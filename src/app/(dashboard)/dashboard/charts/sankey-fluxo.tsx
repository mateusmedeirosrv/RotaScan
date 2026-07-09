"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import type { DashboardKpis } from "@/lib/types/database.types";

export function SankeyFluxoChart({
  dados,
}: {
  dados: DashboardKpis["sankey_fluxo"];
}) {
  const linksBrutos: [string, string, number][] = [
    ["Recebido", "Entregue", dados.entregue],
    ["Recebido", "Devolvido à Origem", dados.devolvido],
    ["Recebido", "Retornado", dados.retornado],
    ["Recebido", "Em aberto", dados.em_aberto],
  ];
  const links = linksBrutos.filter(([, , peso]) => peso > 0);

  const options: Highcharts.Options = {
    chart: { type: "sankey" },
    series: [
      {
        type: "sankey",
        name: "Fluxo de itens recebidos",
        keys: ["from", "to", "weight"],
        data: links,
        tooltip: {
          nodeFormat: "<b>{point.name}</b>: {point.sum}",
          pointFormat: "<b>{point.fromNode.name} → {point.toNode.name}</b>: {point.weight}",
        },
        nodes: [
          { id: "Recebido", color: "#0079fb" },
          { id: "Entregue", color: "#009a60" },
          { id: "Devolvido à Origem", color: "#bd413f" },
          { id: "Retornado", color: "#ba0000" },
          { id: "Em aberto", color: "var(--muted-foreground)" },
        ],
      },
    ],
  };

  return <HighchartsChart options={options} isEmpty={links.length === 0} height={360} />;
}
