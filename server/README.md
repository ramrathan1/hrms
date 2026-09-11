# Worksuite API

Modular monolith on NestJS 12 + Prisma 7 + PostgreSQL, backing the Worksuite frontend.

## Setup

Postgres and Redis must be reachable. Then:

```bash
cd server
npm install
cp .env.example .env      # set DATABASE_URL, and generate APP_ENCRYPTION_KEY:
                          #   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm run db:setup          # migrate + seed
npm run start:dev
```

- API: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api`
- Health: `http://localhost:3001/api/v1/health`

`db:setup` runs the initial migration and seeds one organization with six users,
one per role. All of them use the password `Password123!`:

| Role | Email |
|---|---|
| Owner | `owner@worksuite.demo` |
| Manager | `manager@worksuite.demo` |
| Team Leader | `lead@worksuite.demo` |
| HR | `hr@worksuite.demo` |
| Accountant | `accounts@worksuite.demo` |
| Employee | `employee@worksuite.demo` |

## How tenancy works

`Organization` is the tenant boundary. The chain is:

1. `TenantMiddleware` opens an `AsyncLocalStorage` scope for every request.
2. `JwtAuthGuard` verifies the access token and writes `organizationId`,
   `userId`, roles and permissions into that scope — **from the signed token
   only**. No header, query parameter or body field can influence it.
3. The Prisma client extension in `prisma.service.ts` reads the scope and
   injects `where: { organizationId }` on every read, stamps it on every write,
   and re-checks tenancy before any `update`/`delete` addressed by id.

Controllers and services never write a tenant filter themselves. A service that
forgets to extend `BaseCrudService` is still isolated, because the enforcement
sits underneath every caller.

Four scopes, declared in `infra/prisma/tenant-models.ts`:

| Scope | Filtered by | Examples |
|---|---|---|
| `GLOBAL` | nothing | `Permission`, `Organization` |
| `ORG` | `organizationId` | most tables |
| `USER` | `organizationId` + `userId` | `MailAccount`, `Notification`, `Todo` |
| `JOIN` | via parent | `TaskAssignee`, `ProjectMember`, `InvoiceItem` |

Two escape hatches exist and are deliberately verbose: `runUnscoped()` for the
genuinely cross-tenant reads (resolving a login before the tenant is known) and
`runWithTenantContext()` for background jobs, which have no request to derive a
context from.

## Auth

Access token (15 min) + refresh token (7 days), both JWT. bcrypt cost 10.

Refresh is **rotating with reuse detection**: each refresh token is single-use,
and presenting one that has already been rotated revokes the entire session
family rather than just failing the call — a rotated token in the wild means it
was captured. Only the SHA-256 of a refresh token is stored, so a database leak
yields no usable sessions.

## Authorization

`RolesGuard` is the coarse gate (role keys), `PermissionsGuard` the fine one
(`invoices:create`). Both are registered globally, so a new controller is
protected by default and must opt out with `@Public()`.

Permissions ride on the access token, so a check costs no database round trip.
The trade-off is that a permission change takes effect on the next refresh
(≤15 min); changing a user's roles bumps `tokensValidFrom`, which forces it
immediately.

## Modules

| Module | Endpoints | Business rules it owns |
|---|---|---|
| `auth` | register, login, refresh, logout, me, password | Rotating refresh with reuse detection |
| `rbac` | — (constants + seed) | 147 permissions, 7 system roles |
| `clients` | clients, contacts, statement | Delete refused while invoices reference the client |
| `crm` | leads, deals, pipeline stages | Lead → client conversion; terminal stages close deals |
| `projects` | projects, milestones, tasks, time logs | Budget burn; progress recomputed from tasks |
| `billing` | invoices, payments | Atomic payment; derived status; overpayment refused |
| `peopleops` | leave, attendance, shifts, holidays | Entitlement under a row lock; real attendance records |
| `recruitment` | jobs, applications, interviews, offers | Stage machine; offer acceptance creates the employee |
| `support` | tickets, replies | Public reply reopens a resolved ticket |
| `workplace` | assets, events, notices, knowledge, letters | Asset movement trail; letter merge snapshots |
| `files` | upload, download, usage | Active content forced to `attachment`; magic-number sniffing |
| `mail` | accounts, threads, send, sync | Encrypted credentials; SMTP/IMAP on a queue with retry |
| `collaboration` | channels, members, messages | Membership is the read boundary, not a UI filter |
| `realtime` | Socket.IO gateway at `/ws` | JWT on handshake; room-scoped fan-out; Redis-clustered |

## Files

Uploads go through `StorageService`, which today writes to `STORAGE_ROOT` on
local disk. `Attachment.storageKey` is opaque, so swapping in S3 means adding a
driver and changing nothing above that layer.

Security decisions worth knowing:

- The stored filename is a **UUID**, never the uploaded one. User-supplied names
  are the classic traversal and overwrite vector; the original lives on the row.
- Keys are partitioned `{organizationId}/{year}/{month}/`, and `resolve()`
  refuses any key that escapes the storage root.
- The **declared Content-Type is overridden** when the leading bytes say
  otherwise, so a payload cannot wear a harmless MIME type.
- Executable extensions are refused outright.
- On download, anything that could execute in a browser — SVG, HTML, XML — is
  served as `Content-Disposition: attachment` with `nosniff`, `X-Frame-Options:
  DENY` and a `default-src 'none'; sandbox` CSP. This closes the stored-XSS path
  the old frontend upload had, where an uploaded SVG ran as script on the app's
  own origin.

## Mail

`POST /mail/accounts` stores an IMAP/SMTP connection. The password is encrypted
with **AES-256-GCM** (`CryptoService`) under `APP_ENCRYPTION_KEY`, which lives in
the environment rather than the database — so a database leak yields nothing
usable. The API never returns it; responses carry `hasCredentials: true` instead.

`POST /mail/accounts/test` opens a real IMAP session and verifies the SMTP
transport, reporting each step. Library errors are translated: `EAUTH` becomes
"most providers require an app password", which is the actual cause the majority
of the time.

Sending and syncing both run on the **Bull `mail` queue**, never inline:

- `send-mail` — a message is written to Sent immediately so the UI has something
  to show, then handed to the worker. If SMTP ultimately refuses it, the final
  attempt moves it **back to Drafts** rather than leaving it in Sent claiming to
  have been delivered.
- `sync-mailbox` — incremental after the first run (`lastSyncAt`), capped per
  run, and idempotent: a message already stored under the same IMAP `externalUid`
  is skipped, so a re-run cannot duplicate a mailbox.

Jobs have no HTTP request, so every payload carries its `organizationId` and the
worker wraps execution in `runWithTenantContext()`. Without it the Prisma guard
refuses the query — which is the correct, loud failure.

## Realtime

Socket.IO at `ws://localhost:3001/ws`, clustered through Redis so rooms work
across instances. Two things the old in-browser hub got wrong are fixed here:

**Identity is not claimable.** The old hub accepted whatever `userId` a client
declared in a `hello` message. The socket is now authenticated from a JWT during
the handshake — no token, a forged token, an expired one or a refresh token used
as an access token are all refused and disconnected.

**Fan-out is scoped to membership.** The old hub broadcast every message to every
socket and let the browser filter, so private channels and DMs were on the wire
for anyone connected. A socket now joins only the channel rooms it belongs to,
and membership is re-checked on every send.

Rooms are all prefixed by organization — `org:{id}`, `org:{id}:ch:{channelId}`,
`org:{id}:meet:{roomKey}` — so a broadcast cannot escape its tenant even if a
room id were guessed.

| Client sends | Server emits |
|---|---|
| `chat:send` `chat:react` `chat:typing` `chat:subscribe` | `chat:new` `chat:update` `chat:typing` |
| `office:move` | `office:occupancy` `presence` |
| `meet:join` `meet:leave` | `meet:peer-joined` `meet:peer-left` `wb:init` |
| `rtc:signal` | `rtc:signal` |
| `wb:stroke` `wb:clear` | `wb:stroke` `wb:clear` |
| `heartbeat` | `ready` `notification` `unauthorized` `error` |

WebRTC signalling is a relay only — offers, answers and ICE candidates are
forwarded verbatim to one named peer, and refused if that peer is in another
tenant. Media is peer-to-peer and never touches this process.

Presence lives in Redis, not process memory: with two instances, memory would
have each reporting only the people it happens to hold. Entries carry a TTL, so
a hard crash cannot leave ghosts online, and the presence list is per-person
rather than per-socket — two browser tabs are one person.

Whiteboard strokes are kept per meeting room in Redis (capped, 4-hour TTL) so a
late joiner gets `wb:init` with the board as it stands rather than a blank
canvas. Drawing and clearing both require being in the room.

**A socket that cannot establish its channel membership is refused**, rather than
held open with unknown authorization — the whole privacy model rests on
membership, so failing closed is the right default.

## Layout

```
src/
  common/      guards, decorators, DTOs, error types, the exception filter,
               and BaseCrudService (pagination / sort / search / audit)
  config/      validated environment contract
  infra/
    prisma/    PrismaService + the tenant extension + scope declarations
    tenant/    AsyncLocalStorage context and middleware
    cache/     Redis via cache-manager + keyv, tenant-prefixed keys
    queue/     Bull queue and job names
    storage/   object storage behind one interface (local disk today)
    crypto/    AES-256-GCM for secrets that must be readable back
  modules/     domain modules — auth, rbac, billing, health, …
```

## Scripts

```bash
npm run start:dev        # watch mode
npm run build            # compile
npm run typecheck        # tsc --noEmit
npm run prisma:generate  # regenerate the client after a schema change
npm run prisma:migrate   # create + apply a migration
npm run db:seed          # reseed
```

## Notes on versions

NestJS 12 is new enough that parts of the ecosystem have not caught up:

- `nestjs-pino` and `@nestjs/throttler` do not yet support `@nestjs/common@12`.
  Both are omitted rather than force-installed against a broken peer tree.
  Logging uses Nest's own logger; rate limiting is best added as a small
  Redis-backed guard when needed.
- The Nest CLI needs TypeScript 6 — 7.0 ships `tsc` without the programmatic
  compiler API it uses. Pinned to `typescript@^6`.
- Prisma 7 moved the connection URL out of `schema.prisma` into
  `prisma.config.ts`, and the runtime client takes a `pg` Pool through
  `@prisma/adapter-pg`. The generator is set to `moduleFormat = "cjs"` because
  Nest compiles to CommonJS and the default ESM output cannot be loaded.
