"use client";

export function HBar({ label, value, color = "#0f4c81", suffix = "%" }: { label: string; value: number; color?: string; suffix?: string }) {
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  );
}

export function LineChart({ points }: { points: { label: string; value: number | null }[] }) {
  const W = 420, H = 150, P = 28;
  const n = points.length;
  const x = (i: number) => (n === 1 ? W / 2 : P + ((W - 2 * P) * i) / (n - 1));
  const y = (v: number) => H - P - ((H - 2 * P) * v) / 100;
  // RTL: oldest on the right -> mirror horizontally
  const xm = (i: number) => W - x(i);
  const pts = points.map((p, i) => (p.value === null ? null : [xm(i), y(p.value)] as const));
  const path = pts.filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p![0]},${p![1]}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="رسم التطور">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="#e2e8f0" strokeDasharray="3 3" />
          <text x={W - P + 4} y={y(g) + 3} fontSize="9" fill="#94a3b8">{g}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#0f4c81" strokeWidth="2.5" />
      {points.map((p, i) => (
        <g key={i}>
          {p.value !== null && (
            <>
              <circle cx={xm(i)} cy={y(p.value)} r="4" fill="#0f4c81" />
              <text x={xm(i)} y={y(p.value) - 8} fontSize="10" textAnchor="middle" fill="#334155">{p.value}%</text>
            </>
          )}
          <text x={xm(i)} y={H - 8} fontSize="9" textAnchor="middle" fill="#64748b">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}
