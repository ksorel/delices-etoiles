# Image de base Node.js
FROM node:20-alpine

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY . .

# Installer les dépendances
RUN npm ci --only=production

# Exposer le port 3001
EXPOSE 3001

# Commande de démarrage
CMD ["npm", "start"]