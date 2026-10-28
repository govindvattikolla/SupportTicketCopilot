# SupportTicketCopilot

## SupportFlow — Customer Support Operations Platform

SupportFlow is a production-minded customer support operations platform designed for modern SaaS companies. It handles customer ticket intake, staff assignment, conversation threads (public replies vs. internal notes), SLA management, workload balancing, and operational analytics.

---

## Architecture Overview

SupportFlow uses a **Modular Monolith** architecture with strict layering:

```
Request 
  ──> Express Router
  ──> Security & Auth Middleware (Helmet, CORS, JWT Session)
  ──> Role-Based Authorization & Tenant Scoping
  ──> Request Validation (Zod Schemas)
  ──> Controller (HTTP parsing & standardized serialization)
  ──> Service Layer (pure business rules & transaction boundary)
  ──> Mongoose Model (typed schema, validation, tenant indexes)
  ──> Response ({ success: true, data: ... })
```

### Key Architectural Tenets:
1. **Multi-Tenant Isolation**: Every workspace-owned resource strictly enforces `workspaceId: req.user.workspaceId`. Workspace IDs supplied in client payloads are never trusted without active membership verification.
2. **Customer vs. Staff Isolation**: Customers access their tickets via an unguessable 32-byte cryptographic tracking token (`/track/:token`). Internal notes, staff assignments, and internal SLA configurations are strictly excluded from public responses.
3. **Fail-Safe Observability**: The `/api/health` endpoint reports the status of both the HTTP service and the database connection (`connected`, `degraded`, `disconnected`) without exposing credentials or internal connection strings.

---

## Project Structure

```
SupportTicketCopilot/
├── backend/
│   ├── src/
│   │   ├── config/             # Typed environment (Zod) and resilient DB connection
│   │   ├── middleware/         # Centralized error handler, auth, RBAC (in Phase 1)
│   │   ├── modules/
│   │   │   └── health/         # Health-check controller & route
│   │   ├── shared/             # Custom AppError classes and API response envelopes
│   │   ├── app.ts              # Express application factory (for server & test runner)
│   │   └── server.ts           # Server entrypoint with graceful shutdown
│   ├── tests/                  # Integration tests using Vitest + Supertest + In-Memory MongoDB
│   ├── .env.example            # Backend environment template
│   └── tsconfig.json           # Strict TypeScript configuration
│
├── frontend/
│   ├── src/
│   │   ├── api/                # Centralized typed API client
│   │   ├── App.tsx             # Telemetry & System Status Dashboard
│   │   ├── main.tsx            # React 18, TanStack Query, and React Router bootstrap
│   │   └── index.css           # Tailwind CSS directives
│   ├── .env.example            # Frontend environment template
│   ├── vite.config.ts          # Vite configuration with /api dev proxy
│   └── tailwind.config.js      # Tailwind design system configuration
│
├── .gitignore                  # Prevents committing secrets (.env), node_modules, build outputs
└── package.json                # Root npm workspaces configuration
```

---

## Getting Started

### Prerequisites
- **Node.js**: v20.x or higher (`node -v`)
- **npm**: v10.x or higher (`npm -v`)
- **MongoDB Atlas** account (or local MongoDB if available)

### 1. Installation
Install all dependencies across both `backend` and `frontend` using npm workspaces from the root folder:

```bash
npm install
```

### 2. Configure Environment Variables

#### Backend
Copy the example environment file:
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env` with your values:
```env
PORT=5000
NODE_ENV=development
# Replace with your MongoDB Atlas connection string:
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/supportflow?retryWrites=true&w=majority
CLIENT_URL=http://localhost:5173
```

> **Note on Testing**: Automated unit and integration tests (`npm test`) do **not** require an active MongoDB Atlas connection. They automatically spin up an isolated in-memory database using `mongodb-memory-server`.

#### Frontend
Copy the frontend environment file:
```bash
cp frontend/.env.example frontend/.env
```
Leave `VITE_API_URL` empty in development so Vite proxies `/api` calls directly to the local Express backend at `http://localhost:5000`.

---

## Development Scripts

Run all scripts from the repository root:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts both backend and frontend concurrently |
| `npm run dev:backend` | Starts Express backend in development mode with live reload (`tsx watch`) |
| `npm run dev:frontend` | Starts Vite React frontend development server (`http://localhost:5173`) |
| `npm run test` | Runs backend integration tests with Vitest and in-memory MongoDB |
| `npm run typecheck` | Runs strict TypeScript verification across backend and frontend |
| `npm run build` | Builds production artifacts for backend (`dist/`) and frontend (`dist/`) |

---

## Health Check Verification

The backend exposes a public health check endpoint:
```http
GET /api/health
```

**Response Format (200 OK when connected):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-10-27T11:15:00.000Z",
    "uptime": 42,
    "environment": "development",
    "service": "supportflow-api",
    "database": {
      "status": "connected",
      "healthy": true
    }
  }
}
```

If the database is not yet connected or is in the process of reconnecting, the endpoint accurately responds with `503 Service Unavailable` (or degraded) with `"status": "degraded"` and `"database": { "status": "disconnected", "healthy": false }`, avoiding crashes and keeping monitoring systems informed.
