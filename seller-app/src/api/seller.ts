import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';
import type {
  MeResponse,
  ProductsResponse,
  ProductsQuery,
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
