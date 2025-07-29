FROM node:20-alpine

WORKDIR /app

# Copy files
COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .

# Generate Prisma client & build TS
RUN pnpm exec prisma generate
RUN pnpm run build

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/status || exit 1

CMD ["pnpm", "start"]
