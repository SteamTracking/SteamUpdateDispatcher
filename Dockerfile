FROM node:25-alpine3.23 AS builder
WORKDIR /build-stage
COPY package*.json ./
RUN npm ci
COPY src/* ./

FROM alpine:3.23
WORKDIR /usr/src/app
RUN apk add --no-cache libstdc++ dumb-init \
  && addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node \
  && chown node:node ./
COPY --from=builder /usr/local/bin/node /usr/local/bin/
COPY --from=builder /usr/local/bin/docker-entrypoint.sh /usr/local/bin/
COPY config/config.example.yaml ./config/config.yaml
ENTRYPOINT ["docker-entrypoint.sh"]
VOLUME [ "/var/cache/steam-update-dispatcher" ]
USER node
COPY --from=builder /build-stage/ ./
CMD ["dumb-init", "node", "bot.mjs"]