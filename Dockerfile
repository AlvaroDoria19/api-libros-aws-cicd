FROM node:22-alpine

WORKDIR /app

ARG APP_COMMIT_SHA=local
ENV NODE_ENV=production \
    PORT=3000 \
    APP_COMMIT_SHA=${APP_COMMIT_SHA}

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 3000
USER node

CMD ["node", "src/server.js"]
