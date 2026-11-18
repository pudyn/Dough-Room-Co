export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  error?: { code: string; details?: unknown };
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface Product {
  id: string;
  category_id: string | null;
  category_name: string | null;
  sku: string;
  name: string;
  description: string | null;
  image_url: string | null;
  selling_price: number;
  cost_price: number;
  stock_tracking: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_recommended: boolean;
  tier_prices: Record<string, number>;
  sales_modes: string[];
  reserved_quantity?: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  source: "POS" | "QR_STORE" | "QR_CATALOG" | "ADMIN";
  order_type: "READY_STOCK" | "PREORDER";
  customer_name: string | null;
  customer_phone: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  notes: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export type PaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "PARTIALLY_PAID";

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_number: string;
  method: "CASH" | "QRIS" | "BANK_TRANSFER" | "PAY_AT_COUNTER";
  amount: number;
  status: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  proof_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_active: boolean;
}

export interface PreorderPeriod {
  id: string;
  name: string;
  description: string | null;
  start_at: string;
  close_at: string;
  production_date: string;
  pickup_start_at: string;
  pickup_end_at: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "COMPLETED";
  quotas: PreorderQuota[];
}

export interface PreorderQuota {
  id: string;
  product_id: string;
  product_name: string;
  quota: number;
  reserved_quantity: number;
  confirmed_quantity: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  roles: string[];
  created_at: string;
}


export interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  image_url: string | null;
  is_visible: boolean;
  created_at: string;
}

export interface Feedback {
  id: string;
  customer_name: string;
  contact: string | null;
  message: string;
  image_url: string | null;
  is_visible: boolean;
  created_at: string;
}
