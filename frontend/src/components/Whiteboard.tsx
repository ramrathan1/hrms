/* Shared whiteboard — strokes sync live to everyone in the meeting room. */
import { Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { wsc } from "@/lib/ws";

type Stroke = { color: string; size: number; points: { x: number; y: number }[] };

const COLORS = ["#211d3a", "#5b5ceb", "#3fa9f5", "#1fa971", "#e8983c", "#e85d51"];

export function Whiteboard({ roomId }: { roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[1]);
  const [size, setSize] = useState(3);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const paint = (s: Stroke) => {
      if (s.points.length < 2) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(s.points[0].x * canvas.width, s.points[0].y * canvas.height);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
      ctx.stroke();
    };
    strokesRef.current.forEach(paint);
    if (currentRef.current) paint(currentRef.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      redraw();
    };
    resize();
    window.addEventListener("resize", resize);
    const offs = [
      wsc.on("wb:init", ({ strokes }) => {
        strokesRef.current = strokes ?? [];
        redraw();
      }),
      wsc.on("wb:stroke", ({ stroke }) => {
        strokesRef.current.push(stroke);
        redraw();
      }),
      wsc.on("wb:clear", () => {
        strokesRef.current = [];
        redraw();
      }),
    ];
    return () => {
      window.removeEventListener("resize", resize);
      offs.forEach((off) => off());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Pen color ${c}`}
            className="h-6 w-6 cursor-pointer rounded-full border-2"
            style={{ background: c, borderColor: c === color ? "#211d3a" : "transparent" }}
          />
        ))}
        <input type="range" min={2} max={10} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-20 accent-primary" />
        <button
          className="btn-ghost ml-auto px-2 py-1 text-xs"
          onClick={() => {
            strokesRef.current = [];
            redraw();
            wsc.send({ type: "wb:clear", roomId });
          }}
        >
          <Eraser size={13} /> Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="min-h-0 flex-1 cursor-crosshair touch-none rounded-b-xl bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          currentRef.current = { color, size, points: [pos(e)] };
        }}
        onPointerMove={(e) => {
          if (!currentRef.current) return;
          currentRef.current.points.push(pos(e));
          redraw();
        }}
        onPointerUp={() => {
          if (!currentRef.current) return;
          const stroke = currentRef.current;
          currentRef.current = null;
          if (stroke.points.length > 1) {
            strokesRef.current.push(stroke);
            wsc.send({ type: "wb:stroke", roomId, stroke });
          }
          redraw();
        }}
      />
    </div>
  );
}
