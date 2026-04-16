import os
import json
import logging
from flask import Flask, request
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

BOT_TOKEN = os.environ.get('BOT_TOKEN')
CHANNEL_ID = -1003906912233
BASE_URL = f'https://api.telegram.org/bot{BOT_TOKEN}'

# In-memory storage (simple)
products = {}  # product_id -> product data
groups = {}    # product_id -> list of user_ids

def send_message(chat_id, text, reply_markup=None, parse_mode='HTML'):
    data = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': parse_mode
    }
    if reply_markup:
        data['reply_markup'] = json.dumps(reply_markup)
    r = requests.post(f'{BASE_URL}/sendMessage', json=data)
    return r.json()

def send_photo(chat_id, photo_url, caption, reply_markup=None):
    data = {
        'chat_id': chat_id,
        'photo': photo_url,
        'caption': caption,
        'parse_mode': 'HTML'
    }
    if reply_markup:
        data['reply_markup'] = json.dumps(reply_markup)
    r = requests.post(f'{BASE_URL}/sendPhoto', json=data)
    return r.json()

def edit_message_caption(chat_id, message_id, caption, reply_markup=None):
    data = {
        'chat_id': chat_id,
        'message_id': message_id,
        'caption': caption,
        'parse_mode': 'HTML'
    }
    if reply_markup:
        data['reply_markup'] = json.dumps(reply_markup)
    requests.post(f'{BASE_URL}/editMessageCaption', json=data)

def answer_callback(callback_id, text):
    requests.post(f'{BASE_URL}/answerCallbackQuery', json={
        'callback_query_id': callback_id,
        'text': text,
        'show_alert': True
    })

def build_post_caption(p, product_id):
    joined = groups.get(product_id, [])
    count = len(joined)
    min_g = p['min_group']
    max_g = p['max_group']
    needed = max(0, min_g - count)
    
    # Progress bar
    filled = int((count / min_g) * 10) if min_g > 0 else 0
    filled = min(filled, 10)
    bar = '🟢' * filled + '⚪️' * (10 - filled)
    
    status = '🔥 FAOL' if count < min_g else '✅ GURUH TO\'LDI'
    
    caption = (
        f"<b>{p['name']}</b>\n\n"
        f"💰 <s>{p['original_price']:,} so'm</s>  →  "
        f"<b>🏷 {p['group_price']:,} so'm</b>\n"
        f"📉 Tejash: <b>{p['original_price'] - p['group_price']:,} so'm</b>\n\n"
        f"👥 Guruh: <b>{count}/{min_g}</b> kishi  {status}\n"
        f"{bar}\n\n"
        f"⏳ Kerak: <b>{needed} kishi</b>\n"
        f"📦 Min: {min_g} | Max: {max_g} kishi\n\n"
        f"🏪 <b>{p['shop_name']}</b>\n"
        f"📝 {p['description']}"
    )
    return caption

def build_keyboard(product_id, count, min_group):
    if count < min_group:
        btn_text = f"🛒 Qo'shilish ({count}/{min_group})"
    else:
        btn_text = f"✅ To'ldi! Buyurtma bering"
    
    return {
        'inline_keyboard': [[
            {'text': btn_text, 'callback_data': f'join_{product_id}'}
        ]]
    }

# Sotuvchi state
seller_state = {}

@app.route('/webhook', methods=['POST'])
def webhook():
    data = request.json
    
    if 'callback_query' in data:
        handle_callback(data['callback_query'])
    elif 'message' in data:
        handle_message(data['message'])
    
    return 'ok'

def handle_callback(cb):
    query_id = cb['id']
    user = cb['from']
    user_id = user['id']
    user_name = user.get('first_name', 'Foydalanuvchi')
    cb_data = cb['data']
    chat_id = cb['message']['chat']['id']
    message_id = cb['message']['message_id']
    
    if cb_data.startswith('join_'):
        product_id = cb_data.replace('join_', '')
        
        if product_id not in products:
            answer_callback(query_id, '❌ Mahsulot topilmadi!')
            return
        
        p = products[product_id]
        
        if product_id not in groups:
            groups[product_id] = []
        
        if user_id in groups[product_id]:
            answer_callback(query_id, '✅ Siz allaqachon guruhdasiz!')
            return
        
        groups[product_id].append(user_id)
        count = len(groups[product_id])
        min_g = p['min_group']
        
        answer_callback(query_id, f'✅ Guruhga qo\'shildingiz! {count}/{min_g} kishi')
        
        # Update post
        caption = build_post_caption(p, product_id)
        keyboard = build_keyboard(product_id, count, min_g)
        edit_message_caption(CHANNEL_ID, p['channel_message_id'], caption, keyboard)
        
        # Notify user
        send_message(user_id,
            f"🎉 <b>Tabriklaymiz!</b>\n\n"
            f"<b>{p['name']}</b> guruhiga qo'shildingiz!\n\n"
            f"👥 Guruh: {count}/{min_g} kishi\n"
            f"💰 Narx: <b>{p['group_price']:,} so'm</b>\n\n"
            f"Guruh to'lganda sizga xabar beramiz! 🔔"
        )
        
        # Check if group complete
        if count >= min_g:
            for uid in groups[product_id]:
                send_message(uid,
                    f"🔥 <b>GURUH TO'LDI!</b>\n\n"
                    f"<b>{p['name']}</b>\n"
                    f"💰 Narx: <b>{p['group_price']:,} so'm</b>\n\n"
                    f"📞 Sotuvchi: {p['shop_name']}\n"
                    f"To'lov uchun: {p.get('contact', 'Bot orqali bog\'laning')}\n\n"
                    f"✅ Iltimos, to'lovni amalga oshiring!"
                )

def handle_message(msg):
    chat_id = msg['chat']['id']
    user_id = msg['from']['id']
    text = msg.get('text', '')
    
    # /start
    if text == '/start':
        send_message(chat_id,
            "👋 <b>Joynshop botiga xush kelibsiz!</b>\n\n"
            "🛍 Birgalikda xarid qiling — 40% gacha tejang!\n\n"
            "📢 Kanalimiz: @joynshop_uz\n\n"
            "<b>Sotuvchi bo'lish uchun:</b>\n"
            "/addproduct — Mahsulot qo'shish"
        )
        return
    
    # /addproduct
    if text == '/addproduct':
        seller_state[user_id] = {'step': 'name'}
        send_message(chat_id,
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
            send_message(chat_id, "2️⃣ Do'kon nomingizni yozing:\n<i>Masalan: Nike Toshkent</i>")
        
        elif step == 'shop_name':
            state['shop_name'] = text
            state['step'] = 'description'
            send_message(chat_id, "3️⃣ Mahsulot tavsifini yozing:\n<i>Masalan: 41-45 razmer, oq rang</i>")
        
        elif step == 'description':
            state['description'] = text
            state['step'] = 'original_price'
            send_message(chat_id, "4️⃣ Asl narxini yozing (so'mda):\n<i>Masalan: 850000</i>")
        
        elif step == 'original_price':
            try:
                state['original_price'] = int(text.replace(' ', '').replace(',', ''))
                state['step'] = 'group_price'
                send_message(chat_id, "5️⃣ Guruh narxini yozing (so'mda):\n<i>Masalan: 550000</i>")
            except:
                send_message(chat_id, "❌ Faqat raqam kiriting!\n<i>Masalan: 850000</i>")
        
        elif step == 'group_price':
            try:
                state['group_price'] = int(text.replace(' ', '').replace(',', ''))
                state['step'] = 'min_group'
                send_message(chat_id, "6️⃣ Minimal guruh sonini yozing (2-10):\n<i>Masalan: 3</i>")
            except:
                send_message(chat_id, "❌ Faqat raqam kiriting!\n<i>Masalan: 550000</i>")
        
        elif step == 'min_group':
            try:
                min_g = int(text)
                if min_g < 2 or min_g > 10:
                    send_message(chat_id, "❌ 2 dan 10 gacha raqam kiriting!")
                    return
                state['min_group'] = min_g
                state['max_group'] = min_g * 2
                state['step'] = 'photo'
                send_message(chat_id, "7️⃣ Mahsulot rasmini yuboring 📸\n<i>(Rasm yuklang)</i>")
            except:
                send_message(chat_id, "❌ Faqat raqam kiriting!")
        
        elif step == 'photo':
            photo = msg.get('photo')
            if photo:
                state['photo_id'] = photo[-1]['file_id']
                state['step'] = 'contact'
                send_message(chat_id, "8️⃣ Aloqa ma'lumotingizni yozing:\n<i>Masalan: @username yoki +998901234567</i>")
            else:
                send_message(chat_id, "❌ Iltimos rasm yuboring!")
        
        elif step == 'contact':
            state['contact'] = text
            
            # Generate product ID
            import random, string
            product_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
            
            # Save product
            products[product_id] = {
                'name': state['name'],
                'shop_name': state['shop_name'],
                'description': state['description'],
                'original_price': state['original_price'],
                'group_price': state['group_price'],
                'min_group': state['min_group'],
                'max_group': state['max_group'],
                'photo_id': state['photo_id'],
                'contact': state['contact'],
                'channel_message_id': None
            }
            groups[product_id] = []
            
            # Build caption
            caption = build_post_caption(products[product_id], product_id)
            keyboard = build_keyboard(product_id, 0, state['min_group'])
            
            # Post to channel
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
                
                send_message(chat_id,
                    f"✅ <b>Mahsulot muvaffaqiyatli e'lon qilindi!</b>\n\n"
                    f"📢 Kanal: @joynshop_uz\n"
                    f"🆔 ID: <code>{product_id}</code>\n\n"
                    f"Xaridorlar qo'shila boshlashganda xabar olasiz! 🔔"
                )
            else:
                send_message(chat_id, f"❌ Xato: {result.get('description', 'Noma\'lum xato')}")
                del seller_state[user_id]

@app.route('/', methods=['GET'])
def index():
    return 'Joynshop Bot ishlayapti! 🚀'

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
