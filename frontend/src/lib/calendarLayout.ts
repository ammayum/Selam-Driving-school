export type CalendarItem = {
  id: number; source: "booking" | "event"; title: string; description: string;
  location: string; student_name?: string; event_type: string; status: string;
  start_time: string; end_time: string; notify_email?: boolean; reminder_minutes?: number;
  payment_status?: "paid" | "waiting" | "not_requested";
};

export type CalendarSegment = {
  item: CalendarItem; start: number; end: number; lane: number; lanes: number;
  continuesBefore: boolean; continuesAfter: boolean;
};

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const clockMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
export const minuteLabel = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(Math.floor(minute % 60)).padStart(2, "0")}`;

export function calendarDays(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start); day.setDate(day.getDate() + index); day.setHours(0, 0, 0, 0); return day;
  });
}

export function layoutDay(items: CalendarItem[], day: Date): CalendarSegment[] {
  const next = new Date(day); next.setDate(next.getDate() + 1);
  const segments: CalendarSegment[] = [];
  for (const item of items) {
    const start = new Date(item.start_time), end = new Date(item.end_time);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start || start >= next || end <= day) continue;
    const top = start < day ? 0 : clockMinutes(start);
    const bottom = end >= next ? 1440 : clockMinutes(end);
    // Wall-clock rows stay aligned through DST. A minimum hit area also keeps short
    // events and events crossing the repeated autumn hour selectable.
    segments.push({ item, start: Math.min(top, 1425), end: Math.min(1440, Math.max(top + 15, bottom)), lane: 0, lanes: 1, continuesBefore: start < day, continuesAfter: end > next });
  }
  segments.sort((a, b) => a.start - b.start || b.end - a.end || a.item.id - b.item.id || a.item.source.localeCompare(b.item.source));
  let group: CalendarSegment[] = [], ends: number[] = [], groupEnd = -1;
  const finish = () => { for (const entry of group) entry.lanes = ends.length; };
  for (const segment of segments) {
    if (segment.start >= groupEnd) { finish(); group = []; ends = []; groupEnd = -1; }
    let lane = ends.findIndex(end => end <= segment.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = segment.end; segment.lane = lane;
    group.push(segment); groupEnd = Math.max(groupEnd, segment.end);
  }
  finish();
  return segments;
}
