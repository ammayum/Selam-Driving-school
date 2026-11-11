import { FormEvent, useState } from "react";
import { request } from "../api/client";
import { CalendarItem } from "../lib/calendarLayout";

const localTime = (value: string) => {
  const date = new Date(value);
  return new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function BookingTimeEditor({ booking, onSaved }: { booking: CalendarItem; onSaved: (start: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(() => localTime(booking.start_time));
  const [end, setEnd] = useState(() => localTime(booking.end_time));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setError("");
    const from = new Date(start), until = new Date(end);
    if (!Number.isFinite(+from) || !Number.isFinite(+until) || until <= from) { setError("End time must be after start time."); return; }
    setBusy(true);
    try {
      await request(`/bookings/${booking.id}`, { method: "PATCH", body: JSON.stringify({ start_time: from.toISOString(), end_time: until.toISOString() }) });
      onSaved(start.slice(0, 10));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update booking times."); }
    finally { setBusy(false); }
  }
  if (!editing) return <button onClick={() => setEditing(true)}>Edit booking times</button>;
  return <form className="booking-time-editor" onSubmit={save}>
    <h3>Edit booking times</h3>
    <p>Times are in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Saving reschedules this booking and uses the existing booking notifications.</p>
    {error && <p role="alert" className="schedule-error">{error}</p>}
    <fieldset disabled={busy}>
      <label>Booking start<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>
      <label>Booking end<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} /></label>
      <div className="schedule-actions"><button type="submit">{busy ? "Saving booking..." : "Save booking times"}</button><button type="button" onClick={() => { setStart(localTime(booking.start_time)); setEnd(localTime(booking.end_time)); setError(""); setEditing(false); }}>Cancel time edit</button></div>
    </fieldset>
  </form>;
}
