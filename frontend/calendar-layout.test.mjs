import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
process.env.TZ = 'Europe/London';
const source = fs.readFileSync('src/lib/calendarLayout.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { layoutDay, calendarDays, localDateKey } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const item = (id, start, end) => ({ id, source: 'event', title: `Event ${id}`, start_time: start, end_time: end });
test('dates are local dates, including DST changes', () => {
  const dates = calendarDays(new Date('2026-03-28T00:00:00'), 3);
  assert.deepEqual(dates.map(localDateKey), ['2026-03-28', '2026-03-29', '2026-03-30']);
  assert.ok(dates.every(date => date.getHours() === 0));
});
test('hours map to vertical wall-clock position and overlaps use lanes', () => {
  const result = layoutDay([item(1,'2026-09-21T09:00:00+01:00','2026-09-21T11:00:00+01:00'), item(2,'2026-09-21T09:30:00+01:00','2026-09-21T10:30:00+01:00'), item(3,'2026-09-21T11:00:00+01:00','2026-09-21T12:00:00+01:00')], new Date('2026-09-21T00:00:00'));
  assert.deepEqual(result.map(x => [x.start,x.end,x.lane,x.lanes]), [[540,660,0,2],[570,630,1,2],[660,720,0,1]]);
});
test('overnight events split, and midnight endings do not spill into next day', () => {
  const events = [item(1,'2026-09-21T23:00:00+01:00','2026-09-22T01:00:00+01:00'),item(2,'2026-09-21T22:00:00+01:00','2026-09-22T00:00:00+01:00')];
  const monday = layoutDay(events, new Date('2026-09-21T00:00:00'));
  const tuesday = layoutDay(events, new Date('2026-09-22T00:00:00'));
  assert.equal(monday.find(x => x.item.id === 1).end, 1440);
  assert.equal(monday.find(x => x.item.id === 1).continuesAfter, true);
  assert.equal(tuesday.length, 1);
  assert.deepEqual([tuesday[0].start,tuesday[0].end,tuesday[0].continuesBefore], [0,60,true]);
});
test('short, invalid, spring-forward and repeated-hour events remain bounded', () => {
  assert.deepEqual(layoutDay([item(1,'bad','bad')], new Date('2026-09-21T00:00:00')), []);
  const short = layoutDay([item(1,'2026-09-21T23:59:00+01:00','2026-09-22T00:00:00+01:00')], new Date('2026-09-21T00:00:00'))[0];
  assert.ok(short.start >= 0 && short.end <= 1440 && short.end > short.start);
  const spring = layoutDay([item(1,'2026-03-29T08:00:00+01:00','2026-03-29T09:00:00+01:00')],new Date('2026-03-29T00:00:00'))[0];
  assert.equal(spring.start,480);
  const autumn = layoutDay([item(1,'2026-10-25T01:45:00+01:00','2026-10-25T01:15:00Z')],new Date('2026-10-25T00:00:00'))[0];
  assert.ok(autumn.end > autumn.start);
});
