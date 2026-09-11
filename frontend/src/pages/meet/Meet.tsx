/* Meet hub: instant meetings, scheduled meetings (linked to projects), recordings. */
import { CalendarPlus, Camera, CameraOff, Download, Mic, MicOff, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FormModal } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, Modal, StatusPill } from "@/components/ui";
import { employees as allEmployees } from "@/data/core";
import { CURRENT_USER } from "@/lib/store";
import { wsc } from "@/lib/ws";
import { recordings, teamMeetings } from "@/data/collab";
import { byId, employees } from "@/data/core";
import { projects } from "@/data/work";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export default function Meet() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [meetings, setMeetings] = useState(() => [...teamMeetings]);
  // ---- new instant meeting dialog (like real apps: name it, set devices, invite) ----
  const [instantOpen, setInstantOpen] = useState(false);
  const [mTitle, setMTitle] = useState("");
  const [mMic, setMMic] = useState(true);
  const [mCam, setMCam] = useState(true);
  const [mInvite, setMInvite] = useState<string[]>([]);

  useEffect(() => {
    if (params.get("new") === "1") {
      setInstantOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const startInstant = () => {
    const roomId = `instant-${Math.random().toString(36).slice(2, 8)}`;
    const title = mTitle.trim() || `${CURRENT_USER.name.split(" ")[0]}'s meeting`;
    if (mInvite.length > 0) {
      wsc.send({ type: "notify", text: `invited ${mInvite.length} people to "${title}"` });
      wsc.send({ type: "chat:send", channelId: "general", text: `📞 Join my meeting "${title}" → /meet/${roomId}` });
    }
    const qs = new URLSearchParams({ title, mic: mMic ? "1" : "0", cam: mCam ? "1" : "0" });
    nav(`/meet/${roomId}?${qs.toString()}`);
  };

  return (
    <>
      <PageHeader
        title="Meet"
        actions={
          <>
            <button className="btn-primary" onClick={() => setInstantOpen(true)}>
              <Video size={15} /> New Meeting
            </button>
            <button className="btn-outline" onClick={() => setScheduleOpen(true)}>
              <CalendarPlus size={15} /> Schedule
            </button>
          </>
        }
      />

      {/* pre-meeting dialog */}
      <Modal open={instantOpen} onClose={() => setInstantOpen(false)} title="Start a meeting" wide>
        <label className="block">
          <span className="lbl">Meeting name</span>
          <input
            className="input"
            value={mTitle}
            onChange={(e) => setMTitle(e.target.value)}
            placeholder={`${CURRENT_USER.name.split(" ")[0]}'s meeting`}
            autoFocus
          />
        </label>
        <div className="mt-4 flex gap-3">
          <button
            className={`btn flex-1 gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${mMic ? "border-primary bg-primary-soft text-primary" : "border-line bg-white/70 text-muted"}`}
            onClick={() => setMMic((v) => !v)}
          >
            {mMic ? <Mic size={16} /> : <MicOff size={16} />} Microphone {mMic ? "on" : "off"}
          </button>
          <button
            className={`btn flex-1 gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${mCam ? "border-primary bg-primary-soft text-primary" : "border-line bg-white/70 text-muted"}`}
            onClick={() => setMCam((v) => !v)}
          >
            {mCam ? <Camera size={16} /> : <CameraOff size={16} />} Camera {mCam ? "on" : "off"}
          </button>
        </div>
        <p className="lbl mt-4">Invite people <span className="font-normal text-faint">(they get a notification with the link)</span></p>
        <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {allEmployees
            .filter((e) => e.id !== CURRENT_USER.id)
            .map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-white/70 px-2.5 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary-soft">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={mInvite.includes(e.id)}
                  onChange={() => setMInvite((ms) => (ms.includes(e.id) ? ms.filter((m) => m !== e.id) : [...ms, e.id]))}
                />
                <Avatar name={e.name} size={22} />
                <span className="truncate">{e.name}</span>
              </label>
            ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button className="btn-primary" onClick={startInstant}>
            <Video size={15} /> Start Meeting{mInvite.length > 0 ? ` & invite ${mInvite.length}` : ""}
          </button>
          <button className="btn-ghost" onClick={() => setInstantOpen(false)}>Cancel</button>
        </div>
      </Modal>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="card">
            <div className="border-b border-line px-5 py-3.5 font-display text-[15px] font-bold">Upcoming meetings</div>
            <ul className="divide-y divide-line">
              {meetings.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="w-14 rounded-xl border border-line bg-white/60 py-1.5 text-center">
                    <p className="text-[10px] font-bold text-primary uppercase">
                      {new Date(m.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                    </p>
                    <p className="font-display text-lg leading-none font-bold tabular-nums">{m.date.slice(8)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.title}</p>
                    <p className="text-xs text-muted">
                      {m.time} · {m.duration} · Organised by {byId(m.organizer)?.name}
                      {m.projectId && (
                        <>
                          {" · "}
                          <Link to={`/work/projects/${m.projectId}`} className="text-primary hover:underline">
                            {projects.find((p) => p.id === m.projectId)?.code} project
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="flex -space-x-1.5">
                    {m.attendees.map((a) => (
                      <Avatar key={a} name={byId(a)?.name ?? a} size={26} />
                    ))}
                  </span>
                  <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => nav(`/meet/${m.roomId}`)}>
                    Join
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-display text-sm font-bold">How meetings work</h3>
            <ul className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-muted">
              <li>🎙️ Live audio & video between everyone in the room (open the link in two tabs to try it)</li>
              <li>🖥️ Screen sharing replaces your camera feed for viewers</li>
              <li>🧑‍🎨 Shared whiteboard — strokes sync to everyone instantly</li>
              <li>⏺️ Recording saves a .webm to the server (Recordings below)</li>
              <li>✅ Assign tasks mid-meeting — they land in Work → Tasks</li>
            </ul>
          </div>
          <div className="card">
            <div className="border-b border-line px-5 py-3.5 font-display text-[15px] font-bold">Recordings</div>
            {recordings.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-faint">No recordings yet — hit ⏺ in any meeting.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recordings.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.title}</span>
                      <span className="text-xs text-muted">{fmtDate(r.date.slice(0, 10))} · {(r.size / 1024 / 1024).toFixed(1)} MB</span>
                    </span>
                    <a href={r.url} className="btn-outline px-2.5 py-1 text-xs" download>
                      <Download size={12} /> Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <FormModal
        open={scheduleOpen}
        title="Schedule a meeting"
        fields={[
          { key: "title", label: "Title", required: true, span: true, placeholder: "e.g. Weekly delivery sync" },
          { key: "date", label: "Date", type: "date", required: true },
          { key: "time", label: "Time", required: true, placeholder: "10:00 am" },
          { key: "duration", label: "Duration", type: "select", options: ["30 min", "45 min", "60 min"] },
          { key: "projectId", label: "Link to project", type: "select", options: [{ value: "", label: "—" }, ...projects.map((p) => ({ value: p.id, label: p.name.slice(0, 40) }))] },
          { key: "organizer", label: "Organizer", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })) },
        ]}
        initial={{ date: "2026-09-02", time: "10:00 am" }}
        submitLabel="Schedule"
        onSubmit={(v) => {
          const meeting = {
            id: `tm${Date.now()}`,
            title: String(v.title),
            roomId: `meet-${Date.now().toString(36)}`,
            date: String(v.date),
            time: String(v.time),
            duration: String(v.duration || "30 min"),
            organizer: String(v.organizer || CURRENT_USER.id),
            attendees: [String(v.organizer || CURRENT_USER.id)],
            projectId: v.projectId ? String(v.projectId) : undefined,
          };
          setMeetings((ms) => [meeting, ...ms]);
          teamMeetings.push(meeting);
          void api.create("teamMeetings", meeting);
          setScheduleOpen(false);
        }}
        onClose={() => setScheduleOpen(false)}
      />
      <div className="mt-5 text-center">
        <StatusPill status="Tip: joining from the Virtual Office meeting rooms lands in the same call" tone="info" />
      </div>
    </>
  );
}
