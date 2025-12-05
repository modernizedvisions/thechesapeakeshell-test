CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT,
  slug TEXT,
  description TEXT,
  price_cents INTEGER,
  category TEXT,
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  stripe_payment_intent_id TEXT,
  total_cents INTEGER,
  customer_email TEXT,
  shipping_name TEXT,
  shipping_address_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  product_id TEXT,
  quantity INTEGER,
  price_cents INTEGER
);
