# Deployment checklist for Ubuntu hosting

## 1) Install system dependencies

```bash
sudo apt update
sudo apt install -y git curl ca-certificates docker.io docker-compose-plugin
```

If Node.js is not already installed, install it with:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2) Clone and configure the project

```bash
git clone https://github.com/yinsousdeyy-dot/multi-tenant-hybrid-search-engine.git
cd multi-tenant-hybrid-search-engine
cp .env.example .env
```

Edit `.env` and replace the placeholder OpenAI key with your actual key. Keep the database URL aligned with your deploy setup.

## 3) Start with Docker Compose

```bash
docker compose up -d --build
```

This starts:
- PostgreSQL with pgvector enabled
- the application on port 3000

## 4) Check health

```bash
curl http://localhost:3000/health
```

You should receive a JSON response like:

```json
{"status":"ok"}
```

## 5) Test the API

Insert a tenant-scoped document:

```bash
curl -X POST http://localhost:3000/api/documents \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Customer refund policy",
    "body": "Refunds are processed within 7 business days for eligible purchases.",
    "meta": {"category": "support"}
  }'
```

Search documents:

```bash
curl "http://localhost:3000/api/documents/search?q=refund+policy&bm25Weight=0.6" \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111'
```

## 6) If you want to run the app directly without Docker

From the repo root:

```bash
npm install
cp .env.example .env
npm start
```

## 7) Production notes

- Put `.env` outside the repo if you want stricter secrets management.
- Use a reverse proxy like Nginx or Caddy in front of port 3000.
- Consider a proper process manager such as systemd for long-lived Node services.
