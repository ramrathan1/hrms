/* Teams-style meeting room: WebRTC mesh audio/video, screen share, recording,
   shared whiteboard, in-room chat, and mid-meeting task assignment. */
import clsx from "clsx";
import {
  CheckSquare, Circle, Copy, MessageSquare, Mic, MicOff, MonitorUp, PenLine,
  PhoneOff, Send, Square, Users, Video, VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TaskQuickCreate } from "@/components/TaskQuickCreate";
import { Avatar } from "@/components/ui";
import { Whiteboard } from "@/components/Whiteboard";
import { officeRooms, teamMeetings, recordings } from "@/data/collab";
import { MeshCall, type Peer } from "@/lib/rtc";
import { CURRENT_USER, useToast } from "@/lib/store";
import { wsc } from "@/lib/ws";

function VideoTile({ stream, name, muted, badge }: { stream?: MediaStream; name: string; muted?: boolean; badge?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#1b1733]">
      {hasVideo ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2">
          {stream && <audio ref={(el) => { if (el && stream) el.srcObject = stream; }} autoPlay muted={muted} />}
          <Avatar name={name} size={64} />
          <p className="text-sm font-medium text-white/80">{name}</p>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-lg bg-black/50 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
        {name} {badge}
      </span>
    </div>
  );
}

type PanelTab = "chat" | "people" | "whiteboard" | "tasks";

export default function MeetingRoom() {
  const { roomId = "instant" } = useParams();
  const [search] = useSearchParams();
  const nav = useNavigate();
  const { push } = useToast();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [micOn, setMicOn] = useState(search.get("mic") !== "0");
  const [camOn, setCamOn] = useState(search.get("cam") !== "0");
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const [chatMsgs, setChatMsgs] = useState<{ id: string; name: string; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const callRef = useRef<MeshCall | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const roomTitle = useMemo(() => {
    const named = search.get("title");
    if (named) return named;
    const office = officeRooms.find((r) => `office-${r.id}` === roomId);
    if (office) return office.name;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const meeting = teamMeetings.find((m) => m.roomId === roomId);
    if (meeting) return meeting.title;
    if (roomId.startsWith("huddle-")) return `Huddle · #${roomId.slice(7)}`;
    return "Instant meeting";
  }, [roomId]);

  /* join call */
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        stream = null; // no devices / permission — join as avatar-only participant
      }
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      // honor the pre-meeting mic/cam choices
      stream?.getAudioTracks().forEach((t) => (t.enabled = search.get("mic") !== "0"));
      stream?.getVideoTracks().forEach((t) => (t.enabled = search.get("cam") !== "0"));
      setLocalStream(stream);
      const call = new MeshCall(roomId, stream, setPeers);
      callRef.current = call;
      call.join();
    })();
    const offChat = wsc.on("chat:new", ({ message }) => {
      if (message.channelId !== `meet:${roomId}`) return;
      // History replays on join and the live feed echoes our own sends, so
      // ignore anything already on screen.
      setChatMsgs((ms) =>
        ms.some((m) => m.id === message.id)
          ? ms
          : [...ms, { id: message.id, name: message.name, text: message.text }]
      );
    });
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      cancelled = true;
      offChat();
      window.clearInterval(timer);
      callRef.current?.leave();
      callRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
      if (recRef.current?.state === "recording") recRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((v) => !v);
  };
  const toggleCam = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((v) => !v);
  };

  const toggleShare = async () => {
    if (sharing) {
      screenRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
      const cam = localStream?.getVideoTracks()[0] ?? null;
      callRef.current?.replaceVideoTrack(cam);
      setSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenRef.current = display;
      const track = display.getVideoTracks()[0];
      track.onended = () => {
        callRef.current?.replaceVideoTrack(localStream?.getVideoTracks()[0] ?? null);
        setSharing(false);
      };
      callRef.current?.replaceVideoTrack(track);
      setSharing(true);
      push("You are sharing your screen");
    } catch {
      push("Screen share was cancelled");
    }
  };

  const toggleRecord = () => {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const source = screenRef.current ?? localStream;
    if (!source) {
      push("Nothing to record — no camera or screen available");
      return;
    }
    const rec = new MediaRecorder(source, { mimeType: "video/webm" });
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = async () => {
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      // No server to upload to — keep the clip in this tab and hand back a
      // blob URL, so it plays and downloads until the page is closed.
      const saved = {
        id: `rec-${Date.now().toString(36)}`,
        title: roomTitle,
        roomId,
        by: CURRENT_USER.id,
        type: "video/webm",
        size: blob.size,
        url: URL.createObjectURL(blob),
        date: new Date().toISOString(),
        local: true,
      };
      recordings.push(saved as never);
      push("Recording saved to this tab — see Meet → Recordings");
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
    push("Recording started");
  };

  const sendChat = () => {
    if (!draft.trim()) return;
    wsc.send({ type: "chat:send", channelId: `meet:${roomId}`, text: draft.trim() });
    setDraft("");
  };

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const gridCols = peers.length === 0 ? "grid-cols-1 max-w-2xl" : peers.length <= 1 ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-3";

  const panelBtn = (tab: PanelTab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setPanel((p) => (p === tab ? null : tab))}
      className={clsx(
        "btn flex-col gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium",
        panel === tab ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="-m-6 flex h-[calc(100%+48px)] bg-[#120f26]">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          <h1 className="font-display text-[15px] font-bold text-white">{roomTitle}</h1>
          <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-white/70 tabular-nums">{mins}:{secs}</span>
          {recording && (
            <span className="flex items-center gap-1.5 rounded-lg bg-bad/20 px-2 py-0.5 text-xs font-semibold text-[#ff8a80]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff5252]" /> REC
            </span>
          )}
          <button
            className="btn ml-auto gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/20"
            onClick={() => {
              navigator.clipboard?.writeText(location.href).catch(() => {});
              push("Meeting link copied — open it in another tab to join as a second participant");
            }}
          >
            <Copy size={12} /> Copy invite link
          </button>
        </header>

        {/* tiles */}
        <div className={clsx("mx-auto grid w-full flex-1 content-center gap-4 overflow-y-auto p-6", gridCols)}>
          <VideoTile stream={sharing ? (screenRef.current ?? undefined) : (localStream ?? undefined)} name={CURRENT_USER.name} muted badge="(you)" />
          {peers.map((p) => (
            <VideoTile key={p.peerId} stream={p.stream} name={p.name} />
          ))}
          {peers.length === 0 && (
            <div className="mx-auto max-w-md rounded-xl border border-white/15 bg-white/5 px-5 py-4 text-center">
              <p className="text-sm font-semibold text-white/90">You're the only one here</p>
              <p className="mt-1.5 text-sm text-white/55">
                Your own camera, mic, screen share, recording and the whiteboard all work. Other
                people can't join: connecting two browsers needs a signalling server, and this build
                doesn't have one.
              </p>
            </div>
          )}
        </div>

        {/* controls */}
        <footer className="flex items-center justify-center gap-2.5 border-t border-white/10 px-4 py-3.5">
          <button onClick={toggleMic} className={clsx("btn h-11 w-11 rounded-full", micOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-bad text-white")} aria-label="Toggle microphone">
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button onClick={toggleCam} className={clsx("btn h-11 w-11 rounded-full", camOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-bad text-white")} aria-label="Toggle camera">
            {camOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <button onClick={toggleShare} className={clsx("btn h-11 w-11 rounded-full", sharing ? "bg-good text-white" : "bg-white/15 text-white hover:bg-white/25")} aria-label="Share screen">
            <MonitorUp size={18} />
          </button>
          <button onClick={toggleRecord} className={clsx("btn h-11 w-11 rounded-full", recording ? "bg-bad text-white" : "bg-white/15 text-white hover:bg-white/25")} aria-label="Record meeting">
            {recording ? <Square size={16} /> : <Circle size={18} />}
          </button>
          <span className="mx-2 h-8 w-px bg-white/15" />
          {panelBtn("chat", <MessageSquare size={17} />, "Chat")}
          {panelBtn("people", <Users size={17} />, "People")}
          {panelBtn("whiteboard", <PenLine size={17} />, "Board")}
          {panelBtn("tasks", <CheckSquare size={17} />, "Tasks")}
          <span className="mx-2 h-8 w-px bg-white/15" />
          <button
            onClick={() => nav("/meet")}
            className="btn h-11 gap-2 rounded-full bg-bad px-5 font-semibold text-white hover:brightness-110"
          >
            <PhoneOff size={17} /> Leave
          </button>
        </footer>
      </div>

      {/* side panel */}
      {panel && (
        <aside className="flex w-88 shrink-0 flex-col border-l border-white/10 bg-white/95 backdrop-blur-xl" style={{ width: 340 }}>
          <header className="border-b border-line px-4 py-3 font-display text-sm font-bold capitalize">{panel}</header>

          {panel === "chat" && (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {chatMsgs.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="font-bold">{m.name}: </span>
                    {m.text}
                  </div>
                ))}
                {chatMsgs.length === 0 && <p className="pt-10 text-center text-xs text-faint">Messages here stay with the meeting.</p>}
              </div>
              <div className="flex gap-2 border-t border-line p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Message the meeting…"
                  className="input flex-1 py-1.5"
                />
                <button className="btn-primary px-3" onClick={sendChat} aria-label="Send">
                  <Send size={14} />
                </button>
              </div>
            </>
          )}

          {panel === "people" && (
            <ul className="space-y-3 p-4">
              <li className="flex items-center gap-3 text-sm">
                <Avatar name={CURRENT_USER.name} size={32} />
                <span className="font-medium">{CURRENT_USER.name} <span className="text-xs text-muted">(you)</span></span>
              </li>
              {peers.map((p) => (
                <li key={p.peerId} className="flex items-center gap-3 text-sm">
                  <Avatar name={p.name} size={32} />
                  <span className="font-medium">{p.name}</span>
                </li>
              ))}
            </ul>
          )}

          {panel === "whiteboard" && <Whiteboard roomId={roomId} />}

          {panel === "tasks" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <CheckSquare size={28} className="text-primary" />
              <p className="text-sm text-muted">Turn decisions into work without leaving the call — tasks land straight in <b>Work → Tasks</b>.</p>
              <button className="btn-primary" onClick={() => setTaskOpen(true)}>Assign a task</button>
            </div>
          )}
        </aside>
      )}

      <TaskQuickCreate open={taskOpen} onClose={() => setTaskOpen(false)} source={`meeting · ${roomTitle}`} />
    </div>
  );
}
