"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import { corTransportadora } from "@/lib/charts/theme";
import type { DashboardKpis } from "@/lib/types/database.types";

export function PorTransportadoraChart({
  dados,
}: {
  dados: DashboardKpis["por_transportadora"];
}) {
  const options: Highcharts.Options = {
    chart: { type: "column" },
    xAxis: { categories: dados.map((d) => d.transportadora) },
    yAxis: { allowDecimals: false, title: { text: undefined } },
    tooltip: { pointFormat: "<b>{point.y}</b> bipagens" },
    legend: { enabled: false },
    series: [
      {
        type: "column",
        name: "Bipagens",
        data: dados.map((d, i) => ({ y: d.total, color: corTransportadora(d.transportadora, i) })),
      },
    ],
  };

  return <HighchartsChart options={options} isEmpty={dados.length === 0} />;
}
