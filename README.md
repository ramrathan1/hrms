# Worksuite

A business-management app: CRM, projects, invoicing, HR, recruitment, support, payroll,
an internal mail client, and realtime chat and meetings.

```
frontend/   React 18 · Vite · Tailwind · React Router
server/     NestJS 12 · Prisma 7 · PostgreSQL · Redis · Socket.IO
```

## Running it

Both halves run side by side. Postgres and Redis need to be reachable.

**Backend** — first time, set up the database:

```bash
cd server
npm install
cp .env.example .env        # set DATABASE_URL and generate APP_ENCRYPTION_KEY (see below)
npx prisma migrate deploy   # create the schema
npm run db:seed             # demo organisation, roles and records
npm run start:dev           # http://localhost:3001/api/v1  ·  docs at /api
```

**Frontend**, in a second terminal:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

The frontend reads `VITE_API_URL` and falls back to `http://localhost:3001/api/v1`, so it
works unconfigured against a local backend.

## Signing in

`npm run db:seed` creates one organisation and six accounts, one per role. The password for
all of them is `Password123!`:

| Account | Role | Sees |
| --- | --- | --- |
| `owner@worksuite.demo` | Owner | Everything |
| `manager@worksuite.demo` | Manager | Delivery, clients, the people on them |
| `hr@worksuite.demo` | HR | Hiring, attendance, leave, payroll |
| `accounts@worksuite.demo` | Accountant | Invoicing, payments, expenses, payroll |
| `lead@worksuite.demo` | Team Leader | One team's board and timesheets |
| `employee@worksuite.demo` | Employee | Own work, time and leave |

Roles are enforced on the server, not hidden in the nav: signing in as the accountant really
does get a 403 from `/employees`, and the app only requests what that role may read.

Change these before the app runs anywhere but a development machine.

## How the two halves fit together

Pages read plain arrays imported from `src/data/*`. An adapter layer in
[`frontend/src/lib/adapters.ts`](frontend/src/lib/adapters.ts) translates between those shapes
and the API's — relations, `SCREAMING_ENUM` statuses, decimals as strings — so the transport
lives in one place rather than smeared across seventy-odd page components.

Data is fetched per route rather than all at sign-in: the shell loads the directory it needs
everywhere, and each screen asks for its own the first time you open it. Writes are optimistic
and roll back if the server refuses.

## A note on secrets

`server/.env` holds the JWT signing secrets, the key that encrypts stored mail credentials,
and your database URL. It is gitignored and must stay that way. `server/.env.example`
documents what is needed. Generate a real encryption key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
