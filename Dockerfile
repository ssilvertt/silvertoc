FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json tsconfig.json ./
RUN pnpm install --no-frozen-lockfile

COPY src ./src
RUN pnpm run build

FROM node:20-alpine AS runtime

WORKDIR /app

RUN corepack enable

COPY package.json ./
RUN pnpm install --prod --no-frozen-lockfile

COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]
