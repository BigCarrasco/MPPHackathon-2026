FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY barra/package.json ./barra/package.json
RUN npm ci --omit=dev
COPY barra ./barra
RUN mkdir -p /app/barra/.data && chown -R node:node /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173
USER node
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "start"]
