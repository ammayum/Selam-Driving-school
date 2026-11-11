import { useEffect, useState } from "react";
import { request } from "../api/client";

type Template = { category: string; label: string; subject: string; body: string };
const endpoint = "/admin/notification-templates";
export function NotificationTemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [draft, setDraft] = useState<Template | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    request<Template[]>(endpoint).then(rows => { setTemplates(rows); setDraft(rows[0] ?? null); })
      .catch(error => setStatus(error.message));
  }, []);
  const samples: Record<string, string> = { subject: "Booking request received (#123)", details: "Example notification details.\nBooking: #123\nYour actual booking details or secure account link appear here.", site_name: "Selam Driving School", site_url: window.location.origin };
  const preview = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => samples[key] ?? match);
  return <article className="card">
    <h3>Notification Email Templates</h3>
    <p>Edit email subjects and messages. Changes apply to new emails only; queued and sent messages keep their original content. Delivery settings remain under Settings.</p>
    <p>Available placeholders: <code>{"{{subject}}, {{details}}, {{site_name}}, {{site_url}}"}</code>. Keep <code>{"{{details}}"}</code> in the body so booking information, reset tokens and secure links are preserved. Plain text only.</p>
    {draft && <form className="form-grid" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setStatus("");
      try {
        const rows = await request<Template[]>(endpoint, { method: "PUT", body: JSON.stringify(draft) });
        setTemplates(rows); setDraft(rows.find(row => row.category === draft.category) ?? null); setStatus("Notification template saved.");
      } catch(error) { setStatus(error instanceof Error ? error.message : "Save failed"); }
      finally { setBusy(false); }
    }}><fieldset className="form-grid" disabled={busy}>
      <label>Notification type<select value={draft.category} onChange={event => { setDraft(templates.find(row => row.category === event.target.value) ?? null); setStatus(""); }}>{templates.map(row => <option key={row.category} value={row.category}>{row.label}</option>)}</select></label>
      <label>Email subject<input required maxLength={200} value={draft.subject} onChange={event => setDraft({...draft, subject:event.target.value})} /></label>
      <label>Email message<textarea required rows={10} maxLength={12000} value={draft.body} onChange={event => setDraft({...draft, body:event.target.value})} /></label>
      <div className="hero-actions"><button className="btn btn-gold" type="submit">Save Notification Template</button><button className="mini-btn" type="button" onClick={() => setDraft({...draft, subject:"{{subject}}",body:"{{details}}"})}>Restore Default Draft</button></div>
      <h4>Sample Preview (No Email Sent)</h4>
      <strong>{preview(draft.subject)}</strong><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{preview(draft.body)}</p>
    </fieldset></form>}
    <p role="status">{status}</p>
  </article>;
}
