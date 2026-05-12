// React Query hook'lar — xaridor API.

import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';
import type {
  BuyerOrderItem,
  BuyerProfileResponse,
  BuyerStatsResponse,
  Category,
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
