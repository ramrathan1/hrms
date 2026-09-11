import clsx from "clsx";
import { useState, type ReactNode } from "react";

export type KanbanColumn = { id: string; title: string; color: string; footer?: string };

export function Kanban<T extends { id: string }>({
  columns,
  items,
  columnOf,
  onMove,
  renderCard,
}: {
  columns: KanbanColumn[];
  items: T[];
  columnOf: (item: T) => string;
  onMove: (id: string, col: string) => void;
  renderCard: (item: T) => ReactNode;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const colItems = items.filter((i) => columnOf(i) === col.id);
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={() => {
              if (dragId) onMove(dragId, col.id);
              setDragId(null);
              setOver(null);
            }}
            className={clsx(
              "w-72 shrink-0 rounded-2xl border backdrop-blur-xl transition-colors",
              over === col.id ? "border-primary bg-primary-soft/70" : "border-white/60 bg-white/35"
            )}
          >
            <div className="flex items-center gap-2 border-b border-line px-3.5 py-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
              <span className="text-sm font-semibold">{col.title}</span>
              <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium text-muted tabular-nums">
                {colItems.length}
              </span>
            </div>
            {col.footer && <div className="px-3.5 pt-2 text-xs text-muted">{col.footer}</div>}
            <div className="flex flex-col gap-2.5 p-2.5">
              {colItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragId(item.id)}
                  className="card cursor-grab p-3.5 active:cursor-grabbing"
                >
                  {renderCard(item)}
                </div>
              ))}
              {colItems.length === 0 && (
                <div className="rounded-md border border-dashed border-line py-6 text-center text-xs text-faint">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
