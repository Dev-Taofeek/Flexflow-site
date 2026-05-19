# FlexFlow

A full-stack project management SaaS — track issues, manage workspaces, and collaborate with your team in real time.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Express](https://img.shields.io/badge/Express-4-grey?style=flat-square&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)

---

## Features

- **Authentication** — Email/password registration and login with JWT. Google OAuth ready.
- **Onboarding** — Create a new organization or join an existing one via invite code.
- **Multi-organization** — Users can belong to multiple organizations and switch between them from the sidebar.
- **Workspaces** — Each organization contains multiple workspaces. Workspace switcher built in.
- **Role-based access control** — Owner, Admin, Member, Viewer roles enforced at the API level.
- **Projects** — Create and manage projects per workspace with visibility settings.
- **Kanban board** — Drag-and-drop issue board with real-time updates over Socket.io.
- **Issue tracking** — Full CRUD on issues: status, priority, assignee, due date, labels, comments.
- **Team management** — Invite members by email, update roles, remove members.
- **Analytics** — Velocity, workload distribution, cycle time, and summary metrics computed from real data.
- **Dashboard** — Personalized overview: my tasks, project progress, recent activity, upcoming deadlines.
- **Settings** — Organization profile, invite code, member management, workspace configuration.

---

## Tech Stack

| Layer         | Technology                                         |
| ------------- | -------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| Backend       | Express.js 4, Node.js 20                           |
| Database      | PostgreSQL 16 via Prisma ORM                       |
| Cache / Queue | Redis (optional)                                   |
| Auth          | NextAuth v4 (JWT strategy)                         |
| Real-time     | Socket.io                                          |
| Monorepo      | Turborepo + pnpm workspaces                        |
| Deployment    | Vercel (frontend) + Railway (API + DB + Redis)     |

---

## Project Structure

```
flexflow/
├── apps/
│   ├── web/                  # Next.js 16 frontend
│   │   ├── src/
│   │   │   ├── app/          # App Router pages
│   │   │   ├── components/   # UI + layout components
│   │   │   ├── contexts/     # AppContext (org/workspace/auth state)
│   │   │   ├── lib/          # API clients, auth options
│   │   │   └── middleware.js # Route protection (NextAuth withAuth)
│   │   └── package.json
│   └── api/                  # Express.js backend
│       ├── src/
│       │   ├── routes/       # auth, organizations, workspaces, projects, team, analytics
│       │   ├── middleware/   # authenticate, error handling
│       │   ├── lib/          # Prisma client, Redis client
│       │   └── config/       # Environment validation (Zod)
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.js
│       └── Dockerfile
├── packages/
│   ├── ui/                   # Shared component library
│   ├── eslint-config/
│   └── typescript-config/
├── docker-compose.yml        # PostgreSQL + Redis for local dev
├── vercel.json               # Vercel monorepo config
└── turbo.json                # Turborepo task pipeline
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker Desktop (for local PostgreSQL + Redis)

### 1. Clone and install

```bash
git clone https://github.com/Dev-Taofeek/Flexflow-site.git
cd flexflow
pnpm install
```

### 2. Configure environment variables

```bash
# Backend
cp apps/api/.env.example apps/api/.env

# Frontend
cp apps/web/.env.example apps/web/.env.local
```

Edit both files with your local values. The defaults work with the Docker setup below.

**`apps/api/.env` (minimum for local dev):**

```env
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://flexflow:flexflow_password@localhost:5432/flexflow?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET="local-dev-access-secret-at-least-32-chars"
JWT_REFRESH_SECRET="local-dev-refresh-secret-at-least-32-chars"
CLIENT_ORIGIN="http://localhost:3000"
```

**`apps/web/.env.local` (minimum for local dev):**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET="local-dev-nextauth-secret-at-least-32-chars"
```

### 3. Start the database

```bash
docker compose up -d
```

### 4. Run database migrations and seed

```bash
cd apps/api
pnpm prisma migrate dev --name init
pnpm db:seed
cd ../..
```

This creates the schema and seeds a demo account:

| Field    | Value               |
| -------- | ------------------- |
| Email    | `demo@flexflow.app` |
| Password | `Password123!`      |

### 5. Start the dev servers

```bash
pnpm dev
```

| Service       | URL                                                                 |
| ------------- | ------------------------------------------------------------------- |
| Frontend      | http://localhost:3000                                               |
| Backend API   | http://localhost:4000                                               |
| Prisma Studio | `pnpm --filter @flexflow/api prisma:studio` → http://localhost:5555 |

---

## API Reference

All protected routes require `Authorization: Bearer <access_token>`.

### Auth — `/api/auth`

| Method | Path        | Description                                                            |
| ------ | ----------- | ---------------------------------------------------------------------- |
| `POST` | `/register` | Create account → returns `{ user, accessToken, refreshToken }`         |
| `POST` | `/login`    | Sign in → returns `{ user, organizations, accessToken, refreshToken }` |
| `POST` | `/refresh`  | Exchange refresh token for new access token                            |
| `GET`  | `/me`       | Current user + their organizations                                     |

### Organizations — `/api/organizations`

| Method   | Path                        | Description                               |
| -------- | --------------------------- | ----------------------------------------- |
| `GET`    | `/`                         | List user's organizations                 |
| `POST`   | `/`                         | Create organization (+ default workspace) |
| `GET`    | `/:id`                      | Get org with workspaces and members       |
| `PATCH`  | `/:id`                      | Update org name/description               |
| `DELETE` | `/:id`                      | Delete org (Owner only)                   |
| `GET`    | `/:id/members`              | List members + pending invites            |
| `PATCH`  | `/:id/members/:userId/role` | Update member role                        |
| `DELETE` | `/:id/members/:userId`      | Remove member                             |
| `POST`   | `/:id/invite`               | Send email invitation                     |
| `POST`   | `/join`                     | Join via invite token or org invite code  |

### Workspaces — `/api/workspaces`

| Method   | Path                   | Description                             |
| -------- | ---------------------- | --------------------------------------- |
| `POST`   | `/`                    | Create workspace in an org              |
| `GET`    | `/:id`                 | Get workspace with members and projects |
| `PATCH`  | `/:id`                 | Update workspace                        |
| `DELETE` | `/:id`                 | Delete workspace                        |
| `POST`   | `/:id/members`         | Add org member to workspace             |
| `DELETE` | `/:id/members/:userId` | Remove from workspace                   |

### Projects — `/api/projects`

| Method   | Path                            | Description                                 |
| -------- | ------------------------------- | ------------------------------------------- |
| `GET`    | `/?workspaceId=`                | List projects in workspace                  |
| `POST`   | `/`                             | Create project                              |
| `GET`    | `/:id`                          | Get project with issues                     |
| `PATCH`  | `/:id`                          | Update project                              |
| `DELETE` | `/:id`                          | Delete project                              |
| `POST`   | `/:id/issues`                   | Create issue                                |
| `GET`    | `/:id/issues/:issueId`          | Get issue detail with comments and activity |
| `PATCH`  | `/:id/issues/:issueId`          | Update issue fields                         |
| `PATCH`  | `/:id/issues/:issueId/status`   | Update issue status (emits Socket.io event) |
| `POST`   | `/:id/issues/:issueId/comments` | Add comment                                 |

### Team — `/api/team`

| Method   | Path                        | Description                              |
| -------- | --------------------------- | ---------------------------------------- |
| `GET`    | `/?workspaceId=`            | List workspace members + pending invites |
| `POST`   | `/invite`                   | Send workspace invitation email          |
| `PATCH`  | `/members/:id/role`         | Update workspace member role             |
| `DELETE` | `/members/:id?workspaceId=` | Remove workspace member                  |

### Dashboard & Analytics — `/api/dashboard`, `/api/analytics`

| Method | Path                      | Description                                     |
| ------ | ------------------------- | ----------------------------------------------- |
| `GET`  | `/dashboard?workspaceId=` | My tasks, activity, project progress, deadlines |
| `GET`  | `/analytics?workspaceId=` | Velocity, workload, cycle time, summary         |

---

## Frontend Routes

| Path                              | Access    | Description                      |
| --------------------------------- | --------- | -------------------------------- |
| `/`                               | Public    | Landing page                     |
| `/login`                          | Public    | Sign in                          |
| `/register`                       | Public    | Create account                   |
| `/forgot-password`                | Public    | Password reset request           |
| `/onboarding`                     | Auth      | Create or join an organization   |
| `/dashboard`                      | Protected | Workspace overview               |
| `/projects`                       | Protected | Project list with create form    |
| `/projects/[id]`                  | Protected | Kanban board                     |
| `/projects/[id]/issues/[issueId]` | Protected | Issue detail                     |
| `/issues`                         | Protected | My assigned issues               |
| `/team`                           | Protected | Members + invite                 |
| `/analytics`                      | Protected | Charts and metrics               |
| `/settings/profile`               | Protected | User profile                     |
| `/settings/organization`          | Protected | Org settings + member management |
| `/settings/workspace`             | Protected | Workspace settings               |
| `/settings/roles`                 | Protected | RBAC permission matrix           |
| `/join?token=`                    | Public    | Accept invite link               |

---

## Deployment

### Vercel + Railway (recommended)

See the full deployment guide in [DEPLOYMENT.md](./DEPLOYMENT.md) or follow the summary:

1. Push to GitHub
2. **Railway** — deploy `apps/api` using the Dockerfile; provision PostgreSQL and Redis services
3. **Vercel** — deploy `apps/web`; set root directory to `apps/web`
4. Set environment variables in both platforms (see `.env.example` files)
5. Run `pnpm prisma migrate deploy` from the Railway shell on first deploy

### Environment variables

| App | File                  | Reference               |
| --- | --------------------- | ----------------------- |
| API | `apps/api/.env`       | `apps/api/.env.example` |
| Web | `apps/web/.env.local` | `apps/web/.env.example` |

---

## Development Scripts

```bash
# Run all services (frontend + backend)
pnpm dev

# Run only frontend
pnpm --filter web dev

# Run only backend
pnpm --filter @flexflow/api dev

# Database
pnpm --filter @flexflow/api prisma:migrate   # Create migration
pnpm --filter @flexflow/api prisma:studio    # Open Prisma Studio
pnpm --filter @flexflow/api db:seed          # Seed demo data

# Build
pnpm build
```

---

## License

MIT
