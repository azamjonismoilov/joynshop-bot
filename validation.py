# validation.py — input validatsiya + MXIK (tasnif.soliq.uz) qidiruv/validatsiya
# bot.py dan ajratildi (refactor: validation). Mantiq O'ZGARTIRILMAGAN.
import logging, requests
from datetime import datetime

# ─── VALIDATION HELPERS ─────────────────────────────────────────────
def parse_price(text):
    """Bo'sh joy va vergullarni olib tashlab int ga o'giradi. Xato bo'lsa None."""
    try:
        return int(str(text).replace(' ', '').replace(',', '').replace('.', ''))
    except (ValueError, TypeError):
        return None

def validate_prices(orig, group, solo, sale_type='both'):
    """Narx mantiq tekshiruvi.
    Returns (ok: bool, error_msg: str). solo=0 bo'lsa solo tekshirilmaydi.
    """
    if orig is None or orig <= 0:
        return False, "❌ Asl narx 0 dan katta bo'lishi kerak"
    if sale_type != 'solo':
        if group is None or group <= 0:
            return False, "❌ Guruh narxi 0 dan katta bo'lishi kerak"
        if group >= orig:
            return False, "❌ Guruh narxi asl narxdan past bo'lishi kerak"
    if solo and solo > 0:
        if solo >= orig:
            return False, "❌ Yakka narx asl narxdan past bo'lishi kerak"
        if sale_type == 'both' and group and solo < group:
            # Both: yakka narx odatda guruh narxidan yuqori
            return False, "❌ Yakka narx guruh narxidan yuqori bo'lishi kerak"
    return True, ''

def validate_stir(text):
    """STIR / INN: aynan 9 ta raqam, 1-chi raqam 1-6.
    Returns (ok, value, err)."""
    import re
    s = (text or '').strip().replace(' ', '')
    if not re.fullmatch(r'[1-6]\d{8}', s):
        return False, '', "❌ STIR — 9 ta raqam, 1-chi raqam 1-6 oralig'ida"
    return True, s, ''

def validate_bank_account(text):
    """Hisob raqami: aynan 20 ta raqam.
    Returns (ok, value, err)."""
    import re
    s = (text or '').strip().replace(' ', '')
    if not re.fullmatch(r'\d{20}', s):
        return False, '', "❌ Hisob raqami — aynan 20 ta raqam"
    return True, s, ''

def validate_mfo(text):
    """MFO bank kodi: aynan 5 ta raqam.
    Returns (ok, value, err)."""
    import re
    s = (text or '').strip().replace(' ', '')
    if not re.fullmatch(r'\d{5}', s):
        return False, '', "❌ MFO — aynan 5 ta raqam"
    return True, s, ''

def validate_bank_name(text):
    """Bank nomi: kamida 3 belgi.
    Returns (ok, value, err)."""
    s = (text or '').strip()
    if len(s) < 3:
        return False, '', "❌ Bank nomi juda qisqa (kamida 3 belgi)"
    return True, s[:100], ''

def validate_director_name(text):
    """Direktor F.I.O.: kamida 3 ta so'z.
    Returns (ok, value, err)."""
    s = (text or '').strip()
    if len(s.split()) < 3:
        return False, '', "❌ To'liq F.I.O. kiriting (familiya, ism, sharif — 3 ta so'z)"
    return True, s[:150], ''

# ─── MXIK (tasnif.soliq.uz) ─────────────────────────────────────────
# TODO: To'lov tizimi (Paylov) ulanganda MXIK ni majburiy qilish kerak.
# Hozir Render -> tasnif.soliq.uz bloklangani uchun optional —
# har MXIK promptida "⏭ O'tkazib yuborish" tugmasi mavjud.
# Qaytarish: prod_desc/prod_skip_desc/mp_edit_field_mxik/bz_activate
# joylaridagi "⏭ O'tkazib yuborish" tugmalarini olib tashlash + skip handler'ni
# faqat draft saqlash uchun moslashtirish.
MXIK_BASE_URL    = 'https://tasnif.soliq.uz/api/cls-api'
MXIK_CACHE_TTL   = 300        # 5 daqiqa
MXIK_PAGE_SIZE   = 10         # API'dan har bir sahifa uchun
MXIK_TIMEOUT_PRIMARY = 10     # birinchi urinish
MXIK_TIMEOUT_RETRY   = 5      # qayta urinish
_mxik_search_cache = {}       # {keyword.lower(): (fetched_at: datetime, results: list)}

# Session — DNS, TLS connection reuse (Render → Toshkent geographik latency uchun muhim)
_mxik_session = None
def _get_mxik_session():
    global _mxik_session
    if _mxik_session is None:
        _mxik_session = requests.Session()
        _mxik_session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; JoynshopBot/1.0; +https://joynshop.uz)',
            'Accept':     'application/json',
            'Accept-Language': 'ru,uz;q=0.9,en;q=0.8',
        })
    return _mxik_session

def mxik_validate_code(text):
    """17 raqamli MXIK kod validatsiyasi.
    Returns (ok, code, err)."""
    import re
    s = (text or '').strip().replace(' ', '').replace('-', '')
    if not re.fullmatch(r'\d{17}', s):
        return False, '', "❌ MXIK kod aynan 17 raqam bo'lishi kerak"
    return True, s, ''

def mxik_simplify_item(item):
    """API response item'idan kerakli field'larni ajratadi."""
    parts = [item.get('groupName', ''), item.get('className', '')]
    classify = ' → '.join(p for p in parts if p)[:80]
    return {
        'code':     item.get('mxikCode', ''),
        'name':     item.get('subPositionName') or item.get('positionName') or item.get('name', ''),
        'classify': classify,
        'brand':    item.get('brandName') or '',
        'units':    item.get('unitsName', '') or '',
    }

def _mxik_do_request(keyword, timeout):
    """Bitta MXIK so'rov — exception'larni propagate qiladi."""
    return _get_mxik_session().get(
        f'{MXIK_BASE_URL}/elasticsearch/search',
        params={'search': keyword, 'size': MXIK_PAGE_SIZE, 'page': 0, 'lang': 'ru'},
        timeout=timeout,
    )

def mxik_search(keyword):
    """Tasnif.soliq.uz dan kalit so'z bo'yicha qidirish.
    5 daqiqalik cache. 10s primary + 5s retry timeout.
    Session reuse orqali DNS/TLS overhead kamayadi.
    Returns (results: list[dict] | None, error: str | None).
    """
    key = (keyword or '').lower().strip()
    if not key:
        return None, "Bo'sh so'rov"
    # Cache check
    if key in _mxik_search_cache:
        fetched_at, results = _mxik_search_cache[key]
        if (datetime.now() - fetched_at).total_seconds() < MXIK_CACHE_TTL:
            return results, None

    last_err = None
    for attempt, timeout in enumerate([MXIK_TIMEOUT_PRIMARY, MXIK_TIMEOUT_RETRY], 1):
        try:
            r = _mxik_do_request(keyword, timeout=timeout)
            if r.status_code != 200:
                last_err = f"HTTP {r.status_code}"
                logging.warning(f"MXIK HTTP non-200 (attempt {attempt}, query={key!r}): {r.status_code}")
                continue
            data = r.json() or {}
            if not data.get('success'):
                last_err = "javob success=false"
                logging.warning(f"MXIK success=false (attempt {attempt}, query={key!r}): {data}")
                continue
            items = data.get('data') or []
            results = [mxik_simplify_item(it) for it in items]
            _mxik_search_cache[key] = (datetime.now(), results)
            return results, None
        except requests.Timeout:
            last_err = f"timeout {timeout}s"
            logging.warning(f"MXIK timeout (attempt {attempt}, query={key!r}, t={timeout}s)")
        except requests.ConnectionError as e:
            last_err = "connection error"
            logging.error(f"MXIK ConnectionError (attempt {attempt}, query={key!r}): {e}")
        except Exception as e:
            last_err = "unknown error"
            logging.error(f"MXIK unknown exception (attempt {attempt}, query={key!r}): {type(e).__name__}: {e}")

    # Ikkala urinish ham fail
    return None, ("⚠️ tasnif.soliq.uz hozir javob bermayapti.\n"
                  "Kodni qo'lda kiriting yoki keyinroq urinib ko'ring.")

def validate_min_group_text(text):
    """Min guruh: butun son, 2-100 oralig'ida.
    Returns (ok, value, error_msg).
    """
    try:
        mg = int(str(text).strip())
    except (ValueError, TypeError):
        return False, 0, "❌ Butun son kiriting (masalan: 5)"
    if mg < 2 or mg > 100:
        return False, 0, "❌ Minimal guruh 2 dan 100 gacha bo'lishi kerak"
    return True, mg, ''
