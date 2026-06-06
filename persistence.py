# persistence.py — PostgreSQL ulanish + saqlanadigan SHARED STORAGE + save/load
# bot.py dan ajratildi (refactor: persistence 2-bosqich, COMMIT A).
# KRITIK: load_data() global'larni QAYTA TAYINLAMAYDI — mavjud dict'larni
# in-place (clear()+update()) yangilaydi. Aks holda bot.py 'from persistence
# import *' orqali olgan obyektlar eski qiymatda qolib, ma'lumot "yo'qoladi".
import os, json, logging, threading, pg8000

DATABASE_URL = os.environ.get('DATABASE_URL')
save_lock = threading.RLock()  # save_data race condition guard (audit 3.1)

# ─── SHARED STORAGE (saqlanadigan holat) ────────────────────────────
# Eslatma: seller_state va _photo_url_cache bot.py'da qoladi (saqlanmaydi).
products        = {}
groups          = {}
orders          = {}
wishlists       = {}
buyer_profiles  = {}
refund_requests = {}
customers       = {}  # {seller_id: {user_id: {...}}}
lives           = {}  # {live_id: {...}} - Live Commerce streams
seller_shops    = {}
seller_products = {}
seller_profiles = {}  # {uid: {legal_status, stir, bank_account, ..., terms_accepted, terms_accepted_at, terms_version}}
verified_channels       = {}
pending_moderator_codes = {}
referrals               = {}
referral_map            = {}
# Sprint 8 P18 — Audit log uchun (yurist tekshiruvi). Har element:
# {user_id, role: 'seller'|'buyer', version, accepted_at}
terms_acceptance_log    = []

def get_db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL not set")
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
    conn = None
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "CREATE TABLE IF NOT EXISTS joynshop_data "
            "(key TEXT PRIMARY KEY, value TEXT)"
        )
        conn.commit()
        cur.close()
        logging.info("DB initialized")
    except Exception as e:
        logging.error(f"init_db error: {e}", exc_info=True)
    finally:
        if conn:
            try: conn.close()
            except Exception: pass

def save_data():
    with save_lock:
        if not DATABASE_URL:
            logging.warning("No DATABASE_URL")
            return
        for attempt in range(3):
            conn = None
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
                    'seller_profiles':        {str(k): v for k, v in seller_profiles.items()},
                    'verified_channels':      verified_channels,
                    'pending_moderator_codes':pending_moderator_codes,
                    'referrals':              referrals,
                    'referral_map':           {str(k): v for k, v in referral_map.items()},
                    'customers':              {str(k): v for k, v in customers.items()},
                    'lives':                  {str(k): v for k, v in lives.items()},
                    'terms_acceptance_log':   terms_acceptance_log,
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
                cur.close()
                logging.info(f"Data saved: {len(products)} products, {len(orders)} orders")
                return
            except Exception as e:
                logging.error(f"save_data error (attempt {attempt+1}): {e}")
                if attempt == 2:
                    logging.error("save_data failed 3 times!", exc_info=True)
            finally:
                if conn:
                    try: conn.close()
                    except Exception: pass

def load_data():
    # KRITIK: rebind QILMAYMIZ — har dict in-place (clear()+update()) yangilanadi,
    # shunda bot.py 'from persistence import *' orqali olgan obyektlar bir xil qoladi.
    if not DATABASE_URL:
        logging.warning("No DATABASE_URL — starting fresh")
        return
    conn = None
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT value FROM joynshop_data WHERE key = 'main'")
        row  = cur.fetchone()
        cur.close(); conn.close(); conn = None
        if not row:
            logging.info("No data in DB — starting fresh")
            return
        data = json.loads(row[0]) if isinstance(row[0], str) else row[0]
        products.clear(); products.update(data.get('products', {}))
        # Migration: ensure is_active default for products saved before the field existed
        for _p in products.values():
            _p.setdefault('is_active', True)
            _p.setdefault('mxik_code', None)
            _p.setdefault('mxik_name', None)
        groups.clear();          groups.update(data.get('groups', {}))
        orders.clear();          orders.update(data.get('orders', {}))
        wishlists.clear();       wishlists.update(data.get('wishlists', {}))
        buyer_profiles.clear();  buyer_profiles.update(data.get('buyer_profiles', {}))
        refund_requests.clear(); refund_requests.update(data.get('refund_requests', {}))
        verified_channels.clear(); verified_channels.update(data.get('verified_channels', {}))
        raw_ss = data.get('seller_shops', {})
        seller_shops.clear()
        seller_shops.update({int(k) if str(k).isdigit() else k: v for k, v in raw_ss.items()})
        # Seller profiles (legal info)
        raw_sp = data.get('seller_profiles', {})
        seller_profiles.clear()
        seller_profiles.update({int(k) if str(k).isdigit() else k: v for k, v in raw_sp.items()})
        for _prof in seller_profiles.values():
            _prof.setdefault('legal_status',       None)
            _prof.setdefault('stir',               None)
            _prof.setdefault('bank_account',       None)
            _prof.setdefault('bank_name',          None)
            _prof.setdefault('bank_mfo',           None)
            _prof.setdefault('director_name',      None)
            _prof.setdefault('legal_completed_at', None)
            # Sprint 8 P18 — eski sotuvchilar terms_accepted=False (qaytadan accept kerak)
            _prof.setdefault('terms_accepted',     False)
            _prof.setdefault('terms_accepted_at',  None)
            _prof.setdefault('terms_version',      None)
        # Migration: ensure onboarding_status default for shops saved before the field existed
        for _shops in seller_shops.values():
            for _shop in _shops:
                _shop.setdefault('onboarding_status', 'active')
                # Billz fields (Phase 1 onboarding)
                _shop.setdefault('billz_secret_token', None)
                _shop.setdefault('billz_shop_id', '')
                _shop.setdefault('billz_shop_name', '')
                _shop.setdefault('billz_connected_at', None)
                _shop.setdefault('billz_global_solo_discount', 10)
                _shop.setdefault('billz_global_group_discount', 20)
        pending_moderator_codes.clear(); pending_moderator_codes.update(data.get('pending_moderator_codes', {}))
        referrals.clear();               referrals.update(data.get('referrals', {}))
        raw_rm = data.get('referral_map', {})
        referral_map.clear()
        referral_map.update({int(k) if str(k).isdigit() else k: v for k, v in raw_rm.items()})
        raw_sp = data.get('seller_products', {})
        seller_products.clear()
        seller_products.update({int(k) if k.isdigit() else k: v for k, v in raw_sp.items()})
        raw_cu = data.get('customers', {})
        customers.clear()
        # customers kaliti STRING qoladi — update_customer/CRM/seller API barchasi
        # str(uid) ishlatadi. Int-normalizatsiya (boshqa dict'lardagi kabi) bu yerda
        # nomuvofiqlik va data-loss berardi (load->int vs str usage).
        customers.update(raw_cu)
        raw_lv = data.get('lives', {})
        lives.clear()
        lives.update({k: v for k, v in raw_lv.items()})
        terms_acceptance_log.clear()
        terms_acceptance_log.extend(data.get('terms_acceptance_log', []))
        # Migration: buyer_profiles ham terms field'lariga ega bo'lsin (implicit consent)
        for _bp in buyer_profiles.values():
            if isinstance(_bp, dict):
                _bp.setdefault('terms_accepted',    False)
                _bp.setdefault('terms_accepted_at', None)
                _bp.setdefault('terms_version',     None)
        logging.info(f"Data loaded: {len(products)} products, {len(orders)} orders")
        print(f"[JOYNSHOP] Data loaded: {len(products)} products, {len(seller_shops)} shops, {len(orders)} orders")
    except Exception as e:
        logging.error(f"load_data error: {e}", exc_info=True)
        print(f"[JOYNSHOP] load_data ERROR: {e}")
    finally:
        if conn:
            try: conn.close()
            except Exception: pass
