-- Restore baseline menu items from src/app/data/menuItems.ts
-- Safe to run multiple times.
INSERT INTO menu_items (
  id,
  name,
  description,
  price,
  category,
  image_url,
  available,
  is_best_seller,
  is_new
)
VALUES
  ('espresso','Espresso','Rich and bold Italian espresso',2.50,'coffee','https://images.unsplash.com/photo-1645445644664-8f44112f334c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlc3ByZXNzbyUyMGNvZmZlZSUyMGN1cHxlbnwxfHx8fDE3NzI5OTMzNTd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('cappuccino','Cappuccino','Espresso with steamed milk and foam',3.50,'coffee','https://images.unsplash.com/photo-1667388363683-a07bbf0c84b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXBwdWNjaW5vJTIwbGF0dGUlMjBhcnR8ZW58MXx8fHwxNzczMDQ1MTk5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('latte','Caffe Latte','Smooth espresso with steamed milk',3.75,'coffee','https://images.unsplash.com/photo-1667388363683-a07bbf0c84b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXBwdWNjaW5vJTIwbGF0dGUlMjBhcnR8ZW58MXx8fHwxNzczMDQ1MTk5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('americano','Americano','Espresso with hot water',2.75,'coffee','https://images.unsplash.com/photo-1645445644664-8f44112f334c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlc3ByZXNzbyUyMGNvZmZlZSUyMGN1cHxlbnwxfHx8fDE3NzI5OTMzNTd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('flat-white','Flat White','Velvety microfoam with double espresso',3.60,'coffee','https://images.unsplash.com/photo-1667388363683-a07bbf0c84b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXBwdWNjaW5vJTIwbGF0dGUlMjBhcnR8ZW58MXx8fHwxNzczMDQ1MTk5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('mocha','Mocha','Chocolate espresso with steamed milk',4.00,'coffee','https://images.unsplash.com/photo-1667388363683-a07bbf0c84b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXBwdWNjaW5vJTIwbGF0dGUlMjBhcnR8ZW58MXx8fHwxNzczMDQ1MTk5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('english-breakfast','English Breakfast','Classic black tea blend',2.50,'tea','https://images.unsplash.com/photo-1513021644609-692e9ecb6b4f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdsaXNoJTIwYnJlYWtmYXN0JTIwdGVhfGVufDF8fHx8MTc3MzA2MzQwOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('earl-grey','Earl Grey','Bergamot-infused black tea',2.50,'tea','https://images.unsplash.com/photo-1513021644609-692e9ecb6b4f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdsaXNoJTIwYnJlYWtmYXN0JTIwdGVhfGVufDF8fHx8MTc3MzA2MzQwOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('green-tea','Green Tea','Light and refreshing green tea',2.50,'tea','https://images.unsplash.com/photo-1513021644609-692e9ecb6b4f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdsaXNoJTIwYnJlYWtmYXN0JTIwdGVhfGVufDF8fHx8MTc3MzA2MzQwOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('peppermint','Peppermint Tea','Refreshing herbal infusion',2.25,'tea','https://images.unsplash.com/photo-1513021644609-692e9ecb6b4f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdsaXNoJTIwYnJlYWtmYXN0JTIwdGVhfGVufDF8fHx8MTc3MzA2MzQwOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('croissant','Butter Croissant','Flaky French pastry',2.50,'food','https://images.unsplash.com/photo-1712723247648-64a03ba7c333?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcm9pc3NhbnQlMjBwYXN0cnl8ZW58MXx8fHwxNzcyOTg5ODEyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('pain-au-chocolat','Pain au Chocolat','Chocolate-filled croissant',3.00,'food','https://images.unsplash.com/photo-1712723247648-64a03ba7c333?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcm9pc3NhbnQlMjBwYXN0cnl8ZW58MXx8fHwxNzcyOTg5ODEyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('blueberry-muffin','Blueberry Muffin','Freshly baked with wild blueberries',2.75,'food','https://images.unsplash.com/photo-1607958996333-41aef7caefaa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibHVlYmVycnklMjBtdWZmaW58ZW58MXx8fHwxNzcyOTc2NzA0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('avocado-toast','Avocado Toast','Smashed avocado on sourdough',6.50,'food','https://images.unsplash.com/photo-1609158087148-3bae840bcfda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdm9jYWRvJTIwdG9hc3QlMjBicmVha2Zhc3R8ZW58MXx8fHwxNzczMDExODM3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('bacon-roll','Bacon Roll','Crispy bacon in a soft roll',4.50,'food','https://images.unsplash.com/photo-1609158087148-3bae840bcfda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdm9jYWRvJTIwdG9hc3QlMjBicmVha2Zhc3R8ZW58MXx8fHwxNzczMDExODM3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('sausage-roll','Sausage Roll','Traditional British sausage roll',3.50,'food','https://images.unsplash.com/photo-1712723247648-64a03ba7c333?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcm9pc3NhbnQlMjBwYXN0cnl8ZW58MXx8fHwxNzcyOTg5ODEyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',1,0,0),
  ('vanilla-milkshake','Vanilla Milkshake','Creamy vanilla milkshake topped with whipped cream',4.25,'milkshake','https://images.unsplash.com/photo-1582294867295-4e042a1a0ae1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',1,0,0),
  ('chocolate-milkshake','Chocolate Milkshake','Rich chocolate shake with chocolate syrup',4.50,'milkshake','https://images.unsplash.com/photo-1606312610503-0b845723c2fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',1,0,0),
  ('classic-mojito','Classic Mojito','Refreshing rum cocktail with mint and lime',7.00,'cocktail','https://images.unsplash.com/photo-1552960394-3559c5d35ee4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',1,0,0),
  ('cosmopolitan','Cosmopolitan','Vodka-based cocktail with cranberry and lime',7.50,'cocktail','https://images.unsplash.com/photo-1610849525687-b623924dd4eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',1,0,0)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  price = VALUES(price),
  category = VALUES(category),
  image_url = VALUES(image_url),
  available = VALUES(available),
  is_best_seller = VALUES(is_best_seller),
  is_new = VALUES(is_new);
