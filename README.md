# FlexFlow

<p align="center">
  <img src="brand/logo.png" alt="FlexFlow logo" width="340" />
</p>

A full-stack project management SaaS — plan projects, track tasks, manage permissions, and collaborate with your team in real time.

<p align="center">
  <img src="brand/cover-1920x1080.png" alt="FlexFlow cover" width="100%" />
</p>

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![Express](https://img.shields.io/badge/Express-4-grey?style=flat-square&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)
![Redis](https://img.shields.io/badge/Redis-7-dc382d?style=flat-square&logo=redis)
![Socket.io](https://img.shields.io/badge/Socket.io-realtime-black?style=flat-square&logo=socket.io)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)

---

## Brand

Brand assets (logo mark, lockup, favicon family, PWA icons, 1920×1080 cover) live in [`brand/`](./brand) and are wired into the app:

| Asset | Location |
| ----- | -------- |
| Favicon (`.ico` 16/32/48) | `apps/web/src/app/favicon.ico` |
| PWA icon 192 / 512 / maskable | `apps/web/public/icons/` |
| Apple touch icon (180) | `apps/web/public/icons/apple-touch-icon.png` |
| Web app manifest | `apps/web/public/manifest.webmanifest` |

The mark is an abstract "flowing streams" symbol — three tilted lanes converging into a forward arrow — built in the brand indigo palette (`#a5b4fc → #6366f1 → #4338ca`).

---

## Features

- **Authentication** — Email/password with 2FA (TOTP), plus **Google, GitHub, Slack, and Figma** OAuth (NextAuth v4, JWT sessions). One-click demo access when `DEMO_MODE=true`.
- **Onboarding** — Create a new organization or join an existing one via invite code.
- **Multi-organization** — Users belong to multiple organizations and switch between them from the sidebar.
- **Workspaces** — Each organization contains multiple workspaces with a built-in switcher.
- **Role-based access control** — Owner, Admin, Member, Viewer roles plus a configurable RBAC permission matrix, enforced at the API level.
- **Projects & tasks** — Full CRUD on projects and tasks: status, priority, assignee, due date, labels, and comments; drag-and-drop **Kanban** board with real-time updates over Socket.io.
- **Team management** — Invite members by email (EmailJS), update roles, remove members.
- **Analytics** — Velocity, workload distribution, cycle time, and summary metrics from real data.
- **Search** — Global search across projects, tasks, and members.
- **Dashboard** — Personalized overview: my tasks, project progress, recent activity, upcoming deadlines.
- **Notifications** — In-app notifications and web push (VAPID).
- **Integrations & automations** — Connect GitHub, Slack, and Figma; trigger-based automations; signed webhook ingestion.
- **Intelligence** — AI-assisted project summaries and insights.
- **Billing** — Plan-gated features with mock, Stripe, or Paystack providers and signed webhook handling.
- **Audit logs** — Organization-level audit trail of sensitive actions.
- **Settings** — Profile, organization, workspace, roles, integrations, billing, and audit-log screens.
- **Localization & theming** — 8 languages (EN, FR, ES, PT, DE, AR, ZH, JA) with RTL support and 7 curated themes.

---

## Tech Stack

| Layer         | Technology                                         |
| ------------- | -------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| Backend       | Express.js 4, Node.js 20                           |
| Database      | PostgreSQL 16 via Prisma ORM                       |
| Cache / Queue | Redis (optional)                                   |
| Auth          | NextAuth v4 (JWT strategy) + custom API auth       |
| Real-time     | Socket.io                                          |
| Email / Push  | EmailJS, Web Push (VAPID)                          |
| Billing       | Mock / Stripe / Paystack webhooks                  |
| Monorepo      | Turborepo + pnpm workspaces                        |
| Deployment    | Vercel (frontend) + Render (API + DB + Redis)      |

---

## Project Structure

```
flexflow/
├── apps/
│   ├── web/                  # Next.js 16 frontend
│   │   ├── public/
│   │   │   ├── icons/        # PWA icon set (192/512/maskable/apple-touch)
│   │   │   ├── manifest.webmanifest
│   │   │   └── sw.js
│   │   └── src/
│   │       ├── app/          # App Router pages
│   │       │   ├── (auth)/   # login, register, forgot/reset password
│   │       │   └── (app)/    # dashboard, projects, tasks, analytics, team,
│   │       │                 # intelligence, settings/*
│   │       ├── components/   # UI + layout components
│   │       ├── contexts/     # AppContext (org/workspace/auth state)
│   │       ├── i18n/         # Translations + theme/preference system
│   │       └── lib/          # API clients, auth options
│   └── api/                  # Express.js backend
│       ├── src/
│       │   ├── routes/       # auth, organizations, workspaces, projects, tasks,
│       │   │                 # team, roles, search, notifications, analytics,
│       │   │                 # audit, billing, intelligence, integrations, automations
│       │   ├── middleware/   # auth, RBAC, rate limit, usage, error handling
│       │   ├── services/     # billing, notifications, integrations, orchestration
│       │   ├── lib/          # Prisma client, Redis, realtime, security utils
│       │   └── config/       # Environment validation (Zod)
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.js
│       └── Dockerfile
├── brand/                    # Logo, favicon family, and 1920×1080 cover exports
├── packages/
│   ├── ui/                   # Shared component library
│   ├── plans/                # Plan/entitlement definitions
│   ├── eslint-config/
│   └── typescript-config/
├── tools/dev-db/             # Embedded PostgreSQL 16 for local dev (no Docker)
├── docker-compose.yml        # PostgreSQL + Redis for local dev
├── render.yaml               # Render service config (API)
├── vercel.json               # Vercel monorepo config
└── turbo.json                # Turborepo task pipeline
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker Desktop **or** the embedded Postgres in `tools/dev-db`

### 1. Clone and install

```bash
git clone https://github.com/Dev-Taofeek/Flexflow-site.git
cd Flexflow-site
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
INTERNAL_SECRET="must-match-apps-web-env"
CLIENT_ORIGIN="http://localhost:3000"

# Optional — email (EmailJS), web push (VAPID), billing (Paystack/Stripe)
EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@yourapp.com
BILLING_PROVIDER=mock
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=
DEMO_MODE=false
```

**`apps/web/.env.local` (minimum for local dev):**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET="local-dev-nextauth-secret-at-least-32-chars"
# MUST match INTERNAL_SECRET in apps/api/.env
INTERNAL_SECRET="must-match-apps-api-env"
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# OAuth providers (add credentials from each provider's dashboard)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_SLACK_ID=
AUTH_SLACK_SECRET=
AUTH_FIGMA_ID=
AUTH_FIGMA_SECRET=

# Site metadata
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Start the database

```bash
docker compose up -d
```

**No Docker?** Use the embedded PostgreSQL in `tools/dev-db` (persists data in `tools/dev-db/data`, matches `apps/api/.env` on `:5433`):

```bash
cd tools/dev-db
npm install        # first time only — pulls the Postgres 16 binaries
npm start          # starts the DB (foreground, Ctrl+C to stop)
npm stop           # stops it (or: npm run stop)
```

### 4. Run database migrations and seed

```bash
cd apps/api
pnpm prisma db push
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

## Testing

### Figma Sign-In (reviewer instructions)

1. Use a Figma account that is a member of the workspace the FlexFlow **Figma OAuth app** belongs to, and **sign out of Figma first** if you're signed into another account (Figma's account picker runs too late — otherwise the flow 404s with `OAuth app with client id … doesn't exist`).
2. Open `https://flexflow-one.vercel.app/login` → click **Continue with Figma**.
3. Allow access when prompted → you should land on the **Dashboard** as a newly auto-registered user.
4. Confirm the session persists across refresh, and that cancel/deny at Figma's consent screen returns you to the login page without creating a session.

**Prerequisite:** the redirect URI `https://flexflow-one.vercel.app/api/auth/callback/figma` must be registered on the Figma app, and `AUTH_FIGMA_ID`/`AUTH_FIGMA_SECRET` must be set in the environment.

### Automated tests

```bash
pnpm test          # web unit tests (Jest + Testing Library)
```

---

## API Reference

All protected routes require `Authorization: Bearer <access_token>`. Internal service-to-service calls use `x-internal-secret`.

### Auth — `/api/auth`

| Method | Path                 | Description                                    |
| ------ | -------------------- | ---------------------------------------------- |
| `POST` | `/register`          | Create account                                 |
| `POST` | `/login`             | Sign in (returns 2FA-required when applicable) |
| `POST` | `/refresh`           | Rotate access token                            |
| `POST` | `/oauth`             | Create a session from an OAuth provider        |
| `GET`  | `/me`                | Current user + their organizations             |
| `POST` | `/demo-credentials`  | Seeded demo account (only when `DEMO_MODE`)    |

### Organizations — `/api/organizations`

| Method   | Path                        | Description                               |
| -------- | --------------------------- | ----------------------------------------- |
| `GET`    | `/`                         | List user's organizations                 |
| `POST`   | `/`                         | Create organization (+ default workspace) |
| `GET`    | `/:id`                      | Get org with workspaces and members       |
| `PATCH`  | `/:id`                      | Update org name/description               |
| `DELETE` | `/:id`                      | Delete org (Owner only)                   |
| `POST`   | `/:id/invite`               | Send email invitation                     |
| `POST`   | `/join`                     | Join via invite token or org invite code  |

### Workspaces — `/api/workspaces`

| Method   | Path                    | Description                    |
| -------- | ----------------------- | ------------------------------ |
| `POST`   | `/`                     | Create workspace in an org     |
| `GET`    | `/:id`                  | Get workspace with members     |
| `PATCH`  | `/:id`                  | Update workspace               |
| `DELETE` | `/:id`                  | Delete workspace               |
| `POST`   | `/:id/members`          | Add org member to workspace    |
| `DELETE` | `/:id/members/:userId`  | Remove from workspace          |

### Projects & Tasks — `/api/projects`, `/api/tasks`

| Method   | Path                             | Description                              |
| -------- | -------------------------------- | ---------------------------------------- |
| `GET`    | `/projects?workspaceId=`          | List projects in workspace               |
| `POST`   | `/projects`                       | Create project                           |
| `GET`    | `/projects/:id`                   | Get project with tasks                   |
| `PATCH`  | `/projects/:id`                   | Update project                           |
| `DELETE` | `/projects/:id`                   | Delete project                           |
| `GET`    | `/tasks?workspaceId=`             | List tasks (with filters)                |
| `POST`   | `/tasks`                          | Create task                              |
| `GET`    | `/tasks/:id`                      | Task detail with comments and activity   |
| `PATCH`  | `/tasks/:id`                      | Update task fields                       |
| `PATCH`  | `/tasks/:id/status`               | Update status (emits Socket.io event)    |
| `POST`   | `/tasks/:id/comments`             | Add comment                              |

### Team, Roles & Analytics

| Method | Path                       | Description                              |
| ------ | -------------------------- | ---------------------------------------- |
| `GET`  | `/team?workspaceId=`       | Workspace members + pending invites      |
| `POST` | `/team/invite`             | Send workspace invitation email          |
| `PATCH`| `/team/members/:id/role`   | Update workspace member role             |
| `GET`  | `/roles?organizationId=`   | Role list and permission matrix          |
| `PUT`  | `/roles/:id`               | Update role permissions                  |
| `GET`  | `/analytics?workspaceId=`  | Velocity, workload, cycle time, summary  |
| `GET`  | `/dashboard?workspaceId=`  | My tasks, activity, progress, deadlines  |

### Profile — `/api/profile`

| Method   | Path                | Description                                              |
| -------- | ------------------- | -------------------------------------------------------- |
| `GET`    | `/`                 | Current user profile                                     |
| `PATCH`  | `/`                 | Update name, bio, avatar, timezone                        |
| `GET`    | `/:userId`          | Teammate-visible profile + roles in shared organizations  |
| `PATCH`  | `/password`         | Change password                                          |
| `POST`   | `/2fa/setup`        | Generate TOTP secret + QR code                           |
| `POST`   | `/2fa/verify`       | Enable 2FA                                               |
| `DELETE` | `/2fa`              | Disable 2FA                                              |

### Support routes

| Method | Path                      | Description                                   |
| ------ | ------------------------- | --------------------------------------------- |
| `GET`  | `/search?q=`              | Global search                                 |
| `GET`  | `/notifications`          | User notifications (+ unread count)           |
| `GET`  | `/audit?organizationId=`  | Organization audit log                        |
| `GET`  | `/billing/plan`           | Current plan and entitlements                 |
| `POST` | `/billing/webhook`        | Stripe/Paystack webhook (raw body, signed)    |
| `GET`  | `/intelligence/...`       | AI summaries and insights                     |
| `GET`  | `/integrations`           | Connected provider integrations               |
| `POST` | `/integrations/connect`   | Store a provider connection                   |
| `POST` | `/integrations/webhooks/*`| Signed inbound webhooks (GitHub/Slack/Figma)  |
| `GET`  | `/health`                 | Health check                                 |

---

## Frontend Routes

| Path                            | Access    | Description                      |
| ------------------------------- | --------- | -------------------------------- |
| `/`                             | Public    | Landing page                     |
| `/login`                        | Public    | Sign in                          |
| `/register`                     | Public    | Create account                   |
| `/forgot-password`              | Public    | Password reset request           |
| `/onboarding`                   | Auth      | Create or join an organization   |
| `/dashboard`                    | Protected | Workspace overview               |
| `/projects`                     | Protected | Project list with create form    |
| `/projects/[projectId]`         | Protected | Kanban board                     |
| `/projects/[projectId]/tasks/[taskId]` | Protected | Task detail              |
| `/tasks`                        | Protected | Assigned tasks                   |
| `/team`                         | Protected | Members + invite                 |
| `/analytics`                    | Protected | Charts and metrics               |
| `/intelligence`                 | Protected | AI insights                      |
| `/profile`                      | Protected | Your public profile + roles      |
| `/profile/[userId]`             | Protected | Teammate profile + shared roles  |
| `/settings/profile`             | Protected | User profile                     |
| `/settings/organization`        | Protected | Org settings + member management |
| `/settings/workspace`           | Protected | Workspace settings               |
| `/settings/roles`               | Protected | RBAC permission matrix           |
| `/settings/integrations`        | Protected | Connected integrations & automations |
| `/settings/billing`             | Protected | Plan and billing                 |
| `/settings/audit-logs`          | Protected | Audit trail                      |
| `/join?token=`                  | Public    | Accept invite link               |

---

## Deployment

### Vercel (frontend) + Render (API) — recommended

1. Push to GitHub — the [deploy workflow](.github/workflows/deploy.yml) builds and deploys `apps/web` to **Vercel** on every push to `main`.
2. **Render** — deploy `apps/api` using the included [`render.yaml`](./render.yaml) (Dockerfile + PostgreSQL/Redis).
3. Set environment variables on both platforms (see `.env.example` files).
4. Run `pnpm --filter @flexflow/api prisma:migrate:deploy` from the API host on first deploy.

### Environment variables

| App | File                  | Reference               |
| --- | --------------------- | ----------------------- |
| API | `apps/api/.env`       | `apps/api/.env.example` |
| Web | `apps/web/.env.local` | `apps/web/.env.example` |

**Must match between the two apps:** `INTERNAL_SECRET` (API ↔ web) and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (web) ↔ `VAPID_PUBLIC_KEY` (API).

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