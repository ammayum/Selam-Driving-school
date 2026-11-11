type Props = {
  title: string;
  value: string | number;
  note?: string;
};

export function StatCard({ title, value, note }: Props) {
  return (
    <article className="stat-card">
      <h4>{title}</h4>
      <strong>{value}</strong>
      {note ? <p>{note}</p> : null}
    </article>
  );
}
