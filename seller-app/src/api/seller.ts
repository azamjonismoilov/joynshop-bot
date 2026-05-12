import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiPostMultipart } from './client';
import type {
  MeResponse,
  ProductsResponse,
  ProductsQuery,
  ProductDetailResponse,
  ProductUpdateBody,
  ProductCreateBody,
  ProductCreateResponse,
  ProductPhotoUploadResponse,
  CategoriesResponse,
  MxikSearchResponse,
  LegalUpdateBody,
  ShopUpdateBody,
  StatsResponse,
  StatsRange,
  StatsChartResponse,
  ChartDays,
  OrdersResponse,
  OrdersQuery,
  OrderDetailResponse,
  CustomersResponse,
  CustomersQuery,
  CustomerDetail,
  CustomerHistoryResponse,
  CustomerUpdateBody,
  LegalInfo,
  ShopsResponse,
  ShopDetail,
  IntegrationsResponse,
  BillzIntegration,
} from './types';

const FIVE_MIN = 5 * 60 * 1000;

export function useSellerMe() {
  return useQuery({
    queryKey: ['seller', 'me'],
    queryFn: () => apiGet<MeResponse>('/seller/me'),
    staleTime: 60_000, // 1 daqiqa cache
  });
}

export function useSellerProducts(query: ProductsQuery = {}) {
  return useQuery({
    queryKey: ['seller', 'products', query],
    queryFn: () => apiGet<ProductsResponse>('/seller/products', {
      page:   query.page,
      limit:  query.limit,
      filter: query.filter,
      search: query.search,
    }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useSellerCategories() {
  return useQuery({
    queryKey: ['seller', 'categories'],
    queryFn: () => apiGet<CategoriesResponse>('/seller/categories'),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useMxikSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['seller', 'mxik', trimmed],
    queryFn: () => apiGet<MxikSearchResponse>('/seller/mxik/search', { q: trimmed }),
    enabled: trimmed.length >= 3,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadProductPhoto() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('photo', file);
      return apiPostMultipart<ProductPhotoUploadResponse>('/seller/products/upload-photo', form);
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ProductCreateBody) => {
      try {
        return await apiPost<ProductCreateResponse>('/seller/products', body);
      } catch (e: unknown) {
        const data = (e as { data?: { errors?: Record<string, string> } }).data;
        if (data?.errors) throw new ApiValidationError(data.errors);
        throw e;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'products'] });
      qc.invalidateQueries({ queryKey: ['seller', 'me'] });
      qc.invalidateQueries({ queryKey: ['seller', 'stats'] });
      qc.invalidateQueries({ queryKey: ['seller', 'categories'] });
    },
  });
}

export function useSellerProductDetail(pid: string | undefined) {
  return useQuery({
    queryKey: ['seller', 'products', 'detail', pid],
    queryFn: () => apiGet<ProductDetailResponse>(`/seller/products/${pid}`),
    staleTime: 3 * 60 * 1000,
    enabled: Boolean(pid),
  });
}

export class ApiValidationError extends Error {
  errors: Record<string, string>;
  constructor(errors: Record<string, string>) {
    super('Product validation failed');
    this.name = 'ApiValidationError';
    this.errors = errors;
  }
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, payload }: { pid: string; payload: ProductUpdateBody }) =>
      patchWithValidation<{ ok: true }>(`/seller/products/${pid}`, payload),
    onSuccess: (_data, { pid }) => {
      qc.invalidateQueries({ queryKey: ['seller', 'products'] });
      qc.invalidateQueries({ queryKey: ['seller', 'products', 'detail', pid] });
      qc.invalidateQueries({ queryKey: ['seller', 'me'] });
      qc.invalidateQueries({ queryKey: ['seller', 'stats'] });
    },
  });
}

export function useCloseProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pid: string) =>
      apiPost<{ ok: true }>(`/seller/products/${pid}/close`),
    onSuccess: (_data, pid) => {
      qc.invalidateQueries({ queryKey: ['seller', 'products'] });
      qc.invalidateQueries({ queryKey: ['seller', 'products', 'detail', pid] });
      qc.invalidateQueries({ queryKey: ['seller', 'me'] });
      qc.invalidateQueries({ queryKey: ['seller', 'stats'] });
    },
  });
}

// ─── Stats ───
export function useSellerStats(range: StatsRange = 'week') {
  return useQuery({
    queryKey: ['seller', 'stats', range],
    queryFn: () => apiGet<StatsResponse>('/seller/stats', { range }),
    staleTime: FIVE_MIN,
  });
}

export function useSellerStatsChart(days: ChartDays = 7) {
  return useQuery({
    queryKey: ['seller', 'stats', 'chart', days],
    queryFn: () => apiGet<StatsChartResponse>('/seller/stats/chart', { days }),
    staleTime: FIVE_MIN,
    placeholderData: (prev) => prev,
  });
}

// ─── Orders ───
const THREE_MIN = 3 * 60 * 1000;

export function useSellerOrders(query: OrdersQuery = {}) {
  return useQuery({
    queryKey: ['seller', 'orders', query],
    queryFn: () => apiGet<OrdersResponse>('/seller/orders', {
      status: query.status,
      page:   query.page,
      limit:  query.limit,
      search: query.search,
    }),
    staleTime: THREE_MIN,
    placeholderData: (prev) => prev,
  });
}

export function useSellerOrderDetail(code: string | undefined) {
  return useQuery({
    queryKey: ['seller', 'orders', 'detail', code],
    queryFn: () => apiGet<OrderDetailResponse>(`/seller/orders/${code}`),
    staleTime: THREE_MIN,
    enabled: Boolean(code),
  });
}

// ─── Order actions (Mini App mutations) ───
export function useConfirmOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiPost<{ ok: true }>(`/seller/orders/${code}/confirm`),
    onSuccess: (_data, code) => {
      qc.invalidateQueries({ queryKey: ['seller', 'orders'] });
      qc.invalidateQueries({ queryKey: ['seller', 'orders', 'detail', code] });
      qc.invalidateQueries({ queryKey: ['seller', 'me'] });
      qc.invalidateQueries({ queryKey: ['seller', 'stats'] });
    },
  });
}

export function useRejectOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, reason }: { code: string; reason: string }) =>
      apiPost<{ ok: true }>(`/seller/orders/${code}/reject`, { reason }),
    onSuccess: (_data, { code }) => {
      qc.invalidateQueries({ queryKey: ['seller', 'orders'] });
      qc.invalidateQueries({ queryKey: ['seller', 'orders', 'detail', code] });
      qc.invalidateQueries({ queryKey: ['seller', 'me'] });
      qc.invalidateQueries({ queryKey: ['seller', 'stats'] });
    },
  });
}

// ─── Customers ───
export function useSellerCustomers(query: CustomersQuery = {}) {
  return useQuery({
    queryKey: ['seller', 'customers', query],
    queryFn: () => apiGet<CustomersResponse>('/seller/customers', {
      filter: query.filter,
      page:   query.page,
      limit:  query.limit,
      search: query.search,
    }),
    staleTime: THREE_MIN,
    placeholderData: (prev) => prev,
  });
}

export function useSellerCustomerDetail(cuid: string | undefined) {
  return useQuery({
    queryKey: ['seller', 'customers', 'detail', cuid],
    queryFn: () => apiGet<CustomerDetail>(`/seller/customers/${cuid}`),
    staleTime: THREE_MIN,
    enabled: Boolean(cuid),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cuid, payload }: { cuid: string; payload: CustomerUpdateBody }) =>
      apiPatch<{ ok: true }>(`/seller/customers/${cuid}`, payload),
    onSuccess: (_data, { cuid }) => {
      qc.invalidateQueries({ queryKey: ['seller', 'customers'] });
      qc.invalidateQueries({ queryKey: ['seller', 'customers', 'detail', cuid] });
    },
  });
}

export function useSellerCustomerHistory(cuid: string | undefined, page = 0, limit = 20) {
  return useQuery({
    queryKey: ['seller', 'customers', 'history', cuid, page, limit],
    queryFn: () => apiGet<CustomerHistoryResponse>(`/seller/customers/${cuid}/history`, {
      page, limit,
    }),
    staleTime: THREE_MIN,
    enabled: Boolean(cuid),
    placeholderData: (prev) => prev,
  });
}

// ─── Settings ───
async function patchWithValidation<T>(path: string, body: unknown): Promise<T> {
  try {
    return await apiPatch<T>(path, body);
  } catch (e: unknown) {
    const data = (e as { data?: { errors?: Record<string, string> } }).data;
    if (data?.errors) throw new ApiValidationError(data.errors);
    throw e;
  }
}

export function useUpdateLegal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LegalUpdateBody) =>
      patchWithValidation<{ ok: true }>('/seller/legal', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'legal'] });
      qc.invalidateQueries({ queryKey: ['seller', 'me'] });
    },
  });
}

export function useUpdateShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idx, body }: { idx: number; body: ShopUpdateBody }) =>
      patchWithValidation<{ ok: true }>(`/seller/shops/${idx}`, body),
    onSuccess: (_data, { idx }) => {
      qc.invalidateQueries({ queryKey: ['seller', 'shops'] });
      qc.invalidateQueries({ queryKey: ['seller', 'shops', 'detail', idx] });
      qc.invalidateQueries({ queryKey: ['seller', 'me'] });
    },
  });
}

export function useSellerLegal() {
  return useQuery({
    queryKey: ['seller', 'legal'],
    queryFn: () => apiGet<LegalInfo>('/seller/legal'),
    staleTime: THREE_MIN,
  });
}

export function useSellerShops() {
  return useQuery({
    queryKey: ['seller', 'shops'],
    queryFn: () => apiGet<ShopsResponse>('/seller/shops'),
    staleTime: THREE_MIN,
  });
}

export function useSellerShopDetail(idx: number | undefined) {
  return useQuery({
    queryKey: ['seller', 'shops', 'detail', idx],
    queryFn: () => apiGet<ShopDetail>(`/seller/shops/${idx}`),
    staleTime: THREE_MIN,
    enabled: idx !== undefined && Number.isFinite(idx),
  });
}

export function useSellerIntegrations() {
  return useQuery({
    queryKey: ['seller', 'integrations'],
    queryFn: () => apiGet<IntegrationsResponse>('/seller/integrations'),
    staleTime: THREE_MIN,
  });
}

export function useSellerBillzIntegration() {
  return useQuery({
    queryKey: ['seller', 'integrations', 'billz'],
    queryFn: () => apiGet<BillzIntegration>('/seller/integrations/billz'),
    staleTime: THREE_MIN,
  });
}
