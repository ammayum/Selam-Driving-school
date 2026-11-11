import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { CalendarItem, calendarDays, clockMinutes, layoutDay, localDateKey, minuteLabel } from "../lib/calendarLayout";

const stamp = (value: string) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
export function paymentLabel(item: CalendarItem): string {
  if (item.source !== "booking") return item.event_type.replace(/_/g, " ");
  return item.payment_status === "paid" ? "Paid" : item.payment_status === "waiting" ? "Unpaid" : "Not requested";
}

export function InstructorCalendar({ items, start, days, loading, nowRequest, onSelect, onDay }: {
  items: CalendarItem[]; start: string; days: number; loading: boolean; nowRequest: number;
  onSelect: (item: CalendarItem) => void; onDay: (date: string) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const dates = useMemo(() => calendarDays(new Date(start), days), [start, days]);
  const columns = useMemo(() => dates.map(day => layoutDay(items, day)), [items, dates]);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const view = scroll.current; if (!view) return;
    const hourHeight = parseFloat(getComputedStyle(view).getPropertyValue("--calendar-hour")) || 64;
    const hour = nowRequest ? Math.max(0, clockMinutes(new Date()) / 60 - 1) : 7;
    view.scrollTop = Math.max(0, hour * hourHeight - 12);
  }, [start, days, nowRequest]);

  return <div className="schedule-scroll calendar-scroll" ref={scroll} tabIndex={0} aria-label="Calendar: dates in columns and hours in rows" aria-busy={loading}>
    <div className="calendar-grid" style={{ "--calendar-days": days } as CSSProperties}>
      <div className="calendar-header">
        <span className="calendar-corner">Time</span>
        {dates.map(day => <button className={`calendar-date ${localDateKey(day) === localDateKey(now) ? "is-today" : ""}`} key={+day} aria-label={`View ${day.toLocaleDateString([], { dateStyle: "full" })}`} aria-current={localDateKey(day) === localDateKey(now) ? "date" : undefined} onClick={() => onDay(localDateKey(day))}><span>{day.toLocaleDateString([], { weekday: "short" })}</span><strong>{day.getDate()}</strong></button>)}
      </div>
      <div className="calendar-body">
        <div className="calendar-hours" aria-hidden="true">{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: `${hour / 24 * 100}%` }}>{minuteLabel(hour * 60)}</span>)}</div>
        {dates.map((day, index) => <div className={`calendar-day ${localDateKey(day) === localDateKey(now) ? "is-today" : ""}`} key={+day} aria-label={day.toLocaleDateString([], { dateStyle: "full" })}>
          {columns[index].map(segment => {
            const item = segment.item;
            const title = item.student_name || item.title;
            return <button key={`${item.source}-${item.id}`} className={`calendar-event ${item.source} ${item.status} ${segment.end - segment.start < 45 ? "is-short" : ""}`} data-event-id={`${item.source}-${item.id}`} data-start-minute={segment.start}
              style={{ top: `${segment.start / 1440 * 100}%`, height: `${(segment.end - segment.start) / 1440 * 100}%`, left: `calc(${segment.lane / segment.lanes * 100}% + 1px)`, width: `calc(${100 / segment.lanes}% - 2px)` }}
              aria-label={`${item.title}, ${stamp(item.start_time)} to ${stamp(item.end_time)}, ${item.status}${item.source === "booking" ? `, ${paymentLabel(item)}` : ""}`}
              title={`${title}\n${stamp(item.start_time)} - ${stamp(item.end_time)}\n${item.status} / ${paymentLabel(item)}`}
              onClick={() => onSelect(item)}>
              <span className="calendar-event-copy"><strong>{title}</strong><span>{segment.continuesBefore ? "From previous day" : new Date(item.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</span><span>{segment.continuesAfter ? "Continues tomorrow" : new Date(item.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</span></span>
              <span className={`calendar-event-badge ${item.source === "booking" ? item.payment_status || "not_requested" : "event-type"}`}>{item.status === "cancelled" ? "Cancelled" : paymentLabel(item)}</span>
            </button>;
          })}
          {localDateKey(day) === localDateKey(now) && <div className="calendar-now" style={{ top: `${clockMinutes(now) / 1440 * 100}%` }} aria-label={`Current time ${minuteLabel(clockMinutes(now))}`}><span /></div>}
        </div>)}
      </div>
    </div>
  </div>;
}
