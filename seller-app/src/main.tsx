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
