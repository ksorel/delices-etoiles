FROM node:20-alpine

# Arguments pour le cache
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

# Copier uniquement les fichiers de dépendances d'abord (optimisation cache)
COPY package*.json ./

# Installation des dépendances
RUN if [ "$NODE_ENV" = "development" ]; \
    then npm install; \
    else npm install --only=production; \
    fi

# Le code source sera monté via le volume
# COPY . .  ← SUPPRIMÉ car géré par le volume

EXPOSE 3001

CMD ["npm", "run", "dev"]