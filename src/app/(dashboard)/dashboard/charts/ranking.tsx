"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import { CHART_SEQUENTIAL_BLUE } from "@/lib/charts/theme";

export function RankingChart({
  dados,
}: {
  dados: { nome: string; total: number; dias_trabalhados: number; media_dia: number }[];
}) {
  const options: Highcharts.Options = {
    chart: { type: "bar" },
    xAxis: { categories: dados.map((d) => d.nome) },
    yAxis: { allowDecimals: false, title: { text: undefined } },
    tooltip: {
      pointFormatter(this: Highcharts.Point) {
        const d = dados[this.index];
        return `<b>${d.total}</b> bipagens<br/>média de <b>${d.media_dia}</b>/dia (${d.dias_trabalhados} dia(s) trabalhado(s))`;
      },
    },
    legend: { enabled: false },
    series: [
      {
        type: "bar",
        name: "Total",
        color: CHART_SEQUENTIAL_BLUE[2],
        data: dados.map((d) => ({ y: d.total, mediaDia: d.media_dia })),
        dataLabels: { enabled: true, format: "{y} · {point.mediaDia}/dia", crop: false, overflow: "allow" },
      },
    ],
  };

  return (
    <HighchartsChart
      options={options}
      isEmpty={dados.length === 0}
      height={Math.max(320, dados.length * 40)}
    />
  );
}
