"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import { CHART_SEQUENTIAL_BLUE } from "@/lib/charts/theme";
import type { DashboardKpis } from "@/lib/types/database.types";

const ETAPAS = ["Recebido", "Bipado", "Em rota", "Entregue"] as const;

function taxaConversao(atual: number, anterior: number) {
  if (anterior <= 0) return null;
  return (atual / anterior) * 100;
}

export function FunilChart({
  funil,
  diferencaAbs,
  diferencaPct,
}: {
  funil: DashboardKpis["funil"];
  diferencaAbs: number;
  diferencaPct: number | null;
}) {
  const valores = [funil.recebido, funil.bipado, funil.em_rota, funil.entregue];
  const isEmpty = valores.every((v) => v === 0);

  const options: Highcharts.Options = {
    chart: { type: "funnel" },
    legend: { enabled: false },
    tooltip: { pointFormat: "<b>{point.y}</b> ({point.name})" },
    plotOptions: {
      funnel: {
        dataLabels: { enabled: true, format: "{point.name}: <b>{point.y}</b>", softConnector: true },
        neckWidth: "30%",
        neckHeight: "25%",
      },
    },
    series: [
      {
        type: "funnel",
        name: "Itens",
        data: ETAPAS.map((nome, i) => ({
          name: nome,
          y: valores[i],
          color: CHART_SEQUENTIAL_BLUE[i],
        })),
      },
    ],
  };

  const conversoes = [
    { par: "Recebido → Bipado", pct: taxaConversao(funil.bipado, funil.recebido) },
    { par: "Bipado → Em rota", pct: taxaConversao(funil.em_rota, funil.bipado) },
    { par: "Em rota → Entregue", pct: taxaConversao(funil.entregue, funil.em_rota) },
  ];

  return (
    <div className="space-y-3">
      <HighchartsChart options={options} isEmpty={isEmpty} height={300} />
      {!isEmpty && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          {conversoes.map((c) => (
            <span key={c.par}>
              {c.par}: <b className="text-foreground">{c.pct === null ? "—" : `${c.pct.toFixed(1)}%`}</b>
            </span>
          ))}
          <span>
            Diferença Receb. × Entrega:{" "}
            <b className="text-foreground">
              {diferencaAbs > 0 ? "+" : ""}
              {diferencaAbs}
              {diferencaPct !== null && ` (${diferencaPct > 0 ? "+" : ""}${diferencaPct.toFixed(1)}%)`}
            </b>
          </span>
        </div>
      )}
    </div>
  );
}
