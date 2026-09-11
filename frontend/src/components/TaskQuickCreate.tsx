/* Create + assign a real task from anywhere (chat message, meeting, office).
   Persists via the API and appears instantly in Work → Tasks. */
import { useEffect, useState } from "react";
import { Modal } from "./ui";
import { employees } from "@/data/core";
import { projects, tasks } from "@/data/work";
import { api } from "@/lib/api";
import { useToast } from "@/lib/store";
import { wsc } from "@/lib/ws";

export function TaskQuickCreate({
  open,
  onClose,
  initialTitle = "",
  source,
}: {
  open: boolean;
  onClose: () => void;
  initialTitle?: string;
  source: string; // e.g. "chat · #engineering" or "meeting · Sprint Review"
}) {
  const [title, setTitle] = useState(initialTitle);
  const [assignee, setAssignee] = useState("e2");
  // Project ids come from the server, so default to whichever is first.
  const [projectId, setProjectId] = useState(() => projects[0]?.id ?? "");
  const [due, setDue] = useState("2026-09-05");
  const { push } = useToast();

  useEffect(() => {
    if (open) setTitle(initialTitle);
  }, [open, initialTitle]);

  const create = async () => {
    if (!title.trim()) return;
    const created = await api.create("tasks", {
      code: `QT-${tasks.length + 1}`,
      title: title.trim(),
      projectId,
      assignees: [assignee],
      due,
      status: "Todo",
      priority: "Medium",
      label: source,
      hours: 0,
    });
    // reflect immediately in the Work module (hydrated array is shared app-wide)
    tasks.push(
      (created as (typeof tasks)[number] | null) ?? {
        id: `qt${Date.now()}`,
        code: `QT-${tasks.length + 1}`,
        title: title.trim(),
        projectId,
        assignees: [assignee],
        due,
        status: "Todo",
        priority: "Medium",
        label: source,
        hours: 0,
      }
    );
    const who = employees.find((e) => e.id === assignee)?.name ?? "someone";
    wsc.send({ type: "notify", text: `assigned "${title.trim()}" to ${who}` });
    push(`Task created & assigned to ${who}`);
    setTitle("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create task" wide>
      <div className="space-y-4">
        <label className="block">
          <span className="lbl">Task title <span className="text-bad">*</span></span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
        </label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block">
            <span className="lbl">Assign to</span>
            <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="lbl">Project</span>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name.slice(0, 36)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="lbl">Due date</span>
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
        <p className="rounded-lg bg-page px-3 py-2 text-xs text-muted">Source: {source}</p>
        <div className="flex gap-3">
          <button className="btn-primary" onClick={create}>Create & Assign</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
