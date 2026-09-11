/* Compose-and-send email modal — used for invoices, proposals, estimates,
   payment reminders. Sent mail is persisted to the "outbox" collection. */
import { Paperclip, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "./ui";
import { api } from "@/lib/api";
import { useToast } from "@/lib/store";

export function EmailComposeModal({
  open,
  onClose,
  to,
  cc = "",
  subject,
  body,
  attachment,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachment?: string;
  onSent?: () => void;
}) {
  const [vTo, setTo] = useState(to);
  const [vCc, setCc] = useState(cc);
  const [vSubject, setSubject] = useState(subject);
  const [vBody, setBody] = useState(body);
  const { push } = useToast();

  useEffect(() => {
    if (open) {
      setTo(to);
      setCc(cc);
      setSubject(subject);
      setBody(body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = () => {
    if (!vTo.trim()) return;
    void api.create("outbox", {
      to: vTo,
      cc: vCc,
      subject: vSubject,
      body: vBody,
      attachment: attachment ?? null,
      date: new Date().toISOString(),
    });
    push(`Email sent to ${vTo}`);
    onSent?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Send email" wide>
      <div className="space-y-3.5">
        <label className="flex items-center gap-3 border-b border-line pb-2 text-sm">
          <span className="w-14 shrink-0 text-muted">To</span>
          <input className="w-full bg-transparent outline-none" value={vTo} onChange={(e) => setTo(e.target.value)} placeholder="client@company.com" />
        </label>
        <label className="flex items-center gap-3 border-b border-line pb-2 text-sm">
          <span className="w-14 shrink-0 text-muted">Cc</span>
          <input className="w-full bg-transparent outline-none" value={vCc} onChange={(e) => setCc(e.target.value)} placeholder="optional" />
        </label>
        <label className="flex items-center gap-3 border-b border-line pb-2 text-sm">
          <span className="w-14 shrink-0 text-muted">Subject</span>
          <input className="w-full bg-transparent font-medium outline-none" value={vSubject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <textarea rows={8} className="input resize-y leading-relaxed" value={vBody} onChange={(e) => setBody(e.target.value)} />
        {attachment && (
          <span className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-page/70 px-3 py-1.5 text-xs font-medium">
            <Paperclip size={13} className="text-muted" /> {attachment}
            <span className="text-faint">· PDF</span>
          </span>
        )}
        <div className="flex items-center gap-3 pt-1">
          <button className="btn-primary" onClick={send}>
            <Send size={14} /> Send Email
          </button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <span className="ml-auto text-[11px] text-faint">Delivered via SMTP · Settings → Notifications</span>
        </div>
      </div>
    </Modal>
  );
}
