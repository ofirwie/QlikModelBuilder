-- Olist E-commerce Database Schema
-- For QlikModelBuilder Testing

-- Drop tables if exist (in reverse dependency order)
DROP TABLE IF EXISTS olist_order_reviews CASCADE;
DROP TABLE IF EXISTS olist_order_payments CASCADE;
DROP TABLE IF EXISTS olist_order_items CASCADE;
DROP TABLE IF EXISTS olist_orders CASCADE;
DROP TABLE IF EXISTS olist_products CASCADE;
DROP TABLE IF EXISTS olist_sellers CASCADE;
DROP TABLE IF EXISTS olist_customers CASCADE;
DROP TABLE IF EXISTS olist_geolocation CASCADE;
DROP TABLE IF EXISTS product_category_name_translation CASCADE;

-- ============================================
-- DIMENSION TABLES
-- ============================================

-- Category Translation (lookup table)
CREATE TABLE product_category_name_translation (
    product_category_name VARCHAR(100) PRIMARY KEY,
    product_category_name_english VARCHAR(100)
);

-- Geolocation
CREATE TABLE olist_geolocation (
    geolocation_zip_code_prefix VARCHAR(10),
    geolocation_lat DECIMAL(10, 8),
    geolocation_lng DECIMAL(11, 8),
    geolocation_city VARCHAR(100),
    geolocation_state VARCHAR(2)
);

CREATE INDEX idx_geolocation_zip ON olist_geolocation(geolocation_zip_code_prefix);

-- Customers
CREATE TABLE olist_customers (
    customer_id VARCHAR(50) PRIMARY KEY,
    customer_unique_id VARCHAR(50),
    customer_zip_code_prefix VARCHAR(10),
    customer_city VARCHAR(100),
    customer_state VARCHAR(2)
);

CREATE INDEX idx_customers_zip ON olist_customers(customer_zip_code_prefix);

-- Sellers
CREATE TABLE olist_sellers (
    seller_id VARCHAR(50) PRIMARY KEY,
    seller_zip_code_prefix VARCHAR(10),
    seller_city VARCHAR(100),
    seller_state VARCHAR(2)
);

CREATE INDEX idx_sellers_zip ON olist_sellers(seller_zip_code_prefix);

-- Products
CREATE TABLE olist_products (
    product_id VARCHAR(50) PRIMARY KEY,
    product_category_name VARCHAR(100),
    product_name_lenght INTEGER,
    product_description_lenght INTEGER,
    product_photos_qty INTEGER,
    product_weight_g INTEGER,
    product_length_cm INTEGER,
    product_height_cm INTEGER,
    product_width_cm INTEGER
);

CREATE INDEX idx_products_category ON olist_products(product_category_name);

-- ============================================
-- FACT TABLES
-- ============================================

-- Orders (central fact table)
CREATE TABLE olist_orders (
    order_id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50),
    order_status VARCHAR(20),
    order_purchase_timestamp TIMESTAMP,
    order_approved_at TIMESTAMP,
    order_delivered_carrier_date TIMESTAMP,
    order_delivered_customer_date TIMESTAMP,
    order_estimated_delivery_date TIMESTAMP
);

CREATE INDEX idx_orders_customer ON olist_orders(customer_id);
CREATE INDEX idx_orders_status ON olist_orders(order_status);
CREATE INDEX idx_orders_purchase_date ON olist_orders(order_purchase_timestamp);

-- Order Items
CREATE TABLE olist_order_items (
    order_id VARCHAR(50),
    order_item_id INTEGER,
    product_id VARCHAR(50),
    seller_id VARCHAR(50),
    shipping_limit_date TIMESTAMP,
    price DECIMAL(10, 2),
    freight_value DECIMAL(10, 2),
    PRIMARY KEY (order_id, order_item_id)
);

CREATE INDEX idx_order_items_product ON olist_order_items(product_id);
CREATE INDEX idx_order_items_seller ON olist_order_items(seller_id);

-- Order Payments
CREATE TABLE olist_order_payments (
    order_id VARCHAR(50),
    payment_sequential INTEGER,
    payment_type VARCHAR(30),
    payment_installments INTEGER,
    payment_value DECIMAL(10, 2),
    PRIMARY KEY (order_id, payment_sequential)
);

-- Order Reviews
CREATE TABLE olist_order_reviews (
    review_id VARCHAR(200) PRIMARY KEY,
    order_id VARCHAR(50),
    review_score INTEGER,
    review_comment_title TEXT,
    review_comment_message TEXT,
    review_creation_date TIMESTAMP,
    review_answer_timestamp TIMESTAMP
);

CREATE INDEX idx_reviews_order ON olist_order_reviews(order_id);
CREATE INDEX idx_reviews_score ON olist_order_reviews(review_score);
