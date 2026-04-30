# Joynshop Sotuvchi Mini App

React + Vite + TypeScript Telegram Mini App for sellers.

## Tech stack
- React 18 + Vite
- TypeScript
- Tailwind CSS
- `@telegram-apps/telegram-ui` — native Telegram look
- `@telegram-apps/sdk-react` — initData, theme, BackButton
- `@tanstack/react-query` — server state
- `react-router-dom` — routing
- `zustand` — client state (ready for Phase 2)

## Local dev

```bash
cd seller-app
npm install
npm run dev
```

Vite proxy `/api/*` → `https://joynshop-bot.onrender.com`. Real Telegram
initData faqat Mini App ichida ishlaydi — local browser'da auth 401 qaytadi.

Local'da test qilish uchun:
1. Browser DevTools → Console
2. `localStorage.setItem('tgWebAppData', '<your-init-data>')` (mock)
3. Yoki Telegram Desktop'da `?tgWebAppDebug=1` URL bilan oching

## Build

```bash
npm run build
# output: dist/
```

## Deploy (Vercel)

- Root Directory: `seller-app`
- Build: `npm run build`
- Output: `dist`
- Domain: `seller.joynshop.uz`
- `vercel.json` → `/api/*` rewrite to Render backend

## Backend API (`/api/v1/seller/*`)

Defined in `bot.py` (root). Auth: `Authorization: tma <initData>`.

- `GET /me` — seller profile
- `GET /products?page=&limit=&filter=&search=` — paginated list

## Folder structure

```
seller-app/
├── public/
├── src/
│   ├── api/         (client + types + react-query hooks)
│   ├── components/  (EmptyState, ErrorState)
│   ├── lib/         (telegram.ts)
│   ├── screens/     (ProductsScreen)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── vercel.json
└── index.html
```
