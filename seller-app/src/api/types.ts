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
