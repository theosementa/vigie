# syntax=docker/dockerfile:1
FROM node:26.13.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build number shown in the settings (CI passes the GitHub run number).
ARG BUILD_NUMBER=dev
ENV VITE_BUILD_NUMBER=$BUILD_NUMBER
# `preprod` renames the tab "Preprod Vigie" and swaps its icon for a yellow warning (see vite.config.ts).
ARG APP_ENV=production
ENV VITE_APP_ENV=$APP_ENV
RUN npm run build

FROM caddy:2.10.2-alpine
# Run as a non-root user. The caddy binary keeps cap_net_bind_service, so it can
# still bind 80/443. /data and /config are the volumes (certificates, state).
RUN addgroup -S caddy && adduser -S -G caddy -H caddy \
    && mkdir -p /data/caddy /config/caddy \
    && chown -R caddy:caddy /data /config
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
USER caddy
EXPOSE 80 443 443/udp
