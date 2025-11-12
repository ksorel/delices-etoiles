# 🍽️ Délices Étoiles - Application Restaurant

Application web et mobile moderne pour la gestion des réservations et commandes du restaurant Délices Étoiles.

## 🚀 Fonctionnalités

- 📅 Système de réservations en ligne
- 📱 Commandes via QR code
- 💳 Paiements intégrés
- 🌍 Interface multilingue
- 📊 Dashboard administrateur

## 🛠️ Technologies

- **Backend**: Node.js, Express.js, PostgreSQL
- **Frontend Web**: React.js, TypeScript
- **Mobile**: React Native
- **Base de données**: PostgreSQL
- **Conteneurisation**: Docker

## 📦 Installation

### Prérequis
- Docker et Docker Compose
- Node.js 18+ (pour le développement)

### Démarrage rapide

```bash
# Cloner le projet
git clone https://github.com/ksorel/delices-etoiles.git
cd delices-etoiles

# Copier le fichier d'environnement
cp .env.example .env

# Démarrer avec Docker
docker-compose up -d