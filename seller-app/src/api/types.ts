// Backend /api/v1/seller/* javoblari uchun TypeScript turlar.
// bot.py'dagi api_seller_me va api_seller_products bilan moslashtirilgan.

export interface ShopInfo {
  name: string;
  channel: string;
  billz_connected: boolean;
  billz_shop_name: string;
  onboarding_status: string;
}

export interface OnboardingSteps {
  shop_name: boolean;
  phone:     boolean;
  address:   boolean;
  social:    boolean;
  delivery:  boolean;
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
  is_onboarded?: boolean;     // optional — older backends did not return this
  onboarding_steps?: OnboardingSteps;
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

export type ProductSaleType = 'both' | 'group' | 'solo';
export type ProductStatusKey = 'active' | 'closed' | 'draft';

export interface ProductPhoto {
  url:        string;
  is_primary: boolean;
}

export interface ProductActions {
  can_edit:  boolean;
  can_close: boolean;
}

export interface ProductDetailResponse {
  id:                    string;
  name:                  string;
  description:           string;
  category:              string;
  category_icon:         string;
  sale_type:             ProductSaleType;
  original_price:        number;
  group_price:           number;
  solo_price:            number;
  min_group:             number;
  count:                 number;
  status:                ProductStatusKey;
  status_label:          string;
  status_emoji:          string;
  is_archived:           boolean;
  source:                'manual' | 'billz';
  is_billz_draft:        boolean;
  deadline:              string;
  deadline_dt:           string;
  deadline_seconds_left: number;
  photos:                ProductPhoto[];
  variants:              string[];
  barcode:               string;
  sku:                   string;
  brand_name:            string;
  shop:    { name: string; channel: string };
  mxik:    { code: string | null; name: string | null; missing: boolean };
  stats:   {
    orders_total:   number;
    revenue:        number;
    wishlist_count: number;
    first_order:    string;
    last_order:     string;
  };
  channel_post_url: string | null;
  actions:          ProductActions;
}

export interface ProductUpdateBody {
  name?:           string;
  description?:    string;
  original_price?: number;
  group_price?:    number;
  solo_price?:     number;
  sale_type?:      ProductSaleType;
  min_group?:      number;
  deadline_hours?: number;
  variants?:       string[];
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

export interface OrderActions {
  can_confirm: boolean;
  can_reject:  boolean;
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
  actions?:       OrderActions;
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

// ─── Settings: Legal ───
export type LegalStatus = 'yatt' | 'mchj';

export interface LegalInfo {
  completed:              boolean;
  completed_at:           string | null;
  legal_status:           LegalStatus | null;
  legal_status_label:     string | null;
  stir:                   string | null;
  bank_name:              string | null;
  bank_account:           string | null;
  bank_account_formatted: string | null;
  bank_mfo:               string | null;
  director_name:          string | null;
}

// ─── Settings: Shops ───
export type DeliveryType = 'pickup' | 'deliver' | 'both';

export interface ShopBrief {
  idx:               number;
  name:              string;
  phone:             string;
  phone2:            string;
  address:           string;
  social:            Record<string, string>;
  delivery:          DeliveryType;
  delivery_label:    string;
  channel:           string;
  channel_verified:  boolean;
  verified:          boolean;
  onboarding_status: string;
  products_count:    number;
  billz_connected:   boolean;
  billz_shop_name:   string;
}

export interface ShopsResponse {
  shops: ShopBrief[];
}

export interface ShopDetail extends ShopBrief {
  orders_total:     number;
  orders_confirmed: number;
  revenue:          number;
  last_order:       string;
}

// ─── Settings: Integrations ───
export interface BillzShopStatus {
  shop_idx:        number;
  shop_name:       string;
  connected:       boolean;
  billz_shop_name: string;
}

export interface IntegrationItem {
  id:               string;
  name:             string;
  icon:             string;
  status:           'active' | 'coming_soon';
  connected_shops?: number;
  total_shops?:     number;
  shop_statuses?:   BillzShopStatus[];
}

export interface IntegrationsResponse {
  integrations: IntegrationItem[];
}

export interface BillzShopDetail {
  shop_idx:        number;
  shop_name:       string;
  connected:       boolean;
  billz_shop_id:   string;
  billz_shop_name: string;
  connected_at:    string;
}

export interface BillzIntegration {
  any_connected:   boolean;
  shops_total:     number;
  shops_connected: number;
  imported_count:  number;
  shops:           BillzShopDetail[];
}
