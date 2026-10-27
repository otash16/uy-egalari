# Uy egalari doskasi — server + build qilingan sayt bitta konteynerda (SQLite /data/dev.db da).
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV DATABASE_URL=file:/data/dev.db
# Avval faqat paket fayllari — kod o'zgarganda install qayta yurmaydi
COPY server/package.json server/yarn.lock server/
COPY server/prisma server/prisma
COPY web/package.json web/yarn.lock web/
COPY agent/package.json agent/yarn.lock agent/
RUN yarn --cwd server install --frozen-lockfile && yarn --cwd web install --frozen-lockfile && yarn --cwd agent install --frozen-lockfile
COPY server server
COPY web web
COPY agent agent
RUN yarn --cwd web build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4100
EXPOSE 4100
CMD ["sh", "-c", "yarn --cwd server --silent db:deploy && yarn --cwd server --silent start"]
