// Paleta validada com scripts/validate_palette.js (skill dataviz) a partir das
// cores de marca do projeto (--chart-1..5 em src/app/globals.css).
export const CHART_CATEGORICAL = [
  "#ed6f00", // Amazon — laranja
  "#0079fb", // Magalu — azul
  "#009a60", // verde
  "#a870e1", // roxo
  "#bd413f", // terracota
] as const;

export const CHART_SEQUENTIAL_BLUE = [
  "#82b1ec",
  "#4e91e2",
  "#1070d1",
  "#004fba",
  "#002e99",
] as const;

export const CHART_SEQUENTIAL_RED = [
  "#eb9288",
  "#e45d53",
  "#e7000b",
  "#ba0000",
  "#940000",
] as const;

export const TIPO_EVENTO_LABEL: Record<string, string> = {
  RECEBIMENTO: "Recebimento",
  ENTREGA: "Entrega",
  DEVOLUCAO_ORIGEM: "Devolução à Origem",
  RETORNO: "Retorno",
};

export const TIPO_EVENTO_COLOR: Record<string, string> = {
  RECEBIMENTO: CHART_CATEGORICAL[0],
  ENTREGA: CHART_CATEGORICAL[1],
  DEVOLUCAO_ORIGEM: CHART_CATEGORICAL[2],
  RETORNO: CHART_CATEGORICAL[3],
};

// Identidade fixa por transportadora (marca) — extras caem na paleta restante.
const TRANSPORTADORA_COLOR: Record<string, string> = {
  Amazon: CHART_CATEGORICAL[0],
  "Magazine Luiza": CHART_CATEGORICAL[1],
};

export function corTransportadora(nome: string, indiceExtra: number) {
  return TRANSPORTADORA_COLOR[nome] ?? CHART_CATEGORICAL[(2 + indiceExtra) % CHART_CATEGORICAL.length];
}

export function formatarDiaCurto(dia: string) {
  const [, mes, dd] = dia.split("-");
  return `${dd}/${mes}`;
}
