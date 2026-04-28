import os, json, logging, random, string, threading, time, requests
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
import pg8000

try:
    import boto3
    from botocore.exceptions import ClientError
    S3_AVAILABLE = True
except ImportError:
    S3_AVAILABLE = False
    logging.warning("boto3 not installed — S3 disabled")

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
COMMISSION_RATE = 0.05  # 5%
CLICK_TOKEN    = os.environ.get('CLICK_TOKEN', '')  # Click Terminal payment token

# Kategoriyalar — bot va sayt uchun bir xil
CATEGORIES = [
    ('Kiyim',            '👕'),
    ('Poyabzal',         '👟'),
    ('Sumka',            '👜'),
    ('Soat & Zargarlik', '⌚'),
    ('Elektronika',      '📱'),
    ('Ofis & Kompyuter', '💻'),
    ('Kantselyariya',    '✏️'),
    ('Avto',             '🚗'),
    ('Oziq-ovqat',       '🍎'),
    ('Uy-joy',           '🏠'),
    ('Parfyumeriya',     '💄'),
    ('Salomatlik',       '💊'),
    ('Sport',            '⚽'),
    ('Bolalar',          '🧸'),
    ("O'yin & Hobby",    '🎮'),
    ('Boshqa',           '📦'),
]

# AWS S3
AWS_ACCESS_KEY_ID     = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_BUCKET_NAME       = os.environ.get('AWS_BUCKET_NAME', 'joynshop-media')
AWS_REGION            = os.environ.get('AWS_REGION', 'eu-central-1')
CDN_BASE_URL          = os.environ.get('CDN_BASE_URL', '')

def get_s3():
    if not S3_AVAILABLE or not AWS_ACCESS_KEY_ID:
        return None
    return boto3.client('s3',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )

def upload_photo_to_s3(file_id, bot_token):
    s3 = get_s3()
    if not s3:
        return None
    try:
        r = requests.get(f'https://api.telegram.org/bot{bot_token}/getFile',
                         params={'file_id': file_id}, timeout=10).json()
        if not r.get('ok'):
            return None
        file_path = r['result']['file_path']
        ext = file_path.rsplit('.', 1)[-1].lower() if '.' in file_path else 'jpg'
        tg_url = f'https://api.telegram.org/file/bot{bot_token}/{file_path}'
        img_data = requests.get(tg_url, timeout=20).content
        key = f'products/{file_id}.{ext}'
        s3.put_object(Bucket=AWS_BUCKET_NAME, Key=key, Body=img_data,
                      ContentType=f'image/{ext}')
        if CDN_BASE_URL:
            return f'{CDN_BASE_URL}/{key}'
        return f'https://{AWS_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{key}'
    except Exception as e:
        logging.error(f'S3 upload error: {e}')
        return None

def upload_photo_async(file_id, bot_token, state_ref):
    def _upload():
        url = upload_photo_to_s3(file_id, bot_token)
        if url and state_ref is not None:
            if 'photo_urls' not in state_ref: state_ref['photo_urls'] = []
            if url not in state_ref['photo_urls']:
                state_ref['photo_urls'].append(url)
            logging.info(f'S3 async done: {url}')
    threading.Thread(target=_upload, daemon=True).start()

DASHBOARD_PASSWORD = os.environ.get('DASHBOARD_PASSWORD', 'joynshop2026')
BUYER_BOT_USERNAME = os.environ.get('BUYER_BOT_USERNAME', 'joynshop_bot')
APP_URL            = os.environ.get('APP_URL', '')
# Public Flask backend URL — used when a link must hit the bot's routes
# (e.g. /live/<id>) and APP_URL points to a static frontend (Vercel) that
# doesn't proxy that path. Falls back to APP_URL when not set.
BACKEND_URL        = os.environ.get('BACKEND_URL', APP_URL)

def setup_bot_ui():
    miniapp_url = f"{APP_URL}/miniapp" if APP_URL else None

    if BUYER_TOKEN:
        if miniapp_url:
            requests.post(f'https://api.telegram.org/bot{BUYER_TOKEN}/setChatMenuButton', json={
                'menu_button': {'type': 'web_app', 'text': 'Joynshop', 'web_app': {'url': miniapp_url}}
            })
        requests.post(f'https://api.telegram.org/bot{BUYER_TOKEN}/setMyCommands', json={
            'commands': [
                {'command': 'start',     'description': '🏠 Bosh sahifa'},
                {'command': 'mystatus',  'description': '📋 Mening buyurtmalarim'},
                {'command': 'myprofile', 'description': '👤 Profilim'},
                {'command': 'feedback',  'description': '✍️ Fikr bildirish'},
                {'command': 'settings',  'description': '⚙️ Sozlamalar'},
            ]
        })

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
                {'command': 'golive',     'description': '🔴 Live boshlash'},
                {'command': 'mylive',     'description': '📺 Live dashboard'},
                {'command': 'mychannels', 'description': '📢 Kanallarim'},
                {'command': 'help',       'description': 'ℹ️ Yordam'},
            ]
        })
    logging.info("Bot UI setup done.")

# ─── SHARED STORAGE ─────────────────────────────────────────────────
products        = {}
groups          = {}
orders          = {}
wishlists       = {}
buyer_profiles  = {}
refund_requests = {}
seller_state    = {}
customers       = {}  # {seller_id: {user_id: {...}}}
lives           = {}  # {live_id: {...}} - Live Commerce streams
_photo_url_cache = {}
seller_shops    = {}
seller_products = {}
verified_channels       = {}
pending_moderator_codes = {}
referrals               = {}
referral_map            = {}

# ─── PERSISTENCE (PostgreSQL) ───────────────────────────────────────
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db():
    import urllib.parse, ssl
    r = urllib.parse.urlparse(DATABASE_URL)
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    return pg8000.connect(
        host=r.hostname, port=r.port or 5432,
        database=r.path.lstrip('/'),
        user=r.username, password=r.password,
        ssl_context=ssl_ctx
    )

def init_db():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "CREATE TABLE IF NOT EXISTS joynshop_data "
            "(key TEXT PRIMARY KEY, value TEXT)"
        )
        conn.commit()
        cur.close(); conn.close()
        logging.info("DB initialized")
    except Exception as e:
        logging.error(f"init_db error: {e}", exc_info=True)

def save_data():
    if not DATABASE_URL:
        logging.warning("No DATABASE_URL")
        return
    for attempt in range(3):
        try:
            data = {
                'products':               products,
                'groups':                 groups,
                'orders':                 orders,
                'wishlists':              wishlists,
                'buyer_profiles':         buyer_profiles,
                'refund_requests':        refund_requests,
                'seller_products':        {str(k): v for k, v in seller_products.items()},
                'seller_shops':           {str(k): v for k, v in seller_shops.items()},
                'verified_channels':      verified_channels,
                'pending_moderator_codes':pending_moderator_codes,
                'referrals':              referrals,
                'referral_map':           {str(k): v for k, v in referral_map.items()},
                'customers':              {str(k): v for k, v in customers.items()},
                'lives':                  {str(k): v for k, v in lives.items()},
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
            return
        except Exception as e:
            logging.error(f"save_data error (attempt {attempt+1}): {e}")
            if attempt == 2:
                logging.error("save_data failed 3 times!", exc_info=True)

def load_data():
    global products, groups, orders, wishlists, buyer_profiles
    global refund_requests, seller_products, verified_channels
    global pending_moderator_codes, referrals, referral_map, seller_shops, customers, lives
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
        raw_ss = data.get('seller_shops', {})
        seller_shops = {int(k) if str(k).isdigit() else k: v for k, v in raw_ss.items()}
        pending_moderator_codes= data.get('pending_moderator_codes', {})
        referrals              = data.get('referrals', {})
        raw_rm                 = data.get('referral_map', {})
        referral_map           = {int(k) if str(k).isdigit() else k: v for k, v in raw_rm.items()}
        raw_sp                 = data.get('seller_products', {})
        seller_products        = {int(k) if k.isdigit() else k: v for k, v in raw_sp.items()}
        raw_cu = data.get('customers', {})
        customers = {int(k) if str(k).isdigit() else k: v for k, v in raw_cu.items()}
        raw_lv = data.get('lives', {})
        lives = {k: v for k, v in raw_lv.items()}
        logging.info(f"Data loaded: {len(products)} products, {len(orders)} orders")
        print(f"[JOYNSHOP] Data loaded: {len(products)} products, {len(seller_shops)} shops, {len(orders)} orders")
    except Exception as e:
        logging.error(f"load_data error: {e}", exc_info=True)
        print(f"[JOYNSHOP] load_data ERROR: {e}")

# ─── CLICK PAYMENT HELPERS ──────────────────────────────────────────
def send_invoice(cid, title, description, payload, amount, photo_url=None):
    """Telegram Bot Payments orqali Click invoice yuborish"""
    if not CLICK_TOKEN:
        return None
    data = {
        'chat_id':          cid,
        'title':            title,
        'description':      description,
        'payload':          payload,
        'provider_token':   CLICK_TOKEN,
        'currency':         'UZS',
        'prices':           json.dumps([{'label': title, 'amount': amount * 100}]),
        'need_name':        True,
        'need_phone_number': True,
        'need_shipping_address': False,
        'is_flexible':      False,
    }
    if photo_url:
        data['photo_url'] = photo_url
        data['photo_size'] = 512
    return api('sendInvoice', data, BUYER_TOKEN)

def answer_pre_checkout(query_id, ok=True, error=None, token=None):
    """PreCheckoutQuery ga javob berish"""
    data = {'pre_checkout_query_id': query_id, 'ok': ok}
    if error:
        data['error_message'] = error
    return api('answerPreCheckoutQuery', data, token or SELLER_TOKEN)

# ─── CRM HELPER ─────────────────────────────────────────────────────
def update_customer(seller_id, user_id, user_name, amount, product_name, source='order'):
    """Sotuvchining CRM bazasini yangilash"""
    sid = str(seller_id)
    uid = str(user_id)
    if sid not in customers:
        customers[sid] = {}
    if uid not in customers[sid]:
        customers[sid][uid] = {
            'name':         user_name,
            'user_id':      user_id,
            'total_orders': 0,
            'total_spent':  0,
            'orders':       [],
            'first_order':  datetime.now().strftime('%d.%m.%Y'),
            'last_order':   datetime.now().strftime('%d.%m.%Y'),
            'source':       source,
            'tags':         [],
        }
    cust = customers[sid][uid]
    cust['name']         = user_name
    cust['total_orders'] += 1
    cust['total_spent']  += amount
    cust['last_order']   = datetime.now().strftime('%d.%m.%Y')
    cust['orders'].append({
        'product': product_name,
        'amount':  amount,
        'date':    datetime.now().strftime('%d.%m.%Y %H:%M')
    })
    # Faqat oxirgi 20 ta buyurtmani saqlash
    if len(cust['orders']) > 20:
        cust['orders'] = cust['orders'][-20:]
    save_data()

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

def edit_message(cid, mid, text, kb=None, token=None):
    token = token or SELLER_TOKEN
    d = {'chat_id': cid, 'message_id': mid, 'text': text, 'parse_mode': 'HTML'}
    if kb: d['reply_markup'] = json.dumps(kb)
    return requests.post(f'https://api.telegram.org/bot{token}/editMessageText', json=d).json()

def send_or_edit_seller(cid, text, kb=None, state=None):
    mid = state.get('ob_msg_id') if state else None
    if mid:
        r = edit_message(cid, mid, text, kb)
        if r and r.get('ok'):
            return r
    r = send(cid, text, kb)
    if r and state is not None:
        result = r.get('result', {})
        if result.get('message_id'):
            state['ob_msg_id'] = result['message_id']
    return r

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
def strip_html(text):
    """HTML teglarini olib tashlash — invoice description uchun"""
    import re
    return re.sub(r'<[^>]+>', '', text)

def invoice_description(p, pid):
    """Invoice uchun toza matn (HTML yo'q)"""
    count     = len(groups.get(pid, []))
    min_g     = p['min_group']
    orig      = p['original_price']
    solo      = p.get('solo_price', 0)
    group     = p['group_price']
    sale_type = p.get('sale_type', 'both')
    solo_disc = round((orig - solo) / orig * 100) if solo and orig else 0
    grp_disc  = round((orig - group) / orig * 100) if orig else 0
    lines = []
    if sale_type == 'solo':
        if p.get('description'):
            lines.append(p['description'][:100])
        lines.append(f"🏪 {p.get('shop_name','')} | {p.get('contact','')}")
        return "\n".join(lines)[:255]
    elif sale_type == 'group':
        lines.append(f"👥 Guruh narxi: {fmt(group)} so'm (-{grp_disc}%)")
        lines.append(f"👥 Guruh: {count}/{min_g} • Kerak: {max(0, min_g-count)} kishi")
    else:
        if solo:
            lines.append(f"👤 Yakka: {fmt(solo)} so'm (-{solo_disc}%)")
        lines.append(f"👥 Guruh: {fmt(group)} so'm (-{grp_disc}%)")
        lines.append(f"👥 Guruh: {count}/{min_g} • Kerak: {max(0, min_g-count)} kishi")
    lines.append(f"🕐 {p.get('deadline','')}")
    if p.get('description'):
        lines.append(p['description'][:100])
    lines.append(f"🏪 {p.get('shop_name','')} | {p.get('contact','')}")
    return "\n".join(lines)[:255]

def post_caption(p, pid):
    count     = len(groups.get(pid, []))
    min_g     = p['min_group']
    orig      = p['original_price']
    solo      = p.get('solo_price', 0)
    group     = p['group_price']
    solo_disc = round((orig - solo) / orig * 100) if solo and orig else 0
    grp_disc  = round((orig - group) / orig * 100) if orig else 0
    status    = '\U0001f525' if count < min_g else '\u2705'
    sale_type = p.get('sale_type', 'both')

    lines = [f"<b>{p['name']}</b>\n"]

    if sale_type == 'solo':
        if orig and orig != solo:
            lines.append(f"\U0001f4b0 Asl narx: <s>{fmt(orig)} so'm</s>")
        lines.append(f"\U0001f6d2 <b>{fmt(solo)} so'm</b>")
    elif sale_type == 'group':
        if orig and orig != group:
            lines.append(f"\U0001f4b0 Asl narx: <s>{fmt(orig)} so'm</s>")
        lines.append(f"\U0001f465 Guruh narxi: <b>{fmt(group)} so'm</b>  <i>(-{grp_disc}%)</i>")
        lines.append(f"\U0001f465 Guruh: {count}/{min_g} {status}")
        lines.append(f"\u23f3 Kerak: {max(0, min_g - count)} kishi")
    else:
        if orig:
            lines.append(f"\U0001f4b0 Asl narx: <s>{fmt(orig)} so'm</s>")
        if solo:
            lines.append(f"\U0001f464 Yakka: <b>{fmt(solo)} so'm</b>  <i>(-{solo_disc}%)</i>")
        lines.append(f"\U0001f465 Guruh: <b>{fmt(group)} so'm</b>  <i>(-{grp_disc}%)</i>")
        lines.append(f"\U0001f465 Guruh: {count}/{min_g} {status}")
        lines.append(f"\u23f3 Kerak: {max(0, min_g - count)} kishi")

    if sale_type != 'solo':
        lines.append(f"\U0001f550 {p.get('deadline','')}")
    if p.get('description'):
        lines.append(f"\n📝 {p['description']}")
    if p.get('variants'):
        lines.append(f"🎨 {', '.join(p['variants'])}")

    contact = p.get('contact', '')
    phone2  = p.get('phone2', '')
    address = p.get('address', '')
    social  = p.get('social', {})

    shop_line = f"\n🏪 <b>{p['shop_name']}</b>"
    if contact:
        shop_line += f"  |  📞 {contact}"
    lines.append(shop_line)
    if phone2:
        lines.append(f"📱 {phone2}")
    if address:
        lines.append(f"📍 {address}")
    if social:
        icons = {'instagram':'📸','telegram':'✈️','youtube':'▶️','website':'🌐','tiktok':'🎵'}
        for k, v in social.items():
            icon = icons.get(k.lower(), '🔗')
            lines.append(f"{icon} {k.capitalize()}: {v}")

    return "\n".join(lines)

def join_kb(pid, count, min_g, has_solo=False, sale_type='both'):
    """Kanal post tugmalari — Joynshop sayt to'lov sahifasiga yo'naltiradi."""
    if count >= min_g:
        return {'inline_keyboard': [[{'text': "✅ Guruh to'ldi!", 'url': APP_URL or f'https://t.me/{BUYER_BOT_USERNAME}'}]]}
    kb = []
    # Sayt to'lov sahifasi — joynshop.uz/pay/PID?type=solo|group
    base = (APP_URL or '').rstrip('/') + '/pay'
    if sale_type in ('solo', 'both') and has_solo:
        kb.append([{'text': "🛒 Sotib olish (yakka)",
                    'url': f'{base}/{pid}?type=solo'}])
    if sale_type in ('group', 'both'):
        kb.append([{'text': f"👥 Guruhga qo'shilish ({count}/{min_g})",
                    'url': f'{base}/{pid}?type=group'}])
    if not kb:
        kb.append([{'text': "🛍 Xarid qilish",
                    'url': f'{base}/{pid}?type=group'}])
    return kb_inline(kb)

def kb_inline(rows):
    return {'inline_keyboard': rows}

# ─── CHEK ────────────────────────────────────────────────────────────
def build_check(order_code, order):
    p            = products.get(order['product_id'], {})
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
def notify_group_filled(pid):
    """Guruh to'lganda barcha a'zolarga, sotuvchiga va kanalga xabar yuboradi."""
    p = products.get(pid)
    if not p: return
    count   = len(groups.get(pid, []))
    min_g   = p.get('min_group', 3)
    sid     = p.get('seller_id')
    name    = p.get('name', '')
    shop    = p.get('shop_name', '')
    contact = p.get('contact', '')
    total      = count * p.get('group_price', 0)
    commission = int(total * COMMISSION_RATE)
    payout     = total - commission

    # 1. Barcha guruh a'zolariga
    for wuid in groups.get(pid, []):
        try:
            send_buyer(wuid,
                f"\U0001f525 <b>GURUH TO'LDI!</b>\n\n"
                f"\U0001f3ea {shop}\n"
                f"\U0001f4e6 {name}\n"
                f"\U0001f4de Sotuvchi: {contact}\n\n"
                f"\u2705 Buyurtmangiz tasdiqlandi! Sotuvchi siz bilan bog'lanadi.",
                {'inline_keyboard': [[
                    {'text': '\u2b50 Baho bering', 'callback_data': f'rate_start_{pid}'},
                    {'text': '\u21a9\ufe0f Qaytarish', 'callback_data': f'refund_{pid}'},
                ]]}
            )
        except: pass

    # 2. Wishlist da bor lekin guruhga qo'shilmagan odamlarga
    group_members = set(groups.get(pid, []))
    for wl_uid, wl in wishlists.items():
        if pid in wl and wl_uid not in group_members:
            try:
                send_buyer(wl_uid,
                    f"\U0001f614 <b>Siz qiziqgan guruh to'ldi!</b>\n\n"
                    f"\U0001f4e6 {name}\n"
                    f"\U0001f3ea {shop}\n\n"
                    f"Keyingi guruhga qo'shilish uchun kuzatib boring:",
                    {'inline_keyboard': [[
                        {'text': "\U0001f514 Kuzatish",
                         'url': f'https://t.me/{BUYER_BOT_USERNAME}?start=join_{pid}'}
                    ]]}
                )
            except: pass

    # 3. Sotuvchiga moliyaviy xabar
    if sid:
        send_seller(sid,
            f"\U0001f389 <b>GURUH TO'LDI!</b>\n\n"
            f"\U0001f4e6 {name}\n"
            f"\U0001f465 {count}/{min_g} kishi qo'shildi!\n\n"
            f"\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"
            f"\U0001f4b0 Jami sotuv: <b>{fmt(total)} so'm</b>\n"
            f"\U0001f4ca Komissiya (5%): <b>{fmt(commission)} so'm</b>\n"
            f"\u2705 Sizga to'lanadi: <b>{fmt(payout)} so'm</b>\n"
            f"\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n"
            f"\U0001f4b3 Karta raqamingizni yuboring,\n"
            f"pul 24 soat ichida o'tkaziladi."
        )
        if ADMIN_ID:
            send_seller(ADMIN_ID,
                f"\U0001f4b0 <b>To'lov kerak!</b>\n\n"
                f"\U0001f4e6 {name}\n"
                f"\U0001f464 Sotuvchi ID: <code>{sid}</code>\n"
                f"\U0001f4b5 O'tkazish kerak: <b>{fmt(payout)} so'm</b>\n"
                f"\U0001f4ca Komissiya: <b>{fmt(commission)} so'm</b>"
            )

    # 4. Kanal postini yangilash
    channel_cid = p.get('channel_chat_id')
    channel_mid = p.get('channel_message_id')
    if channel_cid and channel_mid:
        try:
            edit_caption(channel_cid, channel_mid,
                post_caption(p, pid),
                {'inline_keyboard': [[
                    {'text': "\u2705 Guruh to'ldi!",
                     'url': f'https://t.me/{BUYER_BOT_USERNAME}'}
                ]]}
            )
        except: pass


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
            # notify_group_filled barcha xabarlarni yuboradi
            notify_group_filled(pid)
        else:
            send_seller(sid,
                f"😔 <b>Guruh to'lmadi</b>\n\n"
                f"<b>{p['name']}</b>\n"
                f"👥 {count}/{p['min_group']} kishi\n\n"
                f"Yangi mahsulot qo'shib ko'ring.",
                {'inline_keyboard': [[{'text': "➕ Yangi mahsulot qo'shish", 'callback_data': 'menu_addproduct'}]]}
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
                            f"Kanalda qayta e'lon qiling:",
                            {'inline_keyboard': [[{'text': "📢 Qayta e'lon qilish", 'callback_data': f'boost_{pid}'}]]}
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
PROD_ALLOWED_CBS = {
    'prod_photo_done', 'prod_skip_desc', 'prod_add_desc', 'prod_add_solo', 'prod_add_variants',
    'prod_confirm_publish', 'prod_continue', 'prod_restart',
    'prod_deadline_24', 'prod_deadline_48', 'prod_deadline_72', 'prod_deadline_168',
    'prod_stock_unlimited',
    'ob_skip_phone2', 'ob_skip_address', 'ob_skip_social', 'ob_keep_phone',
    'ob_delivery_deliver', 'ob_delivery_pickup', 'ob_delivery_both',
    'edit_shop_0', 'edit_shop_1', 'edit_shop_2',
    'back_menu', 'noop', 'menu_mycustomers', 'menu_inventory', 'menu_export', 'live_cancel', 'live_start',
}

PROD_BLOCKED_TEXTS = {
    "➕ Mahsulot qo'shish", '/addproduct',
    '📦 Mahsulotlarim', '/myproducts',
    '📋 Buyurtmalar', '/myorders',
    '📊 Statistika', '/mystats',
    "📢 Do'konlarim", '/mychannels',
    '❓ Yordam', '/help',
}

def is_prod_in_progress(uid):
    s = seller_state.get(uid)
    if not s: return False
    prod_steps = {'prod_name','prod_category','prod_sale_type','prod_photo','prod_price','prod_min_group','prod_stock',
                  'prod_desc','prod_confirm','prod_edit_desc','prod_edit_solo','prod_edit_variants'}
    return s.get('step') in prod_steps

def get_prod_progress_text(uid):
    s = seller_state.get(uid, {})
    step = s.get('step','')
    name = s.get('name', s.get('prod_name', '—'))
    step_names = {
        'prod_name':      '1/7 — Nom',
        'prod_category':  '2/7 — Kategoriya',
        'prod_sale_type': '3/7 — Sotuv turi',
        'prod_photo':     '2/5 — Rasmlar',
        'prod_price':     '3/5 — Narx',
        'prod_min_group': '4/5 — Guruh soni',
        'prod_desc':      '5/5 — Tavsif',
        'prod_confirm':   '6/6 — Tasdiqlash',
        'prod_edit_desc': '5/5 — Tavsif',
        'prod_edit_solo': '5/5 — Yakka narx',
        'prod_edit_variants': '5/5 — Variantlar',
    }
    step_label = step_names.get(step, step)
    return (
        f"📋 Siz allaqachon mahsulot qo'shmoqdasiz:\n\n"
        f"📦 <b>{name}</b>\n"
        f"📍 Holat: {step_label}\n\n"
        f"Davom etasizmi yoki yangi boshlamoqchimisiz?"
    )

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
    if 'callback_query'   in data: seller_handle_cb(data['callback_query'])
    elif 'pre_checkout_query' in data: handle_pre_checkout(data['pre_checkout_query'])
    elif 'message'        in data:
        msg = data['message']
        if 'successful_payment' in msg:
            handle_successful_payment(msg)
        else:
            seller_handle_msg(msg)
    return 'ok'

def seller_handle_cb(cb):
    cbid = cb['id']
    uid  = cb['from']['id']
    d    = cb['data']

    if d == 'noop':
        answer_cb(cbid); return

    if is_prod_in_progress(uid) and d not in PROD_ALLOWED_CBS and not d.startswith('prod_') and not d.startswith('ob_') and not d.startswith('edit_shop_') and not d.startswith('cat_') and not d.startswith('sale_type_') and not d.startswith('crm_') and not d.startswith('live_'):
        answer_cb(cbid)
        send_seller(uid, get_prod_progress_text(uid),
            {'inline_keyboard': [
                [{'text': "▶️ Davom etish", 'callback_data': 'prod_continue'}],
                [{'text': "🗑 Bekor qilish", 'callback_data': 'prod_restart'}],
            ]}
        )
        return

    if d == 'add_new_shop':
        answer_cb(cbid)
        seller_state[uid] = {'step': 'ob_shop_name', 'adding_shop': True}
        send_seller(uid, "🏪 <b>Yangi do'kon</b>\n\n<b>1/4</b> Do'kon nomini yozing:")
        return

    if d.startswith('ob_delivery_'):
        s = seller_state.get(uid)
        if not s: answer_cb(cbid); return
        delivery_map = {'ob_delivery_deliver': 'deliver', 'ob_delivery_pickup': 'pickup', 'ob_delivery_both': 'both'}
        s['ob_delivery'] = delivery_map.get(d, 'pickup')
        s['step'] = 'ob_channel'; answer_cb(cbid)
        send_or_edit_seller(uid,
            "📢 Telegram kanal username:\n<i>@mening_kanalim</i>\n\n"
            "⚠️ Seller bot kanalga <b>admin</b> sifatida qo'shilgan bo'lishi kerak!",
            state=s)
        return

    if d in ('ob_skip_phone2', 'ob_keep_phone'):
        s = seller_state.get(uid)
        if not s: answer_cb(cbid); return
        if d == 'ob_keep_phone':
            idx = s.get('edit_shop_idx', 0)
            shops = seller_shops.get(uid, [])
            s['ob_phone'] = shops[idx].get('phone', '') if idx < len(shops) else s.get('ob_phone', '')
        else:
            s['ob_phone2'] = ''
        s['step'] = 'ob_address'; answer_cb(cbid)
        send_or_edit_seller(uid,
            "📍 Do'kon manzili (ixtiyoriy):\n<i>Toshkent, Chilonzor, 3-mavze</i>",
            {'inline_keyboard': [[{'text': "⏭ O'tkazib yuborish", 'callback_data': 'ob_skip_address'}]]},
            state=s)
        return

    if d == 'ob_skip_address':
        s = seller_state.get(uid)
        if not s: answer_cb(cbid); return
        s['ob_address'] = ''; s['step'] = 'ob_social'; answer_cb(cbid)
        send_or_edit_seller(uid,
            "🌐 Ijtimoiy tarmoqlar (ixtiyoriy):\n"
            "<code>instagram: @dokon_uz\ntelegram: @kanal\nwebsite: dokon.uz</code>",
            {'inline_keyboard': [[{'text': "⏭ O'tkazib yuborish", 'callback_data': 'ob_skip_social'}]]},
            state=s)
        return

    if d == 'ob_skip_social':
        s = seller_state.get(uid)
        if not s: answer_cb(cbid); return
        s['ob_social'] = {}; s['step'] = 'ob_delivery'; answer_cb(cbid)
        send_or_edit_seller(uid,
            "🚚 Yetkazib berish turini tanlang:",
            {'inline_keyboard': [
                [{'text': "🚚 Yetkazib beraman",   'callback_data': 'ob_delivery_deliver'}],
                [{'text': "🏪 Xaridor olib ketadi", 'callback_data': 'ob_delivery_pickup'}],
                [{'text': "🚚🏪 Ikkalasi ham",       'callback_data': 'ob_delivery_both'}],
            ]},
            state=s)
        return

    if d.startswith('edit_shop_'):
        idx = int(d.split('_')[2])
        shops = seller_shops.get(uid, [])
        if idx >= len(shops): answer_cb(cbid); return
        shop = shops[idx]; answer_cb(cbid)
        social_text = '\n'.join(f"🔗 {k}: {v}" for k, v in shop.get('social', {}).items())
        send_seller(uid,
            f"✏️ <b>Do'kon tahrirlash</b>\n\n"
            f"🏪 {shop['name']}\n📞 {shop['phone']}"
            f"{chr(10)+'📱 '+shop.get('phone2','') if shop.get('phone2') else ''}"
            f"{chr(10)+'📍 '+shop.get('address','') if shop.get('address') else ''}"
            f"{chr(10)+social_text if social_text else ''}\n📢 {shop.get('channel','')}",
            {'inline_keyboard': [
                [{'text': "✏️ Qayta to'ldirish",          'callback_data': f'edit_shop_full_{idx}'}],
                [{'text': "📱 Tel qo'shish/o'zgartirish", 'callback_data': f'edit_shop_phone_{idx}'}],
                [{'text': "📍 Manzil",                    'callback_data': f'edit_shop_address_{idx}'}],
                [{'text': "🌐 Ijtimoiy tarmoqlar",         'callback_data': f'edit_shop_social_{idx}'}],
                [{'text': "❌ Bekor",                      'callback_data': 'noop'}],
            ]})
        return

    if d.startswith('edit_shop_full_'):
        idx = int(d.split('_')[3])
        answer_cb(cbid)
        seller_state[uid] = {'step': 'ob_shop_name', 'edit_shop_idx': idx}
        shops = seller_shops.get(uid, [])
        shop = shops[idx] if idx < len(shops) else {}
        send_seller(uid,
            f"✏️ Do'kon nomini kiriting:\n<i>Hozir: {shop.get('name', '')}</i>")
        return

    if d.startswith('edit_shop_phone_'):
        idx = int(d.split('_')[3])
        answer_cb(cbid)
        seller_state[uid] = {'step': 'edit_phone_direct', 'edit_shop_idx': idx,
                             'ob_shop_name': seller_shops[uid][idx]['name'],
                             'ob_delivery':  seller_shops[uid][idx].get('delivery','pickup'),
                             'ob_channel':   seller_shops[uid][idx].get('channel',''),
                             'ob_address':   seller_shops[uid][idx].get('address',''),
                             'ob_social':    seller_shops[uid][idx].get('social',{})}
        send_seller(uid, "📞 Yangi telefon raqam:\n<i>+998XXXXXXXXX</i>")
        return

    if d.startswith('edit_shop_address_'):
        idx = int(d.split('_')[3])
        answer_cb(cbid)
        seller_state[uid] = {'step': 'edit_address_direct', 'edit_shop_idx': idx,
                             'ob_shop_name': seller_shops[uid][idx]['name'],
                             'ob_phone':     seller_shops[uid][idx].get('phone',''),
                             'ob_phone2':    seller_shops[uid][idx].get('phone2',''),
                             'ob_delivery':  seller_shops[uid][idx].get('delivery','pickup'),
                             'ob_channel':   seller_shops[uid][idx].get('channel',''),
                             'ob_social':    seller_shops[uid][idx].get('social',{})}
        send_seller(uid, "📍 Do'kon manzili:\n<i>Toshkent, Chilonzor, 3-mavze</i>")
        return

    if d.startswith('edit_shop_social_'):
        idx = int(d.split('_')[3])
        answer_cb(cbid)
        seller_state[uid] = {'step': 'edit_social_direct', 'edit_shop_idx': idx,
                             'ob_shop_name': seller_shops[uid][idx]['name'],
                             'ob_phone':     seller_shops[uid][idx].get('phone',''),
                             'ob_phone2':    seller_shops[uid][idx].get('phone2',''),
                             'ob_address':   seller_shops[uid][idx].get('address',''),
                             'ob_delivery':  seller_shops[uid][idx].get('delivery','pickup'),
                             'ob_channel':   seller_shops[uid][idx].get('channel','')}
        send_seller(uid,
            "🌐 Ijtimoiy tarmoqlar:\n\n"
            "<code>instagram: @dokon_uz\ntelegram: @kanal\nwebsite: dokon.uz\nyoutube: @kanal</code>\n\n"
            "<i>Faqat mavjudlarini yozing</i>")
        return

    if d.startswith('sel_shop_'):
        idx = int(d.split('_')[2])
        shops = seller_shops.get(uid, [])
        if idx >= len(shops): answer_cb(cbid, '❌'); return
        shop = shops[idx]; answer_cb(cbid)
        seller_state[uid] = {
            'step': 'prod_name', 'shop_idx': idx,
            'shop_name':      shop['name'],
            'contact':        shop['phone'],
            'delivery_type':  shop.get('delivery','pickup'),
            'seller_channel': shop.get('channel',''),
        }
        send_seller(uid,
            f"📦 <b>{shop['name']}</b> uchun yangi mahsulot\n\n"
            "<b>1/4</b> Mahsulot nomini yozing:")
        return

    if d.startswith('cat_'):
        answer_cb(cbid)
        s = seller_state.get(uid)
        if not s: return
        cat = d[4:]
        s['category'] = cat; s['step'] = 'prod_sale_type'
        send_seller(uid,
            f"✅ Kategoriya: <b>{cat}</b>\n\n"
            "<b>3/7</b> Sotuv turini tanlang:",
            {'inline_keyboard': [
                [{'text': "👥 Faqat guruhli sotuv", 'callback_data': 'sale_type_group'}],
                [{'text': "👤 Faqat yakka sotuv",   'callback_data': 'sale_type_solo'}],
                [{'text': "👥+👤 Ikkalasi ham",      'callback_data': 'sale_type_both'}],
            ]}
        )
        return

    if d in ('sale_type_group', 'sale_type_solo', 'sale_type_both'):
        answer_cb(cbid)
        s = seller_state.get(uid)
        if not s: return
        s['sale_type'] = d.replace('sale_type_', '')
        s['step'] = 'prod_photo'; s['photo_ids'] = []; s['photo_urls'] = []
        type_label = {'group': '👥 Guruhli', 'solo': '👤 Yakka', 'both': '👥+👤 Ikkalasi'}
        send_seller(uid,
            f"✅ {type_label.get(s['sale_type'])} sotuv tanlandi\n\n"
            "<b>4/7</b> Mahsulot rasmini yuboring 📸\n<i>1-5 ta rasm yuborishingiz mumkin</i>"
        )
        return

    if d == 'prod_photo_done':
        s = seller_state.get(uid)
        if not s or not s.get('photo_ids'):
            answer_cb(cbid, '❌ Rasm yo\'q'); return
        s['step'] = 'prod_price'; answer_cb(cbid)
        sale_type = s.get('sale_type', 'both')
        if sale_type == 'solo':
            price_hint = "<b>4/5</b> Yakka sotuv narxini kiriting (so'm):\n<code>850000</code>"
        else:
            price_hint = "<b>4/5</b> Narxlarni kiriting:\n<code>850000 / 550000</code>\n<i>asl narx / guruh narxi</i>"
        send_seller(uid, f"✅ {len(s['photo_ids'])} ta rasm.\n\n{price_hint}")
        return

    if d == 'prod_confirm_publish':
        s = seller_state.get(uid)
        if not s: answer_cb(cbid); return
        answer_cb(cbid)
        publish_product(uid, uid, s); return

    if d == 'prod_add_desc':
        s = seller_state.get(uid)
        if not s: answer_cb(cbid); return
        s['step'] = 'prod_edit_desc'; answer_cb(cbid)
        send_seller(uid, "Tavsif yozing (max 300 belgi):"); return

    if d == 'prod_add_solo':
        s = seller_state.get(uid)
        if not s: answer_cb(cbid); return
        s['step'] = 'prod_edit_solo'; answer_cb(cbid)
        send_seller(uid, "Yakka sotuv narxini yozing (so'm):"); return

    if d.startswith('prod_deadline_'):
        s = seller_state.get(uid)
        if not s: answer_cb(cbid); return
        hours_map = {'prod_deadline_24': 24, 'prod_deadline_48': 48,
                     'prod_deadline_72': 72, 'prod_deadline_168': 168}
        h = hours_map.get(d, 48)
        s['deadline_hours'] = h
        answer_cb(cbid)
        shop = seller_shops.get(uid, [{}])[s.get('shop_idx', 0)]
        show_prod_confirm(uid, s, shop)
        return

    if d == 'prod_add_variants':
        s = seller_state.get(uid)
        if not s: answer_cb(cbid); return
        s['step'] = 'prod_edit_variants'; answer_cb(cbid)
        send_seller(uid, "Variantlarni vergul bilan yozing:\n<i>38, 39, 40 yoki Qizil, Ko'k</i>"); return

    if d in ('start_addproduct', 'menu_addproduct'):
        answer_cb(cbid)
        if is_prod_in_progress(uid):
            send_seller(uid, get_prod_progress_text(uid),
                {'inline_keyboard': [
                    [{'text': "▶️ Davom etish",              'callback_data': 'prod_continue'}],
                    [{'text': "🗑 Bekor qilib, yangi boshlash", 'callback_data': 'prod_restart'}],
                ]}
            )
            return
        # Sotuvchining do'konlarini tekshirish
        shops = seller_shops.get(uid, [])
        if not shops:
            send_seller(uid, "❌ Avval do'kon yarating.\n\n/start yozing.")
            return
        if len(shops) == 1:
            # Bitta do'kon — to'g'ridan-to'g'ri
            seller_state[uid] = {'step': 'prod_name', 'shop_idx': 0}
            send_seller(uid, "📦 <b>Yangi mahsulot</b>\n\n1️⃣ Mahsulot nomini yozing:")
        else:
            # Bir nechta do'kon — tanlash
            kb = []
            for i, sh in enumerate(shops):
                shop_name = sh.get('name', f"Do'kon #{i+1}")
                ch        = sh.get('channel', '')
                label     = f"🏪 {shop_name}" + (f" ({ch})" if ch else "")
                kb.append([{'text': label, 'callback_data': f'prod_shop_{i}'}])
            kb.append([{'text': "❌ Bekor", 'callback_data': 'back_menu'}])
            send_seller(uid,
                "🏪 <b>Qaysi do'konga mahsulot qo'shasiz?</b>\n\n"
                f"Sizda {len(shops)} ta do'kon bor:",
                {'inline_keyboard': kb}
            )
        return

    if d.startswith('prod_shop_'):
        answer_cb(cbid)
        try:
            idx = int(d.split('_')[2])
        except:
            return
        shops = seller_shops.get(uid, [])
        if idx < 0 or idx >= len(shops):
            send_seller(uid, "❌ Noto'g'ri do'kon.")
            return
        seller_state[uid] = {'step': 'prod_name', 'shop_idx': idx}
        shop_name = shops[idx].get('name', '')
        send_seller(uid,
            f"📦 <b>Yangi mahsulot — {shop_name}</b>\n\n"
            f"1️⃣ Mahsulot nomini yozing:"
        )
        return

    if d == 'prod_continue':
        answer_cb(cbid)
        s = seller_state.get(uid, {})
        step = s.get('step','')
        step_msgs = {
            'prod_name':      "Mahsulot nomini yozing:",
            'prod_photo':     "Rasmlarni yuboring (1-5 ta):",
            'prod_price':     "Narxni yozing (asl/guruh):",
            'prod_min_group': "Minimal guruh sonini yozing (2-10):",
        }
        msg = step_msgs.get(step, "Davom eting:")
        send_seller(uid, f"✅ Davom etmoqdasiz\n\n{msg}")
        return

    if d == 'prod_stock_unlimited':
        answer_cb(cbid)
        s = seller_state.get(uid)
        if not s or s.get('step') != 'prod_stock':
            return
        s['stock'] = 9999  # cheksiz
        s['step'] = 'prod_desc'
        s['description'] = ''
        s['variants'] = []
        send_seller(uid,
            "✅ Qoldiq: ♾ Cheksiz\n\n"
            "<b>6/7</b> Mahsulot tavsifi (ixtiyoriy):\n"
            "<i>Mahsulot haqida qo'shimcha ma'lumot...</i>",
            {'inline_keyboard': [[{'text': "⏭ O'tkazib yuborish", 'callback_data': 'prod_skip_desc'}]]}
        )
        return

    if d == 'prod_skip_desc':
        answer_cb(cbid)
        s = seller_state.get(uid)
        if not s: return
        s['description'] = ''; s['step'] = 'prod_confirm'
        shop = seller_shops.get(uid,[{}])[s.get('shop_idx',0)]
        show_prod_confirm(uid, s, shop)
        return

    if d == 'prod_restart':
        answer_cb(cbid)
        seller_state.pop(uid, None)
        send_seller(uid, "🗑 Bekor qilindi. Yangi mahsulot boshlang:",
            {'inline_keyboard': [[{'text': "➕ Mahsulot qo'shish", 'callback_data': 'menu_addproduct'}]]}
        )
        return

    if d == 'menu_mystats':
        answer_cb(cbid)
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

    if d == 'menu_mycustomers' or d.startswith('crm_'):
        answer_cb(cbid)
        sid = str(uid)
        my_customers = customers.get(sid, {})

        # Filter va sahifa
        per_page    = 5
        page        = 1
        cur_filter  = 'all'
        if d.startswith('crm_page_'):
            try: page = int(d.split('_')[2])
            except: page = 1
        elif d.startswith('crm_filter_'):
            cur_filter = d[11:]

        # ─── MIJOZ KARTASINI KO'RISH ───
        if d.startswith('crm_view_'):
            cuid = d[9:]
            cust = my_customers.get(cuid, {})
            if not cust:
                send_seller(uid, "❌ Mijoz topilmadi."); return
            orders_text = ""
            for o in reversed(cust.get('orders', [])[-5:]):
                orders_text += f"  \u2022 {o['product']} \u2014 {fmt(o['amount'])} so'm ({o['date']})\n"
            avg  = cust['total_spent'] // cust['total_orders'] if cust['total_orders'] > 0 else 0
            tags = ', '.join(cust.get('tags', [])) or '\u2014'
            note = cust.get('note', '')
            # Faollik holati
            from datetime import datetime as _dt, timedelta
            try:
                last_dt = _dt.strptime(cust.get('last_order','01.01.2020'), '%d.%m.%Y')
                days_ago = (_dt.now() - last_dt).days
                if days_ago < 7:    activity = "🟢 Faol"
                elif days_ago < 30: activity = "🟡 O'rtacha"
                else:               activity = "🔴 Yo'qotilgan"
            except:
                activity = "—"

            send_seller(uid,
                "👤 <b>" + cust['name'] + "</b>\n"
                "━━━━━━━━━━━━━━━\n"
                "📊 <b>Statistika:</b>\n"
                "🛒 Jami xaridlar: " + str(cust['total_orders']) + " ta\n"
                "💰 Jami sarflagan: " + fmt(cust['total_spent']) + " so'm\n"
                "📈 O'rtacha check: " + fmt(avg) + " so'm\n"
                "📅 Birinchi xarid: " + cust.get('first_order','—') + "\n"
                "📅 Oxirgi xarid: " + cust.get('last_order','—') + "\n"
                "⚡ Holati: " + activity + "\n"
                "🏷 Teglar: " + tags + "\n"
                + (f"📝 <b>Izoh:</b> {note}\n" if note else "") +
                "\n🛍 <b>So'nggi xaridlar:</b>\n" + (orders_text or "  Hali yo'q"),
                {'inline_keyboard': [
                    [{'text': "⭐ VIP",       'callback_data': 'crm_tag_'+cuid+'_vip'},
                     {'text': "🔴 Muammoli", 'callback_data': 'crm_tag_'+cuid+'_problem'},
                     {'text': "💎 Doimiy",   'callback_data': 'crm_tag_'+cuid+'_loyal'}],
                    [{'text': "💬 Xabar yuborish", 'callback_data': 'crm_msg_'+cuid}],
                    [{'text': "📝 Izoh qo'shish",  'callback_data': 'crm_note_'+cuid}],
                    [{'text': "⬅️ Orqaga", 'callback_data': 'menu_mycustomers'}],
                ]}
            )
            return

        # ─── TEG QO'YISH ───
        if d.startswith('crm_tag_'):
            parts = d.split('_')
            cuid, tag = parts[2], parts[3]
            if cuid in my_customers:
                tags = my_customers[cuid].get('tags', [])
                if tag in tags:
                    tags.remove(tag); msg = f"🏷 Teg olib tashlandi: {tag}"
                else:
                    tags.append(tag); msg = f"✅ Teg qo'shildi: {tag}"
                my_customers[cuid]['tags'] = tags
                customers[sid] = my_customers
                save_data()
                send_seller(uid, msg)
            return

        # ─── XABAR YUBORISH ───
        if d.startswith('crm_msg_'):
            cuid = d[8:]
            cust = my_customers.get(cuid, {})
            if not cust:
                send_seller(uid, "❌ Mijoz topilmadi."); return
            seller_state[uid] = {'step': 'crm_send_msg', 'target_uid': cust.get('user_id'), 'target_name': cust['name']}
            send_seller(uid,
                f"💬 <b>{cust['name']}</b> ga xabar yuborish\n\n"
                f"Xabar matnini yozing (yoki /cancel):"
            )
            return

        # ─── IZOH QO'SHISH ───
        if d.startswith('crm_note_'):
            cuid = d[9:]
            cust = my_customers.get(cuid, {})
            if not cust:
                send_seller(uid, "❌ Mijoz topilmadi."); return
            seller_state[uid] = {'step': 'crm_add_note', 'target_cuid': cuid, 'target_name': cust['name']}
            current_note = cust.get('note', '')
            send_seller(uid,
                f"📝 <b>{cust['name']}</b> uchun izoh\n\n"
                + (f"Joriy izoh: <i>{current_note}</i>\n\n" if current_note else "") +
                f"Yangi izoh yozing (yoki /cancel):"
            )
            return

        # ─── QIDIRUV ───
        if d == 'crm_search':
            seller_state[uid] = {'step': 'crm_search_query'}
            send_seller(uid,
                "🔍 <b>Mijoz qidirish</b>\n\n"
                "Ism yoki telefon raqamini yozing:"
            )
            return

        # ─── RO'YXAT (filter bilan) ───
        if not my_customers:
            send_seller(uid,
                "👥 <b>Mijozlar bazasi</b>\n\nHali mijoz yo'q.\n"
                "Buyurtmalar tasdiqlanganidan keyin mijozlar bu yerda ko'rinadi.",
                {'inline_keyboard': [[{'text': "⬅️ Menyu", 'callback_data': 'back_menu'}]]}
            )
            return

        # Filter qo'llash
        from datetime import datetime as _dt
        def days_since_last(c):
            try:
                last_dt = _dt.strptime(c.get('last_order','01.01.2020'), '%d.%m.%Y')
                return (_dt.now() - last_dt).days
            except: return 999

        all_items = list(my_customers.items())
        if cur_filter == 'vip':
            filtered = [(k,v) for k,v in all_items if 'vip' in v.get('tags', [])]
        elif cur_filter == 'active':
            filtered = [(k,v) for k,v in all_items if days_since_last(v) < 7]
        elif cur_filter == 'lost':
            filtered = [(k,v) for k,v in all_items if days_since_last(v) >= 30]
        elif cur_filter == 'new':
            filtered = [(k,v) for k,v in all_items if v.get('total_orders', 0) == 1]
        elif cur_filter == 'repeat':
            filtered = [(k,v) for k,v in all_items if v.get('total_orders', 0) > 1]
        else:
            filtered = all_items

        # Saralash
        filtered.sort(key=lambda x: x[1]['total_spent'], reverse=True)
        total = len(filtered)
        start = (page - 1) * per_page
        page_custs = filtered[start:start + per_page]

        # Umumiy stat
        total_revenue = sum(v['total_spent'] for v in my_customers.values())
        repeat = sum(1 for v in my_customers.values() if v['total_orders'] > 1)
        vip    = sum(1 for v in my_customers.values() if 'vip' in v.get('tags', []))

        filter_labels = {
            'all':    'Hammasi', 'vip': 'VIP', 'active': 'Faol',
            'lost':   "Yo'qotilgan", 'new': 'Yangi', 'repeat': 'Qaytib kelgan'
        }
        text = (
            "👥 <b>Mijozlar bazasi</b>\n"
            "━━━━━━━━━━━━━━━\n"
            f"📊 Jami: {len(my_customers)} ta • VIP: {vip} • Qaytib kelgan: {repeat}\n"
            f"💰 Jami daromad: {fmt(total_revenue)} so'm\n"
            f"🔍 Filter: <b>{filter_labels.get(cur_filter, 'Hammasi')}</b> ({total} ta)\n\n"
        )

        if not page_custs:
            text += "Bu filterda mijoz topilmadi.\n"
        else:
            for i, (cuid, cust) in enumerate(page_custs, start=start+1):
                medal = ['🥇','🥈','🥉'][i-1] if i <= 3 else str(i) + "."
                badges = ""
                if 'vip' in cust.get('tags', []):     badges += " ⭐"
                if 'problem' in cust.get('tags', []): badges += " 🔴"
                if 'loyal' in cust.get('tags', []):   badges += " 💎"
                d_ago = days_since_last(cust)
                act_icon = "🟢" if d_ago < 7 else "🟡" if d_ago < 30 else "🔴"
                text += (
                    f"{medal} <b>{cust['name']}{badges}</b>\n"
                    f"   🛒 {cust['total_orders']} ta • 💰 {fmt(cust['total_spent'])} so'm\n"
                    f"   {act_icon} Oxirgi: {cust.get('last_order','—')}\n\n"
                )

        # Klaviatura
        kb_rows = []
        # Filter qatori
        kb_rows.append([
            {'text': ('✅ ' if cur_filter=='all' else '') + 'Hammasi',  'callback_data': 'crm_filter_all'},
            {'text': ('✅ ' if cur_filter=='vip' else '⭐ ') + 'VIP',    'callback_data': 'crm_filter_vip'},
            {'text': ('✅ ' if cur_filter=='active' else '🟢 ') + 'Faol','callback_data': 'crm_filter_active'},
        ])
        kb_rows.append([
            {'text': ('✅ ' if cur_filter=='lost' else '🔴 ') + "Yo'qotilgan", 'callback_data': 'crm_filter_lost'},
            {'text': ('✅ ' if cur_filter=='new' else '🆕 ') + 'Yangi',         'callback_data': 'crm_filter_new'},
            {'text': ('✅ ' if cur_filter=='repeat' else '🔄 ') + 'Qaytma',     'callback_data': 'crm_filter_repeat'},
        ])
        # Qidiruv
        kb_rows.append([{'text': "🔍 Qidirish", 'callback_data': 'crm_search'}])
        # Mijozlar
        for cuid, cust in page_custs:
            kb_rows.append([{'text': "👤 " + cust['name'], 'callback_data': 'crm_view_' + cuid}])
        # Pagination
        nav = []
        if page > 1:
            nav.append({'text': "◀️", 'callback_data': f'crm_page_{page-1}'})
        if start + per_page < total:
            nav.append({'text': "▶️", 'callback_data': f'crm_page_{page+1}'})
        if nav: kb_rows.append(nav)
        kb_rows.append([{'text': "⬅️ Menyu", 'callback_data': 'back_menu'}])

        send_seller(uid, text, {'inline_keyboard': kb_rows})
        return

    # ─── LIVE COMMERCE ───────────────────────────────────────────
    if d == 'live_cancel':
        answer_cb(cbid, "Bekor qilindi")
        if uid in seller_state and seller_state[uid].get('step','').startswith('live_'):
            del seller_state[uid]
        return

    if d.startswith('live_pick_'):
        answer_cb(cbid)
        pid = d[10:]
        if pid not in products:
            send_seller(uid, "❌ Mahsulot topilmadi.")
            return
        seller_state[uid] = {
            'step': 'live_video',
            'product_id': pid,
        }
        p = products[pid]
        send_seller(uid,
            f"📦 <b>{p.get('name','')}</b>\n\n"
            f"🎥 <b>Live videoni yuboring</b>\n\n"
            f"⏱ Davomiyligi: 15 soniyadan 5 daqiqagacha\n"
            f"📐 Vertikal video tavsiya etiladi (9:16)\n\n"
            f"<i>Videoni shu chatga yuboring...</i>",
            {'inline_keyboard': [[{'text': "❌ Bekor", 'callback_data': 'live_cancel'}]]}
        )
        return

    if d.startswith('live_dur_'):
        answer_cb(cbid)
        s = seller_state.get(uid)
        if not s or s.get('step') != 'live_duration':
            return
        try:
            hours = int(d.split('_')[2])
        except:
            return
        s['duration_hours'] = hours
        s['step'] = 'live_discount'
        labels = {1: '1 soat', 3: '3 soat', 24: '24 soat'}
        send_seller(uid,
            f"⏰ Davomiyligi: {labels.get(hours, str(hours)+' soat')}\n\n"
            f"💸 <b>Qo'shimcha chegirma %?</b>\n\n"
            f"<i>Oddiy guruh narxi ustiga qo'shimcha chegirma.\n"
            f"Misol: oddiy 30%, live qo'shimcha 10% = jami 40% tejash</i>",
            {'inline_keyboard': [
                [{'text': "5%",  'callback_data': 'live_disc_5'},
                 {'text': "10%", 'callback_data': 'live_disc_10'},
                 {'text': "15%", 'callback_data': 'live_disc_15'},
                 {'text': "20%", 'callback_data': 'live_disc_20'}],
                [{'text': "❌ Bekor", 'callback_data': 'live_cancel'}],
            ]}
        )
        return

    if d.startswith('live_disc_'):
        answer_cb(cbid)
        s = seller_state.get(uid)
        if not s or s.get('step') != 'live_discount':
            return
        try:
            pct = int(d.split('_')[2])
        except:
            return
        s['discount_pct'] = pct
        s['step'] = 'live_confirm'
        # Tasdiq xabari
        p = products.get(s['product_id'], {})
        group_price = p.get('group_price', 0)
        live_price  = int(group_price * (100 - pct) / 100)
        s['live_price'] = live_price
        send_seller(uid,
            f"📋 <b>LIVE tasdiqlash</b>\n\n"
            f"📦 {p.get('name','')}\n"
            f"💰 Oddiy guruh: {fmt(group_price)} so'm\n"
            f"🔴 Live narx: <b>{fmt(live_price)} so'm</b> (-{pct}% qo'shimcha)\n"
            f"⏰ Davomiyligi: {s['duration_hours']} soat\n\n"
            f"Live boshlangach kanaliga avtomatik post yuboramiz.",
            {'inline_keyboard': [
                [{'text': "🚀 LIVE BOSHLASH", 'callback_data': 'live_start'}],
                [{'text': "❌ Bekor",         'callback_data': 'live_cancel'}],
            ]}
        )
        return

    if d == 'live_start':
        answer_cb(cbid, "🔴 Live boshlanmoqda...", token=SELLER_TOKEN)
        s = seller_state.get(uid)
        if not s or s.get('step') != 'live_confirm':
            return
        # Live yaratish
        from datetime import datetime as _dt, timedelta
        live_id = 'live_' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        now = _dt.now()
        ends = now + timedelta(hours=s['duration_hours'])
        live_data = {
            'id':             live_id,
            'product_id':     s['product_id'],
            'seller_id':      uid,
            'video_file_id':  s.get('video_file_id', ''),
            'video_duration': s.get('video_duration', 0),
            'duration_hours': s['duration_hours'],
            'discount_pct':   s['discount_pct'],
            'live_price':     s['live_price'],
            'status':         'live',
            'started_at':     now.strftime('%Y-%m-%d %H:%M'),
            'ends_at':        ends.strftime('%Y-%m-%d %H:%M'),
            'viewers':        [],
            'joiners':        [],
            'viewer_count':   0,
            'questions':      [],
            'channel_msg_id': None,
        }
        lives[live_id] = live_data
        del seller_state[uid]
        save_data()

        # Sotuvchi kanaliga post yuborish
        p = products.get(s['product_id'], {})
        channel = p.get('seller_channel', '')
        if channel:
            try:
                video_id = live_data['video_file_id']
                caption = (
                    f"🔴 <b>LIVE — {p.get('name','')}</b>\n\n"
                    f"💰 Oddiy: {fmt(p.get('group_price',0))} so'm\n"
                    f"🔥 LIVE narx: <b>{fmt(s['live_price'])} so'm</b>\n"
                    f"⏰ {s['duration_hours']} soat ichida tugaydi!\n\n"
                    f"🎬 Tomosha qiling va guruhga qo'shiling 👇"
                )
                live_url = f"{(BACKEND_URL or '').rstrip('/')}/live/{live_id}"
                kb_live = {'inline_keyboard': [[
                    {'text': "▶️ LIVE TOMOSHA QILISH", 'url': live_url}
                ]]}
                if video_id:
                    r = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendVideo', json={
                        'chat_id':    channel,
                        'video':      video_id,
                        'caption':    caption,
                        'parse_mode': 'HTML',
                        'reply_markup': kb_live,
                    }).json()
                else:
                    r = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendMessage', json={
                        'chat_id':    channel,
                        'text':       caption,
                        'parse_mode': 'HTML',
                        'reply_markup': kb_live,
                    }).json()
                if r.get('ok'):
                    lives[live_id]['channel_msg_id'] = r['result'].get('message_id')
                    save_data()
            except Exception as e:
                logging.error(f"Live channel post error: {e}")

        send_seller(uid,
            f"🔴 <b>LIVE BOSHLANDI!</b>\n\n"
            f"📦 {p.get('name','')}\n"
            f"⏰ Tugaydi: {ends.strftime('%H:%M')}\n\n"
            f"Real-time dashboard:",
            {'inline_keyboard': [[
                {'text': "📊 Dashboard", 'callback_data': f'live_dash_{live_id}'},
            ]]}
        )
        return

    if d.startswith('live_dash_'):
        answer_cb(cbid)
        live_id = d[10:]
        lv = lives.get(live_id)
        if not lv:
            send_seller(uid, "❌ Live topilmadi.")
            return
        p = products.get(lv.get('product_id',''), {})
        from datetime import datetime as _dt
        try:
            ends = _dt.strptime(lv['ends_at'], '%Y-%m-%d %H:%M')
            remaining = ends - _dt.now()
            if remaining.total_seconds() > 0:
                h = int(remaining.total_seconds() // 3600)
                m = int((remaining.total_seconds() % 3600) // 60)
                time_str = f"{h} soat {m} daqiqa qoldi"
            else:
                time_str = "TUGADI"
                lv['status'] = 'ended'
                save_data()
        except:
            time_str = "—"

        joiners = lv.get('joiners', [])
        joined_amount = sum(orders.get(j.get('order_code',''), {}).get('amount', 0)
                            for j in joiners if isinstance(j, dict))
        send_seller(uid,
            f"📊 <b>LIVE Dashboard</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"📦 {p.get('name','')}\n"
            f"⏰ {time_str}\n\n"
            f"👀 Ko'rdi: <b>{lv.get('viewer_count', 0)}</b>\n"
            f"👥 Qo'shildi: <b>{len(joiners)}</b>\n"
            f"💰 Sotuv: {fmt(joined_amount)} so'm\n"
            f"🔴 Status: {lv.get('status','—').upper()}",
            {'inline_keyboard': [
                [{'text': "🔄 Yangilash",  'callback_data': f'live_dash_{live_id}'}],
                [{'text': "🛑 Tugatish",   'callback_data': f'live_end_{live_id}'}],
                [{'text': "⬅️ Menyu",      'callback_data': 'back_menu'}],
            ]}
        )
        return

    if d.startswith('live_end_'):
        answer_cb(cbid, "Live tugatildi")
        live_id = d[9:]
        lv = lives.get(live_id)
        if not lv or lv.get('seller_id') != uid:
            return
        lv['status'] = 'ended'
        save_data()
        p = products.get(lv.get('product_id',''), {})
        send_seller(uid,
            f"🛑 <b>Live tugatildi</b>\n\n"
            f"📦 {p.get('name','')}\n"
            f"👀 Ko'rdi: {lv.get('viewer_count', 0)}\n"
            f"👥 Qo'shildi: {len(lv.get('joiners', []))}"
        )
        return
    # ─── /LIVE COMMERCE ──────────────────────────────────────────

    if d == 'menu_export' or d.startswith('export_'):
        answer_cb(cbid)

        # Tanlash menyusi
        if d == 'menu_export':
            send_seller(uid,
                "📑 <b>Eksport — Excel</b>\n\n"
                "Nimani yuklab olasiz?",
                {'inline_keyboard': [
                    [{'text': "🛒 Buyurtmalar",     'callback_data': 'export_orders'}],
                    [{'text': "👥 Mijozlar",        'callback_data': 'export_customers'}],
                    [{'text': "📦 Mahsulotlar",     'callback_data': 'export_products'}],
                    [{'text': "💰 Moliyaviy",       'callback_data': 'export_finance'}],
                    [{'text': "⬅️ Menyu",           'callback_data': 'back_menu'}],
                ]}
            )
            return

        # Excel yaratish
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill, Alignment
            import io
            wb = Workbook()
            ws = wb.active
            header_fill = PatternFill(start_color="FF6A1A", end_color="FF6A1A", fill_type="solid")
            header_font = Font(bold=True, color="FFFFFF", size=11)
            center      = Alignment(horizontal="center", vertical="center")

            export_type = d[7:]  # orders / customers / products / finance
            my_pids = set(seller_products.get(uid, []))
            sid = str(uid)
            filename = f"joynshop_{export_type}_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"

            if export_type == 'orders':
                ws.title = "Buyurtmalar"
                headers = ["№", "Kod", "Sana", "Mahsulot", "Mijoz", "Telefon", "Summa", "Tur", "Status", "Manzil"]
                ws.append(headers)
                for i, (code, o) in enumerate([(c,o) for c,o in orders.items() if o.get('product_id') in my_pids], 1):
                    p = products.get(o.get('product_id',''), {})
                    ws.append([
                        i, code, o.get('created',''), p.get('name',''),
                        o.get('user_name',''), o.get('user_phone',''),
                        o.get('amount',0),
                        'Yakka' if o.get('type')=='solo' else 'Guruh',
                        o.get('status',''),
                        o.get('address','')
                    ])

            elif export_type == 'customers':
                ws.title = "Mijozlar"
                headers = ["№", "Ism", "Telegram ID", "Buyurtmalar", "Jami", "O'rtacha", "Birinchi", "Oxirgi", "Teglar", "Izoh"]
                ws.append(headers)
                my_custs = customers.get(sid, {})
                sorted_c = sorted(my_custs.items(), key=lambda x: x[1].get('total_spent',0), reverse=True)
                for i, (cuid, c) in enumerate(sorted_c, 1):
                    avg = c['total_spent']//c['total_orders'] if c.get('total_orders') else 0
                    ws.append([
                        i, c.get('name',''), c.get('user_id',''),
                        c.get('total_orders',0), c.get('total_spent',0), avg,
                        c.get('first_order',''), c.get('last_order',''),
                        ', '.join(c.get('tags',[])), c.get('note','')
                    ])

            elif export_type == 'products':
                ws.title = "Mahsulotlar"
                headers = ["№", "ID", "Nom", "Kategoriya", "Asl narx", "Guruh narx", "Yakka narx", "Min guruh", "Qoldiq", "Sotildi", "Status"]
                ws.append(headers)
                my_prods = [(pid, p) for pid, p in products.items() if pid in my_pids]
                for i, (pid, p) in enumerate(my_prods, 1):
                    sold = p.get('stock_initial', 0) - p.get('stock', 0) if p.get('stock', 9999) < 9999 else len(groups.get(pid, []))
                    ws.append([
                        i, pid, p.get('name',''), p.get('category',''),
                        p.get('original_price',0), p.get('group_price',0), p.get('solo_price',0),
                        p.get('min_group',0),
                        p.get('stock','♾') if p.get('stock', 9999) < 9999 else '♾',
                        sold,
                        p.get('status','active')
                    ])

            elif export_type == 'finance':
                ws.title = "Moliya"
                headers = ["Sana", "Buyurtmalar soni", "Jami summa", "Komissiya (5%)", "Toza daromad"]
                ws.append(headers)
                # Kunlar bo'yicha
                from collections import defaultdict
                by_day = defaultdict(lambda: {'count': 0, 'sum': 0})
                for code, o in orders.items():
                    if o.get('product_id') in my_pids and o.get('status') == 'confirmed':
                        date = o.get('created', '').split(' ')[0]
                        by_day[date]['count'] += 1
                        by_day[date]['sum']   += o.get('amount', 0)
                for date in sorted(by_day.keys(), reverse=True):
                    s = by_day[date]['sum']
                    comm = int(s * COMMISSION_RATE)
                    ws.append([date, by_day[date]['count'], s, comm, s - comm])

            # Header style
            for col in range(1, len(headers) + 1):
                cell = ws.cell(row=1, column=col)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = center
            # Auto-width
            for col_cells in ws.columns:
                max_len = max((len(str(c.value)) for c in col_cells if c.value), default=10)
                ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 2, 40)

            # Faylni saqlash va yuborish
            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            files = {'document': (filename, buf.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            data  = {'chat_id': uid, 'caption': f"📑 {export_type.capitalize()} eksporti tayyor"}
            requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendDocument', data=data, files=files, timeout=30)
        except Exception as e:
            logging.error(f"Export error: {e}")
            send_seller(uid, f"❌ Eksport xatosi: {e}")
        return

    if d == 'menu_inventory':
        answer_cb(cbid)
        my_pids = seller_products.get(uid, [])
        my_products = [(pid, products[pid]) for pid in my_pids if pid in products]
        # Stocki bor mahsulotlar
        with_stock = [(pid, p) for pid, p in my_products if p.get('stock', 9999) < 9999]

        if not with_stock:
            send_seller(uid,
                "📦 <b>Inventar</b>\n\n"
                "Hozircha qoldig'i belgilangan mahsulot yo'q.\n"
                "Yangi mahsulot qo'shganda <b>qoldiq miqdor</b>ni kiriting.",
                {'inline_keyboard': [[{'text': "⬅️ Menyu", 'callback_data': 'back_menu'}]]}
            )
            return

        # Saralash: stock kam birinchi
        with_stock.sort(key=lambda x: x[1].get('stock', 0))
        critical = [x for x in with_stock if x[1].get('stock', 0) == 0]
        low      = [x for x in with_stock if 0 < x[1].get('stock', 0) <= 5]
        normal   = [x for x in with_stock if x[1].get('stock', 0) > 5]

        text = "📦 <b>Inventar</b>\n━━━━━━━━━━━━━━━\n\n"

        if critical:
            text += f"🔴 <b>Tugagan ({len(critical)}):</b>\n"
            for pid, p in critical[:5]:
                text += f"  • {p.get('name','—')} — <b>0 ta</b>\n"
            text += "\n"

        if low:
            text += f"🟡 <b>Kam qolgan ({len(low)}):</b>\n"
            for pid, p in low[:10]:
                stock = p.get('stock', 0)
                text += f"  • {p.get('name','—')} — <b>{stock} ta</b>\n"
            text += "\n"

        if normal:
            text += f"🟢 <b>Yetarli ({len(normal)}):</b>\n"
            for pid, p in normal[:10]:
                stock = p.get('stock', 0)
                text += f"  • {p.get('name','—')} — {stock} ta\n"

        # Sotilgan miqdorni hisoblash
        total_sold = sum(p.get('stock_initial', 0) - p.get('stock', 0) for _, p in with_stock if p.get('stock', 0) < p.get('stock_initial', 0))

        text += f"\n━━━━━━━━━━━━━━━\n"
        text += f"📊 Jami sotildi: {total_sold} ta"

        kb = []
        for pid, p in with_stock[:10]:
            stock = p.get('stock', 0)
            icon  = "🔴" if stock == 0 else "🟡" if stock <= 5 else "🟢"
            kb.append([{'text': f"{icon} {p.get('name','—')[:25]} ({stock} ta)",
                        'callback_data': f'edit_prod_{pid}'}])
        kb.append([{'text': "⬅️ Menyu", 'callback_data': 'back_menu'}])

        send_seller(uid, text, {'inline_keyboard': kb})
        return

    if d == 'menu_myorders':
        answer_cb(cbid)
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
        answer_cb(cbid)
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
        answer_cb(cbid)
        send_seller(uid,
"ℹ️ <b>Sotuvchi yordam</b>\n\n"
            "/start         — 🏠 Bosh sahifa\n"
            "/addproduct    — ➕ Mahsulot qo'shish\n"
            "/myproducts    — 📦 Mahsulotlarim\n"
            "/myorders      — 📋 Buyurtmalar\n"
            "/mystats       — 📊 Statistika\n"
            "/golive        — 🔴 Live boshlash\n"
            "/mylive        — 📺 Live dashboard\n"
            "/mychannels    — 📢 Kanallarim\n"
            "/help          — ℹ️ Yordam\n\n"
            "💬 Yordam: @joynshop_support",
            {'inline_keyboard': [[{'text': "🔙 Menyu", 'callback_data': 'back_menu'}]]}
        )
        return

    if d == 'back_menu':
        answer_cb(cbid)
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
                    {'text': "👥 Mijozlar",       'callback_data': 'menu_mycustomers'},
                ],
                [
                    {'text': "📦 Inventar",       'callback_data': 'menu_inventory'},
                    {'text': "📑 Eksport",        'callback_data': 'menu_export'},
                ],
                [
                    {'text': "❓ Yordam",         'callback_data': 'menu_help'},
                ],
            ]}
        )
        return

    if d.startswith('boost_') and not d.startswith('boost_confirm_'):
        pid = d[6:]
        p = products.get(pid)
        if not p: answer_cb(cbid, '❌ Topilmadi!'); return
        answer_cb(cbid)
        send_seller(uid,
            f"📢 <b>{p['name']}</b> ni qayta e'lon qilmoqchimisiz?\n\n"
            f"🆔 <code>{pid}</code>",
            {'inline_keyboard': [[
                {'text': "✅ Ha, e'lon qil", 'callback_data': f'boost_confirm_{pid}'},
                {'text': '❌ Bekor',         'callback_data': 'noop'},
            ]]}
        )
        return

    if d.startswith('delete_prod_'):
        pid = d[12:]
        p = products.get(pid)
        if not p: answer_cb(cbid, '❌ Topilmadi!'); return
        if p.get('seller_id') != uid and uid != ADMIN_ID:
            answer_cb(cbid, "❌ Ruxsat yo'q!"); return
        answer_cb(cbid)
        send_seller(uid,
            f"🗑 <b>{p['name']}</b> ni o'chirishni tasdiqlaysizmi?",
            {'inline_keyboard': [[
                {'text': "✅ O'chirish", 'callback_data': f'delete_confirm_{pid}'},
                {'text': '❌ Bekor',    'callback_data': 'noop'},
            ]]}
        )
        return

    if d.startswith('delete_confirm_'):
        pid = d[15:]
        p = products.get(pid)
        if not p: answer_cb(cbid, '❌ Topilmadi!'); return
        if p.get('seller_id') != uid and uid != ADMIN_ID:
            answer_cb(cbid, "❌ Ruxsat yo'q!"); return
        p['status'] = 'closed'
        save_data()
        answer_cb(cbid, "✅ O'chirildi!")
        send_seller(uid, f"🗑 <b>{p['name']}</b> o'chirildi.")
        return

    if d.startswith('boost_confirm_'):
        pid = d[14:]
        if pid not in products:
            answer_cb(cbid, '❌ Topilmadi!'); return
        p = products[pid]
        if p.get('seller_id') != uid and uid != ADMIN_ID:
            answer_cb(cbid, "❌ Ruxsat yo'q!"); return
        count    = len(groups.get(pid, []))
        channel  = p.get('seller_channel')
        caption  = post_caption(p, pid)
        kb       = json.dumps(join_kb(pid, count, p['min_group'], has_solo=bool(p.get('solo_price')), sale_type=p.get('sale_type','both')))
        photo_ids = p.get('photo_ids') or ([p['photo_id']] if p.get('photo_id') else [])

        if len(photo_ids) > 1:
            media = [{'type': 'photo', 'media': fid} for fid in photo_ids]
            media[0]['caption'] = caption
            media[0]['parse_mode'] = 'HTML'
            result = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendMediaGroup', json={
                'chat_id': channel, 'media': media,
            }).json()
            if result.get('ok') and result.get('result'):
                requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendMessage', json={
                    'chat_id': channel, 'text': caption,
                    'parse_mode': 'HTML', 'reply_markup': kb,
                })
                products[pid]['channel_message_id'] = result['result'][0].get('message_id')
                products[pid]['channel_chat_id']    = channel
                answer_cb(cbid, "✅ Qayta e'lon qilindi!")
                send_seller(uid, f"📢 <b>{p['name']}</b> qayta e'lon qilindi!")
            else:
                answer_cb(cbid, '❌ Xato!')
        else:
            result = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendPhoto', json={
                'chat_id': channel, 'photo': photo_ids[0] if photo_ids else p.get('photo_id'),
                'caption': caption, 'parse_mode': 'HTML', 'reply_markup': kb,
            }).json()
            if result.get('ok'):
                products[pid]['channel_message_id'] = result['result']['message_id']
                products[pid]['channel_chat_id']    = channel
                answer_cb(cbid, "✅ Qayta e'lon qilindi!")
                send_seller(uid, f"📢 <b>{p['name']}</b> qayta e'lon qilindi!")
            else:
                answer_cb(cbid, "❌ Xato! Bot kanalga admin sifatida qo'shilganmi?")
        return

    if d.startswith('seller_ac_'):
        code     = d[10:]
        if code not in orders:
            answer_cb(cbid, '❌'); return
        o        = orders[code]
        pid      = o['product_id']
        buyer_id = o['user_id']
        p        = products.get(pid, {})
        orders[code]['status'] = 'confirmed'
        # CRM yangilash
        seller_id = p.get('seller_id')
        if seller_id:
            update_customer(seller_id, buyer_id, o.get('user_name',''), o['amount'], p.get('name',''))

        # ─── INVENTAR: stock kamaytirish ───
        if pid in products and products[pid].get('stock', 9999) < 9999:
            products[pid]['stock'] = max(0, products[pid].get('stock', 0) - 1)
            current_stock = products[pid]['stock']
            stock_init    = products[pid].get('stock_initial', current_stock)
            # Stock 0 — mahsulotni yopish
            if current_stock == 0:
                products[pid]['status'] = 'closed'
                if seller_id:
                    send_seller(seller_id,
                        f"🔴 <b>QOLDIQ TUGADI!</b>\n\n"
                        f"📦 {p.get('name','')}\n"
                        f"Mahsulot avtomatik yopildi.\n\n"
                        f"Qoldiq qo'shish uchun mahsulotni tahrirlang.",
                        {'inline_keyboard': [[{'text': "✏️ Tahrirlash", 'callback_data': f'edit_prod_{pid}'}]]}
                    )
            # Stock 5 yoki kam — ogohlantirish (faqat 5,4,3,2,1 da bir marta)
            elif current_stock <= 5 and stock_init > 5:
                if seller_id:
                    send_seller(seller_id,
                        f"⚠️ <b>QOLDIQ KAM!</b>\n\n"
                        f"📦 {p.get('name','')}\n"
                        f"📊 Qoldiq: {current_stock} ta\n\n"
                        f"Tez orada qo'shimcha qo'shing.",
                        {'inline_keyboard': [[{'text': "✏️ Tahrirlash", 'callback_data': f'edit_prod_{pid}'}]]}
                    )

        save_data()

        if o.get('type') == 'group':
            if pid not in groups: groups[pid] = []
            if buyer_id not in groups[pid]: groups[pid].append(buyer_id)
            count = len(groups[pid])
            min_g = p.get('min_group', 3)
            save_data()
            answer_cb(cbid, f'✅ {count}/{min_g}')
            update_profile(buyer_id, o['amount'], p.get('original_price', o['amount']), True)
            send_buyer(buyer_id, build_check(code, o))
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
                notify_group_filled(pid)
        else:
            answer_cb(cbid, '✅ Tasdiqlandi!')
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
        answer_cb(cbid, '❌ Rad'); return

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
        answer_cb(cbid, '✅ Tasdiqlandi'); return

    if d.startswith('seller_deny_refund_'):
        code = d[19:]
        if code in refund_requests:
            refund_requests[code]['status'] = 'denied'
            save_data()
            send_buyer(refund_requests[code]['user_id'],
                f"❌ <b>Qaytarish rad etildi</b>\n\n#{code}\nSotuvchi bilan bog'laning."
            )
        answer_cb(cbid, '❌ Rad'); return

    if d in ('variants_yes', 'variants_no'):
        s = seller_state.get(uid)
        if not s:
            answer_cb(cbid, '❌ Jarayon topilmadi!'); return
        answer_cb(cbid)
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
            answer_cb(cbid, '❌ Jarayon topilmadi!'); return
        dtype = 'deliver' if d == 'delivery_deliver' else 'pickup'
        s['delivery_type'] = dtype
        s['step'] = 'seller_channel'
        answer_cb(cbid)
        send_seller(uid,
            f"{'🚚 Sotuvchi yetkazadi' if dtype == 'deliver' else '🏪 Xaridor olib ketadi'} ✅\n\n"
            "9️⃣ Kanalingiz username ini yozing:\n"
            "<i>Masalan: @mening_kanalim</i>\n\n"
            "⚠️ Sotuvchi bot kanalga <b>admin</b> sifatida qo'shilgan bo'lishi kerak!"
        )
        return

    if d.startswith('addmod_ch_'):
        channel = d[10:]
        answer_cb(cbid)
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
            answer_cb(cbid, '❌ Jarayon topilmadi!'); return
        answer_cb(cbid)
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
            answer_cb(cbid, '❌ Jarayon topilmadi!'); return
        field, prompt = edit_map[d]
        s['step']       = 'editing'
        s['edit_field'] = field
        seller_state[uid] = s
        answer_cb(cbid)
        send_seller(uid, prompt)
        return

# ─── CHANNEL HELPERS ────────────────────────────────────────────────
def can_manage_channel(uid, channel):
    ch = verified_channels.get(channel)
    if not ch: return False
    return uid == ch['owner_id'] or uid in ch.get('moderators', [])

def is_channel_admin(uid, channel):
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

def show_prod_confirm(cid, s, shop):
    orig = s.get('original_price', 0); grp = s.get('group_price', 0)
    disc = round((orig-grp)/orig*100) if orig else 0
    photos = len(s.get('photo_ids', []))
    desc_line     = f"\n📝 {s['description']}" if s.get('description') else ''
    solo_line     = f"\n👤 Yakka: {s['solo_price']:,} so'm" if s.get('solo_price') else ''
    variants_line = f"\n🎨 {', '.join(s['variants'])}" if s.get('variants') else ''
    cat = s.get('category', '')
    cat_icon = next((icon for name, icon in CATEGORIES if name == cat), '📦')
    cat_line  = f"\n{cat_icon} {cat}" if cat else ''
    sale_labels = {'group': '👥 Guruhli', 'solo': '👤 Yakka', 'both': '👥+👤 Ikkalasi'}
    sale_line   = f"\n{sale_labels.get(s.get('sale_type','both'), '')}"
    min_group_line = f"\n👥 Min guruh: {s['min_group']} kishi" if s.get('sale_type') != 'solo' else ''
    stock          = s.get('stock', 9999)
    stock_line     = f"\n📦 Qoldiq: {'♾ Cheksiz' if stock >= 9999 else str(stock) + ' ta'}"
    # Deadline
    hours = int(s.get('deadline_hours', 48))
    deadline_labels = {24: '24 soat', 48: '2 kun', 72: '3 kun', 168: '1 hafta'}
    deadline_line = f"\n⏰ Muddat: {deadline_labels.get(hours, str(hours)+' soat')}"
    # Deadline tugmalari — hozirgi tanlangan belgilangan
    def dl_btn(h, label):
        mark = '✅ ' if hours == h else ''
        return {'text': f"{mark}{label}", 'callback_data': f'prod_deadline_{h}'}
    send_seller(cid,
        f"📋 <b>Mahsulotni tekshiring:</b>\n\n"
        f"📦 <b>{s['name']}</b>\n🏪 {shop.get('name','')}"
        f"{cat_line}{sale_line}\n"
        f"📸 {photos} ta rasm\n💰 {orig:,} → {grp:,} so'm (-{disc}%)"
        f"{min_group_line}{stock_line}\n📢 {shop.get('channel','—')}"
        f"{deadline_line}"
        f"{desc_line}{solo_line}{variants_line}",
        {'inline_keyboard': [
            [{'text': "🚀 E'lon qilish!", 'callback_data': 'prod_confirm_publish'}],
            [dl_btn(24,'24 soat'), dl_btn(48,'2 kun'), dl_btn(72,'3 kun'), dl_btn(168,'1 hafta')],
            [{'text': "📝 Tavsif",        'callback_data': 'prod_add_desc'},
             {'text': "💰 Yakka narx",    'callback_data': 'prod_add_solo'}],
            [{'text': "🎨 Variantlar",    'callback_data': 'prod_add_variants'}],
        ]})

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
        f"📢 Kanal: <b>{channel}</b>",
        {'inline_keyboard': [
            [{'text': "✅ To'g'ri, e'lon qil!", 'callback_data': 'confirm_product'}],
            [{'text': "✏️ Nom",         'callback_data': 'edit_name'},
             {'text': "✏️ Do'kon",      'callback_data': 'edit_shop_name'}],
            [{'text': "✏️ Tavsif",      'callback_data': 'edit_description'},
             {'text': "✏️ Asl narx",    'callback_data': 'edit_original_price'}],
            [{'text': "✏️ Guruh narxi", 'callback_data': 'edit_group_price'},
             {'text': "✏️ Min guruh",   'callback_data': 'edit_min_group'}],
            [{'text': "✏️ Rasm",        'callback_data': 'edit_photo'},
             {'text': "✏️ Aloqa",       'callback_data': 'edit_contact'}],
            [{'text': "✏️ Kanal",       'callback_data': 'edit_seller_channel'}],
        ]}
    )

def publish_product(uid, cid, s):
    shop_idx = s.get('shop_idx')
    if shop_idx is not None:
        shops    = seller_shops.get(uid, [])
        shop     = shops[shop_idx] if shop_idx < len(shops) else {}
        channel  = shop.get('channel',  s.get('seller_channel',''))
        contact  = shop.get('phone',    s.get('contact',''))
        phone2   = shop.get('phone2',   '')
        address  = shop.get('address',  '')
        social   = shop.get('social',   {})
        delivery = shop.get('delivery', s.get('delivery_type','pickup'))
        shop_name= shop.get('name',     s.get('shop_name',''))
    else:
        channel  = s.get('seller_channel','')
        contact  = s.get('contact','')
        phone2   = ''
        address  = ''
        social   = {}
        delivery = s.get('delivery_type','pickup')
        shop_name= s.get('shop_name','')

    pid      = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    deadline = datetime.now() + timedelta(hours=int(s.get('deadline_hours', 48)))
    photo_ids  = s.get('photo_ids') or ([s['photo_id']] if s.get('photo_id') else [])
    photo_urls = s.get('photo_urls', [])
    first_photo = photo_ids[0] if photo_ids else None
    first_url   = photo_urls[0] if photo_urls else None
    if not first_photo:
        send_seller(cid, "❌ Rasm topilmadi!"); return

    products[pid] = {
        'name':           s['name'],
        'shop_name':      shop_name,
        'description':    s.get('description', ''),
        'original_price': s['original_price'],
        'group_price':    s['group_price'],
        'solo_price':     s.get('solo_price', 0),
        'min_group':      s['min_group'],
        'stock':          s.get('stock', 9999),
        'stock_initial':  s.get('stock', 9999),
        'photo_id':       first_photo,
        'photo_ids':      photo_ids,
        'photo_url':      first_url,
        'photo_urls':     photo_urls,
        'contact':        contact,
        'phone2':         phone2,
        'address':        address,
        'social':         social,
        'delivery_type':  delivery,
        'variants':       s.get('variants', []),
        'category':       s.get('category', ''),
        'sale_type':      s.get('sale_type', 'both'),
        'seller_channel': channel,
        'seller_id':      uid,
        'deadline':       deadline.strftime('%d.%m.%Y %H:%M'),
        'deadline_dt':    deadline.strftime('%Y-%m-%d %H:%M'),
        'channel_message_id': None,
        'channel_chat_id':    None,
        'status':         'active',
        'solo_available': True,
    }
    groups[pid] = []
    if uid not in seller_products: seller_products[uid] = []
    seller_products[uid].append(pid)

    caption = post_caption(products[pid], pid)
    kb      = json.dumps(join_kb(pid, 0, s['min_group'], has_solo=bool(s.get('solo_price')), sale_type=s.get('sale_type','both')))

    if len(photo_ids) > 1:
        media = []
        for i, fid in enumerate(photo_ids):
            item = {'type': 'photo', 'media': fid}
            if i == 0:
                item['caption'] = caption
                item['parse_mode'] = 'HTML'
            media.append(item)
        result = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendMediaGroup', json={
            'chat_id': channel, 'media': media,
        }).json()
        if result.get('ok') and result.get('result'):
            first_msg = result['result'][0]
            products[pid]['channel_message_id'] = first_msg.get('message_id')
            products[pid]['channel_chat_id']    = channel
            # Caption + tugmalar alohida xabar (media group da reply_markup ishlamaydi)
            requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendMessage', json={
                'chat_id': channel, 'text': caption,
                'parse_mode': 'HTML', 'reply_markup': kb,
            })
    else:
        result = requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/sendPhoto', json={
            'chat_id': channel, 'photo': first_photo,
            'caption': caption, 'parse_mode': 'HTML', 'reply_markup': kb,
        }).json()
        if result.get('ok'):
            msg_result = result['result']
            products[pid]['channel_message_id'] = msg_result.get('message_id')
            products[pid]['channel_chat_id']    = channel

    del seller_state[uid]
    if result.get('ok'):
        save_data()
        send_seller(cid,
            f"✅ <b>E'lon qilindi!</b>\n\n"
            f"📦 {s['name']}\n📢 {channel}\n"
            f"🆔 <code>{pid}</code>\n⏰ {deadline.strftime('%d.%m.%Y %H:%M')}",
            {'inline_keyboard': [
                [{'text': '📊 Statistika',  'callback_data': 'menu_mystats'},
                 {'text': "📢 Qayta e'lon", 'callback_data': f'boost_{pid}'}],
                [{'text': '✏️ Tahrirlash',  'callback_data': f'edit_prod_{pid}'},
                 {'text': "🗑 O'chirish",   'callback_data': f'delete_prod_{pid}'}],
            ]}
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

    if is_prod_in_progress(uid) and text in PROD_BLOCKED_TEXTS:
        send_seller(cid, get_prod_progress_text(uid),
            {'inline_keyboard': [
                [{'text': "▶️ Davom etish", 'callback_data': 'prod_continue'}],
                [{'text': "🗑 Bekor qilish", 'callback_data': 'prod_restart'}],
            ]}
        )
        return

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
        shops = seller_shops.get(uid) or seller_shops.get(str(uid), [])
        is_new = not shops and str(uid) not in [str(k) for k in seller_shops.keys()]
        if is_new:
            cur_state = seller_state.get(uid, {})
            if not cur_state.get('step','').startswith('ob_'):
                seller_state[uid] = {'step': 'ob_shop_name'}
                send_seller(cid,
                    "🏪 <b>Joynshop Sotuvchi Paneliga xush kelibsiz!</b>\n\n"
                    "Bir marta profilingizni to'ldiring.\n\n"
                    "<b>1/4</b> Do'kon nomini yozing:\n<i>Masalan: Nike Toshkent</i>"
                )
            else:
                send_seller(cid, "📝 Do'kon ma'lumotlarini kiritishni davom eting.")
        else:
            shop_names = ', '.join(s['name'] for s in shops) if shops else ''
            send_seller(cid,
                f"🏪 <b>Joynshop Sotuvchi Paneli</b>\n\n"
                f"{'🏬 ' + shop_names + chr(10) if shop_names else ''}"
                f"Guruh savdosi orqali ko'proq soting!",
                {'keyboard': [
                    [{'text': '➕ Mahsulot qo\'shish'}],
                    [{'text': '📦 Mahsulotlarim'}, {'text': '📋 Buyurtmalar'}],
                    [{'text': '📊 Statistika'},    {'text': "📢 Do'konlarim"}],
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
        my_pids = seller_products.get(uid, [])
        pending = {k:v for k,v in orders.items() if v.get('product_id') in my_pids and v['status']=='confirming'}
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
            "/start       — 🏠 Bosh sahifa\n"
            "/addproduct  — ➕ Mahsulot qo'shish\n"
            "/myproducts  — 📦 Mahsulotlarim\n"
            "/myorders    — 📋 Buyurtmalar\n"
            "/mystats     — 📊 Statistika\n"
            "/golive      — 🔴 Live boshlash\n"
            "/mylive      — 📺 Live dashboard\n"
            "/mychannels  — 📢 Kanallarim\n"
            "/help        — ℹ️ Yordam\n\n"
            "💬 Yordam: @joynshop_support"
        )
        return

    if text == '/golive' or text == "🔴 Live":
        my_pids = seller_products.get(uid, [])
        active_prods = [(pid, products[pid]) for pid in my_pids
                        if pid in products and products[pid].get('status') == 'active']
        if not active_prods:
            send_seller(cid,
                "❌ Avval faol mahsulot qo'shing.\n\n/addproduct yozing."
            )
            return
        # Tanlov klaviaturasi
        kb = []
        for pid, p in active_prods[:10]:
            kb.append([{'text': f"📦 {p.get('name','')[:30]}",
                        'callback_data': f'live_pick_{pid}'}])
        kb.append([{'text': "❌ Bekor", 'callback_data': 'live_cancel'}])
        send_seller(cid,
            "🔴 <b>LIVE boshlash</b>\n\n"
            "Qaysi mahsulot uchun Live qilasiz?",
            {'inline_keyboard': kb}
        )
        return

    if text == '/mylive':
        # Sotuvchining faol live'larini ko'rsatish
        my_lives = [(lid, lv) for lid, lv in lives.items()
                    if lv.get('seller_id') == uid and lv.get('status') == 'live']
        if not my_lives:
            send_seller(cid,
                "🔴 <b>Live Dashboard</b>\n\n"
                "Hozir faol live yo'q.\n"
                "Yangi boshlash uchun /golive yozing."
            )
            return
        text_msg = "🔴 <b>Faol Liveler</b>\n━━━━━━━━━━━━━━━\n\n"
        kb = []
        for lid, lv in my_lives:
            p = products.get(lv.get('product_id',''), {})
            text_msg += (
                f"📦 {p.get('name','—')}\n"
                f"👀 {lv.get('viewer_count',0)} ko'rdi\n"
                f"👥 {len(lv.get('joiners',[]))} qo'shildi\n\n"
            )
            kb.append([{'text': f"📊 {p.get('name','')[:25]}", 'callback_data': f'live_dash_{lid}'}])
        send_seller(cid, text_msg, {'inline_keyboard': kb})
        return

    if text == '/addproduct' or text == "➕ Mahsulot qo'shish":
        if is_prod_in_progress(uid):
            send_seller(cid, get_prod_progress_text(uid),
                {'inline_keyboard': [
                    [{'text': '▶️ Davom etish', 'callback_data': 'prod_continue'}],
                    [{'text': '🗑 Bekor qilish', 'callback_data': 'prod_restart'}],
                ]}
            )
            return
        shops = seller_shops.get(uid, [])
        if not shops:
            send_seller(cid, "❌ Avval do'kon profilingizni to'ldiring.\n\n/start yozing.")
            return
        if len(shops) == 1:
            seller_state[uid] = {
                'step': 'prod_name', 'shop_idx': 0,
                'shop_name':      shops[0]['name'],
                'contact':        shops[0]['phone'],
                'delivery_type':  shops[0].get('delivery','pickup'),
                'seller_channel': shops[0].get('channel',''),
            }
            send_seller(cid,
                f"📦 <b>{shops[0]['name']}</b> uchun yangi mahsulot\n\n"
                f"<b>1/4</b> Mahsulot nomini yozing:\n<i>Masalan: Nike Air Max 270</i>"
            )
        else:
            btns = [[{'text': f"🏪 {s['name']}", 'callback_data': f"sel_shop_{i}"}] for i,s in enumerate(shops)]
            send_seller(cid, "Qaysi do'kon uchun mahsulot qo'shmoqchisiz?", {'inline_keyboard': btns})
        return

    if text == '/mychannels' or text == "📢 Do'konlarim" or text == '📢 Kanallarim':
        shops = seller_shops.get(uid, [])
        if shops:
            r = "🏪 <b>Do'konlaringiz:</b>\n\n"
            btns = []
            for i, sh in enumerate(shops):
                social_text = ' | '.join(f"{k}: {v}" for k,v in sh.get('social',{}).items())
                r += (f"━━━━━━━━━━━━━━\n"
                      f"🏪 <b>{sh['name']}</b>\n"
                      f"📞 {sh['phone']}"
                      + (f"\n📱 {sh['phone2']}" if sh.get('phone2') else '')
                      + (f"\n📍 {sh['address']}" if sh.get('address') else '')
                      + (f"\n🌐 {social_text}" if social_text else '')
                      + f"\n📢 {sh.get('channel','—')}\n")
                btns.append([{'text': f"✏️ {sh['name']} ni tahrirlash", 'callback_data': f'edit_shop_{i}'}])
            btns.append([{'text': "➕ Yangi do'kon qo'shish", 'callback_data': 'add_new_shop'}])
            send_seller(cid, r, {'inline_keyboard': btns})
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

        # ─── LIVE: video qabul qilish ───
        if step == 'live_video':
            video = msg.get('video') or msg.get('document')
            if not video:
                send_seller(cid, "❌ Iltimos, video yuboring (matn emas).")
                return
            duration = video.get('duration', 30)  # document da duration bo'lmasligi mumkin
            file_id  = video.get('file_id', '')
            if not file_id:
                send_seller(cid, "❌ Video fayl topilmadi, qayta yuboring.")
                return
            s['video_file_id']  = file_id
            s['video_duration'] = duration
            s['step'] = 'live_duration'
            send_seller(cid,
                f"✅ Video qabul qilindi ({duration} soniya)\n\n"
                f"⏰ <b>Live davomiyligi?</b>",
                {'inline_keyboard': [
                    [{'text': "1 soat",  'callback_data': 'live_dur_1'},
                     {'text': "3 soat",  'callback_data': 'live_dur_3'},
                     {'text': "24 soat", 'callback_data': 'live_dur_24'}],
                    [{'text': "❌ Bekor", 'callback_data': 'live_cancel'}],
                ]}
            )
            return

        # ─── CRM: Mijozga xabar yuborish ───
        if step == 'crm_send_msg':
            if text == '/cancel':
                del seller_state[uid]
                send_seller(cid, "❌ Bekor qilindi.")
                return
            target_uid = s.get('target_uid')
            target_name = s.get('target_name')
            del seller_state[uid]
            shop_name = (seller_shops.get(uid) or [{}])[0].get('name', '')
            try:
                send_buyer(target_uid,
                    f"💬 <b>{shop_name}</b> dan xabar:\n\n{text}\n\n"
                    f"<i>Joynshop orqali yuborildi</i>"
                )
                send_seller(cid, f"✅ Xabar <b>{target_name}</b> ga yuborildi.")
            except Exception as e:
                send_seller(cid, f"❌ Xabar yuborilmadi: {e}")
            return

        # ─── CRM: Mijozga izoh qo'shish ───
        if step == 'crm_add_note':
            if text == '/cancel':
                del seller_state[uid]
                send_seller(cid, "❌ Bekor qilindi.")
                return
            sid = str(uid)
            cuid = s.get('target_cuid')
            target_name = s.get('target_name')
            del seller_state[uid]
            if sid in customers and cuid in customers[sid]:
                customers[sid][cuid]['note'] = text[:300]
                save_data()
                send_seller(cid, f"✅ Izoh <b>{target_name}</b> uchun saqlandi.",
                    {'inline_keyboard': [[{'text': "👤 Mijozga qaytish", 'callback_data': 'crm_view_'+cuid}]]}
                )
            else:
                send_seller(cid, "❌ Mijoz topilmadi.")
            return

        # ─── CRM: Qidiruv ───
        if step == 'crm_search_query':
            del seller_state[uid]
            sid = str(uid)
            my_customers = customers.get(sid, {})
            q = text.lower().strip()
            if not q:
                send_seller(cid, "❌ Qidiruv so'rovi bo'sh.")
                return
            results = []
            for cuid, c in my_customers.items():
                if q in c.get('name','').lower() or q in str(c.get('user_id','')).lower():
                    results.append((cuid, c))
            if not results:
                send_seller(cid, f"🔍 \"{text}\" bo'yicha hech narsa topilmadi.",
                    {'inline_keyboard': [[{'text': "⬅️ CRM", 'callback_data': 'menu_mycustomers'}]]}
                )
                return
            kb = []
            txt = f"🔍 <b>Qidiruv natijasi: {len(results)} ta</b>\n\n"
            for cuid, c in results[:15]:
                badges = " ⭐" if 'vip' in c.get('tags', []) else ""
                txt += f"• <b>{c['name']}{badges}</b> — {fmt(c['total_spent'])} so'm\n"
                kb.append([{'text': "👤 " + c['name'], 'callback_data': 'crm_view_' + cuid}])
            kb.append([{'text': "⬅️ CRM", 'callback_data': 'menu_mycustomers'}])
            send_seller(cid, txt, {'inline_keyboard': kb})
            return

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

        if step == 'ob_shop_name':
            s['ob_shop_name'] = text; s['step'] = 'ob_phone'
            s.pop('ob_msg_id', None)
            send_or_edit_seller(cid,
                "📞 Asosiy telefon raqam:\n<i>+998XXXXXXXXX</i>",
                state=s)

        elif step == 'ob_phone':
            s['ob_phone'] = text.strip(); s['step'] = 'ob_phone2'
            s.pop('ob_msg_id', None)
            send_or_edit_seller(cid,
                "📱 Qo'shimcha telefon (ixtiyoriy):\n<i>+998XXXXXXXXX</i>",
                {'inline_keyboard': [[{'text': "⏭ O'tkazib yuborish", 'callback_data': 'ob_skip_phone2'}]]},
                state=s)

        elif step == 'ob_phone2':
            s['ob_phone2'] = text.strip() if text != '/skip' else ''
            s['step'] = 'ob_address'
            s.pop('ob_msg_id', None)
            send_or_edit_seller(cid,
                "📍 Do'kon manzili (ixtiyoriy):\n<i>Toshkent, Chilonzor, 3-mavze</i>",
                {'inline_keyboard': [[{'text': "⏭ O'tkazib yuborish", 'callback_data': 'ob_skip_address'}]]},
                state=s)

        elif step == 'ob_address':
            s['ob_address'] = text.strip() if text != '/skip' else ''
            s['step'] = 'ob_social'
            s.pop('ob_msg_id', None)
            send_or_edit_seller(cid,
                "🌐 Ijtimoiy tarmoqlar (ixtiyoriy):\n"
                "<code>instagram: @dokon_uz\ntelegram: @kanal\nwebsite: dokon.uz</code>",
                {'inline_keyboard': [[{'text': "⏭ O'tkazib yuborish", 'callback_data': 'ob_skip_social'}]]},
                state=s)

        elif step == 'ob_social':
            if text != '/skip':
                social = {}
                for line in text.strip().splitlines():
                    if ':' in line:
                        k, v = line.split(':', 1)
                        social[k.strip().lower()] = v.strip()
                s['ob_social'] = social
            else:
                s['ob_social'] = {}
            s['step'] = 'ob_delivery'
            s.pop('ob_msg_id', None)
            send_or_edit_seller(cid,
                "🚚 Yetkazib berish turini tanlang:",
                {'inline_keyboard': [
                    [{'text': "🚚 Yetkazib beraman",   'callback_data': 'ob_delivery_deliver'}],
                    [{'text': "🏪 Xaridor olib ketadi", 'callback_data': 'ob_delivery_pickup'}],
                    [{'text': "🚚🏪 Ikkalasi ham",       'callback_data': 'ob_delivery_both'}],
                ]},
                state=s)

        elif step == 'ob_channel':
            channel = text if text.startswith('@') else f'@{text}'
            send_seller(cid, f"🔍 <b>{channel}</b> tekshirilmoqda...")
            if can_manage_channel(uid, channel) or is_channel_admin(uid, channel):
                if channel not in verified_channels:
                    verified_channels[channel] = {'owner_id': uid, 'moderators': []}
                if uid not in seller_shops: seller_shops[uid] = []
                shop = {
                    'name':     s['ob_shop_name'],
                    'phone':    s['ob_phone'],
                    'phone2':   s.get('ob_phone2', ''),
                    'address':  s.get('ob_address', ''),
                    'social':   s.get('ob_social', {}),
                    'delivery': s.get('ob_delivery', 'pickup'),
                    'channel':  channel,
                    'verified': True,
                }
                edit_idx = s.get('edit_shop_idx')
                if edit_idx is not None and edit_idx < len(seller_shops[uid]):
                    seller_shops[uid][edit_idx] = shop
                else:
                    seller_shops[uid].append(shop)
                save_data(); del seller_state[uid]
                social_lines = ''
                if shop['social']:
                    for k, v in shop['social'].items():
                        social_lines += f"\n🔗 {k}: {v}"
                send_seller(cid,
                    f"✅ <b>Do'kon profili saqlandi!</b>\n\n"
                    f"🏪 {shop['name']}\n📞 {shop['phone']}"
                    f"{chr(10)+'📱 '+shop['phone2'] if shop['phone2'] else ''}"
                    f"{chr(10)+'📍 '+shop['address'] if shop['address'] else ''}"
                    f"{social_lines}\n📢 {channel}\n\n"
                    "Endi mahsulot qo'sha olasiz!",
                    {'keyboard': [
                        [{'text': '➕ Mahsulot qo\'shish'}],
                        [{'text': '📦 Mahsulotlarim'}, {'text': '📋 Buyurtmalar'}],
                        [{'text': '📊 Statistika'}, {'text': "📢 Do'konlarim"}],
                    ], 'resize_keyboard': True})
            else:
                send_seller(cid,
                    f"❌ <b>{channel}</b> kanalining admini emassiz!\n\n"
                    "Seller bot kanalga admin sifatida qo'shilganmi?\n\nQayta kiriting:")

        elif step == 'edit_shop_name':
            s['ob_shop_name'] = text; s['step'] = 'ob_phone'
            send_seller(cid, f"✅ Do'kon nomi yangilandi.\n\n📞 Telefon raqam:\n<i>+998XXXXXXXXX yoki /skip</i>",
                {'inline_keyboard': [[{'text': "⏭ O'zgartirmaslik", 'callback_data': 'ob_keep_phone'}]]})

        elif step == 'edit_phone_direct':
            s['ob_phone'] = text.strip()
            idx = s.get('edit_shop_idx', 0)
            shops = seller_shops.get(uid, [])
            if idx < len(shops):
                shops[idx]['phone'] = s['ob_phone']
                save_data()
            del seller_state[uid]
            send_seller(cid, f"✅ Telefon yangilandi: {s['ob_phone']}")

        elif step == 'edit_address_direct':
            s['ob_address'] = text.strip()
            idx = s.get('edit_shop_idx', 0)
            shops = seller_shops.get(uid, [])
            if idx < len(shops):
                shops[idx]['address'] = s['ob_address']
                save_data()
            del seller_state[uid]
            send_seller(cid, f"✅ Manzil yangilandi: {s['ob_address']}")

        elif step == 'edit_social_direct':
            social = {}
            for line in text.strip().splitlines():
                if ':' in line:
                    k, v = line.split(':', 1)
                    social[k.strip().lower()] = v.strip()
            idx = s.get('edit_shop_idx', 0)
            shops = seller_shops.get(uid, [])
            if idx < len(shops):
                shops[idx]['social'] = social
                save_data()
            del seller_state[uid]
            lines = '\n'.join(f"🔗 {k}: {v}" for k, v in social.items())
            send_seller(cid, f"✅ Ijtimoiy tarmoqlar yangilandi:\n{lines}")

        elif step == 'prod_name':
            s['name'] = text; s['step'] = 'prod_category'
            kb = []
            row = []
            for i, (cat, icon) in enumerate(CATEGORIES):
                row.append({'text': f"{icon} {cat}", 'callback_data': f"cat_{cat}"})
                if len(row) == 2:
                    kb.append(row); row = []
            if row: kb.append(row)
            send_seller(cid,
                f"✅ <b>{text}</b>\n\n"
                "<b>2/7</b> Kategoriyani tanlang:",
                {'inline_keyboard': kb}
            )

        elif step == 'prod_photo':
            photo = msg.get('photo')
            video = msg.get('video')
            media_group_id = msg.get('media_group_id')
            media_id = None
            if photo:
                media_id = photo[-1]['file_id']
            elif video:
                media_id = video['file_id']
            if media_id:
                if media_id not in s['photo_ids'] and len(s['photo_ids']) < 5:
                    s['photo_ids'].append(media_id)
                    upload_photo_async(media_id, SELLER_TOKEN, s)
                if media_group_id:
                    s['last_media_group'] = media_group_id
                    if s.get('album_timer'):
                        s['album_timer'].cancel()
                    def send_album_count(cid=cid, s=s):
                        count = len(s.get('photo_ids', []))
                        send_seller(cid,
                            f"✅ {count}/5 media qabul qilindi. Yana yuboring yoki davom eting:",
                            {'inline_keyboard': [[{'text': f"➡️ Davom etish ({count} ta)", 'callback_data': 'prod_photo_done'}]]}
                        )
                    import threading as _t
                    timer = _t.Timer(0.8, send_album_count)
                    s['album_timer'] = timer
                    timer.start()
                else:
                    count = len(s['photo_ids'])
                    send_seller(cid,
                        f"✅ {count}/5 media. Yana yuboring yoki davom eting:",
                        {'inline_keyboard': [[{'text': f"➡️ Davom etish ({count} ta)", 'callback_data': 'prod_photo_done'}]]}
                    )
            else:
                send_seller(cid, "❌ Rasm yoki video yuboring!")

        elif step == 'prod_price':
            sale_type = s.get('sale_type', 'both')
            try:
                parts = text.replace(' ','').replace(',','').split('/')
                orig  = int(parts[0])
                if sale_type == 'solo':
                    s['original_price'] = orig
                    s['solo_price']     = orig
                    s['group_price']    = orig
                    s['min_group']      = 1
                    s['step'] = 'prod_desc'; s['description'] = ''; s['variants'] = []
                    send_seller(cid,
                        f"✅ Narx: {orig:,} so'm\n\n"
                        "<b>5/6</b> Mahsulot tavsifi (ixtiyoriy):\n"
                        "<i>Mahsulot haqida qo'shimcha ma'lumot...</i>",
                        {'inline_keyboard': [[{'text': "⏭ O'tkazib yuborish", 'callback_data': 'prod_skip_desc'}]]}
                    )
                elif sale_type == 'group':
                    grp = int(parts[1]) if len(parts) > 1 else 0
                    if not grp: send_seller(cid, "❌ Format: <code>850000 / 550000</code>"); return
                    if grp >= orig: send_seller(cid, "❌ Guruh narxi asl narxdan kam bo'lishi kerak!"); return
                    disc = round((orig-grp)/orig*100)
                    s['original_price'] = orig; s['group_price'] = grp; s['solo_price'] = 0
                    s['step'] = 'prod_min_group'
                    send_seller(cid, f"✅ {orig:,} → {grp:,} so'm (-{disc}%)\n\n<b>5/5</b> Minimal guruh soni (2-10):")
                else:
                    grp = int(parts[1]) if len(parts) > 1 else 0
                    if not grp: send_seller(cid, "❌ Format: <code>850000 / 550000</code>"); return
                    if grp >= orig: send_seller(cid, "❌ Guruh narxi asl narxdan kam bo'lishi kerak!"); return
                    disc = round((orig-grp)/orig*100)
                    s['original_price'] = orig; s['group_price'] = grp; s['solo_price'] = grp
                    s['step'] = 'prod_min_group'
                    send_seller(cid, f"✅ {orig:,} → {grp:,} so'm (-{disc}%)\n\n<b>5/5</b> Minimal guruh soni (2-10):")
            except:
                send_seller(cid, "❌ Format: <code>850000 / 550000</code>")

        elif step == 'prod_min_group':
            try:
                mg = int(text)
                if mg < 2 or mg > 10: send_seller(cid, "❌ 2 dan 10 gacha!"); return
                s['min_group'] = mg; s['step'] = 'prod_stock'
                send_seller(cid,
                    f"✅ Minimal guruh: {mg} kishi\n\n"
                    "<b>5/7</b> 📦 <b>Qoldiq miqdor</b> (sizda nechta bor?):\n"
                    "<i>Masalan: 20</i>\n\n"
                    "Qoldiq tugaganda mahsulot avtomatik yopiladi.",
                    {'inline_keyboard': [[{'text': "♾ Cheksiz", 'callback_data': 'prod_stock_unlimited'}]]}
                )
            except: send_seller(cid, "❌ Raqam kiriting!")

        elif step == 'prod_stock':
            try:
                stock = int(text)
                if stock < 1 or stock > 10000:
                    send_seller(cid, "❌ 1 dan 10000 gacha kiriting!"); return
                s['stock'] = stock
                s['step'] = 'prod_desc'
                s['description'] = ''
                s['variants'] = []
                send_seller(cid,
                    f"✅ Qoldiq: {stock} ta\n\n"
                    "<b>6/7</b> Mahsulot tavsifi (ixtiyoriy):\n"
                    "<i>Mahsulot haqida qo'shimcha ma'lumot...</i>",
                    {'inline_keyboard': [[{'text': "⏭ O'tkazib yuborish", 'callback_data': 'prod_skip_desc'}]]}
                )
            except: send_seller(cid, "❌ Raqam kiriting!")

        elif step == 'prod_desc':
            s['description'] = text[:300]; s['step'] = 'prod_confirm'
            shop = seller_shops.get(uid,[{}])[s.get('shop_idx',0)]
            send_seller(cid, "✅ Tavsif saqlandi!")
            show_prod_confirm(cid, s, shop)

        elif step == 'prod_edit_desc':
            s['description'] = text[:300]; s['step'] = 'prod_confirm'
            shop = seller_shops.get(uid,[{}])[s.get('shop_idx',0)]
            send_seller(cid, "✅ Tavsif saqlandi!"); show_prod_confirm(cid, s, shop)

        elif step == 'prod_edit_solo':
            try:
                s['solo_price'] = int(text.replace(' ','').replace(',','')); s['step'] = 'prod_confirm'
                shop = seller_shops.get(uid,[{}])[s.get('shop_idx',0)]
                send_seller(cid, "✅ Yakka narx saqlandi!"); show_prod_confirm(cid, s, shop)
            except: send_seller(cid, "❌ Raqam kiriting!")

        elif step == 'prod_edit_variants':
            raw = [v.strip() for v in text.replace('،',',').split(',') if v.strip()]
            if not raw: send_seller(cid, "❌ Kamida 1 ta variant!"); return
            s['variants'] = raw; s['step'] = 'prod_confirm'
            shop = seller_shops.get(uid,[{}])[s.get('shop_idx',0)]
            send_seller(cid, f"✅ Variantlar: {', '.join(raw)}"); show_prod_confirm(cid, s, shop)

        elif step == 'name':
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
            if can_manage_channel(uid, channel):
                s['step'] = 'confirm'
                show_confirm(cid, s)
            else:
                send_seller(cid, f"🔍 <b>{channel}</b> adminligi tekshirilmoqda...")
                if is_channel_admin(uid, channel):
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
    elif 'pre_checkout_query' in data:
        handle_pre_checkout(data['pre_checkout_query'])
    elif 'message' in data:
        msg = data['message']
        if 'successful_payment' in msg:
            handle_successful_payment(msg)
        elif msg.get('chat', {}).get('type', '') in ['group', 'supergroup']:
            moderate_chat(msg)
        else:
            buyer_handle_msg(msg)
    return 'ok'

def handle_pre_checkout(query):
    """Telegram to'lovni tasdiqlashdan oldin chaqiradi — biz OK deymiz"""
    payload = query.get('invoice_payload', '')
    uid     = query['from']['id']
    # Channel invoice: channel_PID formatida
    if payload.startswith('channel_'):
        pid = payload[8:]
        if pid in products and products[pid].get('status') == 'active':
            answer_pre_checkout(query['id'], ok=True)
        else:
            answer_pre_checkout(query['id'], ok=False, error="Mahsulot topilmadi yoki yopilgan")
    elif payload in orders and orders[payload]['status'] == 'pending':
        answer_pre_checkout(query['id'], ok=True)
    else:
        answer_pre_checkout(query['id'], ok=False, error="Buyurtma topilmadi yoki muddati o'tgan")

def handle_successful_payment(msg):
    """To'lov muvaffaqiyatli — buyurtmani tasdiqlash"""
    uid     = msg['from']['id']
    uname   = msg['from'].get('first_name', 'Foydalanuvchi')
    payment = msg['successful_payment']
    payload = payment['invoice_payload']
    amount  = payment['total_amount'] // 100

    # Kanal invoice: channel_PID
    if payload.startswith('channel_'):
        pid = payload[8:]
        p   = products.get(pid, {})
        if not p:
            send_buyer(uid, "❌ Mahsulot topilmadi.")
            return
        # Yangi buyurtma yaratish
        code = gen_code()
        orders[code] = {
            'product_id': pid, 'user_id': uid,
            'user_name':  uname, 'amount': amount,
            'type': 'group', 'status': 'confirming',
            'variant': '', 'payment_method': 'click',
            'telegram_payment_charge_id': payment.get('telegram_payment_charge_id',''),
            'created': datetime.now().strftime('%d.%m.%Y %H:%M')
        }
        # Guruhga qo'shish
        if pid not in groups: groups[pid] = []
        if uid not in groups[pid]: groups[pid].append(uid)
        sid = p.get('seller_id')
        update_customer(sid, uid, uname, amount, p.get('name',''))
        save_data()
        # Sotuvchiga xabar
        if sid:
            send_seller(sid,
                f"💳 <b>KANAL TO'LOV!</b>\n\n"
                f"📦 {p.get('name','')}\n"
                f"👤 {uname} (ID: {uid})\n"
                f"💰 {fmt(amount)} so'm\n"
                f"👥 Guruh: {len(groups[pid])}/{p.get('min_group',3)}\n"
                f"💳 Click ✅ • 🆔 #{code}",
                {'inline_keyboard': [[
                    {'text': '✅ Tasdiqlash', 'callback_data': f'seller_ac_{code}'},
                    {'text': '❌ Rad',        'callback_data': f'seller_rj_{code}'},
                ]]}
            )
        send_buyer(uid,
            f"✅ <b>To'lov qabul qilindi!</b>\n\n"
            f"📦 {p.get('name','')}\n"
            f"💰 {fmt(amount)} so'm\n"
            f"👥 Guruh: {len(groups[pid])}/{p.get('min_group',3)}\n"
            f"🆔 #{code}\n\n"
            f"⏳ Sotuvchi tasdiqlashi kutilmoqda..."
        )
        return

    # Bot orqali buyurtma
    code = payload
    if code not in orders:
        send_buyer(uid, "❌ Buyurtma topilmadi.")
        return
    orders[code]['status']       = 'confirming'
    orders[code]['payment_method'] = 'click'
    orders[code]['telegram_payment_charge_id'] = payment.get('telegram_payment_charge_id','')
    save_data()
    p   = products.get(orders[code]['product_id'], {})
    sid = p.get('seller_id')
    if sid:
        o = orders[code]
        variant_text = f"\n🎨 Variant: {o.get('variant','')}" if o.get('variant') else ''
        send_seller(sid,
            f"💳 <b>TO'LOV TASDIQLANDI!</b>\n\n"
            f"📦 {p.get('name','')}{variant_text}\n"
            f"👤 {o['user_name']} (ID: {uid})\n"
            f"💰 {fmt(amount)} so'm\n"
            f"💳 Click ✅ • 🆔 #{code}",
            {'inline_keyboard': [[
                {'text': '✅ Tasdiqlash', 'callback_data': f'seller_ac_{code}'},
                {'text': '❌ Rad',        'callback_data': f'seller_rj_{code}'},
            ]]}
        )
    auto_check(code, orders[code], p)
    send_buyer(uid,
        f"✅ <b>To'lov qabul qilindi!</b>\n\n"
        f"📦 {p.get('name','')}\n"
        f"💰 {fmt(amount)} so'm\n"
        f"🆔 #{code}\n\n"
        f"⏳ Sotuvchi tasdiqlashi kutilmoqda..."
    )

def delivery_notice(p):
    dtype = p.get('delivery_type', 'pickup')
    if dtype == 'deliver':
        return "🚚 <b>Yetkazib berish:</b> Sotuvchi yetkazadi\nTo'lovdan so'ng manzil so'raladi."
    return "🏪 <b>Olish:</b> Sotuvchi manzilidan olib ketasiz\n📞 " + p.get('contact', '')

def auto_check(code, order, p):
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

    # ── OPEN SHOP ──
    if d == 'open_shop':
        answer_cb(cbid)
        if APP_URL:
            send_buyer(uid,
                "🛍 <b>Joynshop do'koni</b>\n\nMahsulotlarni ko'rish uchun:",
                {'inline_keyboard': [
                    [{'text': "🌐 Saytga o'tish",  'url': APP_URL}],
                    [{'text': "📱 Miniapp ochish", 'url': f'{APP_URL}/miniapp'}],
                ]}
            )
        else:
            send_buyer(uid,
                "🛍 Tez kunda to'liq sayt ishga tushadi!\n"
                "Hozircha botdan foydalaning 🤝"
            )
        return

    # ── BUYER MENU ──
    def buyer_main_menu():
        send_buyer(uid,
            "👋 <b>Joynshop</b>\n\nNimani qilmoqchisiz?",
            {'inline_keyboard': [
                [{'text': "🛍 Do'konga o'tish",  'callback_data': 'open_shop'}],
                [{'text': "📋 Buyurtmalarim",    'callback_data': 'buyer_mystatus'}],
                [
                    {'text': "👤 Profilim",      'callback_data': 'buyer_myprofile'},
                    {'text': "🤍 Wishlist",      'callback_data': 'buyer_mywishlist'},
                ],
                [
                    {'text': "↩️ Qaytarish",    'callback_data': 'buyer_refund'},
                    {'text': "❓ Yordam",         'callback_data': 'buyer_help'},
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

    if d.startswith('choose_'):
        pid = d[7:]
        if pid not in products:
            answer_cb(cbid, '❌ Mahsulot topilmadi!'); return
        p = products[pid]
        if p.get('status') == 'closed':
            answer_cb(cbid, '⛔️ Yopilgan!'); return
        answer_cb(cbid)
        count    = len(groups.get(pid, []))
        min_g    = p['min_group']
        has_solo = p.get('solo_price')
        kb = []
        if count < min_g:
            kb.append([{'text': f"👥 Guruh narxi — {fmt(p['group_price'])} so'm ({count}/{min_g})", 'callback_data': f'join_{pid}'}])
        if has_solo:
            kb.append([{'text': f"👤 Yakka narxi — {fmt(p['solo_price'])} so'm", 'callback_data': f'solo_{pid}'}])
        kb.append([{'text': "❌ Bekor", 'callback_data': 'noop'}])
        send_buyer(uid,
            f"📦 <b>{p['name']}</b>\n\nQanday sotib olmoqchisiz?",
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

        variants = p.get('variants', [])
        if variants:
            answer_cb(cbid)
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
        answer_cb(cbid, "To'lov sahifasi ochilmoqda...")
        # Click invoice yuborish
        if CLICK_TOKEN:
            photo = p.get('photos', [None])[0]
            photo_url = None
            if photo and CDN_BASE_URL:
                photo_url = f"{CDN_BASE_URL}/products/{photo}.jpg"
            send_invoice(
                uid,
                title=p['name'],
                description=f"Guruh xarid • {p.get('shop_name','Sotuvchi')} • #{code}",
                payload=code,
                amount=p['group_price'],
                photo_url=photo_url
            )
        else:
            # Fallback: qo'lda Payme
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
                {'text': '⭐',         'callback_data': f'rate_{pid}_1'},
                {'text': '⭐⭐',       'callback_data': f'rate_{pid}_2'},
                {'text': '⭐⭐⭐',     'callback_data': f'rate_{pid}_3'},
                {'text': '⭐⭐⭐⭐',   'callback_data': f'rate_{pid}_4'},
                {'text': '⭐⭐⭐⭐⭐', 'callback_data': f'rate_{pid}_5'},
            ]]}
        )
        return

    if d.startswith('rate_') and not d.startswith('rate_start_'):
        parts  = d.split('_')
        pid    = parts[1]
        rating = int(parts[2])
        answer_cb(cbid, f"{'⭐'*rating} Baho berildi!")
        p   = products.get(pid, {})
        uname = cb['from'].get('first_name', 'Xaridor')
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

    # Deep link: /start join_xxx  /start solo_xxx  /start ref_uid
    if text.startswith('/start ') or text.startswith('/start\n'):
        param = text.split(None, 1)[1].strip() if len(text.split(None, 1)) > 1 else ''

        # buy_PID_TYPE — kanaldan kelgan, to'g'ri Mini App ga yo'naltirish
        if param.startswith('buy_'):
            parts = param.split('_')
            if len(parts) >= 2:
                pid = parts[1]
                buy_type = parts[2] if len(parts) > 2 else 'group'
                p = products.get(pid)
                if not p:
                    send_buyer(cid, "❌ Mahsulot topilmadi yoki yopilgan.")
                    return
                miniapp_url = f'{APP_URL}/miniapp?pid={pid}&action=buy&type={buy_type}' if APP_URL else None
                if miniapp_url:
                    # Faqat bitta xabar — Mini App ochish tugmasi bilan
                    send_buyer(cid,
                        f"🛒 <b>{p['name']}</b>\n\n"
                        f"Xarid qilish uchun pastdagi tugmani bosing:",
                        {'inline_keyboard': [[
                            {'text': "🛍 Xarid qilish", 'web_app': {'url': miniapp_url}}
                        ]]}
                    )
                else:
                    send_buyer(cid, "⚠️ Sayt vaqtinchalik ishlamayapti, keyinroq urinib ko'ring.")
                return

        if param.startswith('ref_'):
            try:
                referrer_uid = int(param[4:])
                if referrer_uid != uid and uid not in referral_map:
                    referral_map[uid] = referrer_uid
                    if str(referrer_uid) not in referrals:
                        referrals[str(referrer_uid)] = {'count': 0, 'cashback': 0}
                    referrals[str(referrer_uid)]['count']   += 1
                    referrals[str(referrer_uid)]['cashback'] += 10000
                    prof = get_profile(referrer_uid)
                    prof['cashback']  = prof.get('cashback', 0) + 10000
                    prof['referrals'] = prof.get('referrals', 0) + 1
                    save_data()
                    send_buyer(referrer_uid,
                        f"🎉 <b>Yangi taklif!</b>\n\n"
                        f"Do'stingiz Joynshop ga qo'shildi!\n"
                        f"💰 +10,000 so'm cashback oldiniz!\n\n"
                        f"Jami cashback: {fmt(prof['cashback'])} so'm"
                    )
            except: pass
            # /start with ref — welcome message
            miniapp_url = f'{APP_URL}/miniapp' if APP_URL else None
            site_url    = APP_URL if APP_URL else None

            inline_row = []
            if site_url:
                inline_row.append({'text': "🌐 Saytga o'tish", 'url': site_url})
            if miniapp_url:
                inline_row.append({'text': "📱 Miniapp ochish", 'web_app': {'url': miniapp_url}})
            if not inline_row:
                inline_row.append({'text': "🛍 Do'konga o'tish", 'callback_data': 'open_shop'})

            send_buyer(cid,
                "👋 <b>Joynshop ga xush kelibsiz!</b>\n\n"
                "🛍 Do'stlaringiz bilan xarid qiling — <b>40% gacha tejang!</b>\n\n"
                "💰 Do'stingiz sizni taklif qildi — birinchi xariddan chegirma olasiz!",
                {
                    'keyboard': [
                        [{'text': "📋 Buyurtmalarim"}, {'text': "👤 Profilim"}],
                        [{'text': "🤍 Wishlist"},       {'text': "❓ Yordam"}],
                    ],
                    'resize_keyboard': True,
                    'is_persistent':   True,
                }
            )
            send_buyer(cid,
                "🏪 Xarid boshlash uchun:",
                {'inline_keyboard': [inline_row]}
            )
            return

        if param.startswith('join_') or param.startswith('solo_'):
            action, pid = param.split('_', 1)
            if pid not in products:
                send_buyer(cid, "❌ Mahsulot topilmadi yoki muddati o'tgan.")
                return
            p = products[pid]
            if p.get('status') == 'closed':
                send_buyer(cid, "⛔️ Bu guruh/sotuv yopilgan.")
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
                if CLICK_TOKEN:
                    photo = p.get('photos', [None])[0]
                    photo_url = f"{CDN_BASE_URL}/products/{photo}.jpg" if photo and CDN_BASE_URL else None
                    send_invoice(cid, title=p['name'],
                        description=f"{p.get('shop_name','Sotuvchi')} • Yakka • #{code}",
                        payload=code, amount=p['solo_price'], photo_url=photo_url)
                else:
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

            # action == 'join'
            if pid not in groups: groups[pid] = []
            if uid in groups[pid]:
                send_buyer(cid, '✅ Siz allaqachon guruhdasiz!'); return

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
            if CLICK_TOKEN:
                photo = p.get('photos', [None])[0]
                photo_url = f"{CDN_BASE_URL}/products/{photo}.jpg" if photo and CDN_BASE_URL else None
                send_invoice(cid, title=p['name'],
                    description=f"{p.get('shop_name','Sotuvchi')} • Guruh • #{code}",
                    payload=code, amount=p['group_price'], photo_url=photo_url)
            else:
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

    # ── /start (parametrsiz) ──
    if text == '/start':
        miniapp_url = f'{APP_URL}/miniapp' if APP_URL else None
        site_url    = APP_URL if APP_URL else None

        # 1 ta xabar: salom matni + inline [Saytga o'tish] [Miniapp] buttonlar
        inline_row = []
        if site_url:
            inline_row.append({'text': "🌐 Saytga o'tish", 'url': site_url})
        if miniapp_url:
            inline_row.append({'text': "📱 Miniapp ochish", 'web_app': {'url': miniapp_url}})
        if not inline_row:
            inline_row.append({'text': "🛍 Do'konga o'tish", 'callback_data': 'open_shop'})

        # 1: reply keyboard (pastki menyu) — bo'sh matn bilan
        send_buyer(cid,
            "👋 <b>Joynshop ga xush kelibsiz!</b>\n\n"
            "🛍 Do'stlaringiz bilan xarid qiling — <b>40% gacha tejang!</b>",
            {'inline_keyboard': [inline_row]}
        )
        # 2: reply keyboard ni o'rnatish
        send_buyer(cid, "📌 Asosiy menyu:",
            {
                'keyboard': [
                    [{'text': "📋 Buyurtmalarim"}, {'text': "👤 Profilim"}],
                    [{'text': "🤍 Wishlist"},       {'text': "❓ Yordam"}],
                ],
                'resize_keyboard': True,
                'is_persistent':   True,
            }
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

# ══════════════════════════════════════════════════════════════════════
#  FLASK ROUTES
# ══════════════════════════════════════════════════════════════════════
@app.route('/', methods=['GET'])
def index():
    return 'Joynshop Bot ishlayapti! 🏪🛍'

@app.route('/api/stats', methods=['GET'])
def api_stats():
    from flask import jsonify
    pwd = request.args.get('pwd', '')
    if pwd != DASHBOARD_PASSWORD:
        return jsonify({'error': 'Unauthorized'}), 401

    now         = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start  = today_start - timedelta(days=7)

    all_confirmed = [o for o in orders.values() if o['status'] == 'confirmed']
    today_orders  = [o for o in all_confirmed if datetime.strptime(o['created'], '%d.%m.%Y %H:%M') >= today_start]
    week_orders   = [o for o in all_confirmed if datetime.strptime(o['created'], '%d.%m.%Y %H:%M') >= week_start]

    gmv_total = sum(o['amount'] for o in all_confirmed)
    gmv_today = sum(o['amount'] for o in today_orders)
    gmv_week  = sum(o['amount'] for o in week_orders)

    all_products  = list(products.values())
    active_prods  = [p for p in all_products if p.get('status') != 'closed']
    filled_groups = [p for p in all_products if len(groups.get(list(products.keys())[list(products.values()).index(p)], [])) >= p.get('min_group', 99)]

    unique_sellers = len(set(p.get('seller_id') for p in all_products if p.get('seller_id')))
    unique_buyers  = len(set(o['user_id'] for o in all_confirmed))
    today_buyers   = len(set(o['user_id'] for o in today_orders))
    total_attempts = len([o for o in orders.values()])
    conv_rate      = round(len(all_confirmed) / total_attempts * 100) if total_attempts else 0

    daily_data = []
    for i in range(13, -1, -1):
        day     = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        day_orders = [o for o in all_confirmed
                      if datetime.strptime(o['created'], '%d.%m.%Y %H:%M') >= day
                      and datetime.strptime(o['created'], '%d.%m.%Y %H:%M') < day_end]
        daily_data.append({
            'date':   day.strftime('%d.%m'),
            'gmv':    sum(o['amount'] for o in day_orders),
            'orders': len(day_orders)
        })

    return jsonify({
        'sellers': {
            'total':    unique_sellers,
            'channels': len(verified_channels),
            'channel_list': [
                {
                    'username': ch,
                    'owner':    data.get('owner_id'),
                    'mods':     len(data.get('moderators', [])),
                    'products': sum(1 for p in products.values() if p.get('seller_channel') == ch and p.get('status') != 'closed')
                }
                for ch, data in verified_channels.items()
            ],
        },
        'referrals': {
            'total_referrers': len(referrals),
            'total_referred':  len(referral_map),
            'total_cashback':  sum(v.get('cashback', 0) for v in referrals.values()),
        },
        'buyers': {
            'total': unique_buyers,
            'today': today_buyers,
        },
        'products': {
            'total':  len(all_products),
            'active': len(active_prods),
            'filled': len(filled_groups),
        },
        'orders': {
            'total':      len(all_confirmed),
            'today':      len(today_orders),
            'week':       len(week_orders),
            'conversion': conv_rate,
        },
        'finance': {
            'gmv_total':        gmv_total,
            'gmv_today':        gmv_today,
            'gmv_week':         gmv_week,
            'commission_total': int(gmv_total * COMMISSION_RATE),
            'commission_week':  int(gmv_week  * COMMISSION_RATE),
            'avg_order':        int(gmv_total / len(all_confirmed)) if all_confirmed else 0,
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
            'code':        code,
            'name':        p.get('name',''),
            'shop_name':   p.get('shop_name',''),
            'amount':      o.get('amount', 0),
            'type':        o.get('type','group'),
            'status':      o.get('status',''),
            'status_text': st.get(o.get('status',''), ''),
            'status_icon': em.get(o.get('status',''), '?'),
            'created':     o.get('created',''),
            'address':     o.get('address',''),
            'photo_id':    p.get('photo_id',''),
            'delivery':    p.get('delivery_type','pickup'),
        })
    return jsonify(result)

@app.route('/api/user/<int:uid>/profile', methods=['GET'])
def api_user_profile(uid):
    from flask import jsonify
    prof    = get_profile(uid)
    ref_d   = referrals.get(str(uid), {'count': 0, 'cashback': 0})
    my_ords = {k:v for k,v in orders.items() if v.get('user_id')==uid and v.get('status')=='confirmed'}
    return jsonify({
        'total_orders':    prof.get('total_orders', 0),
        'total_saved':     prof.get('total_saved', 0),
        'groups_joined':   prof.get('groups_joined', 0),
        'cashback':        prof.get('cashback', 0),
        'referral_count':  ref_d.get('count', 0),
        'confirmed_orders': len(my_ords),
    })

@app.route('/api/photo/<file_id>', methods=['GET'])
def api_photo(file_id):
    from flask import redirect
    for p in products.values():
        if p.get('photo_id') == file_id and p.get('photo_url'):
            return redirect(p['photo_url'])
        if file_id in p.get('photo_ids', []):
            urls = p.get('photo_urls', [])
            idx  = p['photo_ids'].index(file_id) if file_id in p.get('photo_ids',[]) else -1
            if idx >= 0 and idx < len(urls) and urls[idx]:
                return redirect(urls[idx])
    cached = _photo_url_cache.get(file_id)
    if cached:
        return redirect(cached)
    s3_url = upload_photo_to_s3(file_id, SELLER_TOKEN)
    if s3_url:
        _photo_url_cache[file_id] = s3_url
        return redirect(s3_url)
    try:
        result = requests.get(
            f'https://api.telegram.org/bot{SELLER_TOKEN}/getFile',
            params={'file_id': file_id}
        ).json()
        if result.get('ok'):
            path = result['result']['file_path']
            url  = f'https://api.telegram.org/file/bot{SELLER_TOKEN}/{path}'
            _photo_url_cache[file_id] = url
            return redirect(url)
    except: pass
    return '', 404

@app.route('/fonts/<path:filename>', methods=['GET'])
def serve_font(filename):
    from flask import send_from_directory, Response
    font_path = os.path.join(os.getcwd(), 'fonts')
    try:
        return send_from_directory(font_path, filename, mimetype='font/truetype')
    except:
        return Response('', 404)

@app.route('/miniapp', methods=['GET'])
def miniapp():
    from flask import Response
    html = open('miniapp.html').read()
    return Response(html, mimetype='text/html')

@app.route('/pay/<pid>', methods=['GET'])
def pay_page(pid):
    """To'lov sahifasi — kanal postidan kelgan xaridorlar uchun"""
    from flask import Response
    try:
        html = open('pay.html').read()
        return Response(html, mimetype='text/html')
    except FileNotFoundError:
        return "<h1>Pay page</h1><p>pay.html fayli topilmadi</p>", 404

@app.route('/live/<live_id>', methods=['GET'])
def live_page(live_id):
    """Live tomosha qilish sahifasi"""
    from flask import Response
    try:
        html = open('live.html').read()
        return Response(html, mimetype='text/html')
    except FileNotFoundError:
        return "<h1>Live page</h1><p>live.html fayli topilmadi</p>", 404

@app.route('/api/lives', methods=['GET'])
def api_lives():
    """Faol live'lar ro'yxati"""
    from datetime import datetime as _dt
    now = _dt.now()
    result = []
    for lid, lv in lives.items():
        if lv.get('status') != 'live':
            continue
        # Vaqt tugaganmi?
        try:
            ends = _dt.strptime(lv['ends_at'], '%Y-%m-%d %H:%M')
            if ends < now:
                lv['status'] = 'ended'
                continue
            seconds_left = int((ends - now).total_seconds())
        except:
            seconds_left = 0
        p = products.get(lv.get('product_id',''), {})
        if not p:
            continue
        result.append({
            'id':            lid,
            'product_id':    lv['product_id'],
            'product_name':  p.get('name',''),
            'shop_name':     p.get('shop_name',''),
            'video_file_id': lv.get('video_file_id',''),
            'group_price':   p.get('group_price', 0),
            'live_price':    lv.get('live_price', 0),
            'discount_pct':  lv.get('discount_pct', 0),
            'viewer_count':  lv.get('viewer_count', 0),
            'joiner_count':  len(lv.get('joiners', [])),
            'min_group':     p.get('min_group', 0),
            'count':         len(groups.get(lv.get('product_id',''), [])),
            'seconds_left':  seconds_left,
            'photo_id':      p.get('photo_id', ''),
            'photo_url':     p.get('photo_url', ''),
        })
    save_data()
    result.sort(key=lambda x: x['viewer_count'], reverse=True)
    return jsonify(result)

@app.route('/api/live/<live_id>', methods=['GET'])
def api_live(live_id):
    """Bitta live ma'lumoti — live.html sahifasi uchun"""
    from datetime import datetime as _dt
    lv = lives.get(live_id)
    if not lv:
        return jsonify({'ok': False, 'error': 'Live topilmadi'}), 404
    p = products.get(lv.get('product_id',''), {})
    try:
        ends = _dt.strptime(lv['ends_at'], '%Y-%m-%d %H:%M')
        seconds_left = max(0, int((ends - _dt.now()).total_seconds()))
        if seconds_left == 0 and lv.get('status') == 'live':
            lv['status'] = 'ended'
            save_data()
    except:
        seconds_left = 0
    # Video URL — Telegram file_id orqali
    video_url = None
    file_id   = lv.get('video_file_id', '')
    if file_id:
        try:
            r = requests.get(
                f'https://api.telegram.org/bot{SELLER_TOKEN}/getFile',
                params={'file_id': file_id}, timeout=5
            ).json()
            if r.get('ok'):
                file_path = r['result']['file_path']
                video_url = f'https://api.telegram.org/file/bot{SELLER_TOKEN}/{file_path}'
        except Exception as e:
            logging.error(f"Video URL fetch error: {e}")
    return jsonify({
        'ok':           True,
        'id':           live_id,
        'status':       lv.get('status', 'live'),
        'product_id':   lv.get('product_id', ''),
        'product_name': p.get('name', ''),
        'shop_name':    p.get('shop_name', ''),
        'description':  p.get('description', ''),
        'video_url':    video_url,
        'group_price':  p.get('group_price', 0),
        'live_price':   lv.get('live_price', 0),
        'original_price': p.get('original_price', 0),
        'discount_pct': lv.get('discount_pct', 0),
        'viewer_count': lv.get('viewer_count', 0),
        'joiner_count': len(lv.get('joiners', [])),
        'min_group':    p.get('min_group', 0),
        'count':        len(groups.get(lv.get('product_id',''), [])),
        'seconds_left': seconds_left,
        'photo_id':     p.get('photo_id', ''),
        'photo_url':    p.get('photo_url', ''),
        'contact':      p.get('contact', ''),
        'questions':    lv.get('questions', [])[-20:],
    })

@app.route('/api/live/<live_id>/view', methods=['POST'])
def api_live_view(live_id):
    """Live ko'rganni qayd qilish"""
    lv = lives.get(live_id)
    if not lv:
        return jsonify({'ok': False}), 404
    data = request.json or {}
    user_id = data.get('user_id', 0)
    viewers = lv.setdefault('viewers', [])
    if user_id and user_id not in viewers:
        viewers.append(user_id)
        lv['viewer_count'] = len(viewers)
        save_data()
        # Sotuvchiga real-time update (har 5-chi ko'ruvchida)
        if len(viewers) % 5 == 0:
            seller_id = lv.get('seller_id')
            if seller_id:
                p = products.get(lv['product_id'], {})
                send_seller(seller_id,
                    f"🔥 <b>{p.get('name','')}</b> — Live\n"
                    f"👀 {len(viewers)} kishi tomosha qilyapti!"
                )
    return jsonify({'ok': True, 'viewer_count': lv['viewer_count']})

@app.route('/api/live/<live_id>/question', methods=['POST'])
def api_live_question(live_id):
    """Live ga savol yuborish"""
    lv = lives.get(live_id)
    if not lv:
        return jsonify({'ok': False}), 404
    data = request.json or {}
    q = {
        'user_name': data.get('user_name', 'Mehmon')[:30],
        'text':      data.get('text', '')[:200],
        'time':      datetime.now().strftime('%H:%M'),
    }
    if not q['text']:
        return jsonify({'ok': False}), 400
    lv.setdefault('questions', []).append(q)
    save_data()
    # Sotuvchiga xabar
    seller_id = lv.get('seller_id')
    if seller_id:
        p = products.get(lv['product_id'], {})
        send_seller(seller_id,
            f"💬 <b>Live savol</b> — {p.get('name','')}\n\n"
            f"<b>{q['user_name']}:</b> {q['text']}"
        )
    return jsonify({'ok': True})

@app.route('/api/product/<pid>', methods=['GET'])
def api_product(pid):
    """Bitta mahsulot ma'lumoti — pay sahifasi uchun"""
    p = products.get(pid)
    if not p:
        return jsonify({'ok': False, 'error': 'Mahsulot topilmadi'}), 404
    if p.get('status') == 'closed':
        return jsonify({'ok': False, 'error': 'Mahsulot yopilgan'}), 400
    count = len(groups.get(pid, []))
    return jsonify({
        'ok':            True,
        'id':            pid,
        'name':          p['name'],
        'description':   p.get('description', ''),
        'photos':        p.get('photo_ids', []) or ([p.get('photo_id')] if p.get('photo_id') else []),
        'photo_url':     p.get('photo_url', ''),
        'photo_urls':    p.get('photo_urls', []),
        'category':      p.get('category', ''),
        'original_price': p['original_price'],
        'solo_price':    p.get('solo_price', 0),
        'group_price':   p['group_price'],
        'min_group':     p['min_group'],
        'count':         count,
        'stock':         p.get('stock', 9999),
        'sale_type':     p.get('sale_type', 'both'),
        'variants':      p.get('variants', []),
        'shop_name':     p.get('shop_name', ''),
        'contact':       p.get('contact', ''),
        'address':       p.get('address', ''),
        'deadline':      p.get('deadline', ''),
    })

@app.route('/manifest.json', methods=['GET'])
def manifest():
    from flask import Response
    import json as _json
    data = {
        "name": "Joynshop",
        "short_name": "Joynshop",
        "description": "Guruh xarid platformasi — 40% gacha tejang!",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#FA7319",
        "orientation": "portrait-primary",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
        ],
        "categories": ["shopping"],
        "lang": "uz"
    }
    return Response(_json.dumps(data), mimetype='application/manifest+json')

@app.route('/sw.js', methods=['GET'])
def service_worker():
    from flask import Response
    try:
        sw = open('sw.js').read()
    except:
        sw = "self.addEventListener('fetch',()=>{});"
    return Response(sw, mimetype='application/javascript')

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

@app.route('/api/buyer_orders', methods=['GET'])
def api_buyer_orders():
    from flask import jsonify
    uid = request.args.get('uid', type=int)
    if not uid: return jsonify([]), 400
    result = []
    for oid, o in orders.items():
        if o.get('buyer_id') != uid: continue
        pid = o.get('product_id','')
        p   = products.get(pid, {})
        result.append({
            'id':        oid,
            'code':      o.get('code', oid),
            'name':      p.get('name', o.get('product_name','')),
            'shop_name': p.get('shop_name', ''),
            'photo_url': p.get('photo_url') or (f"{request.host_url}api/photo/{p.get('photo_id')}" if p.get('photo_id') else ''),
            'amount':    o.get('amount', p.get('group_price' if o.get('type')=='group' else 'solo_price', 0)),
            'type':      o.get('type', 'group'),
            'delivery':  o.get('delivery_type', 'pickup'),
            'address':   o.get('address', ''),
            'status':    o.get('status', 'pending'),
            'created':   o.get('created_at', ''),
        })
    result.sort(key=lambda x: x['created'], reverse=True)
    return jsonify(result)

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
            'category':       p.get('category',''),
            'sale_type':      p.get('sale_type','both'),
            'original_price': orig,
            'solo_price':     solo,
            'group_price':    grp,
            'min_group':      min_g,
            'count':          count,
            'deadline':       p.get('deadline',''),
            'photo_id':       p.get('photo_id',''),
            'contact':        p.get('contact',''),
            'solo_disc':      round((orig-solo)/orig*100) if solo and orig else 0,
            'grp_disc':       round((orig-grp)/orig*100)  if grp  and orig else 0,
            'join_url':       f"https://t.me/{BUYER_BOT_USERNAME}?start=join_{pid}",
            'solo_url':       f"https://t.me/{BUYER_BOT_USERNAME}?start=solo_{pid}" if solo else None,
            'photo_ids':      p.get('photo_ids', [p.get('photo_id')] if p.get('photo_id') else []),
            'photo_url':      p.get('photo_url', ''),
            'photo_urls':     p.get('photo_urls', []),
            'seller_channel': p.get('seller_channel',''),
            'solo_available': p.get('solo_available', True),
            'variants':       p.get('variants', []),
            'stock':          p.get('stock', 9999),
        })
    result.sort(key=lambda x: x['count'], reverse=True)
    return jsonify(result)

# ─── ADMIN API ───────────────────────────────────────────────────────
def admin_auth(req):
    return req.args.get('pwd','') == DASHBOARD_PASSWORD

@app.route('/api/admin/orders', methods=['GET'])
def api_admin_orders():
    from flask import jsonify
    if not admin_auth(request): return jsonify({'error':'Unauthorized'}),401
    page=int(request.args.get('page',1)); status=request.args.get('status',''); per=20
    all_orders=list(orders.values())
    if status: all_orders=[o for o in all_orders if o.get('status')==status]
    all_orders.sort(key=lambda o:o.get('created',''),reverse=True)
    total=len(all_orders); pages=max(1,(total+per-1)//per)
    chunk=all_orders[(page-1)*per:page*per]
    result=[]
    for o in chunk:
        result.append({'code':o.get('code',''),'product':products.get(o.get('product_id',''),{}).get('name','—'),
            'shop':products.get(o.get('product_id',''),{}).get('shop_name',''),
            'buyer_id':o.get('user_id',''),'buyer_name':o.get('user_name','—'),
            'amount':o.get('amount',0),'type':o.get('type','group'),
            'status':o.get('status',''),'status_icon':o.get('status_icon',''),
            'status_text':o.get('status_text',o.get('status','')),
            'created':o.get('created',''),'delivery':o.get('delivery',''),'address':o.get('address','')})
    return jsonify({'orders':result,'total':total,'pages':pages,'page':page})

@app.route('/api/admin/order/<code>/confirm', methods=['POST'])
def api_admin_confirm(code):
    from flask import jsonify
    if not admin_auth(request): return jsonify({'error':'Unauthorized'}),401
    o=orders.get(code)
    if not o: return jsonify({'error':'Not found'}),404
    o['status']='confirmed';o['status_text']='Tasdiqlandi';o['status_icon']='✅'
    save_data(); return jsonify({'ok':True})

@app.route('/api/admin/order/<code>/reject', methods=['POST'])
def api_admin_reject(code):
    from flask import jsonify
    if not admin_auth(request): return jsonify({'error':'Unauthorized'}),401
    o=orders.get(code)
    if not o: return jsonify({'error':'Not found'}),404
    o['status']='rejected';o['status_text']='Rad etildi';o['status_icon']='❌'
    save_data(); return jsonify({'ok':True})

@app.route('/api/admin/products', methods=['GET'])
def api_admin_products():
    from flask import jsonify
    if not admin_auth(request): return jsonify({'error':'Unauthorized'}),401
    result=[]
    for pid,p in products.items():
        count=len(groups.get(pid,[])); orig=p.get('original_price',0); grp=p.get('group_price',0)
        disc=round((orig-grp)/orig*100) if orig else 0
        result.append({'id':pid,'name':p.get('name',''),'shop_name':p.get('shop_name',''),
            'group_price':grp,'original_price':orig,'grp_disc':disc,
            'min_group':p.get('min_group',0),'count':count,'status':p.get('status','active'),
            'deadline':p.get('deadline',''),'seller_id':p.get('seller_id','')})
    result.sort(key=lambda x:x['status']!='active'); return jsonify(result)

@app.route('/api/admin/product/<pid>/close', methods=['POST'])
def api_admin_close(pid):
    from flask import jsonify
    if not admin_auth(request): return jsonify({'error':'Unauthorized'}),401
    p=products.get(pid)
    if not p: return jsonify({'error':'Not found'}),404
    p['status']='closed'; save_data(); return jsonify({'ok':True})

@app.route('/api/admin/product/<pid>/extend', methods=['POST'])
def api_admin_extend(pid):
    from flask import jsonify
    if not admin_auth(request): return jsonify({'error':'Unauthorized'}),401
    p=products.get(pid)
    if not p: return jsonify({'error':'Not found'}),404
    try: dt=datetime.strptime(p['deadline_dt'],'%Y-%m-%d %H:%M')+timedelta(hours=24)
    except: dt=datetime.now()+timedelta(hours=24)
    p['deadline']=dt.strftime('%d.%m.%Y %H:%M'); p['deadline_dt']=dt.strftime('%Y-%m-%d %H:%M')
    save_data(); return jsonify({'ok':True,'deadline':p['deadline']})

@app.route('/api/admin/buyers', methods=['GET'])
def api_admin_buyers():
    from flask import jsonify
    if not admin_auth(request): return jsonify({'error':'Unauthorized'}),401
    page=int(request.args.get('page',1)); per=20
    stats={}
    for o in orders.values():
        uid=str(o.get('user_id',''))
        if not uid: continue
        if uid not in stats:
            stats[uid]={'uid':uid,'total_spent':0,'confirmed':0,'cashback':0,'referrals':0,'last_order':''}
        if o.get('status')=='confirmed':
            stats[uid]['total_spent']+=o.get('amount',0)
            stats[uid]['confirmed']+=1
            stats[uid]['cashback']+=int(o.get('amount',0)*0.02)
        if o.get('created','')>stats[uid]['last_order']:
            stats[uid]['last_order']=o.get('created','')
    for ref_uid,refs in referrals.items():
        uid=str(ref_uid)
        if uid in stats: stats[uid]['referrals']=len(refs)
    buyers_list=sorted(stats.values(),key=lambda x:x['total_spent'],reverse=True)
    total=len(buyers_list); pages=max(1,(total+per-1)//per)
    chunk=buyers_list[(page-1)*per:page*per]
    return jsonify({'buyers':chunk,'total':total,'pages':pages,'page':page})

@app.route('/api/admin/sellers', methods=['GET'])
def api_admin_sellers():
    from flask import jsonify
    if not admin_auth(request): return jsonify({'error':'Unauthorized'}),401
    result=[]
    for uid,pids in seller_products.items():
        revenue=0; order_cnt=0; active_cnt=0; channels=[]
        for pid in pids:
            p=products.get(pid,{})
            if not p: continue
            if p.get('status')=='active': active_cnt+=1
            ch=p.get('seller_channel','')
            if ch and ch not in channels: channels.append(ch)
            for o in orders.values():
                if o.get('product_id')==pid and o.get('status')=='confirmed':
                    revenue+=o.get('amount',0); order_cnt+=1
        commission=int(revenue*COMMISSION_RATE); payout=revenue-commission
        result.append({'uid':str(uid),'channels':channels,'products':len(pids),
            'active':active_cnt,'revenue':revenue,'commission':commission,
            'payout':payout,'orders':order_cnt})
    result.sort(key=lambda x:x['revenue'],reverse=True); return jsonify(result)

@app.route('/setup-menu', methods=['GET'])
def setup_menu_route():
    from flask import jsonify
    if request.args.get('key','')!=DASHBOARD_PASSWORD:
        return jsonify({'ok':False,'error':'unauthorized'}),403
    miniapp_url=f"{APP_URL}/miniapp" if APP_URL else None
    results={}
    if BUYER_TOKEN and miniapp_url:
        r=requests.post(f'https://api.telegram.org/bot{BUYER_TOKEN}/setChatMenuButton',
            json={'menu_button':{'type':'web_app','text':'🛍 Joynshop','web_app':{'url':miniapp_url}}}).json()
        results['buyer_menu']=r
    elif BUYER_TOKEN:
        results['buyer_menu']='APP_URL not set'
    if SELLER_TOKEN:
        r=requests.post(f'https://api.telegram.org/bot{SELLER_TOKEN}/setChatMenuButton',
            json={'menu_button':{'type':'commands'}}).json()
        results['seller_menu']=r
    results['miniapp_url']=miniapp_url; results['APP_URL']=APP_URL; results['BACKEND_URL']=BACKEND_URL
    return jsonify({'ok':True,'results':results})

@app.route('/dashboard', methods=['GET'])
def dashboard():
    from flask import Response
    html = open('dashboard.html').read()
    return Response(html, mimetype='text/html')


@app.route('/api/wishlist', methods=['GET'])
def api_wishlist_get():
    from flask import jsonify
    uid = request.args.get('uid', type=int)
    if not uid: return jsonify([]), 400
    wl  = wishlists.get(uid, [])
    result = []
    for pid in wl:
        p = products.get(pid)
        if not p or p.get('status') == 'closed': continue
        count = len(groups.get(pid, []))
        orig  = p.get('original_price', 0)
        grp   = p.get('group_price', 0)
        result.append({
            'id':             pid,
            'name':           p.get('name', ''),
            'shop_name':      p.get('shop_name', ''),
            'group_price':    grp,
            'original_price': orig,
            'grp_disc':       round((orig - grp) / orig * 100) if orig else 0,
            'min_group':      p.get('min_group', 3),
            'count':          count,
            'photo_id':       p.get('photo_id', ''),
            'photo_url':      p.get('photo_url', ''),
            'deadline':       p.get('deadline', ''),
            'join_url':       f"https://t.me/{BUYER_BOT_USERNAME}?start=join_{pid}",
        })
    return jsonify(result)


@app.route('/api/wishlist/add', methods=['POST'])
def api_wishlist_add():
    from flask import jsonify
    data = request.json or {}
    uid  = data.get('uid')
    pid  = data.get('pid', '')
    if not uid or not pid:
        return jsonify({'ok': False, 'error': 'uid va pid kerak'}), 400
    uid = int(uid)
    if pid not in products:
        return jsonify({'ok': False, 'error': 'Mahsulot topilmadi'}), 404
    if uid not in wishlists: wishlists[uid] = []
    if pid not in wishlists[uid]:
        wishlists[uid].append(pid)
        save_data()
    return jsonify({'ok': True, 'count': len(wishlists[uid])})


@app.route('/api/wishlist/remove', methods=['POST'])
def api_wishlist_remove():
    from flask import jsonify
    data = request.json or {}
    uid  = data.get('uid')
    pid  = data.get('pid', '')
    if not uid or not pid:
        return jsonify({'ok': False, 'error': 'uid va pid kerak'}), 400
    uid = int(uid)
    if uid in wishlists and pid in wishlists[uid]:
        wishlists[uid].remove(pid)
        save_data()
    return jsonify({'ok': True, 'count': len(wishlists.get(uid, []))})

@app.route('/api/categories', methods=['GET'])
def api_categories():
    from flask import jsonify
    # Mahsulotlarda mavjud kategoriyalarni va sonini qaytaradi
    cat_counts = {}
    for p in products.values():
        if p.get('status') == 'closed': continue
        cat = p.get('category', '')
        if cat:
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
    # CATEGORIES tartibida qaytaramiz
    result = []
    for name, icon in CATEGORIES:
        if name in cat_counts:
            result.append({'name': name, 'icon': icon, 'count': cat_counts[name]})
    return jsonify(result)


@app.route('/api/web_checkout', methods=['POST'])
def api_web_checkout():
    """Sayt to'lov sahifasidan kelgan buyurtma — kanal postidan kelgan xaridorlar"""
    data = request.json or {}
    pid       = data.get('product_id', '')
    otype     = data.get('type', 'group')
    user_name = data.get('user_name', '').strip()
    user_phone = data.get('user_phone', '').strip()
    variant   = data.get('variant', '')
    delivery  = data.get('delivery', 'pickup')
    address   = data.get('address', '')

    # Validatsiya
    if not pid:
        return jsonify({'ok': False, 'error': 'product_id kerak'}), 400
    if not user_name or not user_phone:
        return jsonify({'ok': False, 'error': "Ism va telefon kiritilishi shart"}), 400

    p = products.get(pid)
    if not p:
        return jsonify({'ok': False, 'error': 'Mahsulot topilmadi'}), 404
    if p.get('status') == 'closed':
        return jsonify({'ok': False, 'error': 'Mahsulot yopilgan'}), 400

    # Narx
    if otype == 'solo':
        if not p.get('solo_price'):
            return jsonify({'ok': False, 'error': 'Yakka sotish mavjud emas'}), 400
        amount = p['solo_price']
    else:
        amount = p['group_price']

    # Buyurtma yaratish (web_user_id — Telegram ID yo'q, telefon orqali)
    code = gen_code()
    orders[code] = {
        'product_id':  pid,
        'user_id':     0,  # web user, Telegram ID yo'q
        'user_name':   user_name,
        'user_phone':  user_phone,
        'amount':      amount,
        'type':        otype,
        'variant':     variant,
        'delivery':    delivery,
        'address':     address,
        'status':      'pending',
        'created':     datetime.now().strftime('%d.%m.%Y %H:%M'),
        'source':      'web',
    }
    save_data()

    # Sotuvchiga xabar
    sid = p.get('seller_id')
    if sid:
        variant_line  = f"\n🎨 Variant: <b>{variant}</b>" if variant else ''
        delivery_text = "🚚 Yetkazib berish" if delivery == 'deliver' else "🏪 Olib ketish"
        address_line  = f"\n📍 Manzil: {address}" if address else ''
        send_seller(sid,
            f"🔔 <b>YANGI BUYURTMA (Sayt)</b>\n\n"
            f"📦 {p.get('name','')}{variant_line}\n"
            f"👤 {user_name}\n"
            f"📞 <code>{user_phone}</code>\n"
            f"💰 {fmt(amount)} so'm\n"
            f"🛒 {'Yakka' if otype=='solo' else 'Guruh'}\n"
            f"🚚 {delivery_text}{address_line}\n"
            f"🆔 #{code}",
            {'inline_keyboard': [[
                {'text': '✅ Tasdiqlash', 'callback_data': f'seller_ac_{code}'},
                {'text': '❌ Rad',        'callback_data': f'seller_ar_{code}'},
            ]]}
        )

    # Hozircha checkout_url yo'q (Click rasmiy ulanmagan)
    # Kelajakda: checkout_url = create_click_invoice(amount, code, ...)
    return jsonify({
        'ok':           True,
        'code':         code,
        'amount':       amount,
        'checkout_url': None  # kelajakda Click checkout URL
    })


@app.route('/api/checkout', methods=['POST'])
def api_checkout():
    from flask import jsonify
    data = request.json or {}

    pid       = data.get('product_id', '')
    uid       = data.get('user_id')
    user_name = data.get('user_name', 'Foydalanuvchi')
    otype     = data.get('type', 'group')       # 'group' | 'solo'
    variant   = data.get('variant', '')
    delivery  = data.get('delivery', 'pickup')  # 'pickup' | 'deliver'
    address   = data.get('address', '')

    # Validatsiya
    if not pid or not uid:
        return jsonify({'ok': False, 'error': 'product_id va user_id kerak'}), 400

    p = products.get(pid)
    if not p:
        return jsonify({'ok': False, 'error': 'Mahsulot topilmadi'}), 404
    if p.get('status') == 'closed':
        return jsonify({'ok': False, 'error': 'Mahsulot yopilgan'}), 400

    uid = int(uid)

    # Solo sotuv tekshiruvi
    if otype == 'solo':
        if not p.get('solo_price'):
            return jsonify({'ok': False, 'error': 'Yakka sotish mavjud emas'}), 400
        amount = p['solo_price']
    else:
        # Guruh — allaqachon qo'shilganmi?
        if uid in groups.get(pid, []):
            return jsonify({'ok': False, 'error': 'Allaqachon guruhdasiz'}), 400
        amount = p['group_price']

    # Buyurtma yaratish
    code = gen_code()
    orders[code] = {
        'product_id': pid,
        'user_id':    uid,
        'user_name':  user_name,
        'amount':     amount,
        'type':       otype,
        'variant':    variant,
        'delivery':   delivery,
        'address':    address,
        'status':     'pending',
        'created':    datetime.now().strftime('%d.%m.%Y %H:%M'),
        'source':     'miniapp',
    }
    save_data()

    variant_line  = f"\n🎨 Variant: <b>{variant}</b>" if variant else ''
    delivery_text = "🚚 Yetkazib berish" if delivery == 'deliver' else "🏪 Olib ketish"
    address_line  = f"\n📍 Manzil: {address}" if address else ''
    sale_type     = p.get('sale_type', 'both')

    # Click invoice link yaratish (Mini App ichida ochish uchun)
    invoice_link = None
    if CLICK_TOKEN:
        price_lbl = "Yakka narx" if otype == 'solo' else "Guruh narxi"
        # description: yakka bo'lsa minimal, guruh bo'lsa guruh ma'lumoti
        if sale_type == 'solo' or otype == 'solo':
            desc = (p.get('description') or p['name'])[:255]
        else:
            count   = len(groups.get(pid, []))
            min_g   = p['min_group']
            desc    = f"👥 Guruh: {count}/{min_g} • Kerak: {max(0, min_g-count)} kishi"
            if p.get('description'):
                desc += f"\n{p['description'][:100]}"
        desc = (desc + f"\n🏪 {p.get('shop_name','')} | {p.get('contact','')}")[:255]

        photo_url = p.get('photo_url') or None
        inv_data  = {
            'title':             strip_html(p['name'])[:32],
            'description':       desc,
            'payload':           code,
            'provider_token':    CLICK_TOKEN,
            'currency':          'UZS',
            'prices':            json.dumps([{'label': price_lbl, 'amount': amount * 100}]),
            'need_name':         True,
            'need_phone_number': True,
            'need_shipping_address': False,
            'is_flexible':       False,
        }
        if photo_url and photo_url.startswith('http'):
            inv_data['photo_url']  = photo_url
            inv_data['photo_size'] = 800
        # createInvoiceLink — URL qaytaradi (Mini App tg.openInvoice uchun)
        try:
            r = requests.post(f'https://api.telegram.org/bot{BUYER_TOKEN}/createInvoiceLink', json=inv_data, timeout=10).json()
            if r.get('ok'):
                invoice_link = r['result']
            else:
                logging.warning(f"createInvoiceLink failed: {r}")
                # Fallback: oddiy sendInvoice
                inv_data['chat_id'] = uid
                requests.post(f'https://api.telegram.org/bot{BUYER_TOKEN}/sendInvoice', json=inv_data, timeout=10)
        except Exception as e:
            logging.error(f"createInvoiceLink error: {e}")
    else:
        # Fallback: qo'lda Payme
        send_buyer(uid,
            f"🛒 <b>{p.get('shop_name','Sotuvchi')} — {'Yakka' if otype=='solo' else 'Guruh'} buyurtma</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"📦 {p['name']}{variant_line}\n"
            f"💰 {fmt(amount)} so'm\n"
            f"🚚 {delivery_text}{address_line}\n\n"
            f"💳 <b>Payme orqali to'lang:</b>\n"
            f"📱 <code>{PAYME_NUMBER}</code>\n"
            f"💵 <code>{fmt(amount)}</code>\n"
            f"📝 Izoh: <code>{code}</code>\n\n"
            f"⚠️ Izohga <b>{code}</b> yozing!\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🔒 Joynshop kafolati ostida",
            {'inline_keyboard': [
                [{'text': "✅ To'lovni tasdiqlayman", 'callback_data': f'paid_{code}'}],
                [{'text': "❌ Bekor",                 'callback_data': f'cancel_{code}'}],
            ]}
        )

    # Sotuvchiga xabar
    sid = p.get('seller_id')
    if sid:
        send_seller(sid,
            f"🔔 <b>YANGI BUYURTMA (Miniapp)</b>\n\n"
            f"📦 {p.get('name','')}{variant_line}\n"
            f"👤 {user_name} (ID: <code>{uid}</code>)\n"
            f"💰 {fmt(amount)} so'm\n"
            f"🛒 {'Yakka' if otype=='solo' else 'Guruh'}\n"
            f"🚚 {delivery_text}{address_line}\n"
            f"🆔 #{code}",
            {'inline_keyboard': [[
                {'text': '✅ Tasdiqlash', 'callback_data': f'seller_ac_{code}'},
                {'text': '❌ Rad',        'callback_data': f'seller_ar_{code}'},
            ]]}
        )

    return jsonify({'ok': True, 'code': code, 'amount': amount, 'invoice_link': invoice_link})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))

init_db()
load_data()
threading.Thread(target=setup_bot_ui, daemon=True).start()
