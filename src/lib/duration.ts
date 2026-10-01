export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatSignedDuration(minutes: number): string {
  if (minutes === 0) return "±0m";
  const sign = minutes > 0 ? "+" : "-";
  return `${sign}${formatDuration(Math.abs(minutes))}`;
}
