/* Virtual office: floors, rooms, live occupancy over WebSocket.
   Step into a meeting room to start an audio/video call. */
import clsx from "clsx";
import { DoorOpen, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui";
import { floors, officeRooms } from "@/data/collab";
import { useToast } from "@/lib/store";
import { wsc, type PresenceEntry } from "@/lib/ws";

const TYPE_LABEL: Record<string, string> = {
  work: "Workspace",
  meeting: "Meeting room",
  social: "Social",
  quiet: "Quiet zone",
};
const TYPE_TINT: Record<string, string> = {
  work: "from-primary/12 to-transparent",
  meeting: "from-[#3fa9f5]/14 to-transparent",
  social: "from-[#e8983c]/14 to-transparent",
  quiet: "from-[#1fa971]/12 to-transparent",
};

export default function Office() {
  const [floorId, setFloorId] = useState("f1");
  const [online, setOnline] = useState<PresenceEntry[]>([]);
  const [myRoom, setMyRoom] = useState<string | null>(null);
  const nav = useNavigate();
  const { push } = useToast();

  useEffect(() => {
    const off = wsc.on("presence", ({ online: o }) => setOnline(o));
    return off;
  }, []);

  const occupants = (roomId: string) =>
    online.filter((p) => p.officeRoom === roomId);

  const enter = (roomId: string) => {
    const next = myRoom === roomId ? null : roomId;
    setMyRoom(next);
    wsc.send({ type: "office:move", roomId: next });
    if (next) push(`You walked into ${officeRooms.find((r) => r.id === next)?.name}`);
  };

  return (
    <>
      <PageHeader
        title="Virtual Office"
        actions={
          <div className="flex overflow-hidden rounded-xl border border-white/60 bg-white/50 backdrop-blur">
            {floors.map((f) => (
              <button
                key={f.id}
                onClick={() => setFloorId(f.id)}
                className={clsx(
                  "cursor-pointer px-4 py-2 text-sm font-medium",
                  f.id === floorId ? "bg-primary text-white" : "text-muted hover:text-ink"
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex items-start gap-5">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {officeRooms
            .filter((r) => r.floorId === floorId)
            .map((room) => {
              const people = occupants(room.id);
              const mine = myRoom === room.id;
              return (
                <div
                  key={room.id}
                  className={clsx(
                    "card relative overflow-hidden p-5 transition-all",
                    mine && "ring-2 ring-primary"
                  )}
                >
                  <div className={clsx("pointer-events-none absolute inset-0 bg-gradient-to-br", TYPE_TINT[room.type])} />
                  <div className="relative">
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{room.icon}</span>
                      <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-muted">
                        {people.length} / {room.capacity}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-[15px] font-bold">{room.name}</h3>
                    <p className="text-xs text-muted">{TYPE_LABEL[room.type]}</p>
                    <div className="mt-3 flex h-8 items-center -space-x-1.5">
                      {people.slice(0, 6).map((p) => (
                        <span key={p.clientId} title={p.name}>
                          <Avatar name={p.name} size={28} />
                        </span>
                      ))}
                      {people.length === 0 && <span className="text-xs text-faint">Empty</span>}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        className={mine ? "btn-outline flex-1 py-1.5 text-xs" : "btn-primary flex-1 py-1.5 text-xs"}
                        onClick={() => enter(room.id)}
                      >
                        <DoorOpen size={13} /> {mine ? "Step out" : "Walk in"}
                      </button>
                      {room.type === "meeting" && (
                        <button
                          className="btn-outline flex-1 py-1.5 text-xs"
                          onClick={() => nav(`/meet/office-${room.id}`)}
                        >
                          <Video size={13} /> Start call
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        <aside className="card w-64 shrink-0 p-4">
          <h3 className="font-display text-sm font-bold">In the office</h3>
          <p className="mb-3 text-xs text-muted">{online.length} online now</p>
          <ul className="space-y-2.5">
            {online.map((p) => (
              <li key={p.clientId} className="flex items-center gap-2.5 text-sm">
                <span className="relative">
                  <Avatar name={p.name} size={30} />
                  <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-good" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {p.meetRoom
                      ? "📞 In a call"
                      : p.officeRoom
                        ? officeRooms.find((r) => r.id === p.officeRoom)?.name ?? "Roaming"
                        : "Just arrived"}
                  </span>
                </span>
              </li>
            ))}
            {online.length === 0 && <li className="text-xs text-faint">Connecting…</li>}
          </ul>
          <p className="mt-4 rounded-lg bg-page px-3 py-2 text-[11px] leading-relaxed text-muted">
            Open this page in a second tab to see live presence — everyone's position syncs instantly.
          </p>
        </aside>
      </div>
    </>
  );
}
