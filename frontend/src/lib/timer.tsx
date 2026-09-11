/* Global work timer bound to a task. Starting from a task row or the topbar
   tracks against that task; stopping writes a real time log entry. */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { CURRENT_USER } from "./store";
import { timeLogs } from "@/data/work";
import { todayISO } from "@/lib/format";

type TimerState = {
  seconds: number;
  running: boolean;
  taskId: string | null;
  taskLabel: string | null;
  label: string;
  start: (taskId: string, taskLabel: string) => void;
  toggle: () => void;
  stop: () => { hours: number; taskId: string | null } | null;
};

const Ctx = createContext<TimerState>({
  seconds: 0, running: false, taskId: null, taskLabel: null, label: "00:00:00",
  start: () => {}, toggle: () => {}, stop: () => null,
});

const KEY = "ws.timer.v2";

export function TimerProvider({ children }: { children: ReactNode }) {
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "null") as
        | { seconds: number; running: boolean; taskId: string | null; taskLabel: string | null }
        | null;
    } catch {
      return null;
    }
  })();

  const [seconds, setSeconds] = useState(saved?.seconds ?? 0);
  const [running, setRunning] = useState(saved?.running ?? false);
  const [taskId, setTaskId] = useState<string | null>(saved?.taskId ?? null);
  const [taskLabel, setTaskLabel] = useState<string | null>(saved?.taskLabel ?? null);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    if (running) tick.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [running]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ seconds, running, taskId, taskLabel }));
    } catch {
      /* storage unavailable */
    }
  }, [seconds, running, taskId, taskLabel]);

  const label = useMemo(() => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [seconds]);

  const value: TimerState = {
    seconds,
    running,
    taskId,
    taskLabel,
    label,
    start: (id, lbl) => {
      setTaskId(id);
      setTaskLabel(lbl);
      setSeconds(0);
      setRunning(true);
    },
    toggle: () => setRunning((r) => !r),
    stop: () => {
      const hours = Math.round((seconds / 3600) * 100) / 100;
      const captured = taskId;
      if (captured && seconds > 0) {
        const now = new Date();
        const log = {
          id: `tl-${Date.now()}`,
          taskId: captured,
          employee: CURRENT_USER.id,
          start: `${todayISO()} ${new Date(now.getTime() - seconds * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
          end: `${todayISO()} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
          hours: Math.max(hours, 0.01),
          memo: taskLabel ?? "Tracked work",
        };
        timeLogs.push(log);
        void api.create("timeLogs", log);
      }
      setRunning(false);
      setSeconds(0);
      setTaskId(null);
      setTaskLabel(null);
      return captured ? { hours, taskId: captured } : null;
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTimer = () => useContext(Ctx);
