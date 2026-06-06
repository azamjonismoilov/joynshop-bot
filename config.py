# config.py — Joynshop konfiguratsiyasi
# bot.py dan ajratildi (refactor: 1-modul). Mantiq O'ZGARTIRILMAGAN — faqat ko'chirildi.
import os, logging, threading, requests

try:
    import boto3
    from botocore.exceptions import ClientError
    S3_AVAILABLE = True
except ImportError:
    S3_AVAILABLE = False
    logging.warning("boto3 not installed — S3 disabled")

# ─── TOKENS & CONFIG ────────────────────────────────────────────────
SELLER_TOKEN    = os.environ.get('SELLER_TOKEN')
BUYER_TOKEN     = os.environ.get('BUYER_TOKEN')
ADMIN_ID        = int(os.environ.get('ADMIN_ID', '0'))
PAYME_NUMBER    = os.environ.get('PAYME_NUMBER', '+998913968946')
COMMISSION_RATE = 0.04  # 4%
CLICK_TOKEN    = os.environ.get('CLICK_TOKEN', '')  # Click Terminal payment token
BILLZ_ENCRYPTION_KEY = os.environ.get('BILLZ_ENCRYPTION_KEY', '')  # billz.py ishlatadi

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

# Buyer Mini App — React frontend hosted on Vercel (buyer.joynshop.uz).
# Eski /miniapp Flask route ham ishlab turaveradi (fallback uchun).
# Sprint 1+ cutover: barcha bot inline web_app tugmalari shu URL'ga
# yo'naltirilgan. BUYER_APP_URL env var orqali override qilish mumkin
# (masalan staging uchun).
BUYER_APP_URL      = os.environ.get('BUYER_APP_URL', 'https://buyer.joynshop.uz').rstrip('/')

def setup_bot_ui():
    # Xaridor menu button — React Mini App'ga yo'naltiriladi (Vercel hosted).
    miniapp_url = BUYER_APP_URL or None

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
                # LIVE FROZEN: traction olganidan keyin uncomment qilinadi
                # {'command': 'golive',     'description': '🔴 Live boshlash'},
                # {'command': 'mylive',     'description': '📺 Live dashboard'},
                {'command': 'mychannels', 'description': '📢 Kanallarim'},
                {'command': 'help',       'description': 'ℹ️ Yordam'},
            ]
        })
    logging.info("Bot UI setup done.")
