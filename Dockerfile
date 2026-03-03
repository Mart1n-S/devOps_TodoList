# Image de base alpine
FROM node:25-alpine3.22

# Définition du dossier de travail dans le conteneur
WORKDIR /usr/src/app

# Copie uniquement des fichiers de dépendances en premier (optimisation du cache Docker)
COPY package*.json ./

# Installation stricte pour la production
RUN npm ci --only=production

# Copie du reste du code de l'application
COPY . .

# On change d'utilisateur.
USER node

# On expose le port sur lequel l'app écoute
EXPOSE 3000

# Commande de démarrage
CMD ["npm", "start"]