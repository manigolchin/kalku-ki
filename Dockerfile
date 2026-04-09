# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with Node.js (for logging support via /api/log)
FROM node:20-alpine

WORKDIR /app

# Copy built assets + server
COPY --from=build /app/dist ./dist
COPY server.js .

EXPOSE 80

CMD ["node", "server.js"]
