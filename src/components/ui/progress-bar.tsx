export function ProgressBar({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="h-[6px] w-full overflow-hidden rounded-[4px] bg-track">
      <div
        className="h-full rounded-[4px] transition-[width] duration-150 ease-out"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}
