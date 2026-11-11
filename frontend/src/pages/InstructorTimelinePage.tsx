import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, request } from "../api/client";
import { Seo } from "../components/Seo";
import { User } from "../types";
import { InstructorCalendar, paymentLabel } from "../components/InstructorCalendar";
import { BookingTimeEditor } from "../components/BookingTimeEditor";
import { CalendarItem, localDateKey } from "../lib/calendarLayout";
import "./InstructorTimelinePage.css";

type Item = CalendarItem;
type Alert = { id: number; title: string; message: string; read_at: string | null };
const local = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const stamp = (value: string) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const blank = () => { const start = new Date(); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1); return { title: "", description: "", location: "", event_type: "meeting", start_time: local(start), end_time: local(new Date(+start + 3600000)), notify_email: false, reminder_minutes: 30 }; };

export function InstructorTimelinePage() {
  const [role, setRole] = useState("");
  const [instructor, setInstructor] = useState(0);
  const [instructors, setInstructors] = useState<User[]>([]);
  const [date, setDate] = useState(local(new Date()).slice(0, 10));
  const [days, setDays] = useState(7);
  const [nowRequest, setNowRequest] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, refresh] = useState(0);
  const [selected, setSelected] = useState<Item | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [form, setForm] = useState(blank);
  const start = new Date(`${date}T00:00:00`);
  if (days === 7) start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start); end.setDate(end.getDate() + days);
  const from = start.toISOString(), until = end.toISOString();

  useEffect(() => { let active = true; api.checkSession().then(async session => {
    if (!active) return;
    if (session.role !== "admin" && session.role !== "instructor") throw new Error("Sign in with an instructor or admin account to view schedules.");
    setRole(session.role);
    if (session.role === "admin") { const list = await api.listInstructors(); if (active) { setInstructors(list); setInstructor(list[0]?.id || 0); } }
    else setInstructor(session.user_id);
  }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);

  useEffect(() => {
    if (!instructor) return;
    let active = true;
    setLoading(true); setItems([]); setSelected(null); setError("");
    const query = new URLSearchParams({ instructor_id: String(instructor), start: from, end: until });
    request<{items: Item[]}>(`/instructor/timeline?${query}`).then(data => { if (active) setItems(data.items); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [instructor, from, until, revision]);

  useEffect(() => {
    if (!instructor) return;
    let active = true; setAlerts([]); setUnread(0);
    const load = () => request<{items: Alert[]; unread_count: number}>(`/instructor/event-notifications?instructor_id=${instructor}`).then(data => { if (active) { setAlerts(data.items); setUnread(data.unread_count); } }).catch(e => { if (active) setError(e.message); });
    void load(); const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [instructor, revision]);

  const act = async (operation: () => Promise<unknown>) => { setBusy(true); setError(""); try { await operation(); refresh(n => n + 1); setConfirmCancel(false); return true; } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); return false; } finally { setBusy(false); } };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (new Date(form.end_time) <= new Date(form.start_time)) { setError("End time must be after start time."); return; }
    const ok = await act(() => request(`/instructor/events${editing ? `/${editing}` : ""}`, { method: editing ? "PATCH" : "POST", body: JSON.stringify({ ...form, instructor_id: instructor, start_time: new Date(form.start_time).toISOString(), end_time: new Date(form.end_time).toISOString() }) }));
    if (ok) { setEditing(null); setForm(blank()); setDate(form.start_time.slice(0, 10)); }
  }
  function edit(item: Item) { setEditing(item.id); setForm({ title: item.title, description: item.description || "", location: item.location || "", event_type: item.event_type, start_time: local(new Date(item.start_time)), end_time: local(new Date(item.end_time)), notify_email: !!item.notify_email, reminder_minutes: item.reminder_minutes ?? 30 }); document.getElementById("event-editor")?.scrollIntoView({ behavior: "smooth" }); }
  function move(amount: number) { const next = new Date(start); next.setDate(next.getDate() + amount); setDate(local(next).slice(0, 10)); }
  const lastDay = new Date(end); lastDay.setDate(lastDay.getDate() - 1);

  return <section className="schedule container">
    <Seo title="Instructor Timeline | Selam Driving School" description="Private instructor bookings, events and notifications." />
    <header className="schedule-heading"><div><span className="schedule-eyebrow">INSTRUCTOR SCHEDULE</span><h1>Bookings &amp; Events</h1><p>Your lessons and plans, in one timeline.</p></div><Link to="/portal">Back to portal</Link></header>
    {error && <p role="alert" className="schedule-error">{error}</p>}
    {bookingMessage && <p role="status">{bookingMessage}</p>}
    {!role ? <Link to="/login">Sign in to continue</Link> : <>
      <div className="schedule-controls">
        {role === "admin" && <label>Instructor<select value={instructor} disabled={busy} onChange={e => { setInstructor(Number(e.target.value)); setEditing(null); setForm(blank()); }}>{instructors.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>}
        <button onClick={() => move(-days)} aria-label="Previous period">Previous</button><button onClick={() => { setDate(localDateKey(new Date())); setNowRequest(value => value + 1); }}>Now</button><button onClick={() => move(days)} aria-label="Next period">Next</button>
        <label>Date<input type="date" value={date} onChange={e => { if (e.target.value && /^\d{4}-/.test(e.target.value)) setDate(e.target.value); }} /></label>
        <label>View<select aria-label="View" value={days} onChange={e => setDays(Number(e.target.value))}><option value={1}>Day</option><option value={3}>3 days</option><option value={7}>Week</option></select></label>
        <button disabled={loading} onClick={() => refresh(value => value + 1)}>Refresh</button>
        <button onClick={() => { setEditing(null); setForm(blank()); document.getElementById("event-editor")?.scrollIntoView({ behavior: "smooth" }); }}>+ Add event</button>
      </div>
      <div className="calendar-period"><h2>{start.toLocaleDateString([], { month: "long", year: "numeric" })}</h2><span>{start.toLocaleDateString([], { day: "numeric", month: "short" })}{days > 1 && ` - ${lastDay.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`}</span></div>
      <p className="schedule-key"><span>Bookings</span><span>Events</span> All times: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Tap a date for a larger day view.</p>
      <InstructorCalendar items={items} start={from} days={days} loading={loading} nowRequest={nowRequest} onSelect={item => { setSelected(item); setConfirmCancel(false); }} onDay={value => { setDate(value); setDays(1); }} />
      <p className="calendar-summary" role="status">{loading ? "Loading schedule..." : !items.length ? "No bookings or events in this period." : `${items.length} bookings and events. Select a card for full details below.`}</p>
      {selected && <article className="schedule-detail"><h2>{selected.student_name || selected.title}</h2>{selected.source === "booking" && <p>Payment: {paymentLabel(selected)}</p>}<p>{stamp(selected.start_time)} - {stamp(selected.end_time)}</p><p>{selected.location || "No location specified"} / {selected.status}</p><p className="schedule-description">{selected.description}</p>{selected.source === "booking" ? <><BookingTimeEditor key={`${selected.id}-${selected.start_time}-${selected.end_time}`} booking={selected} onSaved={day => { setDate(day); setBookingMessage("Booking times updated."); refresh(value => value + 1); }} /><p><Link to="/portal">Manage other booking details in portal</Link></p></> : selected.status !== "cancelled" && <div className="schedule-actions"><button disabled={busy} onClick={() => edit(selected)}>Edit event</button><button disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel event</button>{confirmCancel && <><span>Cancel this event and notify the instructor?</span><button disabled={busy} onClick={() => act(() => request(`/instructor/events/${selected.id}`, { method: "DELETE" }))}>Confirm cancellation</button><button onClick={() => setConfirmCancel(false)}>Keep event</button></>}</div>}</article>}
      <div className="schedule-panels">
        <form id="event-editor" onSubmit={save} className="schedule-panel"><h2>{editing ? "Edit event" : "Add an event"}</h2><p>Events do not block lesson availability. Existing booking rules remain unchanged.</p>
          <fieldset disabled={busy || !instructor}>
            <label>Event title<input required maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
            <label>Event type<select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>{["meeting", "driving_test", "training", "personal", "other"].map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></label>
            <label>Starts<input type="datetime-local" required value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></label>
            <label>Ends<input type="datetime-local" required value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></label>
            <label>Location<input maxLength={255} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label>
            <label>Description<textarea maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <label>Reminder<select value={form.reminder_minutes} onChange={e => setForm({ ...form, reminder_minutes: Number(e.target.value) })}>{[[0, "None"], [15, "15 minutes before"], [30, "30 minutes before"], [60, "1 hour before"], [1440, "1 day before"]].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
            <label className="schedule-checkbox"><input type="checkbox" checked={form.notify_email} onChange={e => setForm({ ...form, notify_email: e.target.checked })} /> Also email the instructor about changes and reminders</label>
            <div className="schedule-actions"><button type="submit">{busy ? "Saving..." : editing ? "Save changes" : "Create event"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(blank()); }}>Discard edit</button>}</div>
          </fieldset>
        </form>
        <section className="schedule-panel"><h2>Event notifications <span className="schedule-count" aria-label={`${unread} unread`}>{unread}</span></h2><p>Updates automatically every 30 seconds.</p><div className="schedule-alerts">{!alerts.length && <p>No event notifications yet.</p>}{alerts.map(alert => <article key={alert.id} className={alert.read_at ? "" : "unread"}><h3>{alert.title}</h3><p>{alert.message}</p>{!alert.read_at && <button disabled={busy} onClick={() => act(() => request(`/instructor/event-notifications/${alert.id}/read`, { method: "PATCH" }))}>Mark as read</button>}</article>)}</div></section>
      </div>
    </>}
  </section>;
}
