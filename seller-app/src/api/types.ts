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
  customers_count?: number;   // optional — older clients may not see this
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

// ─── Orders ───
export type OrderStatus = 'pending' | 'confirming' | 'confirmed' | 'rejected' | 'cancelled';
export type OrderFilter = OrderStatus | 'all';

export interface OrderBuyer {
  user_id: number;
  name:    string;
  phone:   string;
  username: string;
}

export interface OrderItem {
  code:           string;          // "JS-AB12CD"
  product_id:     string;
  product_name:   string;
  product_photo:  string;
  buyer:          OrderBuyer;
  amount:         number;
  type:           'group' | 'solo';
  type_label:     string;
  variant:        string;
  delivery:       'pickup' | 'deliver';
  delivery_label: string;
  address:        string;
  status:         OrderStatus;
  status_emoji:   string;
  status_label:   string;
  payment_method: string;
  created:        string;          // "01.05.2026 14:30"
}

export interface OrdersSummary {
  pending: number;
  confirming: number;
  confirmed: number;
  rejected: number;
}

export interface OrdersResponse {
  items:    OrderItem[];
  total:    number;
  page:     number;
  pages:    number;
  has_next: boolean;
  summary:  OrdersSummary;
}

export interface OrdersQuery {
  status?: OrderFilter;
  page?:   number;
  limit?:  number;
  search?: string;
}

export interface OrderTimelineEvent {
  event: 'created' | 'payment' | 'confirmed' | 'rejected' | 'cancelled';
  at:    string;
  meta:  Record<string, string>;
}

export interface OrderProductSubset {
  id:             string;
  name:           string;
  photo_url:      string;
  original_price: number;
  group_price:    number;
  solo_price:     number;
  min_group:      number;
  count:          number;
  status:         string;
  status_label:   string;
  shop_name:      string;
  channel:        string;
}

export interface OrderBuyerExtended extends OrderBuyer {
  total_orders:   number;
  lifetime_value: number;
  tags:           string[];
  first_order:    string;
  last_order:     string;
}

export interface OrderDetailResponse extends Omit<OrderItem, 'buyer'> {
  product:  OrderProductSubset;
  buyer:    OrderBuyerExtended;
  timeline: OrderTimelineEvent[];
}

// ─── Customers ───
export type CustomerActivity = 'active' | 'average' | 'lost';
export type CustomerFilter   = 'all' | 'vip' | 'active' | 'lost' | 'new' | 'repeat';

export interface CustomerBrief {
  cuid:            string;
  user_id:         number;
  name:            string;
  phone:           string;
  username:        string;
  total_orders:    number;
  total_spent:     number;
  first_order:     string;
  last_order:      string;
  days_since_last: number;
  activity:        CustomerActivity;
  activity_emoji:  string;
  activity_label:  string;
  tags:            string[];
  rank:            number | null;
  medal:           string | null;   // "🥇" | "🥈" | "🥉" | null
}

export interface CustomersSummary {
  total:         number;
  vip:           number;
  active:        number;
  lost:          number;
  new:           number;
  repeat:        number;
  total_revenue: number;
}

export interface CustomersResponse {
  items:    CustomerBrief[];
  total:    number;
  page:     number;
  pages:    number;
  has_next: boolean;
  filter:   CustomerFilter;
  summary:  CustomersSummary;
}

export interface CustomersQuery {
  filter?: CustomerFilter;
  page?:   number;
  limit?:  number;
  search?: string;
}

export interface CustomerTagOption {
  id:    string;
  label: string;
}

export interface CustomerDetail {
  cuid:            string;
  user_id:         number;
  name:            string;
  phone:           string;
  username:        string;
  total_orders:    number;
  total_spent:     number;
  avg_check:       number;
  first_order:     string;
  last_order:      string;
  activity:        CustomerActivity;
  activity_emoji:  string;
  activity_label:  string;
  tags:            string[];
  note:            string;
  source:          string;
  available_tags:  CustomerTagOption[];
}

export interface CustomerHistoryItem {
  code:    string;   // "" for legacy entries created before the field was added
  product: string;
  amount:  number;
  date:    string;
  type:    string;
  status:  string;
}

export interface CustomerHistoryResponse {
  items:       CustomerHistoryItem[];
  total:       number;
  page:        number;
  pages:       number;
  has_next:    boolean;
  total_spent: number;
  note:        string | null;
}
