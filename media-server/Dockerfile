FROM node:22-alpine

WORKDIR /app
COPY package.json index.js ./
COPY src ./src

ENV SD_PHONE_RELAY_HOST=0.0.0.0
ENV SD_PHONE_RELAY_PORT=30130
EXPOSE 30130

USER node
CMD ["node", "index.js"]
