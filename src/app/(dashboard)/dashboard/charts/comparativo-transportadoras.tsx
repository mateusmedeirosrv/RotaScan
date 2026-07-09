"use client";

import type Highcharts from "highcharts";
import { HighchartsChart } from "@/components/charts/highcharts-chart";
import { corTransportadora, formatarDiaCurto } from "@/lib/charts/theme";
import type { DashboardKpis } from "@/lib/types/database.types";

export function ComparativoTransportadorasChart({
  dados,
}: {
  dados: DashboardKpis["por_dia_transportadora"];
}) {
  const dias = [...new Set(dados.map((d) => d.dia))].sort();
  const transportadoras = [...new Set(dados.map((d) => d.transportadora))];

  const series = transportadoras.map((nome, i) => {
    const porDia = new Map(dados.filter((d) => d.transportadora === nome).map((d) => [d.dia, d.total]));
    const valores = dias.map((dia) => porDia.get(dia) ?? 0);
    const pontos = valores.map((total, idx) => {
      const anterior = idx > 0 ? valores[idx - 1] : null;
      const variacao = anterior && anterior > 0 ? ((total - anterior) / anterior) * 100 : null;
      return { y: total, variacao };
    });
    return {
      type: "line" as const,
      name: nome,
      color: corTransportadora(nome, i),
      lineWidth: 2,
      marker: { enabled: false },
      data: pontos,
    };
  });

  const options: Highcharts.Options = {
    chart: { type: "line" },
    xAxis: { categories: dias.map(formatarDiaCurto) },
    yAxis: { allowDecimals: false, title: { text: undefined } },
    tooltip: {
      shared: true,
      pointFormatter(this: Highcharts.Point) {
        const variacao = (this as unknown as { variacao: number | null }).variacao;
        const variacaoTexto =
          variacao === null
            ? ""
            : ` <span style="color:${variacao >= 0 ? "var(--chart-3)" : "var(--destructive)"}">(${
                variacao >= 0 ? "+" : ""
              }${variacao.toFixed(1)}%)</span>`;
        return `<span style="color:${this.color}">●</span> ${this.series.name}: <b>${this.y}</b>${variacaoTexto}<br/>`;
      },
    },
    series,
  };

  return <HighchartsChart options={options} isEmpty={dados.length === 0} />;
}
