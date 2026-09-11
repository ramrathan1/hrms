/* A small, dismissible line saying a surface is simulated.
   These screens were built on a realtime server this build no longer has. They
   still work on their own, and saying so beats letting them look broken. */
import { Info, X } from "lucide-react";
import { useState } from "react";

export function SimulatedNotice({ id, children }: { id: string; children: React.ReactNode }) {
  const key = `ws.notice.${id}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="flex items-start gap-2.5 border-b border-warn/25 bg-warn-soft px-4 py-2 text-xs text-[#8a5d0c]">
      <Info size={14} className="mt-px shrink-0" />
      <p className="min-w-0 flex-1">{children}</p>
      <button onClick={dismiss} className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-black/5" aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  );
}
