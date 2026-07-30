"use client";

export function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return <div className="spark" aria-hidden />;
  }
  const max = Math.max(...values, 1);
  const shown = values.slice(-48);
  return (
    <div className="spark" title="Muestras de throughput">
      {shown.map((v, i) => (
        <i
          key={i}
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
