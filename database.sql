-- Tawla Scan Cafe Database Schema
-- Complete database for restaurant ordering system

-- Create database
CREATE DATABASE IF NOT EXISTS tawla_scan;
USE tawla_scan;

-- Table for menu items
CREATE TABLE menu_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  image_url VARCHAR(500),
  is_best_seller BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT false,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table for orders
CREATE TABLE orders (
  id VARCHAR(50) PRIMARY KEY,
  order_number INT NOT NULL AUTO_INCREMENT UNIQUE,
  total DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'preparing', 'ready', 'completed') DEFAULT 'pending',
  table_number INT NULL,
  payment_method VARCHAR(50) NULL,
  payment_provider VARCHAR(50) NULL,
  payment_reference VARCHAR(120) NULL,
  payment_status VARCHAR(50) NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_table_number (table_number),
  INDEX idx_payment_reference (payment_reference),
  INDEX idx_timestamp (timestamp)
);

-- Table registry for QR-based ordering
CREATE TABLE cafe_tables (
  id VARCHAR(50) PRIMARY KEY,
  table_number INT NOT NULL UNIQUE,
  qr_token VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_table_registry_number (table_number)
);

-- Table for order items (line items in an order)
CREATE TABLE order_items (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  menu_item_id VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  INDEX idx_order_id (order_id)
);

-- Table for offers/bundles
CREATE TABLE offers (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'percentage',
  value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description VARCHAR(255) NOT NULL,
  image_url VARCHAR(500),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table for offer items (which menu items are in an offer)
CREATE TABLE offer_items (
  id VARCHAR(50) PRIMARY KEY,
  offer_id VARCHAR(50) NOT NULL,
  menu_item_id VARCHAR(50) NOT NULL,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  INDEX idx_offer_id (offer_id),
  INDEX idx_offer_menu_item (menu_item_id),
  UNIQUE KEY uq_offer_item_pair (offer_id, menu_item_id)
);

-- Table for bundles & combos
CREATE TABLE bundles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(500),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table for items included in a bundle/combo
CREATE TABLE bundle_items (
  id VARCHAR(50) PRIMARY KEY,
  bundle_id VARCHAR(50) NOT NULL,
  menu_item_id VARCHAR(50) NOT NULL,
  FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  INDEX idx_bundle_id (bundle_id),
  INDEX idx_bundle_menu_item (menu_item_id),
  UNIQUE KEY uq_bundle_item_pair (bundle_id, menu_item_id)
);

-- Table for global app settings and security config
CREATE TABLE app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table for menu change history (audit log)
CREATE TABLE menu_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_type VARCHAR(40) NOT NULL,
  menu_item_id VARCHAR(50) NOT NULL,
  menu_item_name VARCHAR(255) NOT NULL,
  changed_fields TEXT,
  previous_values TEXT,
  new_values TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_menu_audit_created_at (created_at),
  INDEX idx_menu_audit_item_id (menu_item_id)
);

-- Insert sample menu items
INSERT INTO menu_items (id, name, description, price, category, available) VALUES
('coffee-1', 'Espresso', 'Strong single shot of espresso', 2.50, 'coffee', true),
('coffee-2', 'Americano', 'Espresso with hot water', 3.00, 'coffee', true),
('coffee-3', 'Cappuccino', 'Espresso with steamed milk and foam', 3.50, 'coffee', true),
('coffee-4', 'Latte', 'Espresso with steamed milk', 3.50, 'coffee', true),
('tea-1', 'Green Tea', 'Fresh green tea', 2.00, 'tea', true),
('tea-2', 'Black Tea', 'Traditional black tea', 2.00, 'tea', true),
('milkshake-1', 'Vanilla Milkshake', 'Creamy vanilla milkshake', 4.00, 'milkshake', true),
('milkshake-2', 'Chocolate Milkshake', 'Rich chocolate milkshake', 4.00, 'milkshake', true),
('cocktail-1', 'Mojito', 'Fresh mint and rum cocktail', 6.00, 'cocktail', true),
('cocktail-2', 'Margarita', 'Classic tequila cocktail', 6.00, 'cocktail', true),
('food-1', 'Croissant', 'Buttery french croissant', 3.50, 'food', true),
('food-2', 'Sandwich', 'Club sandwich with ham and cheese', 5.50, 'food', true),
('food-3', 'Pasta', 'Spaghetti carbonara', 7.50, 'food', true);

-- Insert sample cafe tables for QR ordering
INSERT INTO cafe_tables (id, table_number, qr_token, active) VALUES
('table-1', 1, 'table-1', true),
('table-2', 2, 'table-2', true),
('table-3', 3, 'table-3', true),
('table-4', 4, 'table-4', true),
('table-5', 5, 'table-5', true),
('table-6', 6, 'table-6', true),
('table-7', 7, 'table-7', true),
('table-8', 8, 'table-8', true),
('table-9', 9, 'table-9', true),
('table-10', 10, 'table-10', true),
('table-11', 11, 'table-11', true),
('table-12', 12, 'table-12', true);
