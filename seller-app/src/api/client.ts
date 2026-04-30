// API client — initData header bilan har so'rovga avtomatik
// Authorization: tma <initData> qo'shadi.
// Vercel rewrite orqali /api/v1/* → onrender.com/api/v1/*

import { ofetch, type FetchOptions } from 'ofetch';
import { getInitDataRaw } from '@/lib/telegram';

export class AuthError extends Error {
  reason: string;
  constructor(reason: string) {
    super(`Auth error: ${reason}`);
    this.reason = reason;
    this.name = 'AuthError';
  }
}

export class NotASellerError extends Error {
  constructor() {
    super('Not a seller');
    this.name = 'NotASellerError';
  }
}

const BASE_URL = '/api/v1';

export const api = ofetch.create({
  baseURL: BASE_URL,
  retry: 0,
  timeout: 15000,
  onRequest({ options }) {
    const initData = getInitDataRaw();
    const headers = new Headers(options.headers as HeadersInit);
    if (initData) {
      headers.set('Authorization', `tma ${initData}`);
    }
    options.headers = headers;
  },
  onResponseError({ response }) {
    if (response.status === 401) {
      const reason = (response._data as { reason?: string })?.reason || 'unauthorized';
      throw new AuthError(reason);
    }
    if (response.status === 403) {
      throw new NotASellerError();
    }
  },
});

export async function apiGet<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  return api<T>(path, { method: 'GET', query: query as FetchOptions['query'] });
}
