// React Query hook'lar — xaridor API.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from './client';
import type {
  BuyerOrderItem,
  BuyerProfileResponse,
  BuyerStatsResponse,
  Category,
  CheckoutBody,
  CheckoutResponse,
  ProductDetail,
  ProductListItem,
  WishlistItem,
} from './types';

const FIVE_MIN = 5 * 60 * 1000;
const ONE_MIN  = 60 * 1000;

/** GET /api/products — barcha faol mahsulotlar */
export function useProducts() {
  return useQuery({
    queryKey: ['buyer', 'products'],
    queryFn:  () => apiGet<ProductListItem[]>('/products'),
    staleTime: ONE_MIN,
  });
}

/** GET /api/categories — kategoriya ro'yxati */
export function useCategories() {
  return useQuery({
    queryKey: ['buyer', 'categories'],
    queryFn:  () => apiGet<Category[]>('/categories'),
    staleTime: FIVE_MIN,
  });
}

/** GET /api/product/:pid — bitta mahsulot */
export function useProduct(pid: string | null | undefined) {
  return useQuery({
    queryKey: ['buyer', 'product', pid],
    queryFn:  () => apiGet<ProductDetail>(`/product/${pid}`),
    enabled:  !!pid,
    staleTime: ONE_MIN,
  });
}

/** GET /api/buyer_stats?uid=… — bitta xaridor stats */
export function useBuyerStats(uid: number | null | undefined) {
  return useQuery({
    queryKey: ['buyer', 'stats', uid],
    queryFn:  () => apiGet<BuyerStatsResponse>('/buyer_stats', { uid: uid ?? undefined }),
    enabled:  !!uid,
    staleTime: FIVE_MIN,
  });
}

/** GET /api/wishlist?uid=… */
export function useWishlist(uid: number | null | undefined) {
  return useQuery({
    queryKey: ['buyer', 'wishlist', uid],
    queryFn:  () => apiGet<WishlistItem[]>('/wishlist', { uid: uid ?? undefined }),
    enabled:  !!uid,
    staleTime: ONE_MIN,
  });
}

/** GET /api/user/:uid/orders */
export function useBuyerOrders(uid: number | null | undefined) {
  return useQuery({
    queryKey: ['buyer', 'orders', uid],
    queryFn:  () => apiGet<BuyerOrderItem[]>(`/user/${uid}/orders`),
    enabled:  !!uid,
    staleTime: ONE_MIN,
  });
}

/** GET /api/user/:uid/profile */
export function useBuyerProfile(uid: number | null | undefined) {
  return useQuery({
    queryKey: ['buyer', 'profile', uid],
    queryFn:  () => apiGet<BuyerProfileResponse>(`/user/${uid}/profile`),
    enabled:  !!uid,
    staleTime: FIVE_MIN,
  });
}

// ─── Mutation hooks ────────────────────────────────────────────────

/** POST /api/checkout — buyurtma yaratish */
export function useCheckout() {
  return useMutation({
    mutationFn: (body: CheckoutBody) => apiPost<CheckoutResponse>('/checkout', body),
  });
}

interface WishlistVars { uid: number; pid: string }

/** POST /api/wishlist/add — optimistic */
export function useAddWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, pid }: WishlistVars) =>
      apiPost<{ ok: boolean; count: number }>('/wishlist/add', { uid, pid }),
    onMutate: async ({ uid, pid }) => {
      const key = ['buyer', 'wishlist-ids', uid] as const;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key) || [];
      if (!prev.includes(pid)) qc.setQueryData<string[]>(key, [...prev, pid]);
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, { uid }) => {
      qc.invalidateQueries({ queryKey: ['buyer', 'wishlist-ids', uid] });
      qc.invalidateQueries({ queryKey: ['buyer', 'wishlist', uid] });
    },
  });
}

/** POST /api/wishlist/remove — optimistic */
export function useRemoveWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, pid }: WishlistVars) =>
      apiPost<{ ok: boolean; count: number }>('/wishlist/remove', { uid, pid }),
    onMutate: async ({ uid, pid }) => {
      const key = ['buyer', 'wishlist-ids', uid] as const;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key) || [];
      qc.setQueryData<string[]>(key, prev.filter((x) => x !== pid));
      // List ham darhol — saqlanganlar ekrani uchun
      const listKey = ['buyer', 'wishlist', uid] as const;
      const prevList = qc.getQueryData<WishlistItem[]>(listKey);
      if (prevList) {
        qc.setQueryData<WishlistItem[]>(listKey, prevList.filter((x) => x.id !== pid));
      }
      return { prev, prevList, key, listKey };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData(ctx.key, ctx.prev);
      if (ctx.prevList) qc.setQueryData(ctx.listKey, ctx.prevList);
    },
    onSettled: (_data, _err, { uid }) => {
      qc.invalidateQueries({ queryKey: ['buyer', 'wishlist-ids', uid] });
      qc.invalidateQueries({ queryKey: ['buyer', 'wishlist', uid] });
    },
  });
}

/**
 * Wishlist'dagi pid'lar to'plami — `useWishlist` (full data) o'rniga
 * yengilroq lookup uchun. ProductCard heart toggle shu hook'dan o'qiydi.
 * Server source of truth — bir marta yuklab, mutation'lar `setQueryData`
 * orqali real-time yangilab boradi.
 */
export function useWishlistIds(uid: number | null | undefined) {
  return useQuery({
    queryKey: ['buyer', 'wishlist-ids', uid],
    queryFn:  async () => {
      const list = await apiGet<WishlistItem[]>('/wishlist', { uid: uid ?? undefined });
      return list.map((p) => p.id);
    },
    enabled:  !!uid,
    staleTime: 5 * 60 * 1000,
  });
}
