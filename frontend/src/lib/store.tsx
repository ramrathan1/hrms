import { roleById, roleIdFromKeys, roleIdsFromKeys, roleIdFromLabel, type RoleId } from "./roles";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ---------------- auth ---------------- */

/* A session is a token, not a flag. Reading it straight from storage rather
   than keeping a separate boolean means the app and the API can never disagree
   about whether someone is signed in. */
export const isLoggedIn = () => {
  try {
    return Boolean(localStorage.getItem("ws.access") ?? localStorage.getItem("ws.refresh"));
  } catch {
    return false;
  }
};

/** The token is already stored by `api.login`; this only marks the shell ready. */
export const login = () => {
  try {
    localStorage.setItem("ws.auth", "1");
  } catch {
    /* storage unavailable */
  }
};

export const logout = () => {
  try {
    localStorage.removeItem("ws.auth");
    localStorage.removeItem(USER_KEY);
  } catch {
    /* storage unavailable */
  }
  /* Leave the realtime hub too. Signing out used to clear the tokens and walk
     away with the socket still open, so the Virtual Office went on showing the
     person as present — "Just arrived" — long after they had gone. */
  void import("./ws").then((m) => m.wsc.disconnect()).catch(() => {});
  // Revokes the refresh token server-side and clears both tokens here.
  void import("./api").then((m) => m.api.logout()).catch(() => {});
};

export type CurrentUser = { id: string; name: string; role: string; email: string; roleId: RoleId; roleIds: RoleId[] };

const USER_KEY = "ws.user";
const FALLBACK: CurrentUser = { id: "e1", name: "Mohammed Ziemann", role: "Team Lead", email: "admin@worksuite.demo", roleId: "team-leader", roleIds: ["team-leader"] };

/* Mutated in place on sign-in: pages import CURRENT_USER directly and read it
   at render time, so replacing the object's fields reaches all of them without
   touching 30 files. */
export const CURRENT_USER: CurrentUser = (() => {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? { ...FALLBACK, ...JSON.parse(saved) } : { ...FALLBACK };
  } catch {
    return { ...FALLBACK };
  }
})();

/** Called by the sign-in form once a session exists. */
export function setCurrentUser(user: Partial<CurrentUser>) {
  const role = user.role ?? CURRENT_USER.role;
  Object.assign(CURRENT_USER, {
    id: user.id ?? CURRENT_USER.id,
    name: user.name ?? CURRENT_USER.name,
    role,
    email: user.email ?? CURRENT_USER.email,
    roleId: user.roleId ?? roleIdFromLabel(role),
  });
  roleListeners.forEach((fn) => fn());
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(CURRENT_USER));
  } catch {
    /* storage unavailable */
  }
  // The audit trail names whoever is actually signed in.
  void import("./api").then((m) => m.setAuditActor(CURRENT_USER.name)).catch(() => {});
}

/* Follow the signed-in account.
 *
 * The server is the authority on who this is and what roles they hold, so
 * whenever `/auth/me` answers — at boot, after a refresh, after signing in —
 * CURRENT_USER is brought in line with it. Anything stored in this browser is
 * only the last known value. */
void import("./api")
  .then((m) => {
    m.setAuditActor(CURRENT_USER.name);

    const apply = (p: ReturnType<typeof m.currentProfile>) => {
      if (!p) return;
      const roleId = roleIdFromKeys(p.roles);
      setCurrentUser({
        id: p.employeeId ?? p.id,
        name: p.name,
        email: p.email,
        roleId,
        // Every portal this account may view — what the role switcher offers.
        roleIds: roleIdsFromKeys(p.roles),
        // Show the role the server actually granted, not whatever label was
        // last cached in this browser.
        role: roleById(roleId).label,
      });
    };

    apply(m.currentProfile());
    m.onProfileChange(apply);
  })
  .catch(() => {});

/** Switching role re-renders the shell, so subscribers are told. */
const roleListeners = new Set<() => void>();
export const onRoleChange = (fn: () => void) => {
  roleListeners.add(fn);
  return () => {
    roleListeners.delete(fn);
  };
};

/** Change role without changing who is signed in — used by the role switcher. */
export function setRole(roleId: RoleId, label?: string) {
  Object.assign(CURRENT_USER, { roleId, role: label ?? CURRENT_USER.role });
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(CURRENT_USER));
  } catch {
    /* storage unavailable */
  }
  roleListeners.forEach((fn) => fn());
}

/** Subscribe a component to the current role, so switching re-renders it. */
export function useRole(): CurrentUser {
  const [, bump] = useState(0);
  useEffect(() => onRoleChange(() => bump((n) => n + 1)), []);
  return CURRENT_USER;
}

/* ---------------- toasts ---------------- */
type Toast = { id: number; text: string };
const ToastCtx = createContext<{ push: (text: string) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-5 bottom-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------- legacy timer (superseded by lib/timer.tsx) ---------------- */
export function useLegacyTimer() {
  const [seconds, setSeconds] = useState(() => Number(localStorage.getItem("ws.timer") ?? 3740));
  const [running, setRunning] = useState(() => localStorage.getItem("ws.timer.run") !== "0");
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (ref.current) window.clearInterval(ref.current);
    };
  }, [running]);

  useEffect(() => {
    localStorage.setItem("ws.timer", String(seconds));
    localStorage.setItem("ws.timer.run", running ? "1" : "0");
  }, [seconds, running]);

  const label = useMemo(() => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [seconds]);

  return {
    label,
    running,
    toggle: () => setRunning((r) => !r),
    stop: () => {
      setRunning(false);
      setSeconds(0);
    },
  };
}
