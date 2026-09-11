# Worksuite frontend

React 18 · Vite · Tailwind · React Router. Talks to the NestJS API in [`../server`](../server).

```bash
npm install
npm run dev        # http://localhost:5173
```

Point it somewhere other than a local backend with `VITE_API_URL` in `.env.local`; without it
the default is `http://localhost:3001/api/v1`. The API has to be running — this is not a
standalone app and has no mock mode.

Sign-in accounts come from the backend's seed; see the [root README](../README.md).

## How data reaches a page

Pages import plain arrays — `import { clients } from "@/data/core"` — and read them
synchronously. They never see a fetch. Three files put the rows there:

- **[`src/lib/http.ts`](src/lib/http.ts)** — where the API is, how a request is authenticated,
  and what happens when the access token expires. One refresh at a time: a page load fires many
  requests, they all 401 together, and the server treats a reused refresh token as a stolen one,
  so a dozen parallel refreshes would revoke the session.
- **[`src/lib/adapters.ts`](src/lib/adapters.ts)** — one entry per collection saying where it
  lives on the API, how a server row becomes a page row, and how an edit becomes a request body.
  Relations flatten, `IN_PROGRESS` becomes `In Progress`, decimal strings become numbers.
- **[`src/lib/api.ts`](src/lib/api.ts)** — splices translated rows into those arrays, and turns
  `api.create / update / remove` into HTTP.

## Loading

Data is fetched **per route**. The shell loads only what it renders everywhere — the employee
directory, so a name can be put to an id in the sidebar, search and every list — and each screen
asks for its own the first time you open it.

[`src/lib/routeData.ts`](src/lib/routeData.ts) is derived from what the page components actually
import, so it cannot drift into lying about what a screen needs.
[`src/lib/useRouteData.ts`](src/lib/useRouteData.ts) sits in the app shell, which is why the
pages stay unaware of loading entirely. Revisiting a screen costs no requests, and anything the
signed-in account may not read is skipped rather than left to come back 403.

Tables that grow without bound — the audit trail, bank ledgers, payments, door-reader logs —
page against the server instead, through
[`src/lib/useServerRows.ts`](src/lib/useServerRows.ts).

## Writes

`api.create / update / remove` change the array first so the UI responds immediately, then send
the request. If the server refuses, the change is rolled back and the error surfaces as a toast.

Some records are **append-only** — an award given, a punch at a door, a salary band. The server
has no PATCH for those on purpose, so the app does not offer an Edit that cannot work.

## Realtime

[`src/lib/ws.ts`](src/lib/ws.ts) is one Socket.IO connection to the API's `/ws` namespace,
authenticated with the same access token as every HTTP request. Chat, presence, the virtual
office, meetings and the shared whiteboard all speak through it.
