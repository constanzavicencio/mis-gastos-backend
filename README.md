# Mis Gastos Backend (Express + TypeScript + Auth0 + Prisma + Docker)

This repo contains a starter Express backend in TypeScript prepared for use with Auth0 (JWT), Prisma (Postgres), and Docker for local development.

Quickstart (Windows PowerShell):

1. Copy environment variables:

   cp .env.example .env

2. Start Postgres with Docker Compose:

   docker-compose up -d

3. Install dependencies:

   npm install

4. Generate Prisma client and run migrations against the local DB:

   npx prisma generate
   npx prisma migrate dev --name init

5. Run in dev mode:

   npm run dev

Endpoints:
- GET /public — public endpoint
- GET /protected — protected endpoint, requires a valid access token issued for AUTH0_AUDIENCE

Notes:
- Fill the Auth0 values in `.env` (AUTH0_ISSUER_BASE_URL and AUTH0_AUDIENCE) to enable the JWT validation.
- This is a minimal starter; add error handling, logging, and proper CORS/origins for your React Native app.
