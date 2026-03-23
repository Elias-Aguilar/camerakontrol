FROM node:20

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

CMD ["npm", "run", "start"]

