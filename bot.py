import os
import json
import logging
import random
import string
from datetime import datetime, timedelta
from flask import Flask, request
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

BOT_TOKEN = os.environ.get('BOT_TOKEN')
CHANNEL_ID = -1003906912233
ADMIN_ID = int(os.environ.get('ADMIN_ID', '0'))
PAYME_NUMBER = '+998913968946'
BASE_URL = f'https://api.telegram.org/bot{BOT_TOKEN}'

# In-memory storage
products = {}    # product_id -> product data
groups = {}      # product_id -> list of user_ids
orders = {}      # order_code -> order data
seller_state = {}  # user_id -> state

def api(method, data):
    r = requests.post(f'{BASE_URL}/{method}', json=data)
    return r.json()

def send(chat_id, text, keyboard=None, parse_mode='HTML'):
    data = {'chat_id': chat_id, 'text': text, 'parse_mode': parse_mode}
    if keyboard:
        data['reply_markup'] = json.dumps(keyboard)
    return api('sendMessage', data)

def send_photo(chat_id, photo, caption, keyboard=None):
    data = {'chat_id': chat_id, 'photo': photo, 'caption': caption, 'parse_mode': 'HTML'}
    if keyboard:
        data['reply_markup'] = json.dumps(keyboard)
    return api('sendPhoto', data)

def edit_caption(chat_id, msg_id, caption, keyboard=None):
    data = {'chat_id': chat_id, 'message_id': msg_id, 'caption': caption, 'parse_mode': 'HTML'}
    if keyboard:
        data['reply_markup'] = json.dumps(keyboard)
    api('editMessageCaption', data)

def answer_cb(cb_id, text, alert=True):
    api('answerCallbackQuery', {'callback_query_id': cb_id, 'text': text, 'show_alert': alert})

def gen_code(product_id):
    chars = string.ascii_uppercase + string.digits
    suffix = ''.join(random.choices(chars, k=6))
    return f'JS-{suffix}'

def progress_bar(count, min_g):
    bar = '🟢' * count + '⚪️' * (min_g - count)
    return bar

def post_caption(p, product_id):
    joined = groups.get(product_id, [])
    count = len(joined)
    min_g = p['min_group']
    needed = max(0, min_g - count)
    bar = progress_bar(count, min_g)
    status = '🔥 FAOL' if count < min_g else '✅ GURUH TO\'LDI'

    return (
        f"<b>{p['name']}</b>\n\n"
        f"💰 <s>{p['original_price']:,} so'm</s>  →  "
        f"<b>🏷 {p['group_price']:,} so'm</b>\n"
        f"📉 Tejash: <b>{p['original_price'] - p['group_price']:,} so'm</b>\n\n"
        f"👥 Guruh: <b>{count}/{min_g}</b> kishi  {status}\n"
        f"{bar}\n\n"
        f"⏳ Kerak: <b>{needed} kishi</b>\n\n"
        f"🏪 <b>{p['shop_name']}</b>\n"
        f"📝 {p['description']}"
    )

def join_keyboard(product_id, count, min_g):
    if count < min_g:
        text = f"🛒 Qo'shilish ({count}/{min_g})"
    else:
        text = f"✅ To'ldi! Buyurtma bering"
    return {'inline_keyboard': [[{'text': text, 'callback_data': f'join_{product_id}'}]]}

@app.route('/webhook', methods=['POST'])
def webhook():
    data = request.json
    if 'callback_query' in data:
        handle_callback(data['callback_query'])
    elif 'message' in data:
        handle_message(data['message'])
    return 'ok'

def handle_callback(cb):
    cb_id = cb['id']
    user = cb['from']
    user_id = user['id']
    user_name = user.get('first_name', 'Foydalanuvchi')
    cb_data = cb['data']
    msg_id = cb['message']['message_id']

    # Join product
    if cb_data.startswith('join_'):
        product_id = cb_data.replace('join_', '')

        if product_id not in products:
            answer_cb(cb_id, '❌ Mahsulot topilmadi!')
            return

        p = products[product_id]

        if product_id not in groups:
            groups[product_id] = []

        if user_id in groups[product_id]:
            answer_cb(cb_id, '✅ Siz allaqachon guruhdasiz!')
            return

        # Show payment info
        order_code = gen_code(product_id)
        deadline = datetime.now() + timedelta(hours=48)

        orders[order_code] = {
            'product_id': product_id,
            'user_id': user_id,
            'user_name': user_name,
            'amount': p['group_price'],
            'status': 'pending',
            'created': datetime.now().strftime('%d.%m.%Y %H:%M'),
            'deadline': deadline.strftime('%d.%m.%Y %H:%M'),
            'channel_msg_id': msg_id
        }

        answer_cb(cb_id, '📋 To\'lov ma\'lumotlari yuborildi!', alert=False)

        send(user_id,
            f"🛒 <b>Buyurtma #{order_code}</b>\n\n"
            f"📦 <b>{p['name']}</b>\n"
            f"💰 Summa: <b>{p['group_price']:,} so'm</b>\n\n"
            f"━━━━━━━━━━━━━━━\n"
            f"💳 <b>Payme orqali to'lang:</b>\n\n"
            f"📱 Raqam: <code>{PAYME_NUMBER}</code>\n"
            f"💵 Summa: <code>{p['group_price']:,}</code>\n"
            f"📝 Izoh: <code>{order_code}</code>\n\n"
            f"⚠️ <b>MUHIM:</b> Izohga albatta <b>{order_code}</b> yozing!\n"
            f"━━━━━━━━━━━━━━━\n\n"
            f"⏰ Muddat: <b>{deadline.strftime('%d.%m.%Y %H:%M')}</b>\n\n"
            f"✅ To'lovdan so'ng tugmani bosing:",
            keyboard={'inline_keyboard': [
                [{'text': "✅ To'lovni tasdiqlayman", 'callback_data': f'paid_{order_code}'}],
                [{'text': "❌ Bekor qilish", 'callback_data': f'cancel_{order_code}'}]
            ]}
        )

    # Payment confirmed by user
    elif cb_data.startswith('paid_'):
        order_code = cb_data.replace('paid_', '')

        if order_code not in orders:
            answer_cb(cb_id, '❌ Buyurtma topilmadi!')
            return

        order = orders[order_code]

        if order['status'] != 'pending':
            answer_cb(cb_id, '⚠️ Bu buyurtma allaqachon qayta ishlangan!')
            return

        orders[order_code]['status'] = 'confirming'
        answer_cb(cb_id, '⏳ Admin tasdiqlamoqda...', alert=False)

        send(user_id,
            f"⏳ <b>To'lovingiz tekshirilmoqda</b>\n\n"
            f"Buyurtma: <b>#{order_code}</b>\n"
            f"15 daqiqa ichida tasdiqlanadi.\n\n"
            f"Savollar uchun: @joynshop_support"
        )

        # Notify admin
        if ADMIN_ID:
            send(ADMIN_ID,
                f"🔔 <b>YANGI TO'LOV!</b>\n\n"
                f"Buyurtma: <b>#{order_code}</b>\n"
                f"Mahsulot: {products[order['product_id']]['name']}\n"
                f"Xaridor: {order['user_name']} (ID: {user_id})\n"
                f"Summa: <b>{order['amount']:,} so'm</b>\n"
                f"Vaqt: {order['created']}\n\n"
                f"Payme raqam: {PAYME_NUMBER}\n"
                f"Izoh kodi: <b>{order_code}</b>",
                keyboard={'inline_keyboard': [
                    [
                        {'text': "✅ Tasdiqlash", 'callback_data': f'admin_confirm_{order_code}'},
                        {'text': "❌ Rad etish", 'callback_data': f'admin_reject_{order_code}'}
                    ]
                ]}
            )

    # Cancel order
    elif cb_data.startswith('cancel_'):
        order_code = cb_data.replace('cancel_', '')

        if order_code not in orders:
            answer_cb(cb_id, '❌ Buyurtma topilmadi!')
            return

        orders[order_code]['status'] = 'cancelled'
        answer_cb(cb_id, '❌ Buyurtma bekor qilindi', alert=False)
        send(user_id, f"❌ <b>Buyurtma #{order_code} bekor qilindi.</b>\n\nYangi xarid uchun kanalimizga qaytib keling:\n@joynshop_uz")

    # Admin confirm
    elif cb_data.startswith('admin_confirm_'):
        order_code = cb_data.replace('admin_confirm_', '')

        if order_code not in orders:
            answer_cb(cb_id, '❌ Buyurtma topilmadi!')
            return

        order = orders[order_code]
        product_id = order['product_id']
        buyer_id = order['user_id']

        orders[order_code]['status'] = 'confirmed'

        # Add to group
        if product_id not in groups:
            groups[product_id] = []

        if buyer_id not in groups[product_id]:
            groups[product_id].append(buyer_id)

        count = len(groups[product_id])
        p = products[product_id]
        min_g = p['min_group']

        answer_cb(cb_id, f'✅ Tasdiqlandi! Guruh: {count}/{min_g}', alert=False)

        # Update channel post
        caption = post_caption(p, product_id)
        keyboard = join_keyboard(product_id, count, min_g)
        edit_caption(CHANNEL_ID, p['channel_message_id'], caption, keyboard)

        # Notify buyer
        send(buyer_id,
            f"🎉 <b>To'lovingiz tasdiqlandi!</b>\n\n"
            f"Buyurtma: <b>#{order_code}</b>\n"
            f"Mahsulot: <b>{p['name']}</b>\n"
            f"Guruh: <b>{count}/{min_g}</b> kishi\n\n"
            f"Guruh to'lganda yetkazib berish haqida xabar beramiz! 🔔"
        )

        # Check if group complete
        if count >= min_g:
            for uid in groups[product_id]:
                send(uid,
                    f"🔥 <b>GURUH TO'LDI!</b>\n\n"
                    f"<b>{p['name']}</b>\n"
                    f"💰 Narx: <b>{p['group_price']:,} so'm</b>\n\n"
                    f"📞 Sotuvchi siz bilan bog'lanadi: {p.get('contact', '@joynshop_support')}\n\n"
                    f"✅ Buyurtmangiz uchun rahmat!"
                )

    # Admin reject
    elif cb_data.startswith('admin_reject_'):
        order_code = cb_data.replace('admin_reject_', '')

        if order_code not in orders:
            answer_cb(cb_id, '❌ Buyurtma topilmadi!')
            return

        order = orders[order_code]
        orders[order_code]['status'] = 'rejected'

        answer_cb(cb_id, '❌ Rad etildi', alert=False)

        send(order['user_id'],
            f"❌ <b>To'lovingiz tasdiqlanmadi</b>\n\n"
            f"Buyurtma: <b>#{order_code}</b>\n\n"
            f"Sabab: To'lov izohida kod topilmadi.\n\n"
            f"Qayta urinib ko'ring yoki yordam uchun:\n@joynshop_support"
        )

def handle_message(msg):
    chat_id = msg['chat']['id']
    user_id = msg['from']['id']
    text = msg.get('text', '')

    # Admin commands
    if user_id == ADMIN_ID:
        if text == '/orders':
            if not orders:
                send(chat_id, '📋 Hozircha buyurtma yo\'q.')
                return
            result = "📋 <b>Barcha buyurtmalar:</b>\n\n"
            for code, o in list(orders.items())[-10:]:
                emoji = {'pending': '⏳', 'confirming': '🔄', 'confirmed': '✅', 'rejected': '❌', 'cancelled': '🚫'}.get(o['status'], '❓')
                result += f"{emoji} #{code} — {o['amount']:,} so'm — {o['status']}\n"
            send(chat_id, result)
            return

        if text == '/pending':
            pending = {k: v for k, v in orders.items() if v['status'] == 'confirming'}
            if not pending:
                send(chat_id, '✅ Tasdiqlanmagan buyurtma yo\'q.')
                return
            for code, o in pending.items():
                p = products.get(o['product_id'], {})
                send(chat_id,
                    f"⏳ <b>#{code}</b>\n"
                    f"Mahsulot: {p.get('name', '?')}\n"
                    f"Xaridor: {o['user_name']}\n"
                    f"Summa: {o['amount']:,} so'm",
                    keyboard={'inline_keyboard': [[
                        {'text': '✅ Tasdiqlash', 'callback_data': f'admin_confirm_{code}'},
                        {'text': '❌ Rad', 'callback_data': f'admin_reject_{code}'}
                    ]]}
                )
            return

        if text == '/stats':
            total = len(orders)
            confirmed = sum(1 for o in orders.values() if o['status'] == 'confirmed')
            pending = sum(1 for o in orders.values() if o['status'] in ['pending', 'confirming'])
            revenue = sum(o['amount'] for o in orders.values() if o['status'] == 'confirmed')
            send(chat_id,
                f"📊 <b>Statistika:</b>\n\n"
                f"📦 Jami buyurtma: {total}\n"
                f"✅ Tasdiqlangan: {confirmed}\n"
                f"⏳ Kutayotgan: {pending}\n"
                f"💰 Jami daromad: {revenue:,} so'm"
            )
            return

    # /start
    if text == '/start':
        send(chat_id,
            "👋 <b>Joynshop ga xush kelibsiz!</b>\n\n"
            "🛍 Birgalikda xarid qiling — 40% gacha tejang!\n\n"
            "📢 Kanalimiz: @joynshop_uz\n\n"
            "<b>Sotuvchi bo'lish uchun:</b>\n"
            "/addproduct — Mahsulot qo'shish\n\n"
            "<b>Buyurtmalarim:</b>\n"
            "/mystatus — Buyurtma holati"
        )
        return

    # /mystatus
    if text == '/mystatus':
        my_orders = {k: v for k, v in orders.items() if v['user_id'] == user_id}
        if not my_orders:
            send(chat_id, '📋 Sizda hozircha buyurtma yo\'q.\n\n@joynshop_uz kanalidan xarid qiling!')
            return
        result = "📋 <b>Sizning buyurtmalaringiz:</b>\n\n"
        status_emoji = {'pending': '⏳', 'confirming': '🔄', 'confirmed': '✅', 'rejected': '❌', 'cancelled': '🚫'}
        status_text = {'pending': 'To\'lov kutilmoqda', 'confirming': 'Tekshirilmoqda', 'confirmed': 'Tasdiqlandi', 'rejected': 'Rad etildi', 'cancelled': 'Bekor qilindi'}
        for code, o in my_orders.items():
            emoji = status_emoji.get(o['status'], '❓')
            s_text = status_text.get(o['status'], o['status'])
            p = products.get(o['product_id'], {})
            result += f"{emoji} <b>#{code}</b>\n{p.get('name', '?')} — {o['amount']:,} so'm\nHolat: {s_text}\n\n"
        send(chat_id, result)
        return

    # /addproduct
    if text == '/addproduct':
        seller_state[user_id] = {'step': 'name'}
        send(chat_id,
            "📦 <b>Yangi mahsulot qo'shish</b>\n\n"
            "1️⃣ Mahsulot nomini yozing:\n"
            "<i>Masalan: Nike Air Max 270</i>"
        )
        return

    # Seller flow
    if user_id in seller_state:
        state = seller_state[user_id]
        step = state.get('step')

        if step == 'name':
            state['name'] = text
            state['step'] = 'shop_name'
            send(chat_id, "2️⃣ Do'kon nomingizni yozing:\n<i>Masalan: Nike Toshkent</i>")

        elif step == 'shop_name':
            state['shop_name'] = text
            state['step'] = 'description'
            send(chat_id, "3️⃣ Mahsulot tavsifini yozing:")

        elif step == 'description':
            state['description'] = text
            state['step'] = 'original_price'
            send(chat_id, "4️⃣ Asl narxini yozing (so'mda):\n<i>Masalan: 850000</i>")

        elif step == 'original_price':
            try:
                state['original_price'] = int(text.replace(' ', '').replace(',', ''))
                state['step'] = 'group_price'
                send(chat_id, "5️⃣ Guruh narxini yozing (so'mda):\n<i>Masalan: 550000</i>")
            except:
                send(chat_id, "❌ Faqat raqam kiriting!")

        elif step == 'group_price':
            try:
                state['group_price'] = int(text.replace(' ', '').replace(',', ''))
                state['step'] = 'min_group'
                send(chat_id, "6️⃣ Minimal guruh sonini yozing (2-10):")
            except:
                send(chat_id, "❌ Faqat raqam kiriting!")

        elif step == 'min_group':
            try:
                min_g = int(text)
                if min_g < 2 or min_g > 10:
                    send(chat_id, "❌ 2 dan 10 gacha raqam kiriting!")
                    return
                state['min_group'] = min_g
                state['step'] = 'photo'
                send(chat_id, "7️⃣ Mahsulot rasmini yuboring 📸")
            except:
                send(chat_id, "❌ Faqat raqam kiriting!")

        elif step == 'photo':
            photo = msg.get('photo')
            if photo:
                state['photo_id'] = photo[-1]['file_id']
                state['step'] = 'contact'
                send(chat_id, "8️⃣ Aloqa ma'lumotingizni yozing:\n<i>Masalan: @username yoki +998901234567</i>")
            else:
                send(chat_id, "❌ Iltimos rasm yuboring!")

        elif step == 'contact':
            state['contact'] = text

            product_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))

            products[product_id] = {
                'name': state['name'],
                'shop_name': state['shop_name'],
                'description': state['description'],
                'original_price': state['original_price'],
                'group_price': state['group_price'],
                'min_group': state['min_group'],
                'photo_id': state['photo_id'],
                'contact': state['contact'],
                'channel_message_id': None
            }
            groups[product_id] = []

            caption = post_caption(products[product_id], product_id)
            keyboard = join_keyboard(product_id, 0, state['min_group'])

            result = requests.post(f'{BASE_URL}/sendPhoto', json={
                'chat_id': CHANNEL_ID,
                'photo': state['photo_id'],
                'caption': caption,
                'parse_mode': 'HTML',
                'reply_markup': json.dumps(keyboard)
            }).json()

            if result.get('ok'):
                products[product_id]['channel_message_id'] = result['result']['message_id']
                del seller_state[user_id]
                send(chat_id,
                    f"✅ <b>Mahsulot e'lon qilindi!</b>\n\n"
                    f"📢 @joynshop_uz\n"
                    f"🆔 ID: <code>{product_id}</code>"
                )
            else:
                send(chat_id, f"❌ Xato: {result.get('description', 'Noma\'lum xato')}")
                del seller_state[user_id]

@app.route('/', methods=['GET'])
def index():
    return 'Joynshop Bot ishlayapti! 🚀'

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
