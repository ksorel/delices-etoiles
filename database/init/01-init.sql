-- Script d'initialisation de la base Delices Etoiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'client',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des plats
CREATE TABLE IF NOT EXISTS dishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    image_url VARCHAR(500),
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertion de données de test
INSERT INTO users (email, password, first_name, last_name, role) VALUES
('admin@delices-etoiles.com', '$2b$10$examplehashedpassword', 'Admin', 'System', 'admin'),
('client@example.com', '$2b$10$examplehashedpassword', 'Jean', 'Dupont', 'client');

INSERT INTO dishes (name, description, price, category) VALUES
('Salade César', 'Salade fraîche avec poulet grillé et sauce césar', 12.50, 'entree'),
('Steak Frites', 'Steak de bœuf avec frites maison', 18.90, 'plat_principal'),
('Tiramisu', 'Dessert italien au café et mascarpone', 7.50, 'dessert');

-- Message de confirmation
DO $$ 
BEGIN
    RAISE NOTICE 'Base de données Delices Etoiles initialisée avec succès!';
END $$;