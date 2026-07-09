"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import { TIPO_EVENTO_COLOR, TIPO_EVENTO_LABEL } from "@/lib/charts/theme";
import type { DashboardKpis } from "@/lib/types/database.types";

export function DistribuicaoTipoEventoChart({
  dados,
}: {
  dados: DashboardKpis["por_tipo_evento"];
}) {
  const options: Highcharts.Options = {
    chart: { type: "pie" },
    tooltip: { pointFormat: "<b>{point.y}</b> bipagens ({point.percentage:.1f}%)" },
    legend: { enabled: true },
    series: [
      {
        type: "pie",
        name: "Bipagens",
        innerSize: "60%",
        data: dados.map((d) => ({
          name: TIPO_EVENTO_LABEL[d.tipo_evento] ?? d.tipo_evento,
          y: d.total,
          color: TIPO_EVENTO_COLOR[d.tipo_evento],
        })),
        dataLabels: { enabled: false },
      },
    ],
  };

  return <HighchartsChart options={options} isEmpty={dados.length === 0} />;
}
