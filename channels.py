# channels.py — Telegram kanal tekshirish/verifikatsiya helper'lari
# bot.py dan ajratildi (refactor: channels). Mantiq O'ZGARTIRILMAGAN.
# verified_channels persistence.py'da — bu yerda import qilib in-place
# ishlatiladi (QAYTA TAYINLANMAYDI).
import logging, requests
from config import *        # SELLER_TOKEN
from persistence import *   # verified_channels

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

_seller_bot_id_cache = {'id': None}
def get_seller_bot_id():
    """Sotuvchi botning Telegram user_id sini qaytaradi (bir martagina /getMe chaqiriladi)."""
    if _seller_bot_id_cache['id']:
        return _seller_bot_id_cache['id']
    if not SELLER_TOKEN:
        return None
    try:
        r = requests.get(f'https://api.telegram.org/bot{SELLER_TOKEN}/getMe', timeout=5).json()
        if r.get('ok'):
            _seller_bot_id_cache['id'] = r['result'].get('id')
            return _seller_bot_id_cache['id']
    except Exception as e:
        logging.error(f"getMe error: {e}")
    return None

def channel_exists(channel):
    """Kanal mavjudligini getChat orqali tekshiradi."""
    try:
        r = requests.post(
            f'https://api.telegram.org/bot{SELLER_TOKEN}/getChat',
            json={'chat_id': channel}, timeout=5
        ).json()
        return bool(r.get('ok'))
    except:
        return False

def is_bot_admin_in(channel):
    """Sotuvchi bot kanaldagi admin yoki creator ekanligini tekshiradi."""
    bot_id = get_seller_bot_id()
    if not bot_id:
        return False
    try:
        r = requests.post(
            f'https://api.telegram.org/bot{SELLER_TOKEN}/getChatMember',
            json={'chat_id': channel, 'user_id': bot_id}, timeout=5
        ).json()
        if not r.get('ok'):
            return False
        return r['result'].get('status', '') in ('creator', 'administrator')
    except:
        return False
