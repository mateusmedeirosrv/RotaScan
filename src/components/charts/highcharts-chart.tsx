"use client";

import Highcharts from "highcharts/esm/highcharts";
import HighchartsReact from "highcharts-react-official";
import "highcharts/esm/highcharts-more";
import "highcharts/esm/modules/treemap";
import "highcharts/esm/modules/sankey";
import "highcharts/esm/modules/funnel";
import "highcharts/esm/modules/heatmap";
import "highcharts/esm/modules/exporting";
import "highcharts/esm/modules/export-data";
import "highcharts/esm/modules/accessibility";
import { CHART_CATEGORICAL } from "@/lib/charts/theme";
import { EmptyState } from "@/components/charts/empty-state";

if (typeof Highcharts === "object") {
  Highcharts.setOptions({
    lang: {
      decimalPoint: ",",
      thousandsSep: ".",
      viewFullscreen: "Tela cheia",
      exitFullscreen: "Sair da tela cheia",
      downloadPNG: "Baixar imagem PNG",
      downloadJPEG: "Baixar imagem JPEG",
      downloadPDF: "Baixar documento PDF",
      downloadSVG: "Baixar imagem vetorial SVG",
      downloadCSV: "Baixar CSV",
      downloadXLS: "Baixar XLS",
      viewData: "Ver tabela de dados",
      hideData: "Ocultar tabela de dados",
      noData: "Sem dados no período selecionado",
    },
    colors: [...CHART_CATEGORICAL],
    credits: { enabled: false },
    chart: {
      backgroundColor: "transparent",
      style: { fontFamily: "var(--font-sans, sans-serif)" },
    },
    title: { text: undefined },
    subtitle: { text: undefined },
    xAxis: {
      gridLineColor: "var(--border)",
      lineColor: "var(--border)",
      tickColor: "var(--border)",
      labels: { style: { color: "var(--muted-foreground)", fontSize: "12px" } },
    },
    yAxis: {
      gridLineColor: "var(--border)",
      lineColor: "var(--border)",
      tickColor: "var(--border)",
      labels: { style: { color: "var(--muted-foreground)", fontSize: "12px" } },
      title: { text: undefined },
    },
    legend: {
      itemStyle: { color: "var(--foreground)", fontWeight: "normal", fontSize: "12px" },
      itemHoverStyle: { color: "var(--primary)" },
      maxHeight: 80,
    },
    tooltip: {
      backgroundColor: "var(--card)",
      borderColor: "var(--border)",
      borderRadius: 8,
      style: { color: "var(--card-foreground)", fontSize: "12px" },
    },
    plotOptions: {
      series: {
        animation: { duration: 300 },
        dataLabels: {
          style: {
            color: "var(--foreground)",
            fontSize: "11px",
            fontWeight: "normal",
            textOutline: "none",
          },
        },
      },
    },
  });
}

export function HighchartsChart({
  options,
  isEmpty,
  emptyMessage,
  height = 320,
}: {
  options: Highcharts.Options;
  isEmpty?: boolean;
  emptyMessage?: string;
  height?: number;
}) {
  if (isEmpty) {
    return <EmptyState message={emptyMessage} height={height} />;
  }

  return (
    <div style={{ height }}>
      <HighchartsReact
        highcharts={Highcharts}
        options={{ chart: { height, spacingBottom: 12, ...options.chart }, ...options }}
        containerProps={{ style: { height: "100%" } }}
      />
    </div>
  );
}
