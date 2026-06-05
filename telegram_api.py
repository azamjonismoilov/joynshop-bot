# telegram_api.py — Telegram so'rov/yuborish yordamchilari
# bot.py dan ajratildi (refactor: telegram_api). Mantiq O'ZGARTIRILMAGAN.
import json, random, string, requests
from config import *   # SELLER_TOKEN, BUYER_TOKEN

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

def send_no_preview(cid, text, kb=None, token=None):
    """sendMessage + disable_web_page_preview — terms message kabi
    link'larga preview chiqishini oldini olish uchun."""
    d = {'chat_id': cid, 'text': text, 'parse_mode': 'HTML',
         'disable_web_page_preview': True}
    if kb: d['reply_markup'] = json.dumps(kb)
    return api('sendMessage', d, token)

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
    r = send_seller(cid, text, kb)
    if r and state is not None:
        result = r.get('result', {})
        if result.get('message_id'):
            state['ob_msg_id'] = result['message_id']
    return r

def edit_caption(cid, mid, caption, kb=None, token=None):
    d = {'chat_id': cid, 'message_id': mid, 'caption': caption, 'parse_mode': 'HTML'}
    if kb: d['reply_markup'] = json.dumps(kb)
    api('editMessageCaption', d, token or SELLER_TOKEN)

def answer_cb(cbid, text='', alert=False, token=None):
    api('answerCallbackQuery', {'callback_query_id': cbid, 'text': text, 'show_alert': alert}, token or SELLER_TOKEN)

def fmt(n):
    return f"{int(n):,}"

def gen_code():
    return 'JS-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def bar(count, min_g):
    return '🟢' * count + '⚪️' * (min_g - count)
