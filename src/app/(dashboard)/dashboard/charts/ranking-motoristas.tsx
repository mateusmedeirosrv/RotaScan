"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import { CHART_SEQUENTIAL_BLUE, CHART_SEQUENTIAL_RED } from "@/lib/charts/theme";

export function RankingMotoristasChart({
  dados,
}: {
  dados: {
    motorista: string;
    total: number;
    unicos: number;
    duplicados: number;
    dias_trabalhados: number;
    media_dia: number;
  }[];
}) {
  const options: Highcharts.Options = {
    chart: { type: "bar" },
    xAxis: { categories: dados.map((d) => d.motorista) },
    yAxis: { allowDecimals: false, title: { text: undefined }, stackLabels: { enabled: false } },
    plotOptions: { series: { stacking: "normal" } },
    tooltip: {
      pointFormatter(this: Highcharts.Point) {
        const d = dados[this.index];
        return `<b>${d.total}</b> bipagens (${d.unicos} único · ${d.duplicados} duplicado)<br/>média de <b>${d.media_dia}</b>/dia (${d.dias_trabalhados} dia(s) trabalhado(s))`;
      },
    },
    series: [
      {
        type: "bar",
        name: "Único",
        color: CHART_SEQUENTIAL_BLUE[2],
        data: dados.map((d) => d.unicos),
      },
      {
        type: "bar",
        name: "Duplicado",
        color: CHART_SEQUENTIAL_RED[2],
        data: dados.map((d) => d.duplicados),
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
