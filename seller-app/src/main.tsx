import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { tgWebApp } from './lib/telegram';
import './index.css';

// Telegram WebApp tayyorgarligi
const tg = tgWebApp();
if (tg) {
  try { tg.ready(); } catch { /* ignore */ }
  try { tg.expand(); } catch { /* ignore */ }
}

// Safe-area sync — Telegram fullscreen overlay va device notch uchun
function syncSafeArea() {
  const root = document.documentElement;
  const contentTop = tg?.contentSafeAreaInset?.top ?? 0;
  const safeTop    = tg?.safeAreaInset?.top ?? 0;
  root.style.setProperty('--tg-content-safe-top', `${contentTop}px`);
  root.style.setProperty('--tg-safe-top',         `${safeTop}px`);
}
syncSafeArea();
if (tg?.onEvent) {
  try { tg.onEvent('contentSafeAreaChanged', syncSafeArea); } catch { /* ignore */ }
  try { tg.onEvent('safeAreaChanged',        syncSafeArea); } catch { /* ignore */ }
  try { tg.onEvent('fullscreenChanged',      syncSafeArea); } catch { /* ignore */ }
  try { tg.onEvent('viewportChanged',        syncSafeArea); } catch { /* ignore */ }
}
window.addEventListener('resize', syncSafeArea);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
