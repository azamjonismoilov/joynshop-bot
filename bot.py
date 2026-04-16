import os, json, logging, random, string, threading, time, requests
from datetime import datetime, timedelta
from flask import Flask, request

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)

BOT_TOKEN = os.environ.get('BOT_TOKEN')
CHANNEL_ID = -1003906912233
ADMIN_ID = int(os.environ.get('ADMIN_ID', '0'))
PAYME_NUMBER = '+998913968946'
BASE_URL = f'https://api.telegram.org/bot{BOT_TOKEN}'

products = {}
groups = {}
orders = {}
seller_state = {}
seller_products = {}

def api(method, data):
    return requests.post(f'{BASE_URL}/{method}', json=data).json()

def send(chat_id, text, keyboard=None, parse_mode='HTML'):
    d = {'chat_id': chat_id, 'text': text, 'parse_mode': parse_mode}
    if keyboard: d['reply_markup'] = json.dumps(keyboard)
    return api('sendMessage', d)

def edit_caption(chat_id, msg_id, caption, keyboard=None):
    d = {'chat_id': chat_id, 'message_id': msg_id, 'caption': caption, 'parse_mode': 'HTML'}
    if keyboard: d['reply_markup'] = json.dumps(keyboard)
    api('editMessageCaption', d)

def answer_cb(cb_id, text, alert=True):
    api('answerCallbackQuery', {'callback_query_id': cb_id, 'text': text, 'show_alert': alert})

def gen_code():
    return 'JS-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def bar(count, min_g):
    return '🟢' * count + '⚪️' * (min_g - count)

def post_caption(p, pid):
    count = len(groups.get(pid, []))
    min_g = p['min_group']
    status = '🔥 FAOL' if count < min_g else "✅ GURUH TO'LDI"
    return (
        f"<b>{p['name']}</b>\n\n"
        f"💰 <s>{p['original_price']:,} so'm</s> → <b>🏷 {p['group_price']:,} so'm</b>\n"
        f"📉 Tejash: <b>{p['original_price']-p['group_price']:,} so'm</b>\n\n"
        f"👥 Guruh: <b>{count}/{min_g}</b> {status}\n{bar(count,min_g)}\n\n"
        f"⏳ Kerak: <b>{max(0,min_g-count)} kishi</b>\n"
        f"🕐 Muddat: <b>{p.get('deadline','')}</b>\n\n"
        f"🏪 <b>{p['shop_name']}</b>\n📝 {p['description']}"
    )

def join_kb(pid, count, min_g):
    txt = f"🛒 Qo'shilish ({count}/{min_g})" if count < min_g else "✅ To'ldi! Buyurtma bering"
    return {'inline_keyboard':[[{'text':txt,'callback_data':f'join_{pid}'}]]}

def reminder_loop():
    while True:
        time.sleep(1800)
        try:
            now = datetime.now()
            for pid, p in list(products.items()):
                if p.get('status') == 'closed': continue
                ddt = p.get('deadline_dt')
                if not ddt: continue
                deadline = datetime.strptime(ddt, '%Y-%m-%d %H:%M')
                remaining = (deadline - now).total_seconds()
                count = len(groups.get(pid, []))
                needed = p['min_group'] - count
                if remaining <= 0:
                    expire_product(pid)
                    continue
                hours = remaining / 3600
                if needed > 0 and (11.5<=hours<=12.5 or 1.5<=hours<=2.5):
                    msg = f"⚡️ <b>SHOSHILING!</b>\n\n<b>{p['name']}</b>\n{needed} kishi kerak!\n⏰ {int(hours)} soat qoldi!\n\n@joynshop_uz"
                    for uid in groups.get(pid, []):
                        try: send(uid, msg)
                        except: pass
                    sid = p.get('seller_id')
                    if sid:
                        send(sid, f"📢 <b>{p['name']}</b>\n👥 {count}/{p['min_group']}\n⏰ {int(hours)} soat qoldi\n/boost {pid}")
        except Exception as e:
            logging.error(f"Reminder: {e}")

def expire_product(pid):
    p = products.get(pid)
    if not p or p.get('status') == 'closed': return
    products[pid]['status'] = 'closed'
    count = len(groups.get(pid, []))
    for uid in groups.get(pid, []):
        try:
            if count >= p['min_group']:
                send(uid, f"🎉 <b>Guruh to'ldi!</b>\n<b>{p['name']}</b>\nSotuvchi: {p.get('contact')}")
            else:
                send(uid, f"😔 <b>Guruh to'lmadi</b>\n<b>{p['name']}</b>\n💰 To'lovingiz 24 soat ichida qaytariladi.")
        except: pass

threading.Thread(target=reminder_loop, daemon=True).start()

@app.route('/webhook', methods=['POST'])
def webhook():
    data = request.json
    if 'callback_query' in data: handle_cb(data['callback_query'])
    elif 'message' in data: handle_msg(data['message'])
    return 'ok'

def handle_cb(cb):
    cbid = cb['id']
    user = cb['from']
    uid = user['id']
    uname = user.get('first_name', 'Foydalanuvchi')
    d = cb['data']
    mid = cb['message']['message_id']

    if d.startswith('join_'):
        pid = d[5:]
        if pid not in products: answer_cb(cbid, '❌ Topilmadi!'); return
        p = products[pid]
        if p.get('status') == 'closed': answer_cb(cbid, '⛔️ Yopilgan!'); return
        if pid not in groups: groups[pid] = []
        if uid in groups[pid]: answer_cb(cbid, '✅ Allaqachon guruhdasiz!'); return
        code = gen_code()
        deadline = datetime.now() + timedelta(hours=48)
        orders[code] = {'product_id':pid,'user_id':uid,'user_name':uname,'amount':p['group_price'],'status':'pending','created':datetime.now().strftime('%d.%m.%Y %H:%M')}
        answer_cb(cbid, "📋 To'lov ma'lumotlari yuborildi!", alert=False)
        send(uid,
            f"🛒 <b>Buyurtma #{code}</b>\n\n📦 <b>{p['name']}</b>\n💰 <b>{p['group_price']:,} so'm</b>\n\n"
            f"━━━━━━━━━━━━━━━\n💳 <b>Payme:</b>\n📱 <code>{PAYME_NUMBER}</code>\n"
            f"💵 Summa: <code>{p['group_price']:,}</code>\n📝 Izoh: <code>{code}</code>\n\n"
            f"⚠️ Izohga <b>{code}</b> yozing!\n━━━━━━━━━━━━━━━\n⏰ Muddat: <b>{deadline.strftime('%d.%m.%Y %H:%M')}</b>",
            {'inline_keyboard':[[{'text':"✅ To'lovni tasdiqlayman",'callback_data':f'paid_{code}'}],[{'text':"❌ Bekor",'callback_data':f'cancel_{code}'}]]}
        )

    elif d.startswith('paid_'):
        code = d[5:]
        if code not in orders: answer_cb(cbid, '❌ Topilmadi!'); return
        if orders[code]['status'] != 'pending': answer_cb(cbid, '⚠️ Allaqachon!'); return
        orders[code]['status'] = 'confirming'
        answer_cb(cbid, '⏳ Admin tasdiqlamoqda...', alert=False)
        send(uid, f"⏳ Tekshirilmoqda...\nBuyurtma: <b>#{code}</b>")
        if ADMIN_ID:
            p = products.get(orders[code]['product_id'], {})
            send(ADMIN_ID,
                f"🔔 <b>YANGI TO'LOV!</b>\n#{code}\n{p.get('name','?')}\n{uname}\n<b>{orders[code]['amount']:,} so'm</b>",
                {'inline_keyboard':[[{'text':'✅ Tasdiqlash','callback_data':f'ac_{code}'},{'text':'❌ Rad','callback_data':f'ar_{code}'}]]}
            )

    elif d.startswith('cancel_'):
        code = d[7:]
        if code in orders: orders[code]['status'] = 'cancelled'
        answer_cb(cbid, '❌ Bekor', alert=False)
        send(uid, f"❌ #{code} bekor.\n\n@joynshop_uz")

    elif d.startswith('ac_'):
        code = d[3:]
        if code not in orders: answer_cb(cbid, '❌'); return
        o = orders[code]
        pid = o['product_id']
        buyer = o['user_id']
        orders[code]['status'] = 'confirmed'
        if pid not in groups: groups[pid] = []
        if buyer not in groups[pid]: groups[pid].append(buyer)
        count = len(groups[pid])
        p = products[pid]
        answer_cb(cbid, f'✅ {count}/{p["min_group"]}', alert=False)
        edit_caption(CHANNEL_ID, p['channel_message_id'], post_caption(p,pid), join_kb(pid,count,p['min_group']))
        send(buyer, f"🎉 Tasdiqlandi!\n#{code}\n{count}/{p['min_group']} kishi\nGuruh to'lganda xabar beramiz!")
        if count >= p['min_group']:
            for u in groups[pid]:
                try: send(u, f"🔥 GURUH TO'LDI!\n{p['name']}\n📞 {p.get('contact')}\n✅ Rahmat!")
                except: pass

    elif d.startswith('ar_'):
        code = d[3:]
        if code in orders:
            orders[code]['status'] = 'rejected'
            send(orders[code]['user_id'], f"❌ To'lov tasdiqlanmadi.\n#{code}\nIzohda kodni tekshiring.")
        answer_cb(cbid, '❌ Rad', alert=False)

    elif d.startswith('boost_confirm_'):
        pid = d[14:]
        if pid not in products: answer_cb(cbid, '❌'); return
        p = products[pid]
        count = len(groups.get(pid,[]))
        result = requests.post(f'{BASE_URL}/sendPhoto', json={
            'chat_id':CHANNEL_ID,'photo':p['photo_id'],
            'caption':post_caption(p,pid),'parse_mode':'HTML',
            'reply_markup':json.dumps(join_kb(pid,count,p['min_group']))
        }).json()
        if result.get('ok'):
            products[pid]['channel_message_id'] = result['result']['message_id']
            answer_cb(cbid, "✅ Qayta e'lon qilindi!", alert=False)
            send(uid, f"📢 {p['name']} qayta e'lon qilindi!")
        else: answer_cb(cbid, '❌ Xato!')

def handle_msg(msg):
    cid = msg['chat']['id']
    uid = msg['from']['id']
    text = msg.get('text','')

    # Admin
    if uid == ADMIN_ID:
        if text == '/orders':
            r = "📋 <b>So'nggi buyurtmalar:</b>\n\n"
            em = {'pending':'⏳','confirming':'🔄','confirmed':'✅','rejected':'❌','cancelled':'🚫'}
            for k,o in list(orders.items())[-10:]:
                r += f"{em.get(o['status'],'?')} #{k} — {o['amount']:,}\n"
            send(cid, r or 'Buyurtma yo\'q')
            return
        if text == '/pending':
            pnd = {k:v for k,v in orders.items() if v['status']=='confirming'}
            if not pnd: send(cid, '✅ Yo\'q'); return
            for k,o in pnd.items():
                p = products.get(o['product_id'],{})
                send(cid, f"⏳ #{k}\n{p.get('name','?')}\n{o['amount']:,}\n{o['user_name']}",
                    {'inline_keyboard':[[{'text':'✅','callback_data':f'ac_{k}'},{'text':'❌','callback_data':f'ar_{k}'}]]})
            return
        if text == '/stats':
            conf = sum(1 for o in orders.values() if o['status']=='confirmed')
            rev = sum(o['amount'] for o in orders.values() if o['status']=='confirmed')
            active = sum(1 for p in products.values() if p.get('status')!='closed')
            send(cid, f"📊 Buyurtma: {len(orders)}\n✅ Tasdiqlangan: {conf}\n🛍 Aktiv: {active}\n💰 {rev:,} so'm")
            return

    if text == '/start':
        send(cid,
            "👋 <b>Joynshop ga xush kelibsiz!</b>\n\n"
            "🛍 Birgalikda xarid — 40% gacha tejang!\n📢 @joynshop_uz\n\n"
            "━━━━━━━━━━━━━━━\n"
            "<b>Sotuvchi:</b>\n/addproduct — Mahsulot qo'shish\n/myproducts — Mahsulotlarim\n/mystats — Statistika\n\n"
            "<b>Xaridor:</b>\n/mystatus — Buyurtmalarim\n/help — Yordam"
        )
        return

    if text == '/mystatus':
        my = {k:v for k,v in orders.items() if v['user_id']==uid}
        if not my: send(cid, "📋 Buyurtma yo'q.\n@joynshop_uz"); return
        r = "📋 <b>Buyurtmalaringiz:</b>\n\n"
        em = {'pending':'⏳','confirming':'🔄','confirmed':'✅','rejected':'❌','cancelled':'🚫'}
        st = {'pending':"To'lov kutilmoqda",'confirming':'Tekshirilmoqda','confirmed':'Tasdiqlandi','rejected':'Rad','cancelled':'Bekor'}
        for k,o in my.items():
            p = products.get(o['product_id'],{})
            r += f"{em.get(o['status'],'?')} <b>#{k}</b>\n{p.get('name','?')} — {o['amount']:,} so'm\n{st.get(o['status'],'')}\n\n"
        send(cid, r)
        return

    if text == '/myproducts':
        my = seller_products.get(uid, [])
        if not my: send(cid, "📦 Yo'q.\n/addproduct"); return
        r = "📦 <b>Mahsulotlaringiz:</b>\n\n"
        for pid in my:
            p = products.get(pid)
            if not p: continue
            count = len(groups.get(pid,[]))
            st = '✅ Yopiq' if p.get('status')=='closed' else '🔥 Faol'
            r += f"<b>{p['name']}</b>\n🆔 <code>{pid}</code>\n👥 {count}/{p['min_group']}\n💰 {p['group_price']:,}\n{st}\n\n"
        r += "━━━━━━━━━━━━━━━\n/mystats | /boost [ID] | /delete [ID]"
        send(cid, r)
        return

    if text == '/mystats':
        my = seller_products.get(uid,[])
        if not my: send(cid, "📊 Yo'q.\n/addproduct"); return
        tj = sum(len(groups.get(pid,[])) for pid in my)
        conf = sum(1 for pid in my if len(groups.get(pid,[]))>=products.get(pid,{}).get('min_group',99))
        rev = sum(o['amount'] for o in orders.values() if o.get('product_id') in my and o['status']=='confirmed')
        send(cid, f"📊 <b>Statistika:</b>\n\n📦 Mahsulot: {len(my)}\n✅ Muvaffaqiyatli: {conf}\n👥 Jami qo'shilgan: {tj}\n💰 Daromad: {rev:,} so'm")
        return

    if text.startswith('/boost '):
        pid = text.split()[1]
        if pid not in products: send(cid, '❌ Topilmadi!'); return
        p = products[pid]
        if p.get('seller_id') != uid and uid != ADMIN_ID: send(cid, '❌ Ruxsat yo\'q!'); return
        count = len(groups.get(pid,[]))
        send(cid, f"📢 <b>{p['name']}</b> qayta e'lon qilasizmi?\n👥 {count}/{p['min_group']}\n💰 {p['group_price']:,}",
            {'inline_keyboard':[[{'text':"✅ E'lon qil",'callback_data':f'boost_confirm_{pid}'},{'text':'❌','callback_data':'noop'}]]})
        return

    if text.startswith('/delete '):
        pid = text.split()[1]
        if pid not in products: send(cid, '❌ Topilmadi!'); return
        p = products[pid]
        if p.get('seller_id') != uid and uid != ADMIN_ID: send(cid, '❌ Ruxsat yo\'q!'); return
        products[pid]['status'] = 'closed'
        if uid in seller_products and pid in seller_products[uid]: seller_products[uid].remove(pid)
        send(cid, f"✅ <b>{p['name']}</b> o'chirildi.")
        return

    if text == '/help':
        send(cid,
            "ℹ️ <b>Yordam</b>\n\n"
            "<b>Sotuvchi:</b>\n/addproduct | /myproducts | /mystats\n/boost [ID] | /delete [ID]\n\n"
            "<b>Xaridor:</b>\n/mystatus\n\n"
            "📢 @joynshop_uz\n💬 @joynshop_support"
        )
        return

    if text == '/addproduct':
        seller_state[uid] = {'step':'name'}
        send(cid, "📦 <b>Yangi mahsulot</b>\n\n1️⃣ Mahsulot nomini yozing:")
        return

    if uid in seller_state:
        s = seller_state[uid]
        step = s.get('step')
        if step == 'name':
            s['name'] = text; s['step'] = 'shop_name'
            send(cid, "2️⃣ Do'kon nomingiz:")
        elif step == 'shop_name':
            s['shop_name'] = text; s['step'] = 'description'
            send(cid, "3️⃣ Mahsulot tavsifi:")
        elif step == 'description':
            s['description'] = text; s['step'] = 'original_price'
            send(cid, "4️⃣ Asl narx (so'm):")
        elif step == 'original_price':
            try:
                s['original_price'] = int(text.replace(' ','').replace(',','')); s['step'] = 'group_price'
                send(cid, "5️⃣ Guruh narxi (so'm):")
            except: send(cid, "❌ Raqam kiriting!")
        elif step == 'group_price':
            try:
                s['group_price'] = int(text.replace(' ','').replace(',','')); s['step'] = 'min_group'
                send(cid, "6️⃣ Minimal guruh (2-10):")
            except: send(cid, "❌ Raqam kiriting!")
        elif step == 'min_group':
            try:
                mg = int(text)
                if mg < 2 or mg > 10: send(cid, "❌ 2-10 orasida!"); return
                s['min_group'] = mg; s['step'] = 'photo'
                send(cid, "7️⃣ Mahsulot rasmini yuboring 📸")
            except: send(cid, "❌ Raqam kiriting!")
        elif step == 'photo':
            photo = msg.get('photo')
            if photo:
                s['photo_id'] = photo[-1]['file_id']; s['step'] = 'contact'
                send(cid, "8️⃣ Aloqa ma'lumotingiz (@username yoki telefon):")
            else: send(cid, "❌ Rasm yuboring!")
        elif step == 'contact':
            s['contact'] = text
            pid = ''.join(random.choices(string.ascii_lowercase+string.digits, k=6))
            deadline = datetime.now() + timedelta(hours=48)
            products[pid] = {
                'name':s['name'],'shop_name':s['shop_name'],'description':s['description'],
                'original_price':s['original_price'],'group_price':s['group_price'],
                'min_group':s['min_group'],'photo_id':s['photo_id'],'contact':s['contact'],
                'seller_id':uid,'deadline':deadline.strftime('%d.%m.%Y %H:%M'),
                'deadline_dt':deadline.strftime('%Y-%m-%d %H:%M'),'channel_message_id':None,'status':'active'
            }
            groups[pid] = []
            if uid not in seller_products: seller_products[uid] = []
            seller_products[uid].append(pid)
            cap = post_caption(products[pid], pid)
            kb = join_kb(pid, 0, s['min_group'])
            result = requests.post(f'{BASE_URL}/sendPhoto', json={
                'chat_id':CHANNEL_ID,'photo':s['photo_id'],'caption':cap,'parse_mode':'HTML','reply_markup':json.dumps(kb)
            }).json()
            if result.get('ok'):
                products[pid]['channel_message_id'] = result['result']['message_id']
                del seller_state[uid]
                send(cid,
                    f"✅ <b>E'lon qilindi!</b>\n\n📦 {s['name']}\n🆔 <code>{pid}</code>\n"
                    f"⏰ {deadline.strftime('%d.%m.%Y %H:%M')}\n\n"
                    f"📊 /mystats\n📢 /boost {pid}\n🗑 /delete {pid}"
                )
            else:
                del seller_state[uid]
                send(cid, f"❌ Xato: {result.get('description','Noma\\'lum')}")

@app.route('/', methods=['GET'])
def index():
    return 'Joynshop Bot ishlayapti! 🚀'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
