"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Row = { periodo: string; transportadora: string; total: number };

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const CORES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatPeriodo(dateStr: string): string {
  // "2025-10-01" → "1–15 out" | "2025-10-16" → "16–31 out"
  const [y, m, d] = dateStr.split("-").map(Number);
  const mes = MESES[m - 1];
  if (d === 1) return `1–15 ${mes}`;
  const ultimoDia = new Date(y, m, 0).getDate();
  return `16–${ultimoDia} ${mes}`;
}

export function HomeEntregasChart({ rows }: { rows: Row[] }) {
  const transportadoras = [...new Set(rows.map((r) => r.transportadora))].sort();

  // Pivota: periodo → { transportadora: total }
  const mapa = new Map<string, Record<string, number>>();
  for (const { periodo, transportadora, total } of rows) {
    if (!mapa.has(periodo)) mapa.set(periodo, {});
    mapa.get(periodo)![transportadora] = total;
  }

  const data = [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, values]) => ({ periodo: formatPeriodo(periodo), ...values }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma entrega registrada nos últimos 3 meses.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={44} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          cursor={{ fill: "var(--muted)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {transportadoras.map((t, i) => (
          <Bar
            key={t}
            dataKey={t}
            stackId="stack"
            fill={CORES[i % CORES.length]}
            radius={i === transportadoras.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
