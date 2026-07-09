"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import { CHART_SEQUENTIAL_BLUE, TIPO_EVENTO_LABEL } from "@/lib/charts/theme";
import type { DashboardKpis, TipoEvento } from "@/lib/types/database.types";

const ORDEM_TIPO_EVENTO: TipoEvento[] = [
  "RECEBIMENTO",
  "ENTREGA",
  "DEVOLUCAO_ORIGEM",
  "RETORNO",
];

export function HeatmapGalpaoChart({
  dados,
}: {
  dados: DashboardKpis["heatmap_galpao_tipo"];
}) {
  const galpoes = [...new Set(dados.map((d) => d.galpao))].sort();
  const tipos = ORDEM_TIPO_EVENTO.filter((t) => dados.some((d) => d.tipo_evento === t));

  const pontos = dados.map((d) => [
    tipos.indexOf(d.tipo_evento),
    galpoes.indexOf(d.galpao),
    d.total,
  ]);
  const max = Math.max(1, ...dados.map((d) => d.total));

  const options: Highcharts.Options = {
    chart: { type: "heatmap" },
    xAxis: { categories: tipos.map((t) => TIPO_EVENTO_LABEL[t] ?? t) },
    yAxis: { categories: galpoes, title: { text: undefined } },
    colorAxis: {
      min: 0,
      max,
      stops: CHART_SEQUENTIAL_BLUE.map((cor, i) => [i / (CHART_SEQUENTIAL_BLUE.length - 1), cor]),
    },
    legend: { enabled: false },
    tooltip: {
      formatter(this: Highcharts.Point) {
        const p = this as unknown as { x: number; y: number; value: number };
        const galpao = galpoes[p.y];
        const tipo = tipos[p.x];
        return `<b>${galpao}</b> · ${TIPO_EVENTO_LABEL[tipo] ?? tipo}<br/><b>${p.value}</b> bipagens`;
      },
    },
    series: [
      {
        type: "heatmap",
        name: "Bipagens",
        data: pontos,
        dataLabels: { enabled: true, style: { textOutline: "none", color: "var(--foreground)" } },
      },
    ],
  };

  return <HighchartsChart options={options} isEmpty={dados.length === 0} height={Math.max(280, galpoes.length * 90)} />;
}
