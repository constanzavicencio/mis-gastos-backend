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

## Environment

Populate the following variables in `.env` before running the API:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (RDS in production). |
| `AUTH0_AUDIENCE` | Auth0 API audience used when validating JWTs. |
| `AUTH0_ISSUER_BASE_URL` | Auth0 tenant URL, e.g. `https://YOUR_DOMAIN/`. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins for your React Native app (optional, defaults to `*`). |

Regenerate the Prisma client and apply the initial migration whenever the schema changes:

```bash
npx prisma generate
npx prisma migrate deploy # or `prisma migrate dev` for local development
```

## API Overview

All application routes are served under `/api` and require a valid Auth0 access token. The middleware automatically provisions a user record (based on the token `sub`) if one does not exist.

### Users

- `GET /api/users/me` — returns the authenticated user profile.

### Categories & Subcategories

- `GET /api/categories` — list categories with nested subcategories.
- `POST /api/categories` — create a category (`name`, optional `type`, `color`, `icon`).
- `PUT /api/categories/:categoryId` — update category metadata.
- `DELETE /api/categories/:categoryId` — remove a category and related records.
- `POST /api/categories/:categoryId/subcategories` — create a subcategory.
- `PUT /api/categories/subcategories/:subcategoryId` — rename a subcategory.
- `DELETE /api/categories/subcategories/:subcategoryId` — delete a subcategory.

### Expenses & Budgets

- `GET /api/expenses` — list expenses with optional filters (`from`, `to`, `categoryId`, `subcategoryId`).
- `GET /api/expenses/:expenseId` — fetch a single expense.
- `POST /api/expenses` — record an expense (amount, occurredAt, optional category/subcategory and notes).
- `PUT /api/expenses/:expenseId` — update an expense.
- `DELETE /api/expenses/:expenseId` — remove an expense.
- `GET /api/budgets` — list configured budgets.
- `POST /api/budgets` — create a budget for a category or subcategory.
- `PUT /api/budgets/:budgetId` — update a budget.
- `DELETE /api/budgets/:budgetId` — delete a budget.
- `GET /api/budgets/summary?month=YYYY-MM` — compare actual spend vs. budget for a month.

### Income Streams & Subscriptions

Both resources share the same scheduling model (`FIXED_DATE`, `BUSINESS_DAY`, `DATE_RANGE`, `BUSINESS_DAY_RANGE`) and support active month restrictions.

- `GET /api/incomes`
- `POST /api/incomes`
- `PUT /api/incomes/:incomeId`
- `DELETE /api/incomes/:incomeId`
- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `PUT /api/subscriptions/:subscriptionId`
- `DELETE /api/subscriptions/:subscriptionId`

### Inventory Planning

- `GET /api/inventory` — list inventory items with consumption metrics and projected run-out dates.
- `POST /api/inventory` — create an inventory item (consumption per day, purchase size, reminder lead time, etc.).
- `GET /api/inventory/:itemId` — fetch an inventory item with purchases.
- `PUT /api/inventory/:itemId` — update an inventory item.
- `DELETE /api/inventory/:itemId` — remove an inventory item.
- `GET /api/inventory/:itemId/purchases` — list purchases for an item.
- `POST /api/inventory/:itemId/purchases` — record a purchase event (quantity, cost, date).

### Planning & Reminders

- `GET /api/planner/upcoming?days=60&include=incomes,subscriptions,inventory` — consolidated timeline of upcoming income events, subscription charges, and inventory reminders/run-out dates inside the specified window.

### Public & Health Endpoints

- `GET /` — health check (public).
- `GET /public` — sample public route.
- `GET /protected` — sample protected route showing the authenticated user and recent sign-ins.
