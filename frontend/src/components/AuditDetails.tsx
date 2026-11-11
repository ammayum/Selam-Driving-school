export function AuditDetails({ details }: { details: string | null }) {
  if (!details) return <>-</>;
  try {
    const { changes } = JSON.parse(details);
    if (changes && typeof changes === "object" && !Array.isArray(changes)) {
      return <ul>{Object.entries(changes).map(([field, value]) => {
        const change = value as { changed?: boolean; from?: unknown; to?: unknown };
        return <li key={field}><strong>{field.replace(/_/g, " ")}</strong>: {change.changed ? "updated (private)" : `${String(change.from ?? "not recorded")} -> ${String(change.to ?? "not recorded")}`}</li>;
      })}</ul>;
    }
  } catch { /* Older audit entries may contain plain text. */ }
  return <>{details}</>;
}
