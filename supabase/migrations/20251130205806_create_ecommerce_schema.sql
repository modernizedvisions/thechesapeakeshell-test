/*
  # Artist Ecommerce Database Schema

  ## Overview
  This migration creates the complete database schema for an artist ecommerce platform
  with Stripe integration, supporting one-of-a-kind items with reservation system.

  ## New Tables

  ### `products`
  Mirrors Stripe Products with additional metadata for inventory management
  - `id` (uuid, primary key)
  - `stripe_product_id` (text, unique) - Links to Stripe Product
  - `name` (text) - Product name
  - `description` (text) - Product description
  - `image_url` (text) - Full-size product image
  - `thumbnail_url` (text) - Thumbnail for grid display
  - `type` (text) - Product category/type
  - `collection` (text) - Collection grouping
  - `oneoff` (boolean) - True for one-of-a-kind items
  - `visible` (boolean) - Whether product is visible in shop
  - `is_sold` (boolean) - Whether product has been sold
  - `reserved_by_session_id` (text, nullable) - Checkout session holding reservation
  - `reserved_until` (timestamptz, nullable) - When reservation expires
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `prices`
  Mirrors Stripe Prices
  - `id` (uuid, primary key)
  - `stripe_price_id` (text, unique) - Links to Stripe Price
  - `product_id` (uuid, foreign key) - Links to products table
  - `unit_amount` (integer) - Price in cents
  - `currency` (text) - Currency code (USD, EUR, etc.)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `customers`
  Stores customer information
  - `id` (uuid, primary key)
  - `stripe_customer_id` (text, unique, nullable)
  - `email` (text, unique)
  - `name` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `orders`
  Stores completed orders
  - `id` (uuid, primary key)
  - `stripe_session_id` (text, unique) - Stripe checkout session ID
  - `customer_id` (uuid, foreign key) - Links to customers table
  - `total_amount` (integer) - Total in cents
  - `currency` (text) - Currency code
  - `status` (text) - Order status (completed, refunded, etc.)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `order_items`
  Line items for each order
  - `id` (uuid, primary key)
  - `order_id` (uuid, foreign key) - Links to orders table
  - `product_id` (uuid, foreign key) - Links to products table
  - `price_id` (uuid, foreign key) - Links to prices table
  - `quantity` (integer) - Quantity ordered
  - `unit_amount` (integer) - Price per unit in cents
  - `created_at` (timestamptz)

  ### `admin_settings`
  Configuration for admin functionality
  - `id` (uuid, primary key)
  - `password_hash` (text) - Bcrypt hashed admin password
  - `artist_email` (text) - Artist's email for notifications
  - `artist_sms_email` (text, nullable) - SMS gateway email for text notifications
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Public read access on products and prices (visible items only)
  - Admin-only write access on products and prices
  - Authenticated access for orders and customers
  - Admin-only access for admin_settings

  ## Indexes
  - Index on products(stripe_product_id) for fast lookups
  - Index on products(reserved_until) for reservation queries
  - Index on prices(stripe_price_id) for Stripe sync
  - Index on orders(stripe_session_id) for webhook processing
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  thumbnail_url text DEFAULT '',
  type text DEFAULT '',
  collection text DEFAULT '',
  oneoff boolean DEFAULT false,
  visible boolean DEFAULT true,
  is_sold boolean DEFAULT false,
  reserved_by_session_id text,
  reserved_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create prices table
CREATE TABLE IF NOT EXISTS prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id text UNIQUE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  unit_amount integer NOT NULL,
  currency text DEFAULT 'usd',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id text UNIQUE,
  email text UNIQUE NOT NULL,
  name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  total_amount integer NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  price_id uuid REFERENCES prices(id),
  quantity integer NOT NULL,
  unit_amount integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash text NOT NULL,
  artist_email text NOT NULL,
  artist_sms_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_stripe_id ON products(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_products_reserved_until ON products(reserved_until);
CREATE INDEX IF NOT EXISTS idx_products_visible_sold ON products(visible, is_sold);
CREATE INDEX IF NOT EXISTS idx_prices_stripe_id ON prices(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Products policies (public read for visible items)
CREATE POLICY "Anyone can view visible products"
  ON products FOR SELECT
  USING (visible = true);

CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Prices policies (public read)
CREATE POLICY "Anyone can view prices"
  ON prices FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage prices"
  ON prices FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Customers policies (own data only)
CREATE POLICY "Users can view own customer data"
  ON customers FOR SELECT
  TO authenticated
  USING (auth.jwt()->>'email' = email);

CREATE POLICY "Service role can manage customers"
  ON customers FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Orders policies (own orders only)
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = orders.customer_id
      AND customers.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Service role can manage orders"
  ON orders FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Order items policies (own order items only)
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN customers ON customers.id = orders.customer_id
      WHERE orders.id = order_items.order_id
      AND customers.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Service role can manage order items"
  ON order_items FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Admin settings policies (service role only)
CREATE POLICY "Service role can manage admin settings"
  ON admin_settings FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');