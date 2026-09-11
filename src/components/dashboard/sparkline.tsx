export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) return null;
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-[22px] items-end gap-[3px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[5px] rounded-t-[2px]"
          style={{ height: `${Math.max(2, Math.round((v / max) * 22))}px`, backgroundColor: color, opacity: 0.35 + (i / values.length) * 0.65 }}
        />
      ))}
    </div>
  );
}
