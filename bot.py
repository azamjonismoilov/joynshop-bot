import os, json, logging, random, string, threading, time, requests
from datetime import datetime, timedelta
from flask import Flask, request

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)

# ─── TOKENS & CONFIG ────────────────────────────────────────────────
SELLER_TOKEN  = os.environ.get('SELLER_TOKEN')
BUYER_TOKEN   = os.environ.get('BUYER_TOKEN')
ADMIN_ID      = int(os.environ.get('ADMIN_ID', '0'))
PAYME_NUMBER  = os.environ.get('PAYME_NUMBER', '+998913968946')
CHANNEL_ID    = os.environ.get('CHANNEL_ID', '@joynshop_uz')
CHAT_ID       = os.environ.get('CHAT_ID', '@joynshop_chat')
COMMISSION_RATE = 0.05  # 5%

# ─── SHARED STORAGE ─────────────────────────────────────────────────
products       = {}
groups         = {}
orders         = {}
wishlists      = {}
buyer_profiles = {}
refund_requests= {}
seller_state   = {}
seller_products= {}
onboarding_step= {}

# ─── HELPERS ────────────────────────────────────────────────────────
def api(method, data, token=None):
    url = f'https://api.telegram.org/bot{token or BUYER_TOKEN}/{method}'
    return requests.post(url, json=data).json()

def send(cid, text, kb=None, parse_mode='HTML', token=None):
    d = {'chat_id': cid, 'text': text, 'parse_mode': parse_mode}
    if kb: d['reply_markup'] = json.dumps(kb)
    return api('sendMessage', d, token)

def send_seller(cid, text, kb=None):
    return send(cid, text, kb, token=SELLER_TOKEN)

def send_buyer(cid, text, kb=None):
    return send(cid, text, kb, token=BUYER_TOKEN)

def edit_msg(cid, mid, text, kb=None):
    d = {'chat_id': cid, 'message_id': mid, 'text': text, 'parse_mode': 'HTML'}
    if kb: d['reply_markup'] = json.dumps(kb)
    api('editMessageText', d)

def edit_caption(cid, mid, caption, kb=None):
    d = {'chat_id': cid, 'message_id': mid, 'caption': caption, 'parse_mode': 'HTML'}
    if kb: d['reply_markup'] = json.dumps(kb)
    api('editMessageCaption', d)

def answer_cb(cbid, text='', alert=False, token=None):
    api('answerCallbackQuery', {'callback_query_id': cbid, 'text': text, 'show_alert': alert}, token)

def fmt(n):
    return f"{int(n):,}"

def gen_code():
    return 'JS-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def bar(count, min_g):
    return '🟢' * count + '⚪️' * (min_g - count)

# ─── POST CAPTION ────────────────────────────────────────────────────
def post_caption(p, pid):
    count = len(groups.get(pid, []))
    min_g = p['min_group']
    status = '🔥 FAOL' if count < min_g else "✅ GURUH TO'LDI"
    return (
        f"<b>{p['name']}</b>\n\n"
        f"💰 <s>{p['original_price']:,} so'm</s> → <b>🏷 {p['group_price']:,} so'm</b>\n"
        f"📉 Tejash: <b>{p['original_price']-p['group_price']:,} so'm</b>\n\n"
        f"👥 Guruh: <b>{count}/{min_g}</b> {status}\n{bar(count, min_g)}\n\n"
        f"⏳ Kerak: <b>{max(0, min_g-count)} kishi</b>\n"
        f"🕐 Muddat: <b>{p.get('deadline', '')}</b>\n\n"
        f"🏪 <b>{p['shop_name']}</b>\n📝 {p['description']}"
    )

def join_kb(pid, count, min_g):
    txt = f"🛒 Qo'shilish ({count}/{min_g})" if count < min_g else "✅ To'ldi!"
    return {'inline_keyboard': [[{'text': txt, 'callback_data': f'join_{pid}'}]]}

# ─── CHEK ────────────────────────────────────────────────────────────
def build_check(order_code, order):
    p = products.get(order['product_id'], {})
    shop = p.get('shop_name', 'Sotuvchi')
    sale_type = '👤 Yakka' if order.get('type') == 'solo' else '👥 Guruh'
    return (
        f"🧾 <b>JOYNSHOP CHEKI</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"🏪 {shop}\n"
        f"📦 {p.get('name', '')}\n"
        f"🛒 {sale_type} sotuv\n"
        f"💰 {fmt(order['amount'])} so'm\n"
        f"📅 {order.get('created', '')}\n"
        f"🆔 #{order_code}\n"
        f"━━━━━━━━━━━━━━━\n"
        f"✅ <b>Tasdiqlandi</b>\n"
        f"🔒 Joynshop kafolati ostida"
    )

# ─── XARIDOR PROFILI ─────────────────────────────────────────────────
def get_profile(uid):
    if uid not in buyer_profiles:
        buyer_profiles[uid] = {
            'total_orders': 0, 'total_saved': 0,
            'groups_joined': 0, 'cashback': 0, 'referrals': 0
        }
    return buyer_profiles[uid]

def update_profile(uid, amount, original_price, is_group=False):
    p = get_profile(uid)
    p['total_orders'] += 1
    p['total_saved'] += (original_price - amount)
    if is_group: p['groups_joined'] += 1
    p['cashback'] += int(amount * 0.02)

# ─── EXPIRE / REMINDER ───────────────────────────────────────────────
def expire_product(pid):
    p = products.get(pid)
    if not p or p.get('status') == 'closed': return
    products[pid]['status'] = 'closed'
    count = len(groups.get(pid, []))

    for uid in groups.get(pid, []):
        try:
            if count >= p['min_group']:
                send_buyer(uid,
                    f"🎉 <b>Guruh to'ldi!</b>\n\n"
                    f"<b>{p['name']}</b>\n"
                    f"📞 Sotuvchi: {p.get('contact')}"
                )
            else:
                send_buyer(uid,
                    f"😔 <b>Guruh to'lmadi</b>\n\n"
                    f"<b>{p['name']}</b>\n"
                    f"💰 To'lovingiz 24 soat ichida qaytariladi.\n\n"
                    f"@joynshop_uz"
                )
        except: pass

    sid = p.get('seller_id')
    if sid:
        if count >= p['min_group']:
            total      = count * p['group_price']
            commission = int(total * COMMISSION_RATE)
            payout     = total - commission

            send_seller(sid,
                f"🎉 <b>Muvaffaqiyat!</b>\n\n"
                f"<b>{p['name']}</b>\n"
                f"👥 {count}/{p['min_group']} kishi qo'shildi!\n\n"
                f"━━━━━━━━━━━━━━━\n"
                f"💰 Jami sotuv: <b>{fmt(total)} so'm</b>\n"
                f"📊 Joynshop komissiyasi (5%): <b>{fmt(commission)} so'm</b>\n"
                f"✅ Sizga to'lanadi: <b>{fmt(payout)} so'm</b>\n"
                f"━━━━━━━━━━━━━━━\n\n"
                f"💳 Karta raqamingizni yuboring,\n"
                f"pul 24 soat ichida o'tkaziladi."
            )
            if ADMIN_ID:
                send_seller(ADMIN_ID,
                    f"💰 <b>To'lov kerak!</b>\n\n"
                    f"📦 {p['name']}\n"
                    f"👤 Sotuvchi ID: <code>{sid}</code>\n"
                    f"💵 O'tkazish kerak: <b>{fmt(payout)} so'm</b>\n"
                    f"📊 Komissiya: <b>{fmt(commission)} so'm</b>"
                )
        else:
            send_seller(sid,
                f"😔 <b>Guruh to'lmadi</b>\n\n"
                f"<b>{p['name']}</b>\n"
                f"👥 {count}/{p['min_group']} kishi\n\n"
                f"Qayta urinib ko'ring: /addproduct"
            )

def reminder_loop():
    while True:
        time.sleep(1800)
        try:
            now = datetime.now()
            for pid, p in list(products.items()):
                if p.get('status') == 'closed': continue
                ddt = p.get('deadline_dt')
                if not ddt: continue
                deadline  = datetime.strptime(ddt, '%Y-%m-%d %H:%M')
                remaining = (deadline - now).total_seconds()
                count     = len(groups.get(pid, []))
                needed    = p['min_group'] - count

                if remaining <= 0:
                    expire_product(pid)
                    continue

                hours = remaining / 3600
                if needed > 0 and (11.5 <= hours <= 12.5 or 1.5 <= hours <= 2.5):
                    msg = (
                        f"⚡️ <b>SHOSHILING!</b>\n\n"
                        f"<b>{p['name']}</b>\n"
                        f"{needed} kishi kerak!\n"
                        f"⏰ {int(hours)} soat qoldi!\n\n"
                        f"Do'stingizni taklif qiling → @joynshop_uz"
                    )
                    for uid in groups.get(pid, []):
                        try: send_buyer(uid, msg)
                        except: pass

                    sid = p.get('seller_id')
                    if sid:
                        send_seller(sid,
                            f"📢 <b>Eslatma!</b>\n\n"
                            f"<b>{p['name']}</b>\n"
                            f"👥 {count}/{p['min_group']} kishi\n"
                            f"⏰ {int(hours)} soat qoldi\n\n"
                            f"Kanalda qayta e'lon qiling:\n/boost {pid}"
                        )
        except Exception as e:
            logging.error(f"Reminder error: {e}")

def live_update_loop():
    while True:
        time.sleep(30)
        try:
            for pid, p in list(products.items()):
                if p.get('status') == 'closed': continue
                cid = p.get('channel_chat_id')
                mid = p.get('channel_message_id')
                if not cid or not mid: continue
                count = len(groups.get(pid, []))
                try:
                    edit_caption(cid, mid,
                        post_caption(p, pid),
                        join_kb(pid, count, p['min_group'])
                    )
                except: pass
        except Exception as e:
            logging.error(f"Live update: {e}")

threading.Thread(target=reminder_loop, daemon=True).start()
threading.Thread(target=live_update_loop, daemon=True).start()

# ─── SPAM MODERATSIYA ────────────────────────────────────────────────
def is_spam(text):
    if not text: return False
    lower = text.lower()
    return lower.count('http') + lower.count('t.me/') > 1

def moderate_chat(msg):
    text = msg.get('text', '')
    cid  = msg['chat']['id']
    mid  = msg['message_id']
    if is_spam(text):
        api('deleteMessage', {'chat_id': cid, 'message_id': mid})
        send_buyer(cid, "⚠️ Spam xabar o'chirildi.")
        return True
    return False

# ══════════════════════════════════════════════════════════════════════
#  SELLER WEBHOOK  →  /seller/webhook
# ══════════════════════════════════════════════════════════════════════
@app.route('/seller/webhook', methods=['POST'])
def seller_webhook():
    data = request.json
    if 'callback_query' in data: seller_handle_cb(data['callback_query'])
    elif 'message'        in data: seller_handle_msg(data['message'])
    return 'ok'

def seller_handle_cb(cb):
    cbid = cb['id']
    uid  = cb['from']['id']
    d    = cb['data']

    if d == 'start_addproduct':
        answer_cb(cbid, token=SELLER_TOKEN)
        seller_state[uid] = {'step': 'name'}
        send_seller(uid, "📦 <b>Yangi mahsulot</b>\n\n1️⃣ Mahsulot nomini yozing:")
        return

    if d.startswith('boost_confirm_'):
        pid = d[14:]
        if pid not in products:
            answer_cb(cbid, '❌ Topilmadi!', token=SELLER_TOKEN)
            return
        p = products[pid]
        if p.get('seller_id') != uid and uid != ADMIN_ID:
            answer_cb(cbid, "❌ Ruxsat yo'q!", token=SELLER_TOKEN)
            return
        count  = len(groups.get(pid, []))
        result = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendPhoto', json={
            'chat_id': CHANNEL_ID, 'photo': p['photo_id'],
            'caption': post_caption(p, pid), 'parse_mode': 'HTML',
            'reply_markup': json.dumps(join_kb(pid, count, p['min_group']))
        }).json()
        if result.get('ok'):
            products[pid]['channel_message_id'] = result['result']['message_id']
            answer_cb(cbid, "✅ Qayta e'lon qilindi!", token=SELLER_TOKEN)
            send_seller(uid, f"📢 <b>{p['name']}</b> qayta e'lon qilindi!\n\n@joynshop_uz")
        else:
            answer_cb(cbid, '❌ Xato!', token=SELLER_TOKEN)

    if d == 'noop':
        answer_cb(cbid, token=SELLER_TOKEN)

def seller_handle_msg(msg):
    cid  = msg['chat']['id']
    uid  = msg['from']['id']
    text = msg.get('text', '')

    # ── ADMIN ──
    if uid == ADMIN_ID:
        if text == '/stats':
            conf = sum(1 for o in orders.values() if o['status'] == 'confirmed')
            rev  = sum(o['amount'] for o in orders.values() if o['status'] == 'confirmed')
            comm = int(rev * COMMISSION_RATE)
            active = sum(1 for p in products.values() if p.get('status') != 'closed')
            send_seller(cid,
                f"📊 <b>Umumiy statistika</b>\n\n"
                f"📦 Aktiv mahsulotlar: {active}\n"
                f"✅ Tasdiqlangan buyurtmalar: {conf}\n"
                f"💰 Jami aylanma: {fmt(rev)} so'm\n"
                f"📊 Joynshop komissiyasi (5%): {fmt(comm)} so'm"
            )
            return

    # ── /start ──
    if text == '/start':
        send_seller(cid,
            "🏪 <b>Joynshop Sotuvchi Paneli</b>\n\n"
            "Guruh savdosi orqali ko'proq soting!\n\n"
            "/addproduct — Mahsulot qo'shish\n"
            "/myproducts — Mahsulotlarim\n"
            "/mystats    — Statistika\n"
            "/help       — Yordam",
            {'inline_keyboard': [[
                {'text': "➕ Mahsulot qo'shish", 'callback_data': 'start_addproduct'}
            ]]}
        )
        return

    # ── /myproducts ──
    if text == '/myproducts':
        my = seller_products.get(uid, [])
        if not my:
            send_seller(cid, "📦 Mahsulot yo'q.\n\n/addproduct — qo'shish")
            return
        r = "📦 <b>Mahsulotlaringiz:</b>\n\n"
        for pid in my:
            p   = products.get(pid, {})
            if not p: continue
            count = len(groups.get(pid, []))
            st  = '🔥 Aktiv' if p.get('status') != 'closed' else '✅ Yopilgan'
            r  += (
                f"━━━━━━━━━━━━━━━\n"
                f"📦 <b>{p.get('name','')}</b>\n"
                f"🆔 <code>{pid}</code>\n"
                f"👥 {count}/{p['min_group']} kishi  {st}\n"
                f"💰 {fmt(p['group_price'])} so'm\n"
                f"🕐 {p.get('deadline', '')}\n\n"
            )
        r += "━━━━━━━━━━━━━━━\n/boost [ID] | /delete [ID]"
        send_seller(cid, r)
        return

    # ── /mystats ──
    if text == '/mystats':
        my = seller_products.get(uid, [])
        if not my:
            send_seller(cid, "📊 Statistika yo'q.\n\n/addproduct — mahsulot qo'shing!")
            return
        total       = len(my)
        active      = sum(1 for pid in my if products.get(pid, {}).get('status') != 'closed')
        completed   = sum(1 for pid in my if len(groups.get(pid, [])) >= products.get(pid, {}).get('min_group', 99))
        total_joined= sum(len(groups.get(pid, [])) for pid in my)
        revenue     = sum(o['amount'] for o in orders.values() if o.get('product_id') in my and o['status'] == 'confirmed')
        commission  = int(revenue * COMMISSION_RATE)
        payout      = revenue - commission
        send_seller(cid,
            f"📊 <b>Sizning statistikangiz:</b>\n\n"
            f"📦 Jami mahsulot: {total}\n"
            f"🔥 Aktiv: {active}\n"
            f"✅ Muvaffaqiyatli guruh: {completed}\n"
            f"👥 Jami qo'shilgan: {total_joined}\n\n"
            f"━━━━━━━━━━━━━━━\n"
            f"💰 Jami sotuv: {fmt(revenue)} so'm\n"
            f"📊 Komissiya (5%): {fmt(commission)} so'm\n"
            f"✅ Sof daromad: {fmt(payout)} so'm\n\n"
            f"/myproducts — batafsil"
        )
        return

    # ── /boost ──
    if text.startswith('/boost'):
        parts = text.split()
        if len(parts) < 2:
            send_seller(cid, "❌ Format: /boost [ID]\nMasalan: /boost abc123")
            return
        pid = parts[1]
        if pid not in products:
            send_seller(cid, '❌ Mahsulot topilmadi!')
            return
        p = products[pid]
        if p.get('seller_id') != uid and uid != ADMIN_ID:
            send_seller(cid, '❌ Bu sizning mahsulotingiz emas!')
            return
        count = len(groups.get(pid, []))
        send_seller(cid,
            f"📢 <b>{p['name']}</b> qayta e'lon qilasizmi?\n\n"
            f"👥 Hozir: {count}/{p['min_group']} kishi\n"
            f"💰 {fmt(p['group_price'])} so'm",
            {'inline_keyboard': [[
                {'text': "✅ E'lon qil", 'callback_data': f'boost_confirm_{pid}'},
                {'text': "❌ Yo'q",      'callback_data': 'noop'}
            ]]}
        )
        return

    # ── /delete ──
    if text.startswith('/delete'):
        parts = text.split()
        if len(parts) < 2:
            send_seller(cid, "❌ Format: /delete [ID]")
            return
        pid = parts[1]
        if pid not in products:
            send_seller(cid, '❌ Topilmadi!')
            return
        p = products[pid]
        if p.get('seller_id') != uid and uid != ADMIN_ID:
            send_seller(cid, "❌ Ruxsat yo'q!")
            return
        products[pid]['status'] = 'closed'
        if uid in seller_products and pid in seller_products[uid]:
            seller_products[uid].remove(pid)
        send_seller(cid, f"✅ <b>{p['name']}</b> o'chirildi.")
        return

    # ── /help ──
    if text == '/help':
        send_seller(cid,
            "ℹ️ <b>Sotuvchi yordam</b>\n\n"
            "/addproduct  — Mahsulot qo'shish\n"
            "/myproducts  — Mahsulotlarim\n"
            "/mystats     — Statistika\n"
            "/boost [ID]  — Qayta e'lon\n"
            "/delete [ID] — O'chirish\n\n"
            "📢 Kanal: @joynshop_uz\n"
            "💬 Yordam: @joynshop_support"
        )
        return

    # ── /addproduct ──
    if text == '/addproduct':
        seller_state[uid] = {'step': 'name'}
        send_seller(cid,
            "📦 <b>Yangi mahsulot qo'shish</b>\n\n"
            "1️⃣ Mahsulot nomini yozing:\n"
            "<i>Masalan: Nike Air Max 270</i>"
        )
        return

    # ── SELLER FLOW ──
    if uid in seller_state:
        s    = seller_state[uid]
        step = s.get('step')

        if step == 'name':
            s['name'] = text
            s['step'] = 'shop_name'
            send_seller(cid, "2️⃣ Do'kon nomingiz:\n<i>Masalan: Nike Toshkent</i>")

        elif step == 'shop_name':
            s['shop_name'] = text
            s['step']      = 'description'
            send_seller(cid, "3️⃣ Mahsulot tavsifi:")

        elif step == 'description':
            s['description'] = text
            s['step']        = 'original_price'
            send_seller(cid, "4️⃣ Asl narx (so'm):\n<i>Masalan: 850000</i>")

        elif step == 'original_price':
            try:
                s['original_price'] = int(text.replace(' ', '').replace(',', ''))
                s['step']           = 'group_price'
                send_seller(cid, "5️⃣ Guruh narxi (so'm):\n<i>Masalan: 550000</i>")
            except:
                send_seller(cid, "❌ Faqat raqam kiriting!")

        elif step == 'group_price':
            try:
                s['group_price'] = int(text.replace(' ', '').replace(',', ''))
                s['step']        = 'min_group'
                send_seller(cid, "6️⃣ Minimal guruh soni (2-10):")
            except:
                send_seller(cid, "❌ Faqat raqam kiriting!")

        elif step == 'min_group':
            try:
                mg = int(text)
                if mg < 2 or mg > 10:
                    send_seller(cid, "❌ 2 dan 10 gacha!")
                    return
                s['min_group'] = mg
                s['step']      = 'photo'
                send_seller(cid, "7️⃣ Mahsulot rasmini yuboring 📸")
            except:
                send_seller(cid, "❌ Raqam kiriting!")

        elif step == 'photo':
            photo = msg.get('photo')
            if photo:
                s['photo_id'] = photo[-1]['file_id']
                s['step']     = 'contact'
                send_seller(cid, "8️⃣ Aloqa ma'lumotingiz:\n<i>@username yoki +998XXXXXXXXX</i>")
            else:
                send_seller(cid, "❌ Rasm yuboring!")

        elif step == 'contact':
            s['contact'] = text
            pid          = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
            deadline     = datetime.now() + timedelta(hours=48)

            products[pid] = {
                'name':             s['name'],
                'shop_name':        s['shop_name'],
                'description':      s['description'],
                'original_price':   s['original_price'],
                'group_price':      s['group_price'],
                'min_group':        s['min_group'],
                'photo_id':         s['photo_id'],
                'contact':          s['contact'],
                'seller_id':        uid,
                'deadline':         deadline.strftime('%d.%m.%Y %H:%M'),
                'deadline_dt':      deadline.strftime('%Y-%m-%d %H:%M'),
                'channel_message_id': None,
                'status':           'active'
            }
            groups[pid] = []

            if uid not in seller_products:
                seller_products[uid] = []
            seller_products[uid].append(pid)

            caption = post_caption(products[pid], pid)
            kb      = join_kb(pid, 0, s['min_group'])

            result = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendPhoto', json={
                'chat_id':      CHANNEL_ID,
                'photo':        s['photo_id'],
                'caption':      caption,
                'parse_mode':   'HTML',
                'reply_markup': json.dumps(kb)
            }).json()

            if result.get('ok'):
                products[pid]['channel_message_id'] = result['result']['message_id']
                del seller_state[uid]
                send_seller(cid,
                    f"✅ <b>E'lon qilindi!</b>\n\n"
                    f"📦 {s['name']}\n"
                    f"🆔 <code>{pid}</code>\n"
                    f"⏰ {deadline.strftime('%d.%m.%Y %H:%M')}\n\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"📊 /mystats\n"
                    f"📢 /boost {pid}\n"
                    f"🗑 /delete {pid}"
                )
            else:
                del seller_state[uid]
                send_seller(cid, f"❌ Xato: {result.get('description', 'Noma\\'lum')}")

# ══════════════════════════════════════════════════════════════════════
#  BUYER WEBHOOK  →  /buyer/webhook
# ══════════════════════════════════════════════════════════════════════
@app.route('/buyer/webhook', methods=['POST'])
def buyer_webhook():
    data = request.json
    if 'callback_query' in data:
        buyer_handle_cb(data['callback_query'])
    elif 'message' in data:
        msg       = data['message']
        chat_type = msg.get('chat', {}).get('type', '')
        if chat_type in ['group', 'supergroup']:
            moderate_chat(msg)
        else:
            buyer_handle_msg(msg)
    return 'ok'

def buyer_handle_cb(cb):
    cbid = cb['id']
    uid  = cb['from']['id']
    d    = cb['data']

    if d == 'noop':
        answer_cb(cbid)
        return

    # Guruhga qo'shilish
    if d.startswith('join_'):
        pid = d[5:]
        if pid not in products:
            answer_cb(cbid, '❌ Mahsulot topilmadi!')
            return
        p = products[pid]
        if p.get('status') == 'closed':
            answer_cb(cbid, '⛔️ Guruh yopilgan!')
            return
        if pid not in groups: groups[pid] = []
        if uid in groups[pid]:
            answer_cb(cbid, '✅ Allaqachon guruhdasiz!')
            return
        code = gen_code()
        orders[code] = {
            'product_id': pid, 'user_id': uid,
            'user_name':  cb['from'].get('first_name', 'Foydalanuvchi'),
            'amount':     p['group_price'], 'type': 'group',
            'status':     'pending',
            'created':    datetime.now().strftime('%d.%m.%Y %H:%M')
        }
        answer_cb(cbid, "To'lov ma'lumotlari yuborildi!")
        shop = p.get('shop_name', 'Sotuvchi')
        send_buyer(uid,
            f"🛒 <b>{shop} — Guruh buyurtma</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"📦 {p['name']}\n"
            f"💰 {fmt(p['group_price'])} so'm\n\n"
            f"💳 <b>Payme:</b>\n"
            f"📱 <code>{PAYME_NUMBER}</code>\n"
            f"💵 <code>{fmt(p['group_price'])}</code>\n"
            f"📝 Izoh: <code>{code}</code>\n\n"
            f"⚠️ Izohga <b>{code}</b> yozing!\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🔒 Joynshop kafolati ostida",
            {'inline_keyboard': [
                [{'text': "✅ To'lovni tasdiqlayman", 'callback_data': f'paid_{code}'}],
                [{'text': "❌ Bekor",                 'callback_data': f'cancel_{code}'}]
            ]}
        )
        return

    # Yakka sotuv
    if d.startswith('solo_'):
        pid = d[5:]
        if pid not in products:
            answer_cb(cbid, '❌ Topilmadi!')
            return
        p    = products[pid]
        code = gen_code()
        orders[code] = {
            'product_id': pid, 'user_id': uid,
            'user_name':  cb['from'].get('first_name', 'Foydalanuvchi'),
            'amount':     p['solo_price'], 'type': 'solo',
            'status':     'pending',
            'created':    datetime.now().strftime('%d.%m.%Y %H:%M')
        }
        answer_cb(cbid, "To'lov ma'lumotlari yuborildi!")
        shop = p.get('shop_name', 'Sotuvchi')
        send_buyer(uid,
            f"⚡️ <b>{shop} — Yakka buyurtma</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"📦 {p['name']}\n"
            f"💰 {fmt(p['solo_price'])} so'm\n\n"
            f"💳 <b>Payme:</b>\n"
            f"📱 <code>{PAYME_NUMBER}</code>\n"
            f"💵 <code>{fmt(p['solo_price'])}</code>\n"
            f"📝 Izoh: <code>{code}</code>\n\n"
            f"⚠️ Izohga <b>{code}</b> yozing!\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🔒 Joynshop kafolati ostida",
            {'inline_keyboard': [
                [{'text': "✅ To'lovni tasdiqlayman", 'callback_data': f'paid_{code}'}],
                [{'text': "❌ Bekor",                 'callback_data': f'cancel_{code}'}]
            ]}
        )
        return

    # To'lov tasdiqlash
    if d.startswith('paid_'):
        code = d[5:]
        if code not in orders:
            answer_cb(cbid, '❌ Buyurtma topilmadi!')
            return
        o = orders[code]
        if o['status'] != 'pending':
            answer_cb(cbid, '⚠️ Allaqachon yuborilgan!')
            return
        orders[code]['status'] = 'confirming'
        answer_cb(cbid, '⏳ Admin tasdiqlamoqda...')
        send_buyer(uid,
            f"⏳ <b>Tekshirilmoqda</b>\n\n"
            f"Buyurtma: #{code}\n"
            f"15 daqiqa ichida tasdiqlanadi."
        )
        if ADMIN_ID:
            p    = products.get(o['product_id'], {})
            shop = p.get('shop_name', 'Sotuvchi')
            send_buyer(ADMIN_ID,
                f"🔔 <b>YANGI TO'LOV!</b>\n\n"
                f"🏪 {shop}\n"
                f"📦 {p.get('name','')}\n"
                f"👤 {o['user_name']} (ID: {uid})\n"
                f"💰 {fmt(o['amount'])} so'm\n"
                f"🛒 {'Yakka' if o.get('type')=='solo' else 'Guruh'}\n"
                f"🆔 #{code}",
                {'inline_keyboard': [[
                    {'text': '✅ Tasdiqlash', 'callback_data': f'ac_{code}'},
                    {'text': '❌ Rad',        'callback_data': f'ar_{code}'}
                ]]}
            )
        return

    # Bekor
    if d.startswith('cancel_'):
        code = d[7:]
        if code in orders: orders[code]['status'] = 'cancelled'
        answer_cb(cbid, '❌ Bekor qilindi')
        send_buyer(uid, f"❌ #{code} bekor qilindi.\n\n@joynshop_uz")
        return

    # Admin tasdiqlash
    if d.startswith('ac_'):
        code     = d[3:]
        if code not in orders:
            answer_cb(cbid, '❌')
            return
        o        = orders[code]
        pid      = o['product_id']
        buyer_id = o['user_id']
        orders[code]['status'] = 'confirmed'
        p = products.get(pid, {})

        if o.get('type') == 'group':
            if pid not in groups: groups[pid] = []
            if buyer_id not in groups[pid]:
                groups[pid].append(buyer_id)
            count = len(groups[pid])
            min_g = p.get('min_group', 3)
            answer_cb(cbid, f'✅ {count}/{min_g}')
            update_profile(buyer_id, o['amount'], p.get('original_price', o['amount']), True)
            send_buyer(buyer_id, build_check(code, o))
            send_buyer(buyer_id,
                f"🎉 <b>Guruhga qo'shildingiz!</b>\n\n"
                f"👥 Guruh: {count}/{min_g}\n\n"
                f"Guruh to'lganda xabar beramiz! 🔔",
                {'inline_keyboard': [[
                    {'text': "↩️ Qaytarish so'rash", 'callback_data': f'refund_{code}'}
                ]]}
            )
            if count >= min_g:
                for wuid in groups[pid]:
                    try:
                        send_buyer(wuid,
                            f"🔥 <b>GURUH TO'LDI!</b>\n\n"
                            f"🏪 {p.get('shop_name','')}\n"
                            f"📦 {p.get('name','')}\n"
                            f"📞 Sotuvchi: {p.get('contact','')}\n\n"
                            f"✅ Buyurtmangiz uchun rahmat!",
                            {'inline_keyboard': [[
                                {'text': '⭐ Baho bering', 'callback_data': f'rate_start_{pid}'}
                            ]]}
                        )
                    except: pass
        else:
            answer_cb(cbid, '✅ Tasdiqlandi!')
            update_profile(buyer_id, o['amount'], p.get('original_price', o['amount']), False)
            send_buyer(buyer_id, build_check(code, o))
            send_buyer(buyer_id,
                f"✅ <b>Buyurtma tasdiqlandi!</b>\n\n"
                f"📞 Sotuvchi: {p.get('contact','')}\n\n"
                f"Mahsulot yetkazilgandan so'ng:",
                {'inline_keyboard': [[
                    {'text': '⭐ Baho bering', 'callback_data': f'rate_start_{pid}'},
                    {'text': '↩️ Qaytarish',   'callback_data': f'refund_{code}'}
                ]]}
            )
        return

    # Admin rad
    if d.startswith('ar_'):
        code = d[3:]
        if code in orders:
            orders[code]['status'] = 'rejected'
            send_buyer(orders[code]['user_id'],
                f"❌ <b>To'lov tasdiqlanmadi</b>\n\n"
                f"#{code}\n\n"
                f"Izohda kodni tekshiring yoki:\n"
                f"@joynshop_support"
            )
        answer_cb(cbid, '❌ Rad')
        return

    # Reyting
    if d.startswith('rate_start_'):
        pid = d[11:]
        answer_cb(cbid)
        send_buyer(uid, "⭐ Sotuvchiga baho bering:",
            {'inline_keyboard': [[
                {'text': '⭐',     'callback_data': f'rate_{pid}_1'},
                {'text': '⭐⭐',   'callback_data': f'rate_{pid}_2'},
                {'text': '⭐⭐⭐', 'callback_data': f'rate_{pid}_3'},
                {'text': '⭐⭐⭐⭐','callback_data': f'rate_{pid}_4'},
                {'text': '⭐⭐⭐⭐⭐','callback_data': f'rate_{pid}_5'},
            ]]}
        )
        return

    if d.startswith('rate_') and not d.startswith('rate_start_'):
        parts  = d.split('_')
        pid    = parts[1]
        rating = int(parts[2])
        answer_cb(cbid, f"{'⭐'*rating} Baho berildi!")
        p     = products.get(pid, {})
        uname = cb['from'].get('first_name', 'Xaridor')
        try:
            api('sendMessage', {'chat_id': CHAT_ID, 'text': f"{'⭐'*rating} {uname}\n\"{p.get('name','')}\" haqida baho", 'parse_mode': 'HTML'})
        except: pass
        seller_id = p.get('seller_id')
        if seller_id:
            send_seller(seller_id,
                f"⭐ <b>Yangi baho!</b>\n\n"
                f"📦 {p.get('name','')}\n"
                f"{'⭐'*rating} — {uname}"
            )
        send_buyer(uid, "✅ Rahmat! Sharhingiz uchun bonus: +5,000 so'm cashback")
        prof = get_profile(uid)
        prof['cashback'] = prof.get('cashback', 0) + 5000
        return

    # Wishlist
    if d.startswith('save_'):
        pid = d[5:]
        if uid not in wishlists: wishlists[uid] = []
        if pid not in wishlists[uid]:
            wishlists[uid].append(pid)
            answer_cb(cbid, '✅ Wishlistga saqlandi!')
        else:
            answer_cb(cbid, '✅ Allaqachon saqlangan!')
        return

    # Qaytarish
    if d.startswith('refund_') and not d.startswith('refund_reason_'):
        code = d[7:]
        answer_cb(cbid)
        send_buyer(uid, "↩️ <b>Qaytarish sababi:</b>",
            {'inline_keyboard': [
                [{'text': '📦 Mahsulot kelmadi',  'callback_data': f'refund_reason_notarrived_{code}'}],
                [{'text': '😕 Sifat yomon',        'callback_data': f'refund_reason_quality_{code}'}],
                [{'text': '❌ Boshqa sabab',        'callback_data': f'refund_reason_other_{code}'}],
            ]}
        )
        return

    if d.startswith('refund_reason_'):
        parts      = d.replace('refund_reason_', '').split('_')
        reason_map = {'notarrived': 'Mahsulot kelmadi', 'quality': 'Sifat yomon', 'other': 'Boshqa sabab'}
        reason_key = parts[0]
        code       = '_'.join(parts[1:])
        reason     = reason_map.get(reason_key, 'Boshqa')
        refund_requests[code] = {'user_id': uid, 'reason': reason, 'status': 'pending'}
        answer_cb(cbid, "✅ Qaytarish so'rovi yuborildi!")
        send_buyer(uid,
            f"✅ <b>Qaytarish so'rovi yuborildi</b>\n\n"
            f"#{code}\nSabab: {reason}\n\n"
            f"Admin 24 soat ichida ko'rib chiqadi."
        )
        if ADMIN_ID:
            o = orders.get(code, {})
            p = products.get(o.get('product_id',''), {})
            send_buyer(ADMIN_ID,
                f"↩️ <b>QAYTARISH SO'ROVI!</b>\n\n"
                f"#{code}\n📦 {p.get('name','')}\n"
                f"💰 {fmt(o.get('amount',0))} so'm\nSabab: {reason}",
                {'inline_keyboard': [[
                    {'text': '✅ Qaytarish', 'callback_data': f'approve_refund_{code}'},
                    {'text': '❌ Rad',       'callback_data': f'deny_refund_{code}'}
                ]]}
            )
        return

    if d.startswith('approve_refund_'):
        code = d[15:]
        if code in refund_requests:
            refund_requests[code]['status'] = 'approved'
            uid_r = refund_requests[code]['user_id']
            o     = orders.get(code, {})
            send_buyer(uid_r,
                f"✅ <b>Qaytarish tasdiqlandi!</b>\n\n"
                f"#{code}\n"
                f"💰 {fmt(o.get('amount',0))} so'm 24 soat ichida qaytariladi.\n"
                f"Payme: {PAYME_NUMBER}"
            )
        answer_cb(cbid, '✅ Tasdiqlandi')
        return

    if d.startswith('deny_refund_'):
        code = d[12:]
        if code in refund_requests:
            refund_requests[code]['status'] = 'denied'
            uid_r = refund_requests[code]['user_id']
            send_buyer(uid_r,
                f"❌ <b>Qaytarish rad etildi</b>\n\n"
                f"#{code}\nSavollar uchun: @joynshop_support"
            )
        answer_cb(cbid, '❌ Rad')
        return

def buyer_handle_msg(msg):
    cid  = msg['chat']['id']
    uid  = msg['from']['id']
    text = msg.get('text', '')

    # Admin
    if uid == ADMIN_ID:
        if text == '/refunds':
            pending = {k:v for k,v in refund_requests.items() if v['status']=='pending'}
            if not pending:
                send_buyer(cid, "✅ Qaytarish so'rovi yo'q")
                return
            for code, r in pending.items():
                o = orders.get(code, {})
                p = products.get(o.get('product_id',''), {})
                send_buyer(cid,
                    f"↩️ #{code}\n{p.get('name','')}\n{fmt(o.get('amount',0))} so'm\n{r['reason']}",
                    {'inline_keyboard': [[
                        {'text': '✅', 'callback_data': f'approve_refund_{code}'},
                        {'text': '❌', 'callback_data': f'deny_refund_{code}'}
                    ]]}
                )
            return
        if text == '/orders':
            r  = "📋 <b>So'nggi buyurtmalar:</b>\n\n"
            em = {'pending':'⏳','confirming':'🔄','confirmed':'✅','rejected':'❌','cancelled':'🚫'}
            for k, o in list(orders.items())[-10:]:
                r += f"{em.get(o['status'],'?')} #{k} — {fmt(o['amount'])} so'm\n"
            send_buyer(cid, r or "Buyurtma yo'q")
            return

    if text == '/start':
        send_buyer(cid,
            "👋 <b>Joynshop ga xush kelibsiz!</b>\n\n"
            "🛍 Do'stlaringiz bilan xarid qiling — 40% gacha tejang!\n\n"
            "📢 Kanal: @joynshop_uz\n\n"
            "━━━━━━━━━━━━━━━\n"
            "/mystatus  — Buyurtmalarim\n"
            "/myprofile — Profilim\n"
            "/mywishlist — Wishlistim\n"
            "/refund    — Qaytarish\n"
            "/help      — Yordam",
            {'inline_keyboard': [[
                {'text': "📢 Kanalga o'tish", 'url': f'https://t.me/{CHANNEL_ID.lstrip("@")}'}
            ]]}
        )
        return

    if text == '/myprofile':
        p = get_profile(uid)
        send_buyer(cid,
            f"👤 <b>Profilingiz</b>\n\n"
            f"🛒 Jami xaridlar: {p['total_orders']}\n"
            f"💰 Tejagan: {fmt(p['total_saved'])} so'm\n"
            f"👥 Guruhlar: {p['groups_joined']}\n"
            f"🎁 Cashback: {fmt(p['cashback'])} so'm\n"
            f"👫 Referrallar: {p['referrals']}"
        )
        return

    if text == '/mystatus':
        my = {k:v for k,v in orders.items() if v['user_id']==uid}
        if not my:
            send_buyer(cid, "📋 Buyurtma yo'q.\n\n@joynshop_uz")
            return
        r  = "📋 <b>Buyurtmalaringiz:</b>\n\n"
        em = {'pending':'⏳','confirming':'🔄','confirmed':'✅','rejected':'❌','cancelled':'🚫'}
        st = {'pending':"To'lov kutilmoqda",'confirming':'Tekshirilmoqda',
              'confirmed':'Tasdiqlandi','rejected':'Rad','cancelled':'Bekor'}
        for k, o in list(my.items())[-5:]:
            p  = products.get(o['product_id'],{})
            r += f"{em.get(o['status'],'?')} <b>#{k}</b>\n{p.get('name','?')} — {fmt(o['amount'])} so'm\n{st.get(o['status'],'')}\n\n"
        send_buyer(cid, r)
        return

    if text == '/mywishlist':
        wl = wishlists.get(uid, [])
        if not wl:
            send_buyer(cid, "🤍 Wishlist bo'sh.\n\nKanaldan mahsulot saqlang: @joynshop_uz")
            return
        r = "🤍 <b>Wishlistingiz:</b>\n\n"
        for pid in wl:
            p = products.get(pid, {})
            if not p: continue
            count = len(groups.get(pid, []))
            r += f"📦 {p.get('name','')}\n💰 {fmt(p.get('group_price',0))} so'm\n👥 {count}/{p.get('min_group',3)}\n\n"
        send_buyer(cid, r)
        return

    if text == '/refund':
        my = {k:v for k,v in orders.items() if v['user_id']==uid and v['status']=='confirmed'}
        if not my:
            send_buyer(cid, "Qaytarish uchun tasdiqlangan buyurtma yo'q.")
            return
        btns = []
        for k, o in list(my.items())[-5:]:
            p = products.get(o['product_id'],{})
            btns.append([{'text': f"#{k} — {p.get('name','')}", 'callback_data': f'refund_{k}'}])
        send_buyer(cid, "Qaysi buyurtmani qaytarmoqchisiz?\n\n", {'inline_keyboard': btns})
        return

    if text == '/help':
        send_buyer(cid,
            "ℹ️ <b>Yordam</b>\n\n"
            "/mystatus   — Buyurtmalarim\n"
            "/myprofile  — Profilim\n"
            "/mywishlist — Saqlangan mahsulotlar\n"
            "/refund     — Qaytarish so'rovi\n\n"
            "📢 Kanal: @joynshop_uz\n"
            "💬 Guruh: @joynshop_chat\n"
            "🆘 Yordam: @joynshop_support"
        )
        return

# ─── INDEX ───────────────────────────────────────────────────────────
@app.route('/', methods=['GET'])
def index():
    return 'Joynshop Bot ishlayapti! 🏪🛍'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
