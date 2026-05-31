# FlowMind

FlowMind is a full-stack web application with a Node.js backend, React frontend, PostgreSQL database, and Redis caching layer.

## Project Structure

```
flowmind/
├── backend/          # Node.js backend server
├── frontend/         # React + Vite frontend
├── electron/         # Electron desktop wrapper
├── migrations/       # Database migrations
│   └── init/         # Initial SQL scripts
├── docker-compose.yml
├── .dockerignore
└── .gitignore
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

1. **Start all services:**

   ```bash
   docker compose up -d
   ```

   This will start:
   - PostgreSQL on port `5432`
   - Redis on port `6379`
   - Backend on port `3000`
   - Frontend on port `5173`

2. **View logs:**

   ```bash
   docker compose logs -f
   ```

3. **Stop all services:**

   ```bash
   docker compose down
   ```

4. **Stop and remove volumes (clean state):**

   ```bash
   docker compose down -v
   ```

## Development

The development environment supports hot reloading for both frontend and backend services through Docker volume mounts.

### Environment Variables

| Variable       | Default               | Description          |
|----------------|-----------------------|----------------------|
| NODE_ENV       | development           | Node environment     |
| DB_HOST        | postgres              | Database host        |
| DB_PORT        | 5432                  | Database port        |
| DB_NAME        | flowmind              | Database name        |
| DB_USER        | dev                   | Database user        |
| DB_PASSWORD    | dev                   | Database password    |
| REDIS_HOST     | redis                 | Redis host           |
| REDIS_PORT     | 6379                  | Redis port           |
| VITE_API_URL   | http://localhost:3000 | Backend API URL      |

### Database Migrations

Initial SQL scripts placed in `migrations/init/` will be automatically executed on first database startup.

## Architecture

- **Backend**: Node.js with Express
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL 16 with pgvector extension
- **Cache**: Redis 7
