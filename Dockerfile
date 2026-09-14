FROM node:24.19.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
WORKDIR /app
COPY . .
ENV DEPLOY_TARGET=node
RUN npm run build:node

FROM node:24.19.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
# PORT is deliberately not pinned: Northflank does not inject it, so with it
# unset the launcher binds both 8080 and 3000 and whichever number the port
# entry uses reaches the app. Set PORT (or PORTS, comma-separated) to override.
COPY --from=build --chown=node:node /app/dist/standalone ./
USER node
EXPOSE 8080 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "const p=(process.env.PORTS||process.env.PORT||'8080').split(',')[0].trim();fetch('http://127.0.0.1:'+p+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "northflank-serve.mjs"]
