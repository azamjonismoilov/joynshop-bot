# billz.py — Billz POS integratsiyasi: shifrlash + API qatlami
# bot.py dan ajratildi (refactor: billz API qatlami). Mantiq O'ZGARTIRILMAGAN.
# DIQQAT: seller_handle_cb ichidagi billz callback mantiqi KO'CHMAGAN — joyida.
# BILLZ_ENCRYPTION_KEY config.py'dan keladi.
import logging, requests, threading
from datetime import datetime
from config import *        # BILLZ_ENCRYPTION_KEY
from persistence import *   # seller_shops, products, groups, seller_products, save_data
from telegram_api import *  # send_seller

BILLZ_BASE_URL          = 'https://api-admin.billz.ai'
_billz_fernet_cache     = {'fernet': None, 'tried': False}
# In-memory access_token cache: {(seller_uid, shop_idx): {'token': '...', 'fetched_at': dt}}
_billz_access_tokens    = {}

def get_fernet():
    """Fernet shifrlovchini qaytaradi. Kalit yo'q yoki noto'g'ri bo'lsa None."""
    if _billz_fernet_cache['tried']:
        return _billz_fernet_cache['fernet']
    _billz_fernet_cache['tried'] = True
    if not BILLZ_ENCRYPTION_KEY:
        logging.warning("BILLZ_ENCRYPTION_KEY yo'q — Billz integratsiyasi o'chirilgan")
        return None
    try:
        from cryptography.fernet import Fernet
        _billz_fernet_cache['fernet'] = Fernet(BILLZ_ENCRYPTION_KEY.encode())
        return _billz_fernet_cache['fernet']
    except Exception as e:
        logging.error(f"BILLZ_ENCRYPTION_KEY noto'g'ri: {e}")
        return None

def encrypt_token(plain_token):
    """Plain string token ni Fernet bilan shifrlaydi va URL-safe base64 string qaytaradi."""
    f = get_fernet()
    if not f or not plain_token:
        return None
    return f.encrypt(plain_token.encode()).decode('ascii')

def decrypt_token(encrypted_str):
    """Shifrlangan stringni ochib plain token qaytaradi. Xato bo'lsa None."""
    f = get_fernet()
    if not f or not encrypted_str:
        return None
    try:
        return f.decrypt(encrypted_str.encode('ascii')).decode()
    except Exception as e:
        logging.error(f"decrypt_token error: {e}")
        return None

def billz_login(secret_token):
    """secret_token bilan Billz auth qiladi.
    Returns (access_token: str | None, error: str | None).
    """
    if not secret_token:
        return None, "Token bo'sh"
    try:
        r = requests.post(
            f'{BILLZ_BASE_URL}/v1/auth/login',
            json={'secret_token': secret_token},
            timeout=10
        )
        if r.status_code == 401:
            return None, "Secret token noto'g'ri"
        if r.status_code != 200:
            return None, f"Billz xatosi: HTTP {r.status_code}"
        data = r.json() or {}
        token = data.get('data', {}).get('access_token') or data.get('access_token')
        if not token:
            return None, "Billz javobida access_token topilmadi"
        return token, None
    except requests.Timeout:
        return None, "Billz ga ulanish vaqti o'tdi (timeout)"
    except Exception as e:
        logging.error(f"billz_login exception: {e}")
        return None, f"Tarmoq xatosi: {e}"

def _billz_get_access_token(uid, shop_idx, force_refresh=False):
    """Sotuvchi do'koni uchun amaldagi access_token'ni qaytaradi.
    Memory cache yoki secret_token'dan qaytadan auth.
    Returns (access_token: str | None, error: str | None).
    """
    cache_key = (uid, shop_idx)
    if not force_refresh and cache_key in _billz_access_tokens:
        cached = _billz_access_tokens[cache_key]
        # 23 soat — 24 soatlik token uchun xavfsizlik chegarasi
        if (datetime.now() - cached['fetched_at']).total_seconds() < 23 * 3600:
            return cached['token'], None
    shops = seller_shops.get(uid, [])
    if shop_idx >= len(shops):
        return None, "Do'kon topilmadi"
    encrypted = shops[shop_idx].get('billz_secret_token')
    if not encrypted:
        return None, "Billz ulanmagan"
    plain = decrypt_token(encrypted)
    if not plain:
        return None, "Token shifrini ochib bo'lmadi (BILLZ_ENCRYPTION_KEY o'zgarganmi?)"
    token, err = billz_login(plain)
    if not token:
        return None, err
    _billz_access_tokens[cache_key] = {'token': token, 'fetched_at': datetime.now()}
    return token, None

def billz_get(uid, shop_idx, path, params=None):
    """Billz GET so'rovi. 401 bo'lsa avtomatik qayta auth.
    Returns (data: dict | None, error: str | None).
    """
    for attempt in range(2):
        token, err = _billz_get_access_token(uid, shop_idx, force_refresh=(attempt > 0))
        if not token:
            return None, err
        try:
            r = requests.get(
                f'{BILLZ_BASE_URL}{path}',
                headers={'Authorization': f'Bearer {token}'},
                params=params or {},
                timeout=15,
            )
            if r.status_code == 401:
                # Token expired — qayta auth
                _billz_access_tokens.pop((uid, shop_idx), None)
                continue
            if r.status_code != 200:
                return None, f"Billz HTTP {r.status_code}: {r.text[:200]}"
            return r.json(), None
        except requests.Timeout:
            return None, "Billz timeout"
        except Exception as e:
            logging.error(f"billz_get exception: {e}")
            return None, f"Tarmoq xatosi: {e}"
    return None, "Avtorizatsiya muvaffaqiyatsiz"

def billz_extract_shops(products_response):
    """Billz mahsulot javobidan shop ro'yxatini chiqaradi.
    Returns [{'shop_id': str, 'shop_name': str}, ...] yoki [].
    """
    shops_seen = {}
    items = products_response.get('products') or products_response.get('data') or []
    if isinstance(items, dict):
        items = items.get('products', [])
    for prod in items:
        for smv in prod.get('shop_measurement_values', []) or []:
            sid = smv.get('shop_id')
            sname = smv.get('shop_name', sid)
            if sid and sid not in shops_seen:
                shops_seen[sid] = sname
    return [{'shop_id': k, 'shop_name': v} for k, v in shops_seen.items()]

def _billz_extract_price_for_shop(prod, billz_shop_id):
    """Billz mahsulot dict'idan tegishli shop uchun retail narxni topadi."""
    for sp in prod.get('shop_prices', []) or []:
        if str(sp.get('shop_id')) == str(billz_shop_id):
            return int(sp.get('retail_price') or sp.get('price') or 0)
    # Fallback — birinchi shop_price yoki retail_price
    sps = prod.get('shop_prices', []) or []
    if sps:
        return int(sps[0].get('retail_price') or sps[0].get('price') or 0)
    return int(prod.get('retail_price') or 0)

def _billz_extract_stock_for_shop(prod, billz_shop_id):
    """Billz mahsulot dict'idan tegishli shop uchun stock_value ni topadi."""
    for smv in prod.get('shop_measurement_values', []) or []:
        if str(smv.get('shop_id')) == str(billz_shop_id):
            try:
                return int(float(smv.get('active_measurement_value') or smv.get('value') or 0))
            except (TypeError, ValueError):
                return 0
    return 0

def _billz_make_product_dict(prod, uid, shop, channel):
    """Billz mahsulot JSON'idan Joynshop product dict yaratadi."""
    billz_shop_id = shop.get('billz_shop_id', '')
    price = _billz_extract_price_for_shop(prod, billz_shop_id)
    stock = _billz_extract_stock_for_shop(prod, billz_shop_id)
    photo = prod.get('main_image_url') or prod.get('photo_url') or ''
    cats  = prod.get('categories') or []
    cat_name = cats[0].get('name', '') if cats and isinstance(cats[0], dict) else ''
    return {
        # Identifikatsiya
        'billz_id':       prod.get('id') or prod.get('uuid') or '',
        'source':         'billz',
        # Kontent
        'name':           (prod.get('name') or '')[:200],
        'description':    (prod.get('description') or '')[:500],
        'photo_id':       None,
        'photo_ids':      [],
        'photo_url':      photo,
        'photo_urls':     [photo] if photo else [],
        'barcode':        prod.get('barcode', ''),
        'sku':            prod.get('sku', ''),
        'brand_name':     prod.get('brand_name', '') or (prod.get('brand', {}) or {}).get('name', ''),
        'category':       cat_name,
        'category_name':  cat_name,
        # Narx (faqat original — solo/group sotuvchi yoqishda kiritadi)
        'original_price': price,
        'group_price':    0,
        'solo_price':     0,
        'min_group':      0,
        'stock':          stock if stock > 0 else 9999,
        'stock_initial':  stock if stock > 0 else 9999,
        'stock_value':    stock,
        'stock_updated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        # Sotuvchi va do'kon
        'seller_id':      uid,
        'seller_channel': channel,
        'shop_name':      shop.get('name', ''),
        'contact':        shop.get('phone', ''),
        'phone2':         shop.get('phone2', ''),
        'address':        shop.get('address', ''),
        'social':         shop.get('social', {}),
        'delivery_type':  shop.get('delivery', 'pickup'),
        'variants':       [],
        'sale_type':      'both',
        # Holat
        'status':         'draft',
        'is_active':      False,
        'solo_available': False,
        'channel_message_id': None,
        'channel_chat_id':    None,
        'deadline':       '',
        'deadline_dt':    '',
    }

def import_billz_products(uid, cid, shop_idx):
    """Background thread'da Billz mahsulotlarini import qiladi."""
    def worker():
        shops = seller_shops.get(uid, [])
        if shop_idx >= len(shops):
            send_seller(cid, "❌ Do'kon topilmadi"); return
        shop = shops[shop_idx]
        channel = shop.get('channel', '')
        send_seller(cid, "⏳ <b>Mahsulotlar yuklab olinmoqda...</b>")

        existing_billz_ids = {
            p.get('billz_id') for pid, p in products.items()
            if p.get('seller_id') == uid and p.get('source') == 'billz'
        }
        imported = 0
        skipped  = 0
        page     = 1
        last_progress = 0
        max_pages = 50  # 5000 mahsulot — havfsizlik chegarasi

        while page <= max_pages:
            data, err = billz_get(uid, shop_idx, '/v2/products',
                                  {'limit': 100, 'page': page})
            if err:
                send_seller(cid,
                    f"❌ <b>Import to'xtadi (sahifa {page}):</b>\n{err}\n\n"
                    f"Hozirgacha {imported} ta import qilindi.")
                return
            items = (data or {}).get('products') \
                    or (data or {}).get('data') \
                    or []
            if isinstance(items, dict):
                items = items.get('products', [])
            if not items:
                break  # Sahifalar tugadi

            for prod in items:
                billz_id = prod.get('id') or prod.get('uuid') or ''
                if not billz_id:
                    continue
                if billz_id in existing_billz_ids:
                    skipped += 1
                    continue
                pdict = _billz_make_product_dict(prod, uid, shop, channel)
                # Joynshop pid — Billz UUID ning birinchi 12 belgisi
                pid = 'bz' + ''.join(c for c in billz_id if c.isalnum())[:10].lower()
                # Collision bo'lsa qo'shimcha qator
                _i = 0
                while pid in products and _i < 5:
                    pid = 'bz' + ''.join(c for c in billz_id if c.isalnum())[:8].lower() + str(_i)
                    _i += 1
                products[pid] = pdict
                groups.setdefault(pid, [])
                seller_products.setdefault(uid, [])
                if pid not in seller_products[uid]:
                    seller_products[uid].append(pid)
                existing_billz_ids.add(billz_id)
                imported += 1

                if imported - last_progress >= 100:
                    send_seller(cid, f"📥 {imported} ta import qilindi...")
                    last_progress = imported

            if len(items) < 100:
                break  # Oxirgi sahifa
            page += 1

        save_data()
        send_seller(cid,
            f"✅ <b>Import tugadi!</b>\n\n"
            f"📦 Yangi: {imported} ta\n"
            f"⏭ O'tkazib yuborilgan (allaqachon bor): {skipped} ta\n\n"
            f"Endi /myproducts orqali har birini yoqing — narx va deadline kiritib kanalga e'lon qilasiz.",
            {'inline_keyboard': [
                [{'text': "📦 Mahsulotlarim", 'callback_data': 'menu_myproducts'}],
                [{'text': "🔌 Billz menyu",   'callback_data': 'billz_menu'}],
            ]})
    threading.Thread(target=worker, daemon=True).start()
