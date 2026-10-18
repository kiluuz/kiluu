FROM node:24-alpine

WORKDIR /app

ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_WATCH_PARTY_URL=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_WATCH_PARTY_URL=$NEXT_PUBLIC_WATCH_PARTY_URL

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/dubanix?sslmode=disable" DIRECT_URL="postgresql://build:build@localhost:5432/dubanix?sslmode=disable" npx prisma generate && npm run build
RUN npm ci --prefix mini-services/watch-party

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000 3003

CMD ["node", ".next/standalone/server.js"]
