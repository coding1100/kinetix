FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_BASE_PATH=
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_APP_URL=
ARG NEXT_PUBLIC_SOCKET_URL=

ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BASE_PATH=/staging

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=8 --start-period=30s \
  CMD node -e "require('http').get('http://127.0.0.1:3000/staging/auth/login', (r) => process.exit(r.statusCode >= 200 && r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
