// Backend /api/v1/seller/* javoblari uchun TypeScript turlar.
// bot.py'dagi api_seller_me va api_seller_products bilan moslashtirilgan.

export interface ShopInfo {
  name: string;
  channel: string;
  billz_connected: boolean;
  billz_shop_name: string;
  onboarding_status: string;
}

export interface MeResponse {
  uid: number;
  first_name: string;
  last_name: string;
  username: string;
  photo_url: string;
  shops: ShopInfo[];
  legal_completed: boolean;
  billz_connected: boolean;
  products_count: number;
  orders_pending: number;
  stats_summary: {
    gmv_today: number;
    gmv_week: number;
  };
}

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  price_short: string;
  original_price: number;
  min_group: number;
  count: number;
  status: 'active' | 'closed' | 'draft';
  status_label: string;   // "Aktiv" | "Yoqilmagan" | "Yopilgan" | "Muddati tugagan"
  status_emoji: string;   // 🔥 / ⏸ / 🔒 / ⏰
  source: 'manual' | 'billz';
  is_billz_draft: boolean;
  mxik_missing: boolean;
  deadline: string;
  deadline_dt: string;
  photo_url: string;
  shop_name: string;
  channel: string;
}

export interface ProductsResponse {
  items: ProductItem[];
  total: number;
  page: number;
  pages: number;
  has_next: boolean;
}

export type ProductFilter = 'active' | 'archived' | 'all';

export interface ProductsQuery {
  page?: number;
  limit?: number;
  filter?: ProductFilter;
  search?: string;
}

export interface ApiError {
  error: string;
  reason?: string;
}

// ─── Stats ───
export type StatsRange = 'today' | 'week' | 'month' | 'all';

export interface TopProduct {
  id: string;
  name: string;
  sold: number;
  revenue: number;
}

export interface TopCustomer {
  cuid: string;
  name: string;
  spent: number;
  orders: number;
}

export interface StatsResponse {
  range: StatsRange;
  gmv: number;
  commission: number;
  net_income: number;
  orders_total: number;
  orders_confirmed: number;
  orders_pending: number;
  conversion_rate: number;
  products_total: number;
  products_active: number;
  products_archived: number;
  groups_filled: number;
  buyers_unique: number;
  avg_check: number;
  top_products: TopProduct[];
  top_customers: TopCustomer[];
}

export type ChartDays = 7 | 14 | 30 | 60 | 90;

export interface ChartDataPoint {
  date: string;       // "2026-04-30"
  gmv: number;
  orders: number;
}

export interface StatsChartResponse {
  days: number;
  data: ChartDataPoint[];
  total_gmv: number;
  avg_daily: number;
}
