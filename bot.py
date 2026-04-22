import os, json, logging, random, string, threading, time, requests
from datetime import datetime, timedelta
from flask import Flask, request
import pg8000

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# ─── TOKENS & CONFIG ────────────────────────────────────────────────
SELLER_TOKEN    = os.environ.get('SELLER_TOKEN')
BUYER_TOKEN     = os.environ.get('BUYER_TOKEN')
ADMIN_ID        = int(os.environ.get('ADMIN_ID', '0'))
PAYME_NUMBER    = os.environ.get('PAYME_NUMBER', '+998913968946')
COMMISSION_RATE    = 0.05  # 5%
DASHBOARD_PASSWORD = os.environ.get('DASHBOARD_PASSWORD', 'joynshop2026')
BUYER_BOT_USERNAME = os.environ.get('BUYER_BOT_USERNAME', 'joynshop_bot')
APP_URL            = os.environ.get('APP_URL', '')  # e.g. https://joynshop.uz

def setup_bot_ui():
    """Buyer va Seller botlar uchun menu button va commandlarni o'rnatadi."""
    miniapp_url = f"{APP_URL}/miniapp" if APP_URL else None

    # ── BUYER BOT ──
    if BUYER_TOKEN:
        if miniapp_url:
            requests.post(f'https://api.telegram.org/bot{BUYER_TOKEN}/setChatMenuButton', json={
                'menu_button': {'type': 'web_app', 'text': '🛍 Joynshop', 'web_app': {'url': miniapp_url}}
            })
        requests.post(f'https://api.telegram.org/bot{BUYER_TOKEN}/setMyCommands', json={
            'commands': [
                {'command': 'start',     'description': '🏠 Bosh sahifa'},
                {'command': 'shop',      'description': '🛍 Do\'konga o\'tish'},
                {'command': 'mystatus',  'description': '🛍 Mening buyurtmalarim'},
                {'command': 'myprofile', 'description': '👤 Profilim'},
                {'command': 'feedback',  'description': '✍️ Fikr bildirish'},
                {'command': 'settings',  'description': '⚙️ Sozlamalar'},
            ]
        })

    # ── SELLER BOT ──
    if SELLER_TOKEN:
        requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/setChatMenuButton', json={
            'menu_button': {'type': 'commands'}
        })
        requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/setMyCommands', json={
            'commands': [
                {'command': 'start',      'description': '🏠 Bosh sahifa'},
                {'command': 'addproduct', 'description': '➕ Mahsulot qo\'shish'},
                {'command': 'myproducts', 'description': '📦 Mahsulotlarim'},
                {'command': 'myorders',   'description': '📋 Buyurtmalar'},
                {'command': 'mystats',    'description': '📊 Statistika'},
                {'command': 'mychannels', 'description': '📢 Kanallarim'},
                {'command': 'help',       'description': 'ℹ️ Yordam'},
            ]
        })
    logging.info("Bot UI setup done.")

# ─── SHARED STORAGE ─────────────────────────────────────────────────
products        = {}   # pid -> product info
groups          = {}   # pid -> [user_ids]
orders          = {}   # code -> order info
wishlists       = {}   # uid -> [pids]
buyer_profiles  = {}   # uid -> profile
refund_requests = {}   # code -> refund info
seller_state    = {}   # uid -> step state
seller_products = {}   # uid -> [pids]
verified_channels       = {}  # '@kanal' -> {'owner_id': uid, 'moderators': [uid]}
pending_moderator_codes = {}  # code -> {'channel': '@kanal', 'added_by': uid}
referrals               = {}  # uid -> {'count': 0, 'cashback': 0}  (kim kimni taklif qildi)
referral_map            = {}  # new_uid -> referrer_uid

# ─── PERSISTENCE ────────────────────────────────────────────────────
DATA_FILE = '/data/joynshop_data.json'

def save_data():
    try:
        data = {
            'products':        products,
            'groups':          groups,
            'orders':          orders,
            'wishlists':       wishlists,
            'buyer_profiles':  buyer_profiles,
            'refund_requests': refund_requests,
            'seller_products': {str(k): v for k, v in seller_products.items()},
            'verified_channels': verified_channels,
            'pending_moderator_codes': pending_moderator_codes,
            'referrals':       referrals,
            'referral_map':    {str(k): v for k, v in referral_map.items()},
        }
        tmp = DATA_FILE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, default=str)
        os.replace(tmp, DATA_FILE)
        logging.info(f"Data saved: {len(products)} products, {len(orders)} orders")
    except Exception as e:
        logging.error(f"save_data error: {e}", exc_info=True)

# Old load_data replaced by PostgreSQL version below

# Auto-save every 60 seconds
# autosave loop removed — saving after each webhook request

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
    count     = len(groups.get(pid, []))
    min_g     = p['min_group']
    orig      = p['original_price']
    solo      = p.get('solo_price', 0)
    group     = p['group_price']
    solo_disc = round((orig - solo) / orig * 100) if solo else 0
    grp_disc  = round((orig - group) / orig * 100)
    status    = '🔥' if count < min_g else '✅'
    bar_str   = bar(count, min_g)

    lines = [f"<b>{p['name']}</b>\n"]
    lines.append(f"💰 Asl narx: <s>{fmt(orig)} so'm</s>")
    if solo:
        lines.append(f"👤 Yakka:  <b>{fmt(solo)} so'm</b>  <i>(-{solo_disc}%)</i>")
    lines.append(f"👥 Guruh:  <b>{fmt(group)} so'm</b>  <i>(-{grp_disc}%)</i>")
    lines.append(f"Guruh: {count}/{min_g} {status}")
    lines.append(f"⏳ Kerak: {max(0, min_g - count)} kishi")
    lines.append(f"🕐 {p.get('deadline','')}")
    lines.append(f"\n📝 {p['description']}")
    lines.append(f"\n🏪 <b>{p['shop_name']}</b>  |  📞 {p.get('contact','')}")
    return "\n".join(lines)

def join_kb(pid, count, min_g, has_solo=False):
    if count >= min_g:
        return {'inline_keyboard': [[{'text': "✅ Guruh to'ldi!", 'url': f'https://t.me/{BUYER_BOT_USERNAME}'}]]}
    kb = []
    if has_solo:
        kb.append([{'text': "🛒 Sotib olish (yakka)", 'url': f'https://t.me/{BUYER_BOT_USERNAME}?start=solo_{pid}'}])
    kb.append([{'text': f"👥 Guruhga qo'shilish ({count}/{min_g})", 'url': f'https://t.me/{BUYER_BOT_USERNAME}?start=join_{pid}'}])
    return kb_inline(kb)

def kb_inline(rows):
    return {'inline_keyboard': rows}

# ─── CHEK ────────────────────────────────────────────────────────────
def build_check(order_code, order):
    p         = products.get(order['product_id'], {})
    sale_type    = '👤 Yakka' if order.get('type') == 'solo' else '👥 Guruh'
    variant_line = f"\n🎨 {order['variant']}" if order.get('variant') else ''
    return (
        f"🧾 <b>JOYNSHOP CHEKI</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"🏪 {p.get('shop_name', 'Sotuvchi')}\n"
        f"📦 {p.get('name', '')}{variant_line}\n"
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
    p['total_saved']  += (original_price - amount)
    if is_group: p['groups_joined'] += 1
    p['cashback'] += int(amount * 0.02)

# ─── EXPIRE ──────────────────────────────────────────────────────────
def expire_product(pid):
    p = products.get(pid)
    if not p or p.get('status') == 'closed': return
    products[pid]['status'] = 'closed'
    count = len(groups.get(pid, []))
    sid   = p.get('seller_id')

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
                    f"💰 To'lovingiz 24 soat ichida qaytariladi."
                )
        except: pass

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

# ─── REMINDER & LIVE UPDATE ──────────────────────────────────────────
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
                    for uid in groups.get(pid, []):
                        try:
                            send_buyer(uid,
                                f"⚡️ <b>SHOSHILING!</b>\n\n"
                                f"<b>{p['name']}</b>\n"
                                f"{needed} kishi kerak!\n"
                                f"⏰ {int(hours)} soat qoldi!"
                            )
                        except: pass
                    sid = p.get('seller_id')
                    if sid:
                        send_seller(sid,
                            f"📢 <b>Eslatma!</b>\n\n"
                            f"<b>{p['name']}</b>\n"
                            f"👥 {count}/{p['min_group']} kishi\n"
                            f"⏰ {int(hours)} soat qoldi\n\n"
                            f"Kanalda qayta e'lon qiling: /boost {pid}"
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
                        join_kb(pid, count, p['min_group'], has_solo=bool(p.get('solo_price')))
                    )
                except: pass
        except Exception as e:
            logging.error(f"Live update: {e}")

threading.Thread(target=reminder_loop, daemon=True).start()
threading.Thread(target=live_update_loop, daemon=True).start()

# ─── SPAM ────────────────────────────────────────────────────────────
def is_spam(text):
    if not text: return False
    lower = text.lower()
    return lower.count('http') + lower.count('t.me/') > 1

def moderate_chat(msg):
    cid = msg['chat']['id']
    mid = msg['message_id']
    if is_spam(msg.get('text', '')):
        api('deleteMessage', {'chat_id': cid, 'message_id': mid})
        send_buyer(cid, "⚠️ Spam xabar o'chirildi.")
        return True
    return False

# ══════════════════════════════════════════════════════════════════════
#  SELLER WEBHOOK
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

    if d == 'noop':
        answer_cb(cbid, token=SELLER_TOKEN); return

    if d in ('start_addproduct', 'menu_addproduct'):
        answer_cb(cbid, token=SELLER_TOKEN)
        seller_state[uid] = {'step': 'name'}
        send_seller(uid, "📦 <b>Yangi mahsulot</b>\n\n1️⃣ Mahsulot nomini yozing:")
        return

    if d == 'menu_mystats':
        answer_cb(cbid, token=SELLER_TOKEN)
        my = seller_products.get(uid, [])
        if not my:
            send_seller(uid, "📊 Statistika yo'q.\n\n/addproduct — mahsulot qo'shing!"); return
        revenue    = sum(o['amount'] for o in orders.values() if o.get('product_id') in my and o['status'] == 'confirmed')
        commission = int(revenue * COMMISSION_RATE)
        send_seller(uid,
            f"📊 <b>Sizning statistikangiz:</b>\n\n"
            f"📦 Jami mahsulot: {len(my)}\n"
            f"🔥 Aktiv: {sum(1 for pid in my if products.get(pid,{}).get('status')!='closed')}\n"
            f"✅ Muvaffaqiyatli guruh: {sum(1 for pid in my if len(groups.get(pid,[]))>=products.get(pid,{}).get('min_group',99))}\n"
            f"👥 Jami qo'shilgan: {sum(len(groups.get(pid,[])) for pid in my)}\n\n"
            f"━━━━━━━━━━━━━━━\n"
            f"💰 Jami sotuv: {fmt(revenue)} so'm\n"
            f"📊 Komissiya (5%): {fmt(commission)} so'm\n"
            f"✅ Sof daromad: {fmt(revenue-commission)} so'm",
            {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'back_menu'}]]}
        )
        return

    if d == 'menu_myorders':
        answer_cb(cbid, token=SELLER_TOKEN)
        my_pids = seller_products.get(uid, [])
        pending = {k:v for k,v in orders.items() if v.get('product_id') in my_pids and v['status']=='confirming'}
        if not pending:
            send_seller(uid, "📋 Tasdiqlanmagan buyurtma yo'q.",
                {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'back_menu'}]]}
            ); return
        for code, o in list(pending.items())[-10:]:
            p = products.get(o['product_id'], {})
            send_seller(uid,
                f"🔔 <b>YANGI TO'LOV!</b>\n\n"
                f"📦 {p.get('name','')}\n👤 {o['user_name']}\n"
                f"💰 {fmt(o['amount'])} so'm\n"
                f"🛒 {'Yakka' if o.get('type')=='solo' else 'Guruh'}\n🆔 #{code}",
                {'inline_keyboard': [[
                    {'text': '✅ Tasdiqlash', 'callback_data': f'seller_ac_{code}'},
                    {'text': '❌ Rad',        'callback_data': f'seller_ar_{code}'}
                ]]}
            )
        return

    if d == 'menu_myproducts':
        answer_cb(cbid, token=SELLER_TOKEN)
        my = seller_products.get(uid, [])
        if not my:
            send_seller(uid, "📦 Mahsulot yo'q.",
                {'inline_keyboard': [[{'text': "➕ Qo'shish", 'callback_data': 'menu_addproduct'}]]}
            ); return
        r = "📦 <b>Mahsulotlaringiz:</b>\n\n"
        for pid in my:
            p = products.get(pid, {})
            if not p: continue
            count = len(groups.get(pid, []))
            st    = '🔥 Aktiv' if p.get('status') != 'closed' else '✅ Yopilgan'
            r    += f"━━━━━━━━━━━━━━━\n📦 <b>{p.get('name','')}</b>\n🆔 <code>{pid}</code>\n👥 {count}/{p['min_group']} {st}\n💰 {fmt(p['group_price'])} so'm\n\n"
        r += "━━━━━━━━━━━━━━━\n/boost [ID] | /delete [ID]"
        send_seller(uid, r, {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'back_menu'}]]})
        return

    if d == 'menu_help':
        answer_cb(cbid, token=SELLER_TOKEN)
        send_seller(uid,
            "ℹ️ <b>Sotuvchi yordam</b>\n\n"
            "/addproduct    — Mahsulot qo'shish\n"
            "/myproducts    — Mahsulotlarim\n"
            "/mystats       — Statistika\n"
            "/myorders      — Buyurtmalar\n"
            "/mychannels    — Kanallarim\n"
            "/addmoderator  — Moderator qo'shish\n"
            "/boost [ID]    — Qayta e'lon\n"
            "/delete [ID]   — O'chirish\n\n"
            "💬 Yordam: @joynshop_support",
            {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'back_menu'}]]}
        )
        return

    if d == 'back_menu':
        answer_cb(cbid, token=SELLER_TOKEN)
        send_seller(uid,
            "🏪 <b>Joynshop Sotuvchi Paneli</b>\n\nGuruh savdosi orqali ko'proq soting!",
            {'inline_keyboard': [
                [{'text': "➕ Mahsulot qo'shish", 'callback_data': 'menu_addproduct'}],
                [
                    {'text': "📊 Statistika",    'callback_data': 'menu_mystats'},
                    {'text': "📋 Buyurtmalar",   'callback_data': 'menu_myorders'},
                ],
                [
                    {'text': "📦 Mahsulotlarim", 'callback_data': 'menu_myproducts'},
                    {'text': "❓ Yordam",         'callback_data': 'menu_help'},
                ],
            ]}
        )
        return

    if d.startswith('boost_confirm_'):
        pid = d[14:]
        if pid not in products:
            answer_cb(cbid, '❌ Topilmadi!', token=SELLER_TOKEN); return
        p = products[pid]
        if p.get('seller_id') != uid and uid != ADMIN_ID:
            answer_cb(cbid, "❌ Ruxsat yo'q!", token=SELLER_TOKEN); return
        count   = len(groups.get(pid, []))
        channel = p.get('seller_channel')
        result  = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendPhoto', json={
            'chat_id': channel, 'photo': p['photo_id'],
            'caption': post_caption(p, pid), 'parse_mode': 'HTML',
            'reply_markup': json.dumps(join_kb(pid, count, p['min_group'], has_solo=bool(p.get('solo_price'))))
        }).json()
        if result.get('ok'):
            products[pid]['channel_message_id'] = result['result']['message_id']
            products[pid]['channel_chat_id']    = channel
            answer_cb(cbid, "✅ Qayta e'lon qilindi!", token=SELLER_TOKEN)
            send_seller(uid, f"📢 <b>{p['name']}</b> qayta e'lon qilindi!")
        else:
            answer_cb(cbid, '❌ Xato! Bot kanalga admin sifatida qo\'shilganmi?', token=SELLER_TOKEN)
        return

    if d.startswith('seller_ac_'):
        code     = d[10:]
        if code not in orders:
            answer_cb(cbid, '❌', token=SELLER_TOKEN); return
        o        = orders[code]
        pid      = o['product_id']
        buyer_id = o['user_id']
        p        = products.get(pid, {})
        orders[code]['status'] = 'confirmed'
        save_data()

        if o.get('type') == 'group':
            if pid not in groups: groups[pid] = []
            if buyer_id not in groups[pid]: groups[pid].append(buyer_id)
            count = len(groups[pid])
            min_g = p.get('min_group', 3)
            save_data()
            answer_cb(cbid, f'✅ {count}/{min_g}', token=SELLER_TOKEN)
            update_profile(buyer_id, o['amount'], p.get('original_price', o['amount']), True)
            send_buyer(buyer_id, build_check(code, o))
            # Yetkazib berish bo'lsa manzil so'ra
            dtype = p.get('delivery_type', 'pickup')
            if dtype == 'deliver':
                send_buyer(buyer_id,
                    f"🚚 <b>Yetkazib berish uchun manzil yuboring</b>\n\n"
                    f"Shahar, tuman, ko'cha, uy raqami\n"
                    f"<i>Masalan: Toshkent, Yunusobod, Amir Temur 108, 15-xonadon</i>"
                )
                get_profile(buyer_id)['awaiting_address'] = code
            ref_link = f"https://t.me/{BUYER_BOT_USERNAME}?start=ref_{buyer_id}"
            send_buyer(buyer_id,
                f"🎉 <b>Guruhga qo'shildingiz!</b>\n\n"
                f"👥 Guruh: {count}/{min_g}\n\nGuruh to'lganda xabar beramiz! 🔔\n\n"
                f"👫 Do'stingizni taklif qiling — +10,000 so'm cashback!",
                {'inline_keyboard': [
                    [{'text': "🔗 Do'stni taklif qilish", 'url': f"https://t.me/share/url?url={ref_link}&text=🛍%20Do'stlarim%20bilan%20birgalikda%20xarid%20qilib%2040%25%20gacha%20tejayapman!%20Sen%20ham%20ulab%20ko'r%20👇"}],
                    [{'text': "↩️ Qaytarish so'rash", 'callback_data': f'refund_{code}'}]
                ]}
            )
            if count >= min_g:
                for wuid in groups[pid]:
                    try:
                        send_buyer(wuid,
                            f"🔥 <b>GURUH TO'LDI!</b>\n\n"
                            f"🏪 {p.get('shop_name','')}\n"
                            f"📦 {p.get('name','')}\n"
                            f"📞 Sotuvchi: {p.get('contact','')}\n\n✅ Buyurtmangiz uchun rahmat!",
                            {'inline_keyboard': [[{'text': '⭐ Baho bering', 'callback_data': f'rate_start_{pid}'}]]}
                        )
                    except: pass
        else:
            answer_cb(cbid, '✅ Tasdiqlandi!', token=SELLER_TOKEN)
            update_profile(buyer_id, o['amount'], p.get('original_price', o['amount']), False)
            send_buyer(buyer_id, build_check(code, o))
            dtype = p.get('delivery_type', 'pickup')
            if dtype == 'deliver':
                send_buyer(buyer_id,
                    f"🚚 <b>Yetkazib berish uchun manzil yuboring</b>\n\n"
                    f"Shahar, tuman, ko'cha, uy raqami\n"
                    f"<i>Masalan: Toshkent, Yunusobod, Amir Temur 108, 15-xonadon</i>"
                )
                get_profile(buyer_id)['awaiting_address'] = code
            send_buyer(buyer_id,
                f"✅ <b>Buyurtma tasdiqlandi!</b>\n\n📞 Sotuvchi: {p.get('contact','')}\n\nMahsulot yetkazilgandan so'ng:",
                {'inline_keyboard': [[
                    {'text': '⭐ Baho bering', 'callback_data': f'rate_start_{pid}'},
                    {'text': '↩️ Qaytarish',   'callback_data': f'refund_{code}'}
                ]]}
            )
        return

    if d.startswith('seller_ar_'):
        code = d[10:]
        if code in orders:
            orders[code]['status'] = 'rejected'
            save_data()
            send_buyer(orders[code]['user_id'],
                f"❌ <b>To'lov tasdiqlanmadi</b>\n\n#{code}\n\nIzohda kodni tekshiring."
            )
        answer_cb(cbid, '❌ Rad', token=SELLER_TOKEN); return

    if d.startswith('seller_approve_refund_'):
        code = d[21:]
        if code in refund_requests:
            refund_requests[code]['status'] = 'approved'
            save_data()
            o = orders.get(code, {})
            send_buyer(refund_requests[code]['user_id'],
                f"✅ <b>Qaytarish tasdiqlandi!</b>\n\n#{code}\n"
                f"💰 {fmt(o.get('amount',0))} so'm 24 soat ichida qaytariladi.\nPayme: {PAYME_NUMBER}"
            )
        answer_cb(cbid, '✅ Tasdiqlandi', token=SELLER_TOKEN); return

    if d.startswith('seller_deny_refund_'):
        code = d[19:]
        if code in refund_requests:
            refund_requests[code]['status'] = 'denied'
            save_data()
            send_buyer(refund_requests[code]['user_id'],
                f"❌ <b>Qaytarish rad etildi</b>\n\n#{code}\nSotuvchi bilan bog'laning."
            )
        answer_cb(cbid, '❌ Rad', token=SELLER_TOKEN); return

    if d in ('variants_yes', 'variants_no'):
        s = seller_state.get(uid)
        if not s:
            answer_cb(cbid, '❌ Jarayon topilmadi!', token=SELLER_TOKEN); return
        answer_cb(cbid, token=SELLER_TOKEN)
        if d == 'variants_yes':
            s['step'] = 'variants_input'
            send_seller(uid,
                "Variantlarni vergul bilan yozing:\n\n"
                "<i>O'lcham uchun: 38, 39, 40, 41, 43</i>\n"
                "<i>Rang uchun: Qizil, Ko'k, Yashil</i>\n"
                "<i>Aralash: S, M, L, XL</i>"
            )
        else:
            s['variants'] = []
            s['step'] = 'min_group'
            send_seller(uid, "6️⃣ Minimal guruh soni (2-10):")
        return

    if d.startswith('delivery_'):
        s = seller_state.get(uid)
        if not s:
            answer_cb(cbid, '❌ Jarayon topilmadi!', token=SELLER_TOKEN); return
        dtype = 'deliver' if d == 'delivery_deliver' else 'pickup'
        s['delivery_type'] = dtype
        s['step'] = 'seller_channel'
        answer_cb(cbid, token=SELLER_TOKEN)
        send_seller(uid,
            f"{'🚚 Sotuvchi yetkazadi' if dtype == 'deliver' else '🏪 Xaridor olib ketadi'} ✅\n\n"
            "9️⃣ Kanalingiz username ini yozing:\n"
            "<i>Masalan: @mening_kanalim</i>\n\n"
            "⚠️ Sotuvchi bot kanalga <b>admin</b> sifatida qo'shilgan bo'lishi kerak!"
        )
        return

    if d.startswith('addmod_ch_'):
        channel = d[10:]
        answer_cb(cbid, token=SELLER_TOKEN)
        if verified_channels.get(channel, {}).get('owner_id') != uid:
            send_seller(uid, "❌ Bu kanal egasi emassiz!"); return
        seller_state[uid] = {'step': 'add_mod_user', 'mod_channel': channel}
        send_seller(uid,
            f"🛡 <b>{channel}</b> uchun moderator qo'shish\n\n"
            f"Moderatorning Telegram @username ini yozing:\n"
            f"<i>Masalan: @username</i>\n\n"
            f"⚠️ U avval seller botni ishga tushirgan bo'lishi kerak!"
        )
        return

    if d == 'confirm_product':
        s = seller_state.get(uid)
        if not s:
            answer_cb(cbid, '❌ Jarayon topilmadi!', token=SELLER_TOKEN); return
        answer_cb(cbid, token=SELLER_TOKEN)
        publish_product(uid, uid, s)
        return

    edit_map = {
        'edit_name':           ('name',           '1️⃣ Yangi mahsulot nomini yozing:'),
        'edit_shop_name':      ('shop_name',       "2️⃣ Yangi do'kon nomini yozing:"),
        'edit_description':    ('description',     '3️⃣ Yangi tavsifni yozing:'),
        'edit_original_price': ('original_price',  '4️⃣ Yangi asl narxni yozing (so\'m):'),
        'edit_group_price':    ('group_price',     '5️⃣ Yangi guruh narxini yozing (so\'m):'),
        'edit_min_group':      ('min_group',       '6️⃣ Yangi minimal guruh sonini yozing (2-10):'),
        'edit_photo':          ('photo',           '7️⃣ Yangi rasmni yuboring 📸'),
        'edit_contact':        ('contact',         "8️⃣ Yangi aloqa ma'lumotini yozing:"),
        'edit_seller_channel': ('seller_channel',  '9️⃣ Yangi kanal username ini yozing:'),
    }
    if d in edit_map:
        s = seller_state.get(uid)
        if not s:
            answer_cb(cbid, '❌ Jarayon topilmadi!', token=SELLER_TOKEN); return
        field, prompt = edit_map[d]
        s['step']       = 'editing'
        s['edit_field'] = field
        seller_state[uid] = s
        answer_cb(cbid, token=SELLER_TOKEN)
        send_seller(uid, prompt)
        return

# ─── CHANNEL HELPERS ────────────────────────────────────────────────
def can_manage_channel(uid, channel):
    """Foydalanuvchi kanalga mahsulot qo'sha oladimi?"""
    ch = verified_channels.get(channel)
    if not ch: return False
    return uid == ch['owner_id'] or uid in ch.get('moderators', [])

def is_channel_admin(uid, channel):
    """Telegram API orqali kanal adminligini tekshirish"""
    try:
        result = requests.post(
            f'https://api.telegram.org/bot{SELLER_TOKEN}/getChatMember',
            json={'chat_id': channel, 'user_id': uid}
        ).json()
        if not result.get('ok'): return False
        status = result['result'].get('status', '')
        return status in ('creator', 'administrator')
    except:
        return False

def gen_mod_code():
    return 'MOD-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def show_confirm(cid, s):
    channel = s.get('seller_channel', '')
    send_seller(cid,
        f"📋 <b>Ma'lumotlarni tekshiring:</b>\n\n"
        f"📦 Mahsulot: <b>{s['name']}</b>\n"
        f"🏪 Do'kon: <b>{s['shop_name']}</b>\n"
        f"📝 Tavsif: {s['description']}\n\n"
        f"💰 Asl narx: <b>{fmt(s['original_price'])} so'm</b>\n"
        f"👤 Yakka narx: <b>{fmt(s.get('solo_price',0)) if s.get('solo_price') else 'Yoq'} so'm</b>\n"
        f"🏷 Guruh narxi: <b>{fmt(s['group_price'])} so'm</b>\n\n"
        f"👥 Minimal guruh: <b>{s['min_group']} kishi</b>\n"
        f"📞 Aloqa: <b>{s['contact']}</b>\n"
        f"{'\n🎨 Variantlar: <b>' + ', '.join(s['variants']) + '</b>' if s.get('variants') else ''}\n"
        f"📢 Kanal: <b>{channel}</b>",
        {'inline_keyboard': [
            [{'text': "✅ To'g'ri, e'lon qil!", 'callback_data': 'confirm_product'}],
            [{'text': "✏️ Nom",         'callback_data': 'edit_name'},
             {'text': "✏️ Do'kon",       'callback_data': 'edit_shop_name'}],
            [{'text': "✏️ Tavsif",       'callback_data': 'edit_description'},
             {'text': "✏️ Asl narx",     'callback_data': 'edit_original_price'}],
            [{'text': "✏️ Guruh narxi",  'callback_data': 'edit_group_price'},
             {'text': "✏️ Min guruh",    'callback_data': 'edit_min_group'}],
            [{'text': "✏️ Rasm",         'callback_data': 'edit_photo'},
             {'text': "✏️ Aloqa",        'callback_data': 'edit_contact'}],
            [{'text': "✏️ Kanal",        'callback_data': 'edit_seller_channel'}],
        ]}
    )

def publish_product(uid, cid, s):
    channel  = s['seller_channel']
    pid      = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    deadline = datetime.now() + timedelta(hours=48)
    products[pid] = {
        'name': s['name'], 'shop_name': s['shop_name'],
        'description': s['description'], 'original_price': s['original_price'],
        'group_price': s['group_price'], 'solo_price': s.get('solo_price', 0),
        'min_group': s['min_group'],
        'photo_id': s['photo_id'], 'contact': s['contact'],
        'delivery_type': s.get('delivery_type', 'pickup'),
        'variants': s.get('variants', []),
        'seller_channel': channel, 'seller_id': uid,
        'deadline': deadline.strftime('%d.%m.%Y %H:%M'),
        'deadline_dt': deadline.strftime('%Y-%m-%d %H:%M'),
        'channel_message_id': None, 'channel_chat_id': None, 'status': 'active'
    }
    groups[pid] = []
    if uid not in seller_products: seller_products[uid] = []
    seller_products[uid].append(pid)
    result = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendPhoto', json={
        'chat_id': channel, 'photo': s['photo_id'],
        'caption': post_caption(products[pid], pid), 'parse_mode': 'HTML',
        'reply_markup': json.dumps(join_kb(pid, 0, s['min_group'], has_solo=bool(s.get('solo_price'))))
    }).json()
    del seller_state[uid]
    if result.get('ok'):
        products[pid]['channel_message_id'] = result['result']['message_id']
        products[pid]['channel_chat_id']    = channel
        save_data()
        send_seller(cid,
            f"✅ <b>E'lon qilindi!</b>\n\n"
            f"📦 {s['name']}\n📢 Kanal: {channel}\n"
            f"🆔 <code>{pid}</code>\n⏰ {deadline.strftime('%d.%m.%Y %H:%M')}\n\n"
            f"━━━━━━━━━━━━━━━\n"
            f"📊 /mystats\n📢 /boost {pid}\n🗑 /delete {pid}"
        )
    else:
        del products[pid]
        seller_products[uid].remove(pid)
        s['step'] = 'confirm'
        seller_state[uid] = s
        send_seller(cid,
            f"❌ Kanalga post qo'yib bo'lmadi!\n\n"
            f"Tekshiring:\n"
            f"• Sotuvchi bot {channel} ga admin sifatida qo'shilganmi?\n"
            f"• Kanal username to'g'rimi?\n\n"
            f"Tahrirlash yoki qayta urinish:"
        )
        show_confirm(cid, s)

def seller_handle_msg(msg):
    cid  = msg['chat']['id']
    uid  = msg['from']['id']
    text = msg.get('text', '')

    if uid == ADMIN_ID and text == '/stats':
        conf   = sum(1 for o in orders.values() if o['status'] == 'confirmed')
        rev    = sum(o['amount'] for o in orders.values() if o['status'] == 'confirmed')
        active = sum(1 for p in products.values() if p.get('status') != 'closed')
        send_seller(cid,
            f"📊 <b>Umumiy statistika</b>\n\n"
            f"📦 Aktiv mahsulotlar: {active}\n"
            f"✅ Tasdiqlangan buyurtmalar: {conf}\n"
            f"💰 Jami aylanma: {fmt(rev)} so'm\n"
            f"📊 Komissiya (5%): {fmt(int(rev*COMMISSION_RATE))} so'm"
        )
        return

    if text == '/start':
        send_seller(cid,
            "🏪 <b>Joynshop Sotuvchi Paneli</b>\n\n"
            "Guruh savdosi orqali ko'proq soting!\n\n"
            "Pastdagi tugmalar orqali boshqaring 👇",
            {'keyboard': [
                [{'text': '➕ Mahsulot qo\'shish'}],
                [{'text': '📦 Mahsulotlarim'}, {'text': '📋 Buyurtmalar'}],
                [{'text': '📊 Statistika'},    {'text': '📢 Kanallarim'}],
            ], 'resize_keyboard': True}
        )
        return

    if text == '/myproducts' or text == '📦 Mahsulotlarim':
        my = seller_products.get(uid, [])
        if not my:
            send_seller(cid, "📦 Mahsulot yo'q.\n\n/addproduct — qo'shish"); return
        r = "📦 <b>Mahsulotlaringiz:</b>\n\n"
        for pid in my:
            p     = products.get(pid, {})
            if not p: continue
            count = len(groups.get(pid, []))
            st    = '🔥 Aktiv' if p.get('status') != 'closed' else '✅ Yopilgan'
            r    += f"━━━━━━━━━━━━━━━\n📦 <b>{p.get('name','')}</b>\n🆔 <code>{pid}</code>\n👥 {count}/{p['min_group']} {st}\n💰 {fmt(p['group_price'])} so'm\n🕐 {p.get('deadline','')}\n\n"
        r += "━━━━━━━━━━━━━━━\n/boost [ID] | /delete [ID]"
        send_seller(cid, r)
        return

    if text == '/mystats' or text == '📊 Statistika':
        my = seller_products.get(uid, [])
        if not my:
            send_seller(cid, "📊 Statistika yo'q.\n\n/addproduct — mahsulot qo'shing!"); return
        revenue    = sum(o['amount'] for o in orders.values() if o.get('product_id') in my and o['status'] == 'confirmed')
        commission = int(revenue * COMMISSION_RATE)
        send_seller(cid,
            f"📊 <b>Sizning statistikangiz:</b>\n\n"
            f"📦 Jami mahsulot: {len(my)}\n"
            f"🔥 Aktiv: {sum(1 for pid in my if products.get(pid,{}).get('status')!='closed')}\n"
            f"✅ Muvaffaqiyatli guruh: {sum(1 for pid in my if len(groups.get(pid,[]))>=products.get(pid,{}).get('min_group',99))}\n"
            f"👥 Jami qo'shilgan: {sum(len(groups.get(pid,[])) for pid in my)}\n\n"
            f"━━━━━━━━━━━━━━━\n"
            f"💰 Jami sotuv: {fmt(revenue)} so'm\n"
            f"📊 Komissiya (5%): {fmt(commission)} so'm\n"
            f"✅ Sof daromad: {fmt(revenue-commission)} so'm"
        )
        return

    if text == '/myorders' or text == '📋 Buyurtmalar':
        my_pids   = seller_products.get(uid, [])
        pending   = {k:v for k,v in orders.items() if v.get('product_id') in my_pids and v['status']=='confirming'}
        if not pending:
            send_seller(cid, "📋 Tasdiqlanmagan buyurtma yo'q."); return
        for code, o in list(pending.items())[-10:]:
            p = products.get(o['product_id'], {})
            send_seller(cid,
                f"🔔 <b>YANGI TO'LOV!</b>\n\n"
                f"📦 {p.get('name','')}\n👤 {o['user_name']}\n"
                f"💰 {fmt(o['amount'])} so'm\n"
                f"🛒 {'Yakka' if o.get('type')=='solo' else 'Guruh'}\n🆔 #{code}",
                {'inline_keyboard': [[
                    {'text': '✅ Tasdiqlash', 'callback_data': f'seller_ac_{code}'},
                    {'text': '❌ Rad',        'callback_data': f'seller_ar_{code}'}
                ]]}
            )
        return

    if text.startswith('/boost'):
        parts = text.split()
        if len(parts) < 2:
            send_seller(cid, "❌ Format: /boost [ID]"); return
        pid = parts[1]
        if pid not in products:
            send_seller(cid, '❌ Topilmadi!'); return
        p = products[pid]
        if p.get('seller_id') != uid and uid != ADMIN_ID:
            send_seller(cid, '❌ Bu sizning mahsulotingiz emas!'); return
        count = len(groups.get(pid, []))
        send_seller(cid,
            f"📢 <b>{p['name']}</b> qayta e'lon qilasizmi?\n\n"
            f"👥 Hozir: {count}/{p['min_group']} kishi\n💰 {fmt(p['group_price'])} so'm",
            {'inline_keyboard': [[
                {'text': "✅ E'lon qil", 'callback_data': f'boost_confirm_{pid}'},
                {'text': "❌ Yo'q",      'callback_data': 'noop'}
            ]]}
        )
        return

    if text.startswith('/delete'):
        parts = text.split()
        if len(parts) < 2:
            send_seller(cid, "❌ Format: /delete [ID]"); return
        pid = parts[1]
        if pid not in products:
            send_seller(cid, '❌ Topilmadi!'); return
        p = products[pid]
        if p.get('seller_id') != uid and uid != ADMIN_ID:
            send_seller(cid, "❌ Ruxsat yo'q!"); return
        products[pid]['status'] = 'closed'
        if uid in seller_products and pid in seller_products[uid]:
            seller_products[uid].remove(pid)
        send_seller(cid, f"✅ <b>{p['name']}</b> o'chirildi.")
        return

    if text == '/help':
        send_seller(cid,
            "ℹ️ <b>Sotuvchi yordam</b>\n\n"
            "/addproduct  — Mahsulot qo'shish\n"
            "/myproducts  — Mahsulotlarim\n"
            "/mystats     — Statistika\n"
            "/myorders    — Buyurtmalar\n"
            "/boost [ID]  — Qayta e'lon\n"
            "/delete [ID] — O'chirish\n\n"
            "💬 Yordam: @joynshop_support"
        )
        return

    if text == '/addproduct' or text == '➕ Mahsulot qo\'shish':
        seller_state[uid] = {'step': 'name'}
        send_seller(cid,
            "📦 <b>Yangi mahsulot qo'shish</b>\n\n"
            "1️⃣ Mahsulot nomini yozing:\n<i>Masalan: Nike Air Max 270</i>"
        )
        return

    if text == '/mychannels' or text == '📢 Kanallarim':
        my_channels = [ch for ch, data in verified_channels.items() if data['owner_id'] == uid or uid in data.get('moderators', [])]
        if not my_channels:
            send_seller(cid,
                "📢 Tasdiqlangan kanal yo'q.\n\n"
                "/addproduct orqali mahsulot qo'shishda kanal tasdiqlanadi."
            )
        else:
            r = "📢 <b>Tasdiqlangan kanallaringiz:</b>\n\n"
            for ch in my_channels:
                data = verified_channels[ch]
                role = "👑 Egasi" if data['owner_id'] == uid else "🛡 Moderator"
                mods = len(data.get('moderators', []))
                r += f"{role} {ch}\n👥 {mods} moderator\n\n"
            send_seller(cid, r)
        return

    if text == '/addmoderator':
        my_channels = [ch for ch, data in verified_channels.items() if data['owner_id'] == uid]
        if not my_channels:
            send_seller(cid, "❌ Siz hech bir kanalning egasi emassiz.\n\nAvval mahsulot qo'shib, kanal tasdiqlang.")
            return
        if len(my_channels) == 1:
            seller_state[uid] = {'step': 'add_mod_user', 'mod_channel': my_channels[0]}
            send_seller(cid,
                f"🛡 <b>{my_channels[0]}</b> uchun moderator qo'shish\n\n"
                f"Moderatorning Telegram @username ini yozing:\n"
                f"<i>Masalan: @username</i>\n\n"
                f"⚠️ U avval seller botni ishga tushirgan bo'lishi kerak!"
            )
        else:
            btns = [[{'text': ch, 'callback_data': f'addmod_ch_{ch}'}] for ch in my_channels]
            send_seller(cid, "Qaysi kanal uchun moderator qo'shmoqchisiz?", {'inline_keyboard': btns})
        return

    # Verifikatsiya kodi kiritish
    # Moderator kodi kiritish
    if text.startswith('MOD-'):
        code = text.strip()
        if code not in pending_moderator_codes:
            send_seller(cid, "❌ Kod topilmadi yoki muddati o'tgan."); return
        data    = pending_moderator_codes[code]
        channel = data['channel']
        if channel in verified_channels:
            if uid not in verified_channels[channel]['moderators']:
                verified_channels[channel]['moderators'].append(uid)
        del pending_moderator_codes[code]
        save_data()
        send_seller(cid,
            f"✅ <b>{channel}</b> kanalida moderator bo'ldingiz!\n\n"
            f"Endi /addproduct orqali mahsulot qo'sha olasiz."
        )
        # Notify owner
        owner_id = verified_channels.get(channel, {}).get('owner_id')
        if owner_id:
            send_seller(owner_id,
                f"🛡 Yangi moderator qo'shildi!\n\n"
                f"Kanal: {channel}\n"
                f"Moderator ID: <code>{uid}</code>"
            )
        return

    if uid in seller_state:
        s    = seller_state[uid]
        step = s.get('step')

        if step == 'add_mod_user':
            username = text if text.startswith('@') else f'@{text}'
            channel  = s.get('mod_channel')
            code     = gen_mod_code()
            pending_moderator_codes[code] = {'channel': channel, 'added_by': uid}
            del seller_state[uid]
            send_seller(cid,
                f"✅ Moderator uchun kod yaratildi!\n\n"
                f"Quyidagi kodni <b>{username}</b> ga yuboring:\n\n"
                f"<code>{code}</code>\n\n"
                f"U seller botga shu kodni yuborishi kerak.\n"
                f"Kod 24 soat amal qiladi."
            )
            return

        if step == 'name':
            s['name'] = text; s['step'] = 'shop_name'
            send_seller(cid, "2️⃣ Do'kon nomingiz:\n<i>Masalan: Nike Toshkent</i>")

        elif step == 'shop_name':
            s['shop_name'] = text; s['step'] = 'description'
            send_seller(cid, "3️⃣ Mahsulot tavsifi:")

        elif step == 'description':
            s['description'] = text; s['step'] = 'original_price'
            send_seller(cid, "4️⃣ Asl narx (so'm):\n<i>Masalan: 850000</i>")

        elif step == 'original_price':
            try:
                s['original_price'] = int(text.replace(' ','').replace(',',''))
                s['step'] = 'group_price'
                send_seller(cid, "5️⃣ Guruh narxi (so'm):\n<i>Masalan: 550000</i>")
            except:
                send_seller(cid, "❌ Faqat raqam kiriting!")

        elif step == 'group_price':
            try:
                s['group_price'] = int(text.replace(' ','').replace(',',''))
                s['step'] = 'solo_price'
                send_seller(cid,
                    "5️⃣b Yakka sotish narxi (so'm):\n"
                    "<i>Masalan: 720000</i>\n\n"
                    "Yakka sotish bo'lmasa /skip yozing"
                )
            except:
                send_seller(cid, "❌ Faqat raqam kiriting!")

        elif step == 'solo_price':
            if text.strip() == '/skip':
                s['solo_price'] = 0
            else:
                try:
                    s['solo_price'] = int(text.replace(' ','').replace(',',''))
                except:
                    send_seller(cid, "❌ Faqat raqam kiriting yoki /skip yozing!"); return
            s['step'] = 'has_variants'
            send_seller(cid,
                "5️⃣c Variantlar bormi? (o'lcham, rang va h.k.)",
                {'inline_keyboard': [
                    [{'text': "✅ Ha, variantlar bor", 'callback_data': 'variants_yes'}],
                    [{'text': "❌ Yo'q, oddiy mahsulot", 'callback_data': 'variants_no'}],
                ]}
            )

        elif step == 'variants_input':
            # Parse variants: "38,39,40,41,43" or "Qizil,Ko'k,Yashil"
            raw = [v.strip() for v in text.replace('،',',').split(',') if v.strip()]
            if not raw:
                send_seller(cid, "❌ Kamida 1 ta variant kiriting!"); return
            s['variants'] = raw
            s['step'] = 'min_group'
            send_seller(cid,
                f"✅ Variantlar: {', '.join(raw)}\n\n"
                f"6️⃣ Minimal guruh soni (2-10):"
            )

        elif step == 'min_group':
            try:
                mg = int(text)
                if mg < 2 or mg > 10:
                    send_seller(cid, "❌ 2 dan 10 gacha!"); return
                s['min_group'] = mg; s['step'] = 'photo'
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
            s['step']    = 'delivery_type'
            send_seller(cid,
                "8️⃣b Yetkazib berish turi:",
                {'inline_keyboard': [
                    [{'text': "🚚 Sotuvchi yetkazadi", 'callback_data': 'delivery_deliver'}],
                    [{'text': "🏪 Xaridor olib ketadi", 'callback_data': 'delivery_pickup'}],
                ]}
            )

        elif step == 'seller_channel':
            channel = text if text.startswith('@') else f'@{text}'
            s['seller_channel'] = channel
            # Kanal verifikatsiya tekshirish
            if can_manage_channel(uid, channel):
                # Allaqachon tasdiqlangan
                s['step'] = 'confirm'
                show_confirm(cid, s)
            else:
                # Telegram API orqali adminligini tekshirish
                send_seller(cid, f"🔍 <b>{channel}</b> adminligi tekshirilmoqda...")
                if is_channel_admin(uid, channel):
                    # Admin tasdiqlandi
                    verified_channels[channel] = {'owner_id': uid, 'moderators': []}
                    save_data()
                    send_seller(cid, f"✅ <b>{channel}</b> tasdiqlandi!")
                    s['step'] = 'confirm'
                    show_confirm(cid, s)
                else:
                    send_seller(cid,
                        f"❌ <b>{channel}</b> kanalining admini emassiz!\n\n"
                        f"Tekshiring:\n"
                        f"• Seller bot kanalga admin sifatida qo'shilganmi?\n"
                        f"• Kanal username to'g'rimi?\n\n"
                        f"Qayta urinish: /addproduct"
                    )

        elif step == 'editing':
            field = s.get('edit_field')
            if field in ('original_price', 'group_price'):
                try:
                    s[field] = int(text.replace(' ','').replace(',',''))
                except:
                    send_seller(cid, "❌ Faqat raqam kiriting!"); return
            elif field == 'min_group':
                try:
                    mg = int(text)
                    if mg < 2 or mg > 10:
                        send_seller(cid, "❌ 2 dan 10 gacha!"); return
                    s[field] = mg
                except:
                    send_seller(cid, "❌ Raqam kiriting!"); return
            elif field == 'photo':
                photo = msg.get('photo')
                if photo:
                    s['photo_id'] = photo[-1]['file_id']
                else:
                    send_seller(cid, "❌ Rasm yuboring!"); return
            elif field == 'seller_channel':
                s[field] = text if text.startswith('@') else f'@{text}'
            else:
                s[field] = text
            s['step'] = 'confirm'
            send_seller(cid, "✅ Yangilandi!")
            show_confirm(cid, s)

# ══════════════════════════════════════════════════════════════════════
#  BUYER WEBHOOK
# ══════════════════════════════════════════════════════════════════════
@app.route('/buyer/webhook', methods=['POST'])
def buyer_webhook():
    data = request.json
    if 'callback_query' in data:
        buyer_handle_cb(data['callback_query'])
    elif 'message' in data:
        msg = data['message']
        if msg.get('chat', {}).get('type', '') in ['group', 'supergroup']:
            moderate_chat(msg)
        else:
            buyer_handle_msg(msg)
    return 'ok'

def delivery_notice(p):
    dtype = p.get('delivery_type', 'pickup')
    if dtype == 'deliver':
        return "🚚 <b>Yetkazib berish:</b> Sotuvchi yetkazadi\nTo'lovdan so'ng manzil so'raladi."
    return "🏪 <b>Olish:</b> Sotuvchi manzilidan olib ketasiz\n📞 " + p.get('contact', '')

def auto_check(code, order, p):
    """Xaridorga darhol avtomatik chek yuborish"""
    dtype = p.get('delivery_type', 'pickup')
    delivery_text = "🚚 Sotuvchi yetkazadi" if dtype == 'deliver' else "🏪 Xaridor olib ketadi"
    send_buyer(order['user_id'],
        f"📋 <b>BUYURTMA QABUL QILINDI</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"🏪 {p.get('shop_name','')}\n"
        f"📦 {p.get('name','')}\n"
        f"🛒 {'Yakka' if order.get('type')=='solo' else 'Guruh'} buyurtma\n"
        f"💰 {fmt(order['amount'])} so'm\n"
        f"📅 {order.get('created','')}\n"
        f"🆔 #{code}\n"
        f"━━━━━━━━━━━━━━━\n"
        f"{delivery_text}\n"
        f"━━━━━━━━━━━━━━━\n"
        f"⏳ Sotuvchi 15 daqiqa ichida tasdiqlaydi\n"
        f"🔒 Joynshop kafolati ostida"
    )

def buyer_handle_cb(cb):
    cbid = cb['id']
    uid  = cb['from']['id']
    d    = cb['data']

    if d == 'noop':
        answer_cb(cbid); return

    # ── BUYER MENU ──
    def buyer_main_menu():
        send_buyer(uid,
            "👋 <b>Joynshop</b>\n\nNimani qilmoqchisiz?",
            {'inline_keyboard': [
                [{'text': "📋 Buyurtmalarim",  'callback_data': 'buyer_mystatus'}],
                [
                    {'text': "👤 Profilim",    'callback_data': 'buyer_myprofile'},
                    {'text': "🤍 Wishlist",    'callback_data': 'buyer_mywishlist'},
                ],
                [
                    {'text': "↩️ Qaytarish",  'callback_data': 'buyer_refund'},
                    {'text': "❓ Yordam",      'callback_data': 'buyer_help'},
                ],
            ]}
        )

    if d == 'buyer_mystatus':
        answer_cb(cbid)
        my = {k:v for k,v in orders.items() if v['user_id']==uid}
        if not my:
            send_buyer(uid, "📋 Buyurtma yo'q.",
                {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'buyer_back'}]]}
            ); return
        r  = "📋 <b>Buyurtmalaringiz:</b>\n\n"
        em = {'pending':'⏳','confirming':'🔄','confirmed':'✅','rejected':'❌','cancelled':'🚫'}
        st = {'pending':"To'lov kutilmoqda",'confirming':'Tekshirilmoqda',
              'confirmed':'Tasdiqlandi','rejected':'Rad','cancelled':'Bekor'}
        for k, o in list(my.items())[-5:]:
            p  = products.get(o['product_id'],{})
            r += f"{em.get(o['status'],'?')} <b>#{k}</b>\n{p.get('name','?')} — {fmt(o['amount'])} so'm\n{st.get(o['status'],'')}\n\n"
        send_buyer(uid, r, {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'buyer_back'}]]})
        return

    if d == 'buyer_myprofile':
        answer_cb(cbid)
        p      = get_profile(uid)
        ref_d  = referrals.get(str(uid), {'count': 0, 'cashback': 0})
        ref_link = f"https://t.me/{BUYER_BOT_USERNAME}?start=ref_{uid}"
        send_buyer(uid,
            f"👤 <b>Profilingiz</b>\n\n"
            f"🛒 Jami xaridlar: {p['total_orders']}\n"
            f"💰 Tejagan: {fmt(p['total_saved'])} so'm\n"
            f"👥 Guruhlar: {p['groups_joined']}\n"
            f"🎁 Cashback: {fmt(p['cashback'])} so'm\n"
            f"👫 Taklif qilganlar: {ref_d['count']} kishi\n\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🔗 Referral linkingiz:\n"
            f"<code>{ref_link}</code>\n\n"
            f"Har taklif uchun +10,000 so'm cashback!",
            {'inline_keyboard': [
                [{'text': "🔗 Referral linkni ulashish", 'url': f"https://t.me/share/url?url={ref_link}&text=🛍%20Do'stlarim%20bilan%20birgalikda%20xarid%20qilib%2040%25%20gacha%20tejayapman!%20Sen%20ham%20ulab%20ko'r%20👇"}],
                [{'text': "🔙 Menyu", 'callback_data': 'buyer_back'}]
            ]}
        )
        return

    if d == 'buyer_mywishlist':
        answer_cb(cbid)
        wl = wishlists.get(uid, [])
        if not wl:
            send_buyer(uid, "🤍 Wishlist bo'sh.",
                {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'buyer_back'}]]}
            ); return
        r = "🤍 <b>Wishlistingiz:</b>\n\n"
        for pid in wl:
            p = products.get(pid, {})
            if not p: continue
            count = len(groups.get(pid, []))
            r    += f"📦 {p.get('name','')}\n💰 {fmt(p.get('group_price',0))} so'm\n👥 {count}/{p.get('min_group',3)}\n\n"
        send_buyer(uid, r, {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'buyer_back'}]]})
        return

    if d == 'buyer_refund':
        answer_cb(cbid)
        my = {k:v for k,v in orders.items() if v['user_id']==uid and v['status']=='confirmed'}
        if not my:
            send_buyer(uid, "Qaytarish uchun tasdiqlangan buyurtma yo'q.",
                {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'buyer_back'}]]}
            ); return
        btns = []
        for k, o in list(my.items())[-5:]:
            p = products.get(o['product_id'],{})
            btns.append([{'text': f"#{k} — {p.get('name','')}", 'callback_data': f'refund_{k}'}])
        btns.append([{'text': "🔙 Menyu", 'callback_data': 'buyer_back'}])
        send_buyer(uid, "Qaysi buyurtmani qaytarmoqchisiz?", {'inline_keyboard': btns})
        return

    if d == 'buyer_help':
        answer_cb(cbid)
        send_buyer(uid,
            "ℹ️ <b>Yordam</b>\n\n"
            "/mystatus   — Buyurtmalarim\n"
            "/myprofile  — Profilim\n"
            "/mywishlist — Saqlangan mahsulotlar\n"
            "/refund     — Qaytarish so'rovi\n\n"
            "🆘 Yordam: @joynshop_support",
            {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'buyer_back'}]]}
        )
        return

    if d == 'buyer_back':
        answer_cb(cbid)
        buyer_main_menu()
        return

    # ── GURUH / YAKKA TANLASH ──
    if d.startswith('choose_'):
        pid = d[7:]
        if pid not in products:
            answer_cb(cbid, '❌ Mahsulot topilmadi!'); return
        p = products[pid]
        if p.get('status') == 'closed':
            answer_cb(cbid, '⛔️ Yopilgan!'); return
        answer_cb(cbid)
        count = len(groups.get(pid, []))
        min_g = p['min_group']
        has_solo = p.get('solo_price')
        kb = []
        if count < min_g:
            kb.append([{'text': f"👥 Guruh narxi — {fmt(p['group_price'])} so'm ({count}/{min_g})", 'callback_data': f'join_{pid}'}])
        if has_solo:
            kb.append([{'text': f"👤 Yakka narxi — {fmt(p['solo_price'])} so'm", 'callback_data': f'solo_{pid}'}])
        kb.append([{'text': "❌ Bekor", 'callback_data': 'noop'}])
        send_buyer(uid,
            f"📦 <b>{p['name']}</b>\n\n"
            f"Qanday sotib olmoqchisiz?",
            {'inline_keyboard': kb}
        )
        return

    if d.startswith('join_'):
        pid = d[5:]
        if pid not in products:
            answer_cb(cbid, '❌ Mahsulot topilmadi!'); return
        p = products[pid]
        if p.get('status') == 'closed':
            answer_cb(cbid, '⛔️ Guruh yopilgan!'); return
        if pid not in groups: groups[pid] = []
        if uid in groups[pid]:
            answer_cb(cbid, '✅ Allaqachon guruhdasiz!'); return

        # Variantlar bo'lsa tanlash
        variants = p.get('variants', [])
        if variants:
            answer_cb(cbid, token=BUYER_TOKEN)
            btns = [[{'text': v, 'callback_data': f'variant_{pid}_{v}'}] for v in variants]
            send_buyer(uid,
                f"📦 <b>{p['name']}</b>\n\nVariantni tanlang:",
                {'inline_keyboard': btns}
            )
            return

        code = gen_code()
        orders[code] = {
            'product_id': pid, 'user_id': uid,
            'user_name':  cb['from'].get('first_name', 'Foydalanuvchi'),
            'amount':     p['group_price'], 'type': 'group',
            'status':     'pending', 'variant': '',
            'created':    datetime.now().strftime('%d.%m.%Y %H:%M')
        }
        save_data()
        answer_cb(cbid, "To'lov ma'lumotlari yuborildi!")
        send_buyer(uid,
            f"🛒 <b>{p.get('shop_name','Sotuvchi')} — Guruh buyurtma</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"📦 {p['name']}\n💰 {fmt(p['group_price'])} so'm\n\n"
            f"💳 <b>Payme:</b>\n"
            f"📱 <code>{PAYME_NUMBER}</code>\n"
            f"💵 <code>{fmt(p['group_price'])}</code>\n"
            f"📝 Izoh: <code>{code}</code>\n\n"
            f"⚠️ Izohga <b>{code}</b> yozing!\n"
            f"━━━━━━━━━━━━━━━\n🔒 Joynshop kafolati ostida",
            {'inline_keyboard': [
                [{'text': "✅ To'lovni tasdiqlayman", 'callback_data': f'paid_{code}'}],
                [{'text': "❌ Bekor",                 'callback_data': f'cancel_{code}'}]
            ]}
        )
        return

    if d.startswith('paid_'):
        code = d[5:]
        if code not in orders:
            answer_cb(cbid, '❌ Buyurtma topilmadi!'); return
        o = orders[code]
        if o['status'] != 'pending':
            answer_cb(cbid, '⚠️ Allaqachon yuborilgan!'); return
        orders[code]['status'] = 'confirming'
        save_data()
        answer_cb(cbid, '⏳ Sotuvchi tasdiqlamoqda...')
        # Avtomatik chek
        p_auto = products.get(orders[code]['product_id'], {})
        auto_check(code, orders[code], p_auto)
        p   = products.get(o['product_id'], {})
        sid = p.get('seller_id')
        if sid:
            variant_text = f"\n🎨 Variant: {o.get('variant','')}" if o.get('variant') else ''
            send_seller(sid,
                f"🔔 <b>YANGI TO'LOV!</b>\n\n"
                f"📦 {p.get('name','')}{variant_text}\n👤 {o['user_name']} (ID: {uid})\n"
                f"💰 {fmt(o['amount'])} so'm\n"
                f"🛒 {'Yakka' if o.get('type')=='solo' else 'Guruh'}\n🆔 #{code}",
                {'inline_keyboard': [[
                    {'text': '✅ Tasdiqlash', 'callback_data': f'seller_ac_{code}'},
                    {'text': '❌ Rad',        'callback_data': f'seller_ar_{code}'}
                ]]}
            )
        return

    if d.startswith('cancel_'):
        code = d[7:]
        if code in orders:
            orders[code]['status'] = 'cancelled'
            save_data()
        answer_cb(cbid, '❌ Bekor qilindi')
        send_buyer(uid, f"❌ #{code} bekor qilindi.")
        return

    if d.startswith('rate_start_'):
        pid = d[11:]
        answer_cb(cbid)
        send_buyer(uid, "⭐ Sotuvchiga baho bering:",
            {'inline_keyboard': [[
                {'text': '⭐',        'callback_data': f'rate_{pid}_1'},
                {'text': '⭐⭐',      'callback_data': f'rate_{pid}_2'},
                {'text': '⭐⭐⭐',    'callback_data': f'rate_{pid}_3'},
                {'text': '⭐⭐⭐⭐',  'callback_data': f'rate_{pid}_4'},
                {'text': '⭐⭐⭐⭐⭐','callback_data': f'rate_{pid}_5'},
            ]]}
        )
        return

    if d.startswith('rate_') and not d.startswith('rate_start_'):
        parts  = d.split('_')
        pid    = parts[1]
        rating = int(parts[2])
        answer_cb(cbid, f"{'⭐'*rating} Baho berildi!")
        p      = products.get(pid, {})
        uname  = cb['from'].get('first_name', 'Xaridor')
        # Faqat sotuvchiga shaxsiy — kanalga yuborilmaydi
        sid = p.get('seller_id')
        if sid:
            send_seller(sid, f"⭐ <b>Yangi baho!</b>\n\n📦 {p.get('name','')}\n{'⭐'*rating} — {uname}")
        send_buyer(uid, "✅ Rahmat! Sharhingiz uchun bonus: +5,000 so'm cashback")
        get_profile(uid)['cashback'] = get_profile(uid).get('cashback', 0) + 5000
        return

    if d.startswith('save_'):
        pid = d[5:]
        if uid not in wishlists: wishlists[uid] = []
        if pid not in wishlists[uid]:
            wishlists[uid].append(pid)
            answer_cb(cbid, '✅ Wishlistga saqlandi!')
        else:
            answer_cb(cbid, '✅ Allaqachon saqlangan!')
        return

    if d.startswith('variant_'):
        parts   = d.split('_', 2)
        pid     = parts[1]
        variant = parts[2] if len(parts) > 2 else ''
        if pid not in products:
            answer_cb(cbid, '❌ Topilmadi!'); return
        p = products[pid]
        if p.get('status') == 'closed':
            answer_cb(cbid, '⛔️ Yopilgan!'); return
        if pid not in groups: groups[pid] = []
        if uid in groups[pid]:
            answer_cb(cbid, '✅ Allaqachon guruhdasiz!'); return
        answer_cb(cbid, f"✅ {variant} tanlandi!")
        code = gen_code()
        orders[code] = {
            'product_id': pid, 'user_id': uid,
            'user_name':  cb['from'].get('first_name', 'Foydalanuvchi'),
            'amount':     p['group_price'], 'type': 'group',
            'status':     'pending', 'variant': variant,
            'created':    datetime.now().strftime('%d.%m.%Y %H:%M')
        }
        save_data()
        send_buyer(uid,
            f"🛒 <b>{p.get('shop_name','Sotuvchi')} — Guruh buyurtma</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"📦 {p['name']}\n"
            f"🎨 Variant: <b>{variant}</b>\n"
            f"💰 {fmt(p['group_price'])} so'm\n\n"
            f"💳 <b>Payme:</b>\n"
            f"📱 <code>{PAYME_NUMBER}</code>\n"
            f"💵 <code>{fmt(p['group_price'])}</code>\n"
            f"📝 Izoh: <code>{code}</code>\n\n"
            f"⚠️ Izohga <b>{code}</b> yozing!\n"
            f"━━━━━━━━━━━━━━━\n🔒 Joynshop kafolati ostida",
            {'inline_keyboard': [
                [{'text': "✅ To'lovni tasdiqlayman", 'callback_data': f'paid_{code}'}],
                [{'text': "❌ Bekor",                 'callback_data': f'cancel_{code}'}]
            ]}
        )
        return

    if d.startswith('refund_') and not d.startswith('refund_reason_'):
        code = d[7:]
        answer_cb(cbid)
        send_buyer(uid, "↩️ <b>Qaytarish sababi:</b>",
            {'inline_keyboard': [
                [{'text': '📦 Mahsulot kelmadi', 'callback_data': f'refund_reason_notarrived_{code}'}],
                [{'text': '😕 Sifat yomon',       'callback_data': f'refund_reason_quality_{code}'}],
                [{'text': '❌ Boshqa sabab',       'callback_data': f'refund_reason_other_{code}'}],
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
        save_data()
        answer_cb(cbid, "✅ Qaytarish so'rovi yuborildi!")
        send_buyer(uid,
            f"✅ <b>Qaytarish so'rovi yuborildi</b>\n\n#{code}\nSabab: {reason}\n\nSotuvchi 24 soat ichida ko'rib chiqadi."
        )
        o   = orders.get(code, {})
        p   = products.get(o.get('product_id',''), {})
        sid = p.get('seller_id')
        if sid:
            send_seller(sid,
                f"↩️ <b>QAYTARISH SO'ROVI!</b>\n\n#{code}\n📦 {p.get('name','')}\n"
                f"💰 {fmt(o.get('amount',0))} so'm\nSabab: {reason}",
                {'inline_keyboard': [[
                    {'text': '✅ Qaytarish', 'callback_data': f'seller_approve_refund_{code}'},
                    {'text': '❌ Rad',       'callback_data': f'seller_deny_refund_{code}'}
                ]]}
            )
        return

def buyer_handle_msg(msg):
    cid  = msg['chat']['id']
    uid  = msg['from']['id']
    text = msg.get('text', '')

    # Deep link handler: /start join_abc123 or /start solo_abc123 or /start ref_uid
    if text.startswith('/start ') or text.startswith('/start\n'):
        param = text.split(None, 1)[1].strip() if len(text.split(None, 1)) > 1 else ''

        if param.startswith('ref_'):
            try:
                referrer_uid = int(param[4:])
                if referrer_uid != uid and uid not in referral_map:
                    referral_map[uid] = referrer_uid
                    # Cashback referral qiluvchiga
                    if str(referrer_uid) not in referrals:
                        referrals[str(referrer_uid)] = {'count': 0, 'cashback': 0}
                    referrals[str(referrer_uid)]['count']   += 1
                    referrals[str(referrer_uid)]['cashback'] += 10000
                    prof = get_profile(referrer_uid)
                    prof['cashback']  = prof.get('cashback', 0) + 10000
                    prof['referrals'] = prof.get('referrals', 0) + 1
                    save_data()
                    # Referral qiluvchiga xabar
                    send_buyer(referrer_uid,
                        f"🎉 <b>Yangi taklif!</b>\n\n"
                        f"Do'stingiz Joynshop ga qo'shildi!\n"
                        f"💰 +10,000 so'm cashback oldiniz!\n\n"
                        f"Jami cashback: {fmt(prof['cashback'])} so'm"
                    )
            except: pass
            # Oddiy /start ko'rsatish
            send_buyer(cid,
                "👋 <b>Joynshop ga xush kelibsiz!</b>\n\n"
                "🛍 Do'stlaringiz bilan xarid qiling — 40% gacha tejang!\n\n"
                "💰 Do'stingiz sizni taklif qildi — birinchi xariddan chegirma olasiz!",
                {'inline_keyboard': [
                    [{'text': "📋 Buyurtmalarim",  'callback_data': 'buyer_mystatus'}],
                    [
                        {'text': "👤 Profilim",    'callback_data': 'buyer_myprofile'},
                        {'text': "🤍 Wishlist",    'callback_data': 'buyer_mywishlist'},
                    ],
                    [
                        {'text': "↩️ Qaytarish",  'callback_data': 'buyer_refund'},
                        {'text': "❓ Yordam",      'callback_data': 'buyer_help'},
                    ],
                ]}
            )
            return

        if param.startswith('join_') or param.startswith('solo_'):
            action, pid = param.split('_', 1)
            if pid not in products:
                send_buyer(cid, "❌ Mahsulot topilmadi yoki muddati o'tgan.")
                return
            p = products[pid]
            if p.get('status') == 'closed':
                send_buyer(cid, "⛔️ Bu guruh yopilgan.")
                return

            if action == 'solo':
                if not p.get('solo_price'):
                    send_buyer(cid, "❌ Bu mahsulotda yakka sotish yo'q.")
                    return
                code = gen_code()
                orders[code] = {
                    'product_id': pid, 'user_id': uid,
                    'user_name':  msg['from'].get('first_name', 'Foydalanuvchi'),
                    'amount':     p['solo_price'], 'type': 'solo',
                    'status':     'pending',
                    'created':    datetime.now().strftime('%d.%m.%Y %H:%M')
                }
                save_data()
                send_buyer(cid,
                    f"🛒 <b>{p.get('shop_name','Sotuvchi')} — Yakka buyurtma</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"📦 {p['name']}\n💰 {fmt(p['solo_price'])} so'm\n\n"
                    f"💳 <b>Payme:</b>\n"
                    f"📱 <code>{PAYME_NUMBER}</code>\n"
                    f"💵 <code>{fmt(p['solo_price'])}</code>\n"
                    f"📝 Izoh: <code>{code}</code>\n\n"
                    f"⚠️ Izohga <b>{code}</b> yozing!\n"
                    f"━━━━━━━━━━━━━━━\n🔒 Joynshop kafolati ostida",
                    {'inline_keyboard': [
                        [{'text': "✅ To'lovni tasdiqlayman", 'callback_data': f'paid_{code}'}],
                        [{'text': "❌ Bekor",                 'callback_data': f'cancel_{code}'}]
                    ]}
                )
                return

            # action == 'join' (guruh)
            if pid not in groups: groups[pid] = []
            if uid in groups[pid]:
                send_buyer(cid, '✅ Siz allaqachon guruhdasiz!'); return

            # Variantlar bo'lsa tanlash
            variants = p.get('variants', [])
            if variants:
                btns = [[{'text': v, 'callback_data': f'variant_{pid}_{v}'}] for v in variants]
                send_buyer(cid,
                    f"📦 <b>{p['name']}</b>\n\nVariantni tanlang:",
                    {'inline_keyboard': btns}
                )
                return

            code = gen_code()
            orders[code] = {
                'product_id': pid, 'user_id': uid,
                'user_name':  msg['from'].get('first_name', 'Foydalanuvchi'),
                'amount':     p['group_price'], 'type': 'group',
                'status':     'pending', 'variant': '',
                'created':    datetime.now().strftime('%d.%m.%Y %H:%M')
            }
            save_data()
            send_buyer(cid,
                f"🛒 <b>{p.get('shop_name','Sotuvchi')} — Guruh buyurtma</b>\n"
                f"━━━━━━━━━━━━━━━\n"
                f"📦 {p['name']}\n💰 {fmt(p['group_price'])} so'm\n\n"
                f"💳 <b>Payme:</b>\n"
                f"📱 <code>{PAYME_NUMBER}</code>\n"
                f"💵 <code>{fmt(p['group_price'])}</code>\n"
                f"📝 Izoh: <code>{code}</code>\n\n"
                f"⚠️ Izohga <b>{code}</b> yozing!\n"
                f"━━━━━━━━━━━━━━━\n🔒 Joynshop kafolati ostida",
                {'inline_keyboard': [
                    [{'text': "✅ To'lovni tasdiqlayman", 'callback_data': f'paid_{code}'}],
                    [{'text': "❌ Bekor",                 'callback_data': f'cancel_{code}'}]
                ]}
            )
            return

    # Manzil kutilayotgan bo'lsa
    prof = get_profile(uid)
    if prof.get('awaiting_address') and not text.startswith('/'):
        code = prof['awaiting_address']
        o    = orders.get(code, {})
        p    = products.get(o.get('product_id',''), {})
        sid  = p.get('seller_id')
        orders[code]['address'] = text
        del prof['awaiting_address']
        save_data()
        send_buyer(cid,
            f"✅ <b>Manzil saqlandi!</b>\n\n"
            f"📍 {text}\n\n"
            f"Sotuvchi yetkazib berish vaqtini belgilaydi."
        )
        if sid:
            send_seller(sid,
                f"📍 <b>Yangi manzil!</b>\n\n"
                f"📦 {p.get('name','')}\n"
                f"👤 {o.get('user_name','')}\n"
                f"🆔 #{code}\n\n"
                f"📍 Manzil: <b>{text}</b>"
            )
        return

    if text == '/start':
        send_buyer(cid,
            "👋 <b>Joynshop ga xush kelibsiz!</b>\n\n"
            "🛍 Do'stlaringiz bilan xarid qiling — 40% gacha tejang!",
            {'inline_keyboard': [
                [{'text': "📋 Buyurtmalarim",  'callback_data': 'buyer_mystatus'}],
                [
                    {'text': "👤 Profilim",    'callback_data': 'buyer_myprofile'},
                    {'text': "🤍 Wishlist",    'callback_data': 'buyer_mywishlist'},
                ],
                [
                    {'text': "↩️ Qaytarish",  'callback_data': 'buyer_refund'},
                    {'text': "❓ Yordam",      'callback_data': 'buyer_help'},
                ],
            ]}
        )
        return

    if text == '/myprofile':
        p      = get_profile(uid)
        ref_d  = referrals.get(str(uid), {'count': 0, 'cashback': 0})
        ref_link = f"https://t.me/{BUYER_BOT_USERNAME}?start=ref_{uid}"
        send_buyer(cid,
            f"👤 <b>Profilingiz</b>\n\n"
            f"🛒 Jami xaridlar: {p['total_orders']}\n"
            f"💰 Tejagan: {fmt(p['total_saved'])} so'm\n"
            f"👥 Guruhlar: {p['groups_joined']}\n"
            f"🎁 Cashback: {fmt(p['cashback'])} so'm\n"
            f"👫 Taklif qilganlar: {ref_d['count']} kishi\n\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🔗 Referral linkingiz:\n"
            f"<code>{ref_link}</code>\n\n"
            f"Har taklif uchun +10,000 so'm cashback!",
            {'inline_keyboard': [
                [{'text': "🔗 Referral linkni ulashish", 'url': f"https://t.me/share/url?url={ref_link}&text=🛍%20Do'stlarim%20bilan%20birgalikda%20xarid%20qilib%2040%25%20gacha%20tejayapman!%20Sen%20ham%20ulab%20ko'r%20👇"}],
            ]}
        )
        return

    if text == '/mystatus':
        my = {k:v for k,v in orders.items() if v['user_id']==uid}
        if not my:
            send_buyer(cid, "📋 Buyurtma yo'q."); return
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
            send_buyer(cid, "🤍 Wishlist bo'sh."); return
        r = "🤍 <b>Wishlistingiz:</b>\n\n"
        for pid in wl:
            p = products.get(pid, {})
            if not p: continue
            count = len(groups.get(pid, []))
            r    += f"📦 {p.get('name','')}\n💰 {fmt(p.get('group_price',0))} so'm\n👥 {count}/{p.get('min_group',3)}\n\n"
        send_buyer(cid, r)
        return

    if text == '/refund':
        my = {k:v for k,v in orders.items() if v['user_id']==uid and v['status']=='confirmed'}
        if not my:
            send_buyer(cid, "Qaytarish uchun tasdiqlangan buyurtma yo'q."); return
        btns = []
        for k, o in list(my.items())[-5:]:
            p = products.get(o['product_id'],{})
            btns.append([{'text': f"#{k} — {p.get('name','')}", 'callback_data': f'refund_{k}'}])
        send_buyer(cid, "Qaysi buyurtmani qaytarmoqchisiz?", {'inline_keyboard': btns})
        return

    if text == '/help':
        send_buyer(cid,
            "ℹ️ <b>Yordam</b>\n\n"
            "/mystatus   — Buyurtmalarim\n"
            "/myprofile  — Profilim\n"
            "/mywishlist — Saqlangan mahsulotlar\n"
            "/refund     — Qaytarish so'rovi\n\n"
            "🆘 Yordam: @joynshop_support"
        )
        return

@app.route('/', methods=['GET'])
def index():
    return 'Joynshop Bot ishlayapti! 🏪🛍'

@app.route('/api/stats', methods=['GET'])
def api_stats():
    from flask import jsonify
    pwd = request.args.get('pwd', '')
    if pwd != DASHBOARD_PASSWORD:
        return jsonify({'error': 'Unauthorized'}), 401

    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start  = today_start - timedelta(days=7)

    # Orders
    all_confirmed = [o for o in orders.values() if o['status'] == 'confirmed']
    today_orders  = [o for o in all_confirmed if datetime.strptime(o['created'], '%d.%m.%Y %H:%M') >= today_start]
    week_orders   = [o for o in all_confirmed if datetime.strptime(o['created'], '%d.%m.%Y %H:%M') >= week_start]

    gmv_total = sum(o['amount'] for o in all_confirmed)
    gmv_today = sum(o['amount'] for o in today_orders)
    gmv_week  = sum(o['amount'] for o in week_orders)

    # Products
    all_products   = list(products.values())
    active_prods   = [p for p in all_products if p.get('status') != 'closed']
    filled_groups  = [p for p in all_products if len(groups.get(list(products.keys())[list(products.values()).index(p)], [])) >= p.get('min_group', 99)]

    # Sellers
    unique_sellers = len(set(p.get('seller_id') for p in all_products if p.get('seller_id')))

    # Buyers
    unique_buyers  = len(set(o['user_id'] for o in all_confirmed))
    today_buyers   = len(set(o['user_id'] for o in today_orders))

    # Conversion
    total_attempts = len([o for o in orders.values()])
    conv_rate = round(len(all_confirmed) / total_attempts * 100) if total_attempts else 0

    # Daily GMV for chart (last 14 days)
    daily_data = []
    for i in range(13, -1, -1):
        day = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        day_orders = [o for o in all_confirmed
                      if datetime.strptime(o['created'], '%d.%m.%Y %H:%M') >= day
                      and datetime.strptime(o['created'], '%d.%m.%Y %H:%M') < day_end]
        daily_data.append({
            'date': day.strftime('%d.%m'),
            'gmv': sum(o['amount'] for o in day_orders),
            'orders': len(day_orders)
        })

    return jsonify({
        'sellers': {
            'total': unique_sellers,
            'channels': len(verified_channels),
            'channel_list': [
                {
                    'username': ch,
                    'owner': data.get('owner_id'),
                    'mods': len(data.get('moderators', [])),
                    'products': sum(1 for p in products.values() if p.get('seller_channel') == ch and p.get('status') != 'closed')
                }
                for ch, data in verified_channels.items()
            ],
        },
        'referrals': {
            'total_referrers': len(referrals),
            'total_referred': len(referral_map),
            'total_cashback': sum(v.get('cashback', 0) for v in referrals.values()),
        },
        'buyers': {
            'total': unique_buyers,
            'today': today_buyers,
        },
        'products': {
            'total': len(all_products),
            'active': len(active_prods),
            'filled': len(filled_groups),
        },
        'orders': {
            'total': len(all_confirmed),
            'today': len(today_orders),
            'week': len(week_orders),
            'conversion': conv_rate,
        },
        'finance': {
            'gmv_total': gmv_total,
            'gmv_today': gmv_today,
            'gmv_week': gmv_week,
            'commission_total': int(gmv_total * COMMISSION_RATE),
            'commission_week': int(gmv_week * COMMISSION_RATE),
            'avg_order': int(gmv_total / len(all_confirmed)) if all_confirmed else 0,
        },
        'chart': daily_data,
    })

@app.route('/api/user/<int:uid>/orders', methods=['GET'])
def api_user_orders(uid):
    from flask import jsonify
    my = {k: v for k, v in orders.items() if v.get('user_id') == uid}
    result = []
    em = {'pending':'⏳','confirming':'🔄','confirmed':'✅','rejected':'❌','cancelled':'🚫'}
    st = {'pending':"To'lov kutilmoqda",'confirming':'Tekshirilmoqda',
          'confirmed':'Tasdiqlandi','rejected':'Rad etildi','cancelled':'Bekor qilindi'}
    for code, o in sorted(my.items(), key=lambda x: x[1].get('created',''), reverse=True)[:20]:
        p = products.get(o.get('product_id',''), {})
        result.append({
            'code':       code,
            'name':       p.get('name',''),
            'shop_name':  p.get('shop_name',''),
            'amount':     o.get('amount', 0),
            'type':       o.get('type','group'),
            'status':     o.get('status',''),
            'status_text': st.get(o.get('status',''), ''),
            'status_icon': em.get(o.get('status',''), '?'),
            'created':    o.get('created',''),
            'address':    o.get('address',''),
            'photo_id':   p.get('photo_id',''),
            'delivery':   p.get('delivery_type','pickup'),
        })
    return jsonify(result)

@app.route('/api/user/<int:uid>/profile', methods=['GET'])
def api_user_profile(uid):
    from flask import jsonify
    prof    = get_profile(uid)
    ref_d   = referrals.get(str(uid), {'count': 0, 'cashback': 0})
    my_ords = {k:v for k,v in orders.items() if v.get('user_id')==uid and v.get('status')=='confirmed'}
    return jsonify({
        'total_orders':   prof.get('total_orders', 0),
        'total_saved':    prof.get('total_saved', 0),
        'groups_joined':  prof.get('groups_joined', 0),
        'cashback':       prof.get('cashback', 0),
        'referral_count': ref_d.get('count', 0),
        'confirmed_orders': len(my_ords),
    })

@app.route('/api/photo/<file_id>', methods=['GET'])
def api_photo(file_id):
    from flask import redirect
    try:
        result = requests.get(
            f'https://api.telegram.org/bot{SELLER_TOKEN}/getFile',
            params={'file_id': file_id}
        ).json()
        if result.get('ok'):
            path = result['result']['file_path']
            return redirect(f'https://api.telegram.org/file/bot{SELLER_TOKEN}/{path}')
    except: pass
    return '', 404

@app.route('/miniapp', methods=['GET'])
def miniapp():
    from flask import Response
    html = open('miniapp.html').read()
    return Response(html, mimetype='text/html')

@app.route('/api/buyer_stats', methods=['GET'])
def api_buyer_stats():
    from flask import jsonify
    uid = request.args.get('uid', type=int)
    if not uid: return jsonify({}), 400
    p   = buyer_profiles.get(uid, {})
    ref = referrals.get(str(uid), {})
    return jsonify({
        'total_orders':  p.get('total_orders', 0),
        'total_saved':   p.get('total_saved', 0),
        'groups_joined': p.get('groups_joined', 0),
        'cashback':      p.get('cashback', 0),
        'referrals':     ref.get('count', 0),
    })

@app.route('/api/products', methods=['GET'])
def api_products():
    from flask import jsonify
    result = []
    for pid, p in products.items():
        if p.get('status') == 'closed': continue
        count = len(groups.get(pid, []))
        min_g = p.get('min_group', 3)
        orig  = p.get('original_price', 0)
        solo  = p.get('solo_price', 0)
        grp   = p.get('group_price', 0)
        result.append({
            'id':             pid,
            'name':           p.get('name',''),
            'shop_name':      p.get('shop_name',''),
            'description':    p.get('description',''),
            'original_price': orig,
            'solo_price':     solo,
            'group_price':    grp,
            'min_group':      min_g,
            'count':          count,
            'deadline':       p.get('deadline',''),
            'photo_id':       p.get('photo_id',''),
            'contact':        p.get('contact',''),
            'solo_disc':      round((orig-solo)/orig*100) if solo and orig else 0,
            'grp_disc':       round((orig-grp)/orig*100) if grp and orig else 0,
            'join_url':       f"https://t.me/{BUYER_BOT_USERNAME}?start=join_{pid}",
            'solo_url':       f"https://t.me/{BUYER_BOT_USERNAME}?start=solo_{pid}" if solo else None,
        })
    result.sort(key=lambda x: x['count'], reverse=True)
    return jsonify(result)

@app.route('/dashboard', methods=['GET'])
def dashboard():
    from flask import Response
    html = open('dashboard.html').read()
    return Response(html, mimetype='text/html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))# ─── PERSISTENCE (PostgreSQL) ───────────────────────────────────────
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db():
    import urllib.parse
    r = urllib.parse.urlparse(DATABASE_URL)
    return pg8000.connect(
        host=r.hostname, port=r.port or 5432,
        database=r.path.lstrip('/'),
        user=r.username, password=r.password,
        ssl_context=True
    )

def init_db():
    try:
        conn = get_db()
        cur  = conn.cursor()
        sql  = (
            "CREATE TABLE IF NOT EXISTS joynshop_data "
            "(key TEXT PRIMARY KEY, value TEXT)"
        )
        cur.execute(sql)
        conn.commit()
        cur.close(); conn.close()
        logging.info("DB initialized")
    except Exception as e:
        logging.error(f"init_db error: {e}", exc_info=True)

def save_data():
    if not DATABASE_URL:
        logging.warning("No DATABASE_URL")
        return
    try:
        data = {
            'products':               products,
            'groups':                 groups,
            'orders':                 orders,
            'wishlists':              wishlists,
            'buyer_profiles':         buyer_profiles,
            'refund_requests':        refund_requests,
            'seller_products':        {str(k): v for k, v in seller_products.items()},
            'verified_channels':      verified_channels,
            'pending_moderator_codes':pending_moderator_codes,
            'referrals':              referrals,
            'referral_map':           {str(k): v for k, v in referral_map.items()},
        }
        payload = json.dumps(data, ensure_ascii=False, default=str)
        conn    = get_db()
        cur     = conn.cursor()
        cur.execute(
            "INSERT INTO joynshop_data (key, value) VALUES ('main', %s) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (payload,)
        )
        conn.commit()
        cur.close(); conn.close()
        logging.info(f"Data saved: {len(products)} products, {len(orders)} orders")
    except Exception as e:
        logging.error(f"save_data error: {e}", exc_info=True)

def load_data():
    global products, groups, orders, wishlists, buyer_profiles
    global refund_requests, seller_products, verified_channels
    global pending_moderator_codes, referrals, referral_map
    if not DATABASE_URL:
        logging.warning("No DATABASE_URL — starting fresh")
        return
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT value FROM joynshop_data WHERE key = 'main'")
        row  = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            logging.info("No data in DB — starting fresh")
            return
        data = json.loads(row[0]) if isinstance(row[0], str) else row[0]
        products               = data.get('products', {})
        groups                 = data.get('groups', {})
        orders                 = data.get('orders', {})
        wishlists              = data.get('wishlists', {})
        buyer_profiles         = data.get('buyer_profiles', {})
        refund_requests        = data.get('refund_requests', {})
        verified_channels      = data.get('verified_channels', {})
        pending_moderator_codes= data.get('pending_moderator_codes', {})
        referrals              = data.get('referrals', {})
        raw_rm                 = data.get('referral_map', {})
        referral_map           = {int(k) if str(k).isdigit() else k: v for k, v in raw_rm.items()}
        raw_sp                 = data.get('seller_products', {})
        seller_products        = {int(k) if k.isdigit() else k: v for k, v in raw_sp.items()}
        logging.info(f"Data loaded: {len(products)} products, {len(orders)} orders")
    except Exception as e:
        logging.error(f"load_data error: {e}", exc_info=True)

import atexit, signal
init_db()
load_data()
threading.Thread(target=setup_bot_ui, daemon=True).start()

# shutdown save removed — DB persistence handles restarts

# autosave loop removed — saving after each webhook request

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
    count     = len(groups.get(pid, []))
    min_g     = p['min_group']
    orig      = p['original_price']
    solo      = p.get('solo_price', 0)
    group     = p['group_price']
    solo_disc = round((orig - solo) / orig * 100) if solo else 0
    grp_disc  = round((orig - group) / orig * 100)
    status    = '🔥' if count < min_g else '✅'
    bar_str   = bar(count, min_g)

    lines = [f"<b>{p['name']}</b>\n"]
    lines.append(f"💰 Asl narx: <s>{fmt(orig)} so'm</s>")
    if solo:
        lines.append(f"👤 Yakka:  <b>{fmt(solo)} so'm</b>  <i>(-{solo_disc}%)</i>")
    lines.append(f"👥 Guruh:  <b>{fmt(group)} so'm</b>  <i>(-{grp_disc}%)</i>")
    lines.append(f"Guruh: {count}/{min_g} {status}")
    lines.append(f"⏳ Kerak: {max(0, min_g - count)} kishi")
    lines.append(f"🕐 {p.get('deadline','')}")
    lines.append(f"\n📝 {p['description']}")
    lines.append(f"\n🏪 <b>{p['shop_name']}</b>  |  📞 {p.get('contact','')}")
    return "\n".join(lines)

def join_kb(pid, count, min_g, has_solo=False):
    if count >= min_g:
        return {'inline_keyboard': [[{'text': "✅ Guruh to'ldi!", 'url': f'https://t.me/{BUYER_BOT_USERNAME}'}]]}
    kb = []
    if has_solo:
        kb.append([{'text': "🛒 Sotib olish (yakka)", 'url': f'https://t.me/{BUYER_BOT_USERNAME}?start=solo_{pid}'}])
    kb.append([{'text': f"👥 Guruhga qo'shilish ({count}/{min_g})", 'url': f'https://t.me/{BUYER_BOT_USERNAME}?start=join_{pid}'}])
    return kb_inline(kb)

def kb_inline(rows):
    return {'inline_keyboard': rows}

# ─── CHEK ────────────────────────────────────────────────────────────
def build_check(order_code, order):
    p         = products.get(order['product_id'], {})
    sale_type    = '👤 Yakka' if order.get('type') == 'solo' else '👥 Guruh'
    variant_line = f"\n🎨 {order['variant']}" if order.get('variant') else ''
    return (
        f"🧾 <b>JOYNSHOP CHEKI</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"🏪 {p.get('shop_name', 'Sotuvchi')}\n"
        f"📦 {p.get('name', '')}{variant_line}\n"
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
    p['total_saved']  += (original_price - amount)
    if is_group: p['groups_joined'] += 1
    p['cashback'] += int(amount * 0.02)

# ─── EXPIRE ──────────────────────────────────────────────────────────
def expire_product(pid):
    p = products.get(pid)
    if not p or p.get('status') == 'closed': return
    products[pid]['status'] = 'closed'
    count = len(groups.get(pid, []))
    sid   = p.get('seller_id')

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
                    f"💰 To'lovingiz 24 soat ichida qaytariladi."
                )
        except: pass

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

# ─── REMINDER & LIVE UPDATE ──────────────────────────────────────────
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
                    for uid in groups.get(pid, []):
                        try:
                            send_buyer(uid,
                                f"⚡️ <b>SHOSHILING!</b>\n\n"
                                f"<b>{p['name']}</b>\n"
                                f"{needed} kishi kerak!\n"
                                f"⏰ {int(hours)} soat qoldi!"
                            )
                        except: pass
                    sid = p.get('seller_id')
                    if sid:
                        send_seller(sid,
                            f"📢 <b>Eslatma!</b>\n\n"
                            f"<b>{p['name']}</b>\n"
                            f"👥 {count}/{p['min_group']} kishi\n"
                            f"⏰ {int(hours)} soat qoldi\n\n"
                            f"Kanalda qayta e'lon qiling: /boost {pid}"
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
                        join_kb(pid, count, p['min_group'], has_solo=bool(p.get('solo_price')))
                    )
                except: pass
        except Exception as e:
            logging.error(f"Live update: {e}")

threading.Thread(target=reminder_loop, daemon=True).start()
threading.Thread(target=live_update_loop, daemon=True).start()

# ─── SPAM ────────────────────────────────────────────────────────────
def is_spam(text):
    if not text: return False
    lower = text.lower()
    return lower.count('http') + lower.count('t.me/') > 1

def moderate_chat(msg):
    cid = msg['chat']['id']
    mid = msg['message_id']
    if is_spam(msg.get('text', '')):
        api('deleteMessage', {'chat_id': cid, 'message_id': mid})
        send_buyer(cid, "⚠️ Spam xabar o'chirildi.")
        return True
    return False

# ══════════════════════════════════════════════════════════════════════
#  SELLER WEBHOOK
# ══════════════════════════════════════════════════════════════════════
