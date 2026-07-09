"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import { CHART_CATEGORICAL, formatarDiaCurto } from "@/lib/charts/theme";
import type { DashboardKpis } from "@/lib/types/database.types";

export function VolumeDiarioChart({ dados }: { dados: DashboardKpis["por_dia"] }) {
  const options: Highcharts.Options = {
    chart: { type: "area" },
    xAxis: { categories: dados.map((d) => formatarDiaCurto(d.dia)) },
    yAxis: { allowDecimals: false, title: { text: undefined } },
    tooltip: { headerFormat: "{point.key}<br/>", pointFormat: "<b>{point.y}</b> bipagens" },
    legend: { enabled: false },
    series: [
      {
        type: "area",
        name: "Bipagens",
        data: dados.map((d) => d.total),
        color: CHART_CATEGORICAL[1],
        fillOpacity: 0.12,
        lineWidth: 2,
        marker: { enabled: false, symbol: "circle" },
      },
    ],
  };

  return <HighchartsChart options={options} isEmpty={dados.length === 0} />;
}
