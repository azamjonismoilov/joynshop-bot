import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from './client';
import type {
  MeResponse,
  ProductsResponse,
  ProductsQuery,
  ProductDetailResponse,
  ProductUpdateBody,
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

export function useSellerProductDetail(pid: string | undefined) {
  return useQuery({
    queryKey: ['seller', 'products', 'detail', pid],
    queryFn: () => apiGet<ProductDetailResponse>(`/seller/products/${pid}`),
    staleTime: 3 * 60 * 1000,
    enabled: Boolean(pid),
  });
}

export class ProductValidationError extends Error {
  errors: Record<string, string>;
  constructor(errors: Record<string, string>) {
    super('Product validation failed');
    this.name = 'ProductValidationError';
    this.errors = errors;
  }
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pid, payload }: { pid: string; payload: ProductUpdateBody }) => {
      try {
        return await apiPatch<{ ok: true }>(`/seller/products/${pid}`, payload);
      } catch (e: unknown) {
        // ofetch wraps 400 responses with a `data` property
        const data = (e as { data?: { errors?: Record<string, string> } }).data;
        if (data?.errors) throw new ProductValidationError(data.errors);
        throw e;
      }
    },
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
