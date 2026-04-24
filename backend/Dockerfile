FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

ENV DATABASE_URL=postgresql://camerakontrol:camerakontrol@db:5432/camerakontrol
ENV PORT=4000

RUN npx prisma generate
RUN npm run build

EXPOSE 4000

# Aplica migraciones en cada arranque y luego inicia el API (grabaciones usan ffmpeg)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

