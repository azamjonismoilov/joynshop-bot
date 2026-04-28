# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Joynshop is a group-buying platform for Uzbekistan combining **two Telegram bots** (seller + buyer) with a **PWA web storefront**, all served by a single Flask app (`bot.py`). User-facing strings are in Uzbek.

## Run / Deploy

- **Production**: Render.com via `Procfile` → `gunicorn bot:app --workers 1 --timeout 120`. The hardcoded backend URL in `index.html` is `https://joynshop-bot.onrender.com`.
- **Local**: `python bot.py` (binds `0.0.0.0:$PORT`, default `5000`). There is no test suite, no linter config, no build step.
- **Workers must stay at 1.** All state lives in module-level dicts (`products`, `groups`, `orders`, etc.) and is shared across threads, not processes. Multiple gunicorn workers would fork divergent in-memory state.

## Required environment variables

- `SELLER_TOKEN`, `BUYER_TOKEN` — two separate Telegram bot tokens
- `ADMIN_ID` — Telegram user ID that receives payout notifications
- `DATABASE_URL` — Postgres URL (parsed manually, SSL with `CERT_NONE`)
- `APP_URL` — public base URL (used to build `/miniapp`, `/pay/<pid>`, `/live/<id>` links)
- `CLICK_TOKEN` — Telegram Bot Payments provider token for Click
- `PAYME_NUMBER` — phone number shown for manual Payme transfers
- `DASHBOARD_PASSWORD` — gates `/api/stats` and all `/api/admin/*` endpoints (passed as `?pwd=`)
- `BUYER_BOT_USERNAME` — used in deep links like `t.me/<username>?start=...`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`, `AWS_REGION`, `CDN_BASE_URL` — optional; if `boto3` or keys are missing, S3 upload silently degrades and photos fall back to Telegram `file_id`s

After deploy, hit `/setup-menu` once to register Telegram menu buttons / commands for both bots (`setup_bot_ui()`).

## Architecture

### Single-file monolith
`bot.py` (~5000 lines) is the entire backend. There are no modules to import — everything (Flask routes, Telegram webhook handlers, persistence, S3, payments, background loops) lives in one file. When adding code, follow the section banners (`# ─── ... ───`) already in the file.

### Two bots, one process
- `POST /seller/webhook` → `seller_handle_cb` / `seller_handle_msg` — product creation wizard, order management, CRM, channel/shop setup, live commerce
- `POST /buyer/webhook` → `buyer_handle_cb` / `buyer_handle_msg` — browsing, orders, profile, group joining, payment confirmation

Helpers `send_seller(...)` and `send_buyer(...)` wrap `api()` with the correct token. **Never hardcode a token** — always pass via these wrappers so the right bot replies.

### State and persistence
All runtime state is in module-level dicts (`products`, `groups`, `orders`, `wishlists`, `buyer_profiles`, `refund_requests`, `seller_state`, `customers`, `lives`, `seller_shops`, `seller_products`, `verified_channels`, `pending_moderator_codes`, `referrals`, `referral_map`).

Persistence is a **single JSON blob** in Postgres:
```
table joynshop_data (key TEXT PRIMARY KEY, value TEXT)
```
`save_data()` serializes every dict above into one row with `key='main'`; `load_data()` reads it on boot. **Any new top-level dict you add must be wired into both** `save_data()` and `load_data()`, otherwise it won't survive a restart. Call `save_data()` after every state mutation that needs to persist — there is no autosave.

### Background threads
Started at module load (not inside `if __name__ == '__main__'`):
- `reminder_loop` — every 30 min, sends "deadline approaching" nudges and calls `expire_product()` when groups time out
- `live_update_loop` — every 30 s, edits channel post captions to refresh group member counts

Both are daemons; failures are swallowed and logged. The bot's UI setup (`setup_bot_ui`) runs in a third daemon thread on import.

### Frontend pages (served by Flask)
- `/` → `index.html` — public PWA storefront (browse, wishlist, orders). Note: this file hardcodes `const API='https://joynshop-bot.onrender.com'` — it talks to the prod backend even when opened locally.
- `/miniapp` → `miniapp.html` — Telegram WebApp opened from the buyer bot's menu button
- `/pay/<pid>` → `pay.html` — checkout page linked from channel posts (calls `/api/web_checkout`)
- `/live/<id>` → `live.html` — live commerce viewer (`/api/live/<id>`, `/view`, `/question`)
- `/dashboard` → `dashboard.html` — admin dashboard (calls `/api/stats` and `/api/admin/*`, all gated by `?pwd=$DASHBOARD_PASSWORD`)

`pay.html`, `live.html`, `dashboard.html` use **same-origin relative URLs** (`/api/...`); only `index.html` hardcodes the prod URL.

### Payments
Two flows coexist:
1. **Telegram Bot Payments (Click)** — `send_invoice()` → user pays inside Telegram → `handle_pre_checkout()` confirms → `handle_successful_payment()` finalizes the order. Invoice payloads use `channel_<pid>` for channel-post purchases, raw order codes (`JS-XXXXXX`) otherwise.
2. **Manual Payme** — buyer sees `PAYME_NUMBER` and an order code (`JS-XXXXXX`) as the transfer comment; seller confirms via callback button.

Commission is fixed at `COMMISSION_RATE = 0.05` (5%), computed inside `notify_group_filled()` when a group is filled.

### Telegram channels and shops
Sellers register **verified channels** (`verified_channels[username]`) — the bot must be admin in the channel. Each seller can have multiple **shops** (`seller_shops[seller_id]` is a list). Products are posted to a chosen shop's channel; `live_update_loop` keeps the post caption in sync with the group counter via `editMessageCaption`.

### Photo storage
`upload_photo_to_s3()` downloads from Telegram and re-uploads to S3, returning a CDN URL (or the raw S3 URL). `upload_photo_async()` does this in a thread and writes the result back into `state['photo_urls']`. If S3 is disabled, code falls back to passing Telegram `file_id`s through `/api/photo/<file_id>` which proxies to Telegram's file API. Treat S3 as best-effort — never block on it.

### Spam moderation
Group/supergroup messages routed to the buyer webhook hit `moderate_chat()` first — `is_spam()` deletes messages with multiple links. Keep this fast; it runs synchronously inside the webhook.

## Conventions to preserve

- **Uzbek user-facing strings**, English code/comments. Section banners use box-drawing characters (`# ─── NAME ───`).
- **HTML in Telegram messages**: `parse_mode='HTML'`. Tags must be balanced or Telegram rejects the send. `strip_html()` exists for places that can't render tags (e.g., invoice descriptions, capped at 255 chars).
- **CORS** is wide open (`*`) via `add_cors` — the public PWA at a different origin depends on this.
- **Order codes**: `JS-XXXXXX` (`gen_code()`), used as both invoice payloads and admin/seller references.
- **Categories** (`CATEGORIES` list at top of `bot.py`) are the source of truth for both bot keyboards and the website — keep them in sync.

## Known footguns

- Editing `bot.py` requires a redeploy on Render — webhooks point at the live URL, so local changes don't affect the running bots.
- `seller_state[uid]` is a step-machine for multi-turn flows (product creation, shop onboarding). The `is_prod_in_progress()` guard in `seller_handle_cb` blocks unrelated callbacks while a wizard is mid-flight — preserve this when adding new callback prefixes (extend `PROD_ALLOWED_CBS` or the prefix whitelist).
- `save_data()` retries up to 3× then gives up silently — a transient DB outage during a high-traffic moment can lose state until the next successful save.
- `load_data()` runs at module import time (bottom of `bot.py`), not inside `__main__`, so gunicorn workers load state on boot.
