// Buyer API response tiplari — bot.py `/api/*` endpoint'lariga mos.

export type SaleType = 'group' | 'solo' | 'both';

/** /api/products → ProductListItem[] */
export interface ProductListItem {
  id:             string;
  name:           string;
  shop_name:      string;
  description:    string;
  category:       string;
  sale_type:      SaleType;
  original_price: number;
  solo_price:     number;
  group_price:    number;
  min_group:      number;
  count:          number;
  deadline:       string;
  photo_id:       string;
  photo_ids?:     string[];
  photo_url?:     string;
  photo_urls?:    string[];
  contact:        string;
  solo_disc:      number;
  grp_disc:       number;
  join_url:       string;
  solo_url?:      string | null;
  seller_channel: string;
  solo_available: boolean;
  variants:       string[];
  stock:          number;
}

/** /api/product/<pid> */
export interface ProductDetail {
  ok:             true;
  id:             string;
  name:           string;
  description:    string;
  photos:         string[];     // file_id list
  photo_url?:     string;
  photo_urls?:    string[];
  category:       string;
  original_price: number;
  solo_price:     number;
  group_price:    number;
  min_group:      number;
  count:          number;
  stock:          number;
  sale_type:      SaleType;
  variants:       string[];
  shop_name:      string;
  contact:        string;
  address:        string;
  deadline:       string;
}

/** /api/categories */
export interface Category {
  name:  string;
  icon:  string;
  count: number;
}

/** /api/buyer_stats?uid=… */
export interface BuyerStatsResponse {
  total_orders:  number;
  total_saved:   number;
  groups_joined: number;
  cashback:      number;
  referrals:     number;
}

/** /api/wishlist?uid=… */
export interface WishlistItem extends ProductListItem {}

/** /api/user/<uid>/orders */
export interface BuyerOrderItem {
  code:        string;
  name:        string;
  shop_name:   string;
  amount:      number;
  type:        'solo' | 'group';
  status:      'pending' | 'confirming' | 'confirmed' | 'rejected' | 'cancelled';
  status_text: string;
  status_icon: string;
  created:     string;
  address:     string;
  photo_id:    string;
  delivery:    'pickup' | 'deliver';
}

/** /api/user/<uid>/profile */
export interface BuyerProfileResponse {
  total_orders:     number;
  total_saved:      number;
  groups_joined:    number;
  cashback:         number;
  referral_count:   number;
  confirmed_orders: number;
}

/** /api/checkout payload */
export interface CheckoutBody {
  product_id: string;
  user_id:    number;
  user_name?: string;
  type:       'group' | 'solo';
  variant?:   string;
  delivery:   'pickup' | 'deliver';
  address?:   string;
}

/** /api/checkout javobi — Paylov uchun strategik ochiq tuzilma */
export type PaymentProvider = 'mock' | 'paylov' | 'click' | 'payme' | 'uzum';

export interface CheckoutResponse {
  ok:               true;
  code:             string;
  amount:           number;
  payment_url:      string;
  payment_provider: PaymentProvider;
}

/** Photo URL'ni file_id dan yasash — server-side proxy */
export function photoUrl(item: Pick<ProductListItem, 'photo_url' | 'photo_id'>): string {
  if (item.photo_url) return item.photo_url;
  if (item.photo_id)  return `/api/photo/${item.photo_id}`;
  return '';
}
