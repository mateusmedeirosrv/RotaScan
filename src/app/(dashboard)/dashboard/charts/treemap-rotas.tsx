"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import { CHART_SEQUENTIAL_RED } from "@/lib/charts/theme";
import type { DashboardKpis } from "@/lib/types/database.types";

export function TreemapRotasChart({
  dados,
}: {
  dados: DashboardKpis["por_rota_treemap"];
}) {
  const galpoes = [...new Set(dados.map((d) => d.galpao))];

  const nosGalpao = galpoes.map((galpao) => ({
    id: `g-${galpao}`,
    name: galpao,
  }));

  const nosRota = dados.map((d) => ({
    id: `r-${d.galpao}-${d.rota}`,
    parent: `g-${d.galpao}`,
    name: d.rota,
    value: d.total,
    colorValue: d.total > 0 ? d.insucesso / d.total : 0,
  }));

  const options: Highcharts.Options = {
    chart: { type: "treemap" },
    colorAxis: {
      min: 0,
      max: 1,
      labels: { format: "{value:.0%}" },
      stops: CHART_SEQUENTIAL_RED.map((cor, i) => [i / (CHART_SEQUENTIAL_RED.length - 1), cor]),
    },
    tooltip: {
      pointFormatter(this: Highcharts.Point) {
        const p = this as unknown as { value?: number; colorValue?: number; name: string };
        if (p.value === undefined) return `<b>${p.name}</b>`;
        return `<b>${p.name}</b><br/>${p.value} bipagens · ${(((p.colorValue ?? 0) * 100)).toFixed(1)}% de insucesso`;
      },
    },
    series: [
      {
        type: "treemap",
        name: "Volume por rota",
        layoutAlgorithm: "squarified",
        allowTraversingTree: true,
        data: [...nosGalpao, ...nosRota],
        levels: [
          { level: 1, layoutAlgorithm: "squarified", dataLabels: { enabled: true, style: { fontWeight: "600" } } },
          { level: 2, dataLabels: { enabled: true } },
        ],
      },
    ],
  };

  return <HighchartsChart options={options} isEmpty={dados.length === 0} height={380} />;
}
