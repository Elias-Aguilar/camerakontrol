# Etapa 1: build de Vite (esbuild solo durante el build; sin servidor dev en runtime)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

# Inyectada en el bundle en build time (debe ser la URL que el navegador usa para el API).
ARG VITE_API_BASE=http://localhost:4000
ENV VITE_API_BASE=${VITE_API_BASE}

RUN npm run build

# Etapa 2: servir archivos estáticos (sin Vite/esbuild en ejecución)
FROM node:20-alpine AS runner

WORKDIR /app

RUN npm install -g serve@14

COPY --from=builder /app/dist ./dist

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
