# The live demo's front door: the web app built for the live API, served by Caddy, which
# also proxies /api/* to the tenant API. Build from the repository root (see compose.prod.yaml).
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /src
COPY . .
RUN pnpm install --frozen-lockfile --filter web...
# Same origin as the API, so no CORS. Receipt extraction stays mocked (MSW): a public demo
# must not spend Anthropic credits on visitors' uploads.
ENV VITE_API_MODE=live \
    VITE_API_URL=/api/v1 \
    VITE_AI_MODE=mock
RUN pnpm --filter web exec vite build --base /

FROM caddy:2.10-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/apps/web/dist /srv
