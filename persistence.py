# persistence.py — PostgreSQL ulanish (get_db) + jadval init (init_db)
# bot.py dan ajratildi (refactor: persistence 1-bosqich — SOF KO'CHIRISH, tuzatishsiz).
# save_data()/load_data() hozircha bot.py'da (global holatga bog'liq — 2-bosqichda).
import os, logging, pg8000

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
