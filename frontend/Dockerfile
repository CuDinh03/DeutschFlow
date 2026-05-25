# ============================================================
# Stage 1 — Dependencies: cài npm packages
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Chỉ copy package files để tận dụng Docker layer cache
COPY package.json package-lock.json* ./
# Cài TẤT CẢ dependencies (bao gồm devDependencies như tailwindcss, postcss)
# vì chúng cần thiết trong build stage. Runtime stage sẽ KHÔNG copy node_modules này.
RUN npm ci

# ============================================================
# Stage 2 — Build: compile Next.js app
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Biến build-time (không chứa secret - chỉ public vars)
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

# PostHog Analytics
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL=$NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL

# Build Next.js với standalone output (mode này tạo ra bundle tự đủ,
# không cần node_modules đầy đủ khi chạy → image runtime nhỏ hơn ~70%)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================================
# Stage 3 — Runtime: chỉ copy những gì cần thiết
# ============================================================
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (tất cả gói vào 1 thư mục nhỏ gọn)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Next.js standalone server
CMD ["node", "server.js"]
