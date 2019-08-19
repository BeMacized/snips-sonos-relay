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
EXPOSE 8080
CMD ["node", "app.js"]
