# ForwardDesk service (WhatsApp inbox + accounts API). Build: docker build -t forwarddesk-wa ./server
# Node 24 (>= 24.7) is required: passwords use node:crypto Argon2id.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npx tsc -p tsconfig.build.json

FROM node:24-alpine
ENV NODE_ENV=production PORT=8080 WA_DB_PATH=/data/wa.sqlite WA_MEDIA_DIR=/data/media FD_DB_PATH=/data/fd.sqlite
WORKDIR /app
# no runtime dependencies: node:http + node:sqlite only
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "dist/src/index.js"]
