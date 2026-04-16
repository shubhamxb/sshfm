# Development Guide

## Prerequisites

- Node.js 20+
- npm 9+
- An SSH server to connect to (can use localhost if you have SSH running)

## Setup

### Backend

```bash
cd backend
npm install
cp .env .env.local   # optionally customize
npm run dev          # nodemon for live reload
```

The backend runs on **http://localhost:6969**

```
GET  /api/health    → server status
POST /api/connect   → start SSH session
GET  /api/files     → list files
...
```

### Frontend

```bash
cd frontend
npm install
npm run dev     # Vite dev server with HMR
```

The frontend runs on **http://localhost:5173** and proxies `/api` calls to `:6969`.

## Testing the API

```bash
# Health check
curl http://localhost:6969/api/health

# Connect to SSH
curl -X POST http://localhost:6969/api/connect \
  -H "Content-Type: application/json" \
  -d '{"host":"192.168.1.1","port":22,"username":"user","password":"pass"}'
# Returns: { "sessionId": "..." }

# List files
curl "http://localhost:6969/api/files?sessionId=YOUR_SESSION_ID&path=/"
```

## Build for Production

```bash
# Build frontend
cd frontend && npm run build   # outputs to frontend/dist/

# Start backend (serves frontend static files)
cd backend && npm start
# App runs on http://localhost:6969
```

## Docker

```bash
# Build
docker build -t sshfm .

# Run
docker run -p 6969:6969 sshfm

# Compose
docker compose up --build
```

## Tips

- The backend uses in-memory sessions — restarting it clears all connections
- Upload size limit is 500MB (configurable in `backend/config.js`)
- Connection timeout is 15s (also in `config.js`)
- All console logs are structured and prefixed: `[SSH]`, `[SFTP]`, `[API]`
