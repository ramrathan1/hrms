# Worksuite React

A front-end-only rebuild of the Worksuite admin app with its own visual identity, plus a
built-in **Mail** client and three collaboration modules. There is **no backend** — everything
runs in the browser on mock data.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (any email address signs you in)
```

That's the whole setup. No database, no API server, no environment variables.

## Where the data lives

All records start from the seed arrays in `src/data/*`. On boot, `hydrate()` in
[`src/lib/api.ts`](src/lib/api.ts) loads anything previously saved out of `localStorage` and
splices it into those same arrays, so every page keeps reading its plain imports.

Writes go through `api.create / update / replace / remove`, which mutate the shared array and
persist the result. Practical consequences:

- **Edits survive a refresh.** Create an invoice, reload, it's still there.
- **Nothing is shared.** The data is in one browser profile. Another person, another browser or
  a private window each see their own copy.
- **Clearing site data wipes it.** Use **Settings → Storage → Reset demo data** to put every
  collection back to what the app ships with (it also clears the audit trail).

## Mail

`/mail` is a full mail client: folder rail, conversation list and reading pane; threading,
stars, labels, bulk archive/delete, search across subject, participants and body; and a
composer with recipient validation, autocomplete, drafts, reply and reply-all.

`/mail/accounts` is where you connect a provider. The form captures exactly what a real client
needs — IMAP and SMTP host, port and security, username, password, signature — with one-click
presets for Gmail, Outlook, Yahoo, iCloud, Zoho and Fastmail, plus a step-by-step connection
test.

**Connections are simulated, and the app says so on the page.** IMAP and SMTP are raw TCP
protocols and a browser cannot open a socket, so a live mailbox needs a server-side bridge that
this build doesn't have. Your settings are validated and saved; the mailbox itself runs on the
demo data in `src/data/mail.ts`.

Every mailbox operation goes through [`src/lib/mail.ts`](src/lib/mail.ts). That file is the
seam: point it at a real mail bridge and the rest of the UI is unchanged.

## Collaboration modules

These were built against a realtime server. Without one they still work on their own, and each
says plainly what it can't do:

- **Virtual Office** (`/office`) — floors and rooms with simulated occupancy.
- **Meet** (`/meet`) — your own camera, mic, screen share, recording and a shared whiteboard.
  Remote participants need a signalling server, so you're always the only one in the room.
- **Communication** (`/chat`) — channels, DMs, threads and emoji reactions, persisted locally.
  A teammate replies automatically so a channel doesn't sit silent.

`src/lib/ws.ts` is a local in-process hub standing in for the old WebSocket connection — the
same message types, handled without a network.

## Design system

Glassmorphism over an aurora gradient (violet `#7C5CFF` → cyan `#4CC3FF` accent), translucent
blurred surfaces, **Sora** display + **Manrope** body type, rounded-2xl cards, soft violet
shadows. Tokens live in `src/styles.css` under `@theme` — change the palette in one place.

Component classes (`.card`, `.btn-*`, `.input`) sit inside `@layer components` so plain
utilities still beat them; without that, `hidden` loses to `.btn-primary` and responsive
visibility silently stops working.

The shell is responsive: the sidebar docks from `lg` up and becomes a drawer below it, and Mail
and Chat collapse from three panes to one on a phone.

## Layout

```
src/
  data/      seed records, one module per domain (mail.ts, core.ts, work.ts, …)
  lib/       api.ts (local store), mail.ts (mail engine), ws.ts (local hub), format, filters
  components/  shared UI — DataTable, FormKit, crud helpers, Kanban, Gantt, charts
  pages/     one folder per module
```

## Scripts

```bash
npm run dev       # dev server
npm run build     # typecheck + production build
npm run preview   # serve the built output
```
