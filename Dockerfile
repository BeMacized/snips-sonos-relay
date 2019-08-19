FROM node:12-alpine AS builder
WORKDIR /opt/app
COPY package.json .
COPY src src
COPY webpack.config.js .
COPY tsconfig.json .
RUN npm install
RUN npm run build

FROM node:12-alpine
COPY --from=builder /opt/app/dist /opt/app
WORKDIR /opt/app
RUN npm install --only=prod
CMD ["node", "app.js"]
