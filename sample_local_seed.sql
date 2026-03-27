-- Sample data for local development only. DO NOT RUN IN PRODUCTION!

-- Insert sample admin and super admin passwords (plaintext for local/dev only)
INSERT INTO app_settings (setting_key, setting_value)
VALUES
  ('security.admin_pass', 'admin1234'),
  ('security.super_admin_pass', 'j12345678A')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Insert sample menu items
INSERT INTO menu_items (id, name, description, price, category, image_url, is_best_seller, is_new, available)
VALUES
  ('coffee-1', 'Espresso', 'Strong and bold espresso shot', 3.00, 'coffee', NULL, true, false, true),
  ('coffee-2', 'Cappuccino', 'Espresso with steamed milk and foam', 3.50, 'coffee', NULL, false, true, true),
  ('tea-1', 'Green Tea', 'Refreshing green tea', 2.50, 'tea', NULL, false, false, true),
  ('food-1', 'Croissant', 'Buttery French pastry', 2.00, 'food', NULL, false, false, true);

-- Insert sample cafe table
INSERT INTO cafe_tables (id, table_number, qr_token, active)
VALUES ('table-1', 1, 'sampletoken1', true)
ON DUPLICATE KEY UPDATE qr_token = VALUES(qr_token);
