/**
 * The realtime connection.
 *
 * One Socket.IO connection to the API's `/ws` namespace, authenticated with the
 * same access token as every HTTP request. Chat, Virtual Office, Meet and the
 * whiteboard all speak through it.
 *
 * The vocabulary here (`wsc.on("chat:new")`, `wsc.send({ type: "chat:send" })`)
 * is the one those pages already use, so this file translates between it and
 * the gateway's event names and payload shapes. That keeps the translation in
 * one place instead of spreading socket details through seven components.
 */
import { io, type Socket } from "socket.io-client";

import { API_BASE, tokens } from "./http";
import { asEmployee } from "./adapters";

/** Realtime is real now. Screens no longer need to disclaim simulated peers. */
export const isSimulated = false;

type Handler = (msg: any) => void;

export type PresenceEntry = {
  clientId: string;
  userId: string | null;
  name: string;
  officeRoom: string | null;
  meetRoom: string | null;
};

/** ".../api/v1" → "..." — Socket.IO connects to the origin, not the API prefix. */
const socketOrigin = () => {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return window.location.origin;
  }
};

/** Server message → the shape the chat components read. */
const toChatMessage = (m: any, author?: { id: string; name: string }) => ({
  id: String(m?.id ?? ""),
  channelId: String(m?.channelId ?? ""),
  threadId: m?.parentId ?? null,
  userId: asEmployee(m?.authorId) ?? String(m?.authorId ?? ""),
  name: author?.name ?? m?.author?.name ?? "Unknown",
  text: String(m?.body ?? ""),
  time: String(m?.createdAt ?? new Date().toISOString()),
  // The server keeps who reacted; the UI shows how many.
  reactions: Object.fromEntries(
    Object.entries((m?.reactions ?? {}) as Record<string, unknown>).map(([emoji, who]) => [
      emoji,
      Array.isArray(who) ? who.length : Number(who) || 0,
    ])
  ),
});

class RealtimeClient {
  private handlers = new Map<string, Set<Handler>>();
  private socket: Socket | null = null;
  private meetRoom: string | null = null;
  private heartbeat: number | undefined;

  /** Our own socket id, once connected. Pages use it to ignore their own echo. */
  clientId = "";

  /** True while the socket is up — screens can show a "reconnecting" state. */
  connected = false;

  connect(_userId?: string, _name?: string) {
    // Identity comes from the token, not from the caller: a client that could
    // name itself could name someone else.
    const token = tokens.access;
    if (!token) return;
    if (this.socket) return;

    const socket = io(`${socketOrigin()}/ws`, {
      transports: ["websocket"],
      auth: { token },
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
    });
    this.socket = socket;

    socket.on("connect", () => {
      this.clientId = socket.id ?? "";
      this.connected = true;

      // Presence entries expire on their own so a crashed client can't stay
      // "online" forever. This is what proves we're still here.
      window.clearInterval(this.heartbeat);
      this.heartbeat = window.setInterval(() => socket.emit("heartbeat"), 30_000);
    });

    socket.on("disconnect", () => {
      this.connected = false;
      window.clearInterval(this.heartbeat);
      this.heartbeat = undefined;
      this.emit({ type: "disconnected" });
    });

    socket.on("connect_error", (err) => {
      this.connected = false;
      this.emit({ type: "error", message: err.message });
    });

    // The gateway's handshake acknowledgement.
    socket.on("ready", (payload: any) => {
      this.emit({ type: "welcome", clientId: this.clientId, channels: payload?.channels ?? [] });
      // Rejoin the meeting after a reconnect, so a dropped connection doesn't
      // silently leave the user out of the call they're still looking at.
      if (this.meetRoom) socket.emit("meet:join", { roomKey: this.meetRoom });
    });

    socket.on("unauthorized", (payload: any) => {
      this.emit({ type: "error", message: payload?.message ?? "Not authorised" });
      this.disconnect();
    });

    socket.on("presence", (payload: any) => {
      const online: PresenceEntry[] = (payload?.online ?? []).map((p: any) => ({
        clientId: String(p.socketId ?? p.userId ?? ""),
        userId: asEmployee(p.userId) ?? null,
        name: String(p.name ?? ""),
        officeRoom: p.officeRoom ?? null,
        meetRoom: p.meetRoom ?? null,
      }));
      this.emit({ type: "presence", online });
    });

    socket.on("chat:new", (payload: any) => {
      this.emit({ type: "chat:new", message: toChatMessage(payload?.message, payload?.author) });
    });

    socket.on("chat:update", (payload: any) => {
      this.emit({ type: "chat:update", message: toChatMessage(payload?.message) });
    });

    socket.on("chat:typing", (payload: any) => {
      this.emit({
        type: "chat:typing",
        channelId: payload?.channelId,
        userId: asEmployee(payload?.userId),
        name: payload?.name,
      });
    });

    socket.on("office:occupancy", (payload: any) => {
      this.emit({ type: "office:occupancy", rooms: payload?.rooms ?? {} });
    });

    socket.on("meet:peer-joined", (payload: any) => {
      this.emit({
        type: "meet:peer-joined",
        socketId: payload?.socketId,
        userId: asEmployee(payload?.userId),
        name: payload?.name,
      });
    });

    socket.on("meet:peer-left", (payload: any) => {
      this.emit({
        type: "meet:peer-left",
        socketId: payload?.socketId,
        userId: asEmployee(payload?.userId),
      });
    });

    socket.on("rtc:signal", (payload: any) => {
      this.emit({ type: "rtc:signal", ...payload });
    });

    socket.on("meet:chat", (payload: any) => {
      const m = payload?.message ?? {};
      // Presented as a channel message so the meeting UI reads one shape.
      this.emit({
        type: "chat:new",
        message: {
          id: String(m.id ?? ""),
          channelId: `meet:${m.roomKey ?? ""}`,
          threadId: null,
          userId: asEmployee(m.userId) ?? "",
          name: String(m.name ?? ""),
          text: String(m.body ?? ""),
          time: String(m.at ?? new Date().toISOString()),
          reactions: {},
        },
      });
    });

    socket.on("wb:init", (payload: any) => {
      this.emit({ type: "wb:init", strokes: payload?.strokes ?? [] });
    });

    socket.on("wb:stroke", (payload: any) => {
      this.emit({ type: "wb:stroke", stroke: payload?.stroke, from: payload?.from });
    });

    socket.on("wb:clear", () => this.emit({ type: "wb:clear" }));

    socket.on("notification", (payload: any) => {
      this.emit({
        type: "notify",
        text: payload?.title ?? "",
        body: payload?.body ?? "",
        to: payload?.linkTo ?? undefined,
      });
    });
  }

  disconnect() {
    window.clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
    this.clientId = "";
    this.meetRoom = null;
  }

  private emit(msg: any) {
    this.handlers.get(msg.type)?.forEach((h) => h(msg));
    this.handlers.get("*")?.forEach((h) => h(msg));
  }

  on(type: string, handler: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  send(msg: any) {
    const socket = this.socket;
    if (!socket) return;

    switch (msg.type) {
      case "hello":
        // Nothing to do: the handshake already authenticated this socket.
        break;

      case "office:move":
        socket.emit("office:move", { roomId: msg.roomId ?? null });
        break;

      case "chat:subscribe":
        socket.emit("chat:subscribe", { channelId: msg.channelId });
        break;

      case "notify":
        // A local affordance ("3 people notified"), not a broadcast. Echoing it
        // back to this tab is the whole behaviour — the server raises its own
        // notifications and delivers them over the `notification` event.
        this.emit({ type: "notify", text: msg.text, local: true });
        break;

      case "chat:send":
        // Chat inside a call goes to the meeting room, not to a channel: the
        // gateway scopes it to whoever actually joined the call.
        if (String(msg.channelId ?? "").startsWith("meet:")) {
          socket.emit(
            "meet:chat",
            { roomKey: String(msg.channelId).slice("meet:".length), body: String(msg.text ?? "") },
            (ack: any) => {
              if (ack && ack.ok === false) {
                this.emit({ type: "error", message: ack.error ?? "Message not sent" });
              }
            }
          );
          break;
        }
        socket.emit(
          "chat:send",
          { channelId: msg.channelId, body: String(msg.text ?? ""), parentId: msg.threadId ?? undefined },
          (ack: any) => {
            if (ack && ack.ok === false) {
              this.emit({ type: "error", message: ack.error ?? "Message not sent" });
            }
          }
        );
        break;

      case "chat:typing":
        socket.emit("chat:typing", { channelId: msg.channelId });
        break;

      case "chat:react":
        // The server toggles, so `remove` needs no separate call.
        socket.emit("chat:react", { messageId: msg.messageId, emoji: msg.emoji });
        break;

      case "meet:join":
        this.meetRoom = msg.roomId;
        socket.emit("meet:join", { roomKey: msg.roomId }, (ack: any) => {
          // Peers arrive in the acknowledgement rather than a broadcast — only
          // the joiner needs the list, and they need it before they offer.
          this.emit({
            type: "meet:peers",
            peers: (ack?.peers ?? []).map((p: any) => ({
              socketId: p.socketId,
              userId: asEmployee(p.userId),
              name: p.name,
            })),
          });
          this.emit({ type: "wb:init", strokes: ack?.strokes ?? [] });

          // Whatever was said before we joined, so the panel isn't blank.
          for (const m of ack?.chat ?? []) {
            this.emit({
              type: "chat:new",
              message: {
                id: String(m.id ?? ""),
                channelId: `meet:${m.roomKey ?? msg.roomId}`,
                threadId: null,
                userId: asEmployee(m.userId) ?? "",
                name: String(m.name ?? ""),
                text: String(m.body ?? ""),
                time: String(m.at ?? ""),
                reactions: {},
              },
            });
          }
        });
        break;

      case "meet:leave":
        this.meetRoom = null;
        socket.emit("meet:leave");
        break;

      case "rtc:signal":
        socket.emit("rtc:signal", {
          to: msg.to ?? msg.target,
          signal: msg.signal ?? msg.data,
        });
        break;

      case "wb:stroke":
        socket.emit("wb:stroke", { roomKey: msg.roomId ?? this.meetRoom, stroke: msg.stroke });
        break;

      case "wb:clear":
        socket.emit("wb:clear", { roomKey: msg.roomId ?? this.meetRoom });
        break;

      case "heartbeat":
        socket.emit("heartbeat");
        break;

      default:
        break;
    }
  }

  dispose() {
    this.disconnect();
    this.handlers.clear();
  }
}

export const wsc = new RealtimeClient();
