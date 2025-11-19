-- ==========================================
-- SCHÉMA DÉLICES ÉTOILÉS - MVP MODERNE
-- ==========================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Utilisateurs
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'client',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Catégories plats
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_fr VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    description_fr TEXT,
    description_en TEXT,
    image_url VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plats
CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id),
    name_fr VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    description_fr TEXT NOT NULL,
    description_en TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT true,
    preparation_time INTEGER, -- minutes
    is_vegetarian BOOLEAN DEFAULT false,
    is_vegan BOOLEAN DEFAULT false,
    is_gluten_free BOOLEAN DEFAULT false,
    tags TEXT[], -- ['épicé', 'signature', 'nouveau']
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Catégories boissons
CREATE TABLE drink_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_fr VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_alcoholic BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Boissons
CREATE TABLE drinks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES drink_categories(id),
    name_fr VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    description_fr TEXT,
    description_en TEXT,
    price DECIMAL(10,2) NOT NULL,
    volume_ml INTEGER,
    alcohol_percentage DECIMAL(4,2),
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT true,
    serving_temperature VARCHAR(50), -- 'froid', 'ambiant', 'chambré'
    glass_type VARCHAR(100), -- 'flûte', 'verre à vin', 'tumbler'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tables restaurant
CREATE TABLE restaurant_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_number VARCHAR(10) UNIQUE NOT NULL,
    table_name_fr VARCHAR(100),
    table_name_en VARCHAR(100),
    capacity INTEGER NOT NULL,
    location VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commandes
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    table_id UUID REFERENCES restaurant_tables(id),
    order_type VARCHAR(20) DEFAULT 'dine_in', -- 'dine_in', 'takeaway'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'preparing', 'ready', 'completed'
    total_amount DECIMAL(10,2) NOT NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    special_instructions TEXT,
    estimated_completion_time TIMESTAMP,
    actual_completion_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items commande (plats)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    dish_id UUID REFERENCES dishes(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    customizations TEXT, -- JSON des personnalisations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items commande (boissons)
CREATE TABLE order_drink_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    drink_id UUID REFERENCES drinks(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    serving_notes TEXT, -- 'glace', 'citron', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Paiements
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    payment_method VARCHAR(50) NOT NULL, -- 'card', 'cash'
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    amount DECIMAL(10,2) NOT NULL,
    stripe_payment_intent_id VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'EUR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suivi commande
CREATE TABLE order_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    public_tracking_code VARCHAR(20) UNIQUE NOT NULL,
    qr_code_data TEXT,
    last_accessed_at TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historique statuts
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    status_message_fr TEXT,
    status_message_en TEXT,
    estimated_time INTEGER, -- minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    order_id UUID REFERENCES orders(id),
    type VARCHAR(50) NOT NULL, -- 'status_update', 'ready', 'payment'
    title_fr VARCHAR(200),
    title_en VARCHAR(200),
    message_fr TEXT,
    message_en TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- DONNÉES DE TEST HAUT DE GAMME
-- ==========================================

-- Utilisateurs
INSERT INTO users (email, password, first_name, last_name, role) VALUES
('admin@delices-etoiles.com', '$2b$10$examplehashedpassword', 'Antoine', 'Dubois', 'admin'),
('client@example.com', '$2b$10$examplehashedpassword', 'Sophie', 'Martin', 'client'),
('chef@delices-etoiles.com', '$2b$10$examplehashedpassword', 'Pierre', 'Leroux', 'chef');

-- Catégories plats
INSERT INTO categories (name_fr, name_en, display_order) VALUES
('Entrées', 'Starters', 1),
('Plats Principaux', 'Main Courses', 2),
('Desserts', 'Desserts', 3),
('Fromages', 'Cheese Selection', 4);

-- Plats gastronomiques
INSERT INTO dishes (category_id, name_fr, name_en, description_fr, description_en, price, preparation_time, tags) VALUES
((SELECT id FROM categories WHERE name_fr = 'Entrées'), 
 'Foie Gras Maison', 'House Foie Gras', 
 'Foie gras de canard mi-cuit, chutney de figues et pain d''épices', 
 'Duck foie gras semi-cooked, fig chutney and gingerbread', 28.00, 10, '{"signature", "fait maison"}'),
 
((SELECT id FROM categories WHERE name_fr = 'Plats Principaux'), 
 'Filet de Boeuf Rossini', 'Beef Fillet Rossini', 
 'Filet de boeuf charolais, foie gras poêlé, truffe noire, pommes soufflées', 
 'Charolais beef fillet, pan-seared foie gras, black truffle, souffled potatoes', 62.00, 25, '{"signature", "carte"}'),
 
((SELECT id FROM categories WHERE name_fr = 'Desserts'), 
 'Sphère Chocolat Grand Cru', 'Grand Cru Chocolate Sphere', 
 'Sphère de chocolat Guanaja 70%, cœur coulant caramel beurre salé', 
 'Guanaja 70% chocolate sphere, flowing salted butter caramel heart', 18.00, 8, '{"signature", "chocolat"}');

-- Catégories boissons
INSERT INTO drink_categories (name_fr, name_en, display_order, is_alcoholic) VALUES
('Vins Rouges', 'Red Wines', 1, true),
('Vins Blancs', 'White Wines', 2, true),
('Champagnes', 'Champagnes', 3, true),
('Cocktails Signature', 'Signature Cocktails', 4, true),
('Boissons Sans Alcool', 'Non-Alcoholic Drinks', 5, false);

-- Boissons sélection
INSERT INTO drinks (category_id, name_fr, name_en, description_fr, description_en, price, volume_ml, alcohol_percentage, serving_temperature) VALUES
((SELECT id FROM drink_categories WHERE name_fr = 'Vins Rouges'),
 'Château Margaux 2015', 'Château Margaux 2015', 
 'Grand Cru Classé - Margaux - Bordeaux', 
 'Grand Cru Classé - Margaux - Bordeaux', 450.00, 750, 13.5, 'chambré'),
 
((SELECT id FROM drink_categories WHERE name_fr = 'Champagnes'),
 'Dom Pérignon 2010', 'Dom Pérignon 2010',
 'Champagne brut - Notes de fruits blancs et pain grillé',
 'Brut champagne - White fruit and toasted bread notes', 280.00, 750, 12.5, 'très froid'),
 
((SELECT id FROM drink_categories WHERE name_fr = 'Cocktails Signature'),
 'Spritz Étoilé', 'Starry Spritz',
 'Prosecco, Aperol, soda club, zeste d''orange confit',
 'Prosecco, Aperol, club soda, candied orange zest', 18.00, 200, 11.0, 'froid');

-- Tables restaurant
INSERT INTO restaurant_tables (table_number, table_name_fr, table_name_en, capacity, location) VALUES
('T01', 'Table du Jardin', 'Garden Table', 2, 'terrasse'),
('T02', 'Table Romantique', 'Romantic Table', 2, 'salon'),
('T05', 'Table VIP', 'VIP Table', 6, 'salon_principal'),
('T08', 'Table Dégustation', 'Tasting Table', 4, 'salle_privée');

-- Commande exemple
INSERT INTO orders (order_number, user_id, table_id, total_amount, customer_name, status) VALUES
('CMD-2025-001', (SELECT id FROM users WHERE email = 'client@example.com'), 
 (SELECT id FROM restaurant_tables WHERE table_number = 'T05'), 156.00, 'Sophie Martin', 'preparing');

-- Items commande exemple
INSERT INTO order_items (order_id, dish_id, quantity, unit_price) VALUES
((SELECT id FROM orders WHERE order_number = 'CMD-2025-001'), 
 (SELECT id FROM dishes WHERE name_fr = 'Filet de Boeuf Rossini'), 2, 62.00);

INSERT INTO order_drink_items (order_id, drink_id, quantity, unit_price) VALUES
((SELECT id FROM orders WHERE order_number = 'CMD-2025-001'),
 (SELECT id FROM drinks WHERE name_fr = 'Spritz Étoilé'), 2, 18.00);

-- Suivi commande
INSERT INTO order_tracking (order_id, public_tracking_code) VALUES
((SELECT id FROM orders WHERE order_number = 'CMD-2025-001'), 'TRK-7B3D9F');

-- Historique statuts
INSERT INTO order_status_history (order_id, status, status_message_fr, status_message_en, estimated_time) VALUES
((SELECT id FROM orders WHERE order_number = 'CMD-2025-001'), 'confirmed', 'Commande confirmée', 'Order confirmed', 5),
((SELECT id FROM orders WHERE order_number = 'CMD-2025-001'), 'preparing', 'En préparation', 'Being prepared', 20);

-- Indexes performance
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_tracking_code ON order_tracking(public_tracking_code);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);

SELECT '✅ Schéma Délices Étoilés initialisé avec données de test!' as status;