# The app on Fly.io: one Node server that also runs research (the Agent SDK
# starts a Claude Code binary, so this needs a real container, not an edge runtime).
FROM node:24-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base
# Claude Code verifies TLS against the system store.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
# The committed library: seeds the database on the volume.
COPY --from=build /app/data/guides.json /app/data/no-oauth.json ./data/
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
