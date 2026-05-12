// Buyer API client — Vercel rewrite orqali /api/* → onrender.com/api/*
//
// Xaridor endpoint'lari hozircha `uid` query param orqali ishlaydi
// (initData server-side validatsiyasi Sprint 4'da qo'shiladi). Shu sababli
// auth header majburiy emas, lekin initData mavjud bo'lsa biz uni baribir
// yuboramiz — kelajakda server tomonida tekshirish uchun.

import { ofetch, type FetchOptions } from 'ofetch';
import { getInitDataRaw } from '@/lib/telegram';

export class ApiError extends Error {
  status: number;
  data:   unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data   = data;
    this.name   = 'ApiError';
  }
}

const BASE_URL = '/api';

export const api = ofetch.create({
  baseURL: BASE_URL,
  retry: 0,
  timeout: 15000,
  onRequest({ options }) {
    const initData = getInitDataRaw();
    if (initData) {
      const headers = new Headers(options.headers as HeadersInit);
      headers.set('Authorization', `tma ${initData}`);
      options.headers = headers;
    }
  },
  onResponseError({ response }) {
    const data = response._data as { error?: string } | undefined;
    const msg  = data?.error || `HTTP ${response.status}`;
    throw new ApiError(response.status, msg, data);
  },
});

export async function apiGet<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  return api<T>(path, { method: 'GET', query: query as FetchOptions['query'] });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method: 'POST',
    body: body as FetchOptions['body'],
  });
}
