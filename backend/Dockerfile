FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

# Data directory is mounted as a volume at runtime
# so crime-grid.json and lighting.json are injected without rebuilding
RUN mkdir -p ./src/data

EXPOSE 3001

CMD ["node", "src/index.js"]
