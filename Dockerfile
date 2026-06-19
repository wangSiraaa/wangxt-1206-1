# syntax=docker/dockerfile:1.7

# ---- build stage: type-check + vite build ----
FROM node:26-slim AS build
WORKDIR /app
RUN npm install -g pnpm@10.33.0
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm build

# ---- runtime stage ----
FROM node:26-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@10.33.0
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --no-frozen-lockfile
COPY --from=build /app/dist-client ./dist-client
COPY api ./api
COPY shared ./shared
COPY migrations ./migrations
ENV PATH /app/node_modules/.bin:$PATH
RUN mkdir -p /app/data
EXPOSE 18506
CMD ["tsx", "api/server.ts"]
