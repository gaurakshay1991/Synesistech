FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm install --no-audit --no-fund

COPY . .
RUN npm run check

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    SYNESIS_PUBLIC_MODE=true

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/api ./api
COPY --from=build /app/server ./server
COPY --from=build /app/client/package.json ./client/package.json
COPY --from=build /app/client/dist ./client/dist

EXPOSE 3000

CMD ["npm", "start"]
