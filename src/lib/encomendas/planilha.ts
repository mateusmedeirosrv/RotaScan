import { SSF, utils, type WorkSheet } from "xlsx";

// Campos da planilha de Recebimento (layout v2.0). "Data Importação" e
// "Transportadora" não vêm da planilha: são preenchidos pelo sistema a partir
// do momento da importação e da operação de Recebimento.
export type EncomendaInput = {
  romaneio: string | null;
  data_romaneio: string | null; // ISO yyyy-mm-dd
  motorista: string | null;
  placa: string | null;
  remetente: string | null;
  nr_entrega: string | null;
  nome_pessoa: string | null;
  telefone: string | null;
  prazo_texto: string | null;
  prazo_final: string | null; // ISO yyyy-mm-dd
  situacao: string | null;
  dias_ate_prazo: number | null;
  cep: string | null;
  endereco: string | null;
  ponto_referencia: string | null;
  bairro: string | null;
  cidade_uf: string | null;
  regiao: string | null;
  nome_regiao: string | null;
  nota_fiscal: string | null;
  volumes: number | null;
  vol_nr: number | null;
  pedido: string | null;
};

type Campo = keyof EncomendaInput;

// Cabeçalhos aceitos por campo, já normalizados (sem acento, minúsculo, só a-z0-9).
const ALIASES: Record<Campo, string[]> = {
  romaneio: ["romaneio"],
  data_romaneio: ["dataromaneio"],
  motorista: ["motorista"],
  placa: ["placa"],
  remetente: ["remetente"],
  nr_entrega: ["nroentrega", "nrentrega", "numeroentrega", "nentrega"],
  nome_pessoa: ["nomepessoavisita", "nomepessoa", "destinatario"],
  telefone: ["telefones", "telefone"],
  prazo_texto: ["prazotexto"],
  prazo_final: ["prazofinal"],
  situacao: ["situacao"],
  dias_ate_prazo: ["diasateprazo", "diasate", "diasateoprazo"],
  cep: ["cep"],
  endereco: ["endereco"],
  ponto_referencia: ["pontoreferencia", "pontodereferencia", "referencia"],
  bairro: ["bairro"],
  cidade_uf: ["cidadeuf", "cidade"],
  regiao: ["regiao"],
  nome_regiao: ["nomeregiao"],
  nota_fiscal: ["notafiscal", "nf", "nfe"],
  volumes: ["volumes"],
  vol_nr: ["volno", "volnr", "voln", "vol", "volnumero", "volume"],
  pedido: ["pedido"],
};

const CAMPOS_DATA: Campo[] = ["data_romaneio", "prazo_final"];
const CAMPOS_INTEIRO: Campo[] = ["dias_ate_prazo", "volumes", "vol_nr"];
// Códigos: comparados com o que o scanner digita (sempre em maiúsculas)
const CAMPOS_CODIGO: Campo[] = ["nr_entrega", "pedido"];

export function normalizarCabecalho(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const limpo = String(valor).replace(/\s+/g, " ").trim();
  return limpo || null;
}

function inteiro(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", ".").trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function dataIso(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;

  if (typeof valor === "number") {
    const d = SSF.parse_date_code(valor);
    if (!d || !d.y) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }

  const s = String(valor).trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${ano}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

// Índice de coluna de cada campo, a partir da linha de cabeçalho.
function mapearColunas(cabecalho: unknown[]): Partial<Record<Campo, number>> {
  const normalizados = cabecalho.map(normalizarCabecalho);
  const mapa: Partial<Record<Campo, number>> = {};
  for (const campo of Object.keys(ALIASES) as Campo[]) {
    const indice = normalizados.findIndex((c) => ALIASES[campo].includes(c));
    if (indice >= 0) mapa[campo] = indice;
  }
  return mapa;
}

export type ResultadoPlanilhaEncomendas = {
  encomendas: EncomendaInput[];
  camposAusentes: Campo[];
};

// Lê a planilha no layout de encomendas. Retorna null se não for esse layout
// (sem coluna "Nro. Entrega"), para o chamador cair no layout antigo de
// manifesto (coluna "codigo").
export function lerPlanilhaEncomendas(sheet: WorkSheet): ResultadoPlanilhaEncomendas | null {
  // raw: valores originais (datas como serial do Excel, números);
  // formatado: texto como aparece na célula (preserva códigos longos/zeros).
  const linhasRaw = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const linhasTexto = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: null });
  if (linhasRaw.length < 2) return null;

  const colunas = mapearColunas(linhasRaw[0]);
  if (colunas.nr_entrega === undefined) return null;

  const camposAusentes = (Object.keys(ALIASES) as Campo[]).filter((c) => colunas[c] === undefined);
  const encomendas: EncomendaInput[] = [];

  for (let i = 1; i < linhasRaw.length; i++) {
    const raw = linhasRaw[i] ?? [];
    const fmt = linhasTexto[i] ?? [];
    if (raw.every((v) => v === null || v === "")) continue;

    const registro = {} as Record<Campo, string | number | null>;
    for (const campo of Object.keys(ALIASES) as Campo[]) {
      const indice = colunas[campo];
      if (indice === undefined) {
        registro[campo] = null;
      } else if (CAMPOS_DATA.includes(campo)) {
        registro[campo] = dataIso(raw[indice]);
      } else if (CAMPOS_INTEIRO.includes(campo)) {
        registro[campo] = inteiro(raw[indice]);
      } else {
        const valor = texto(fmt[indice] ?? raw[indice]);
        registro[campo] = valor && CAMPOS_CODIGO.includes(campo) ? valor.toUpperCase() : valor;
      }
    }

    const encomenda = registro as EncomendaInput;
    if (!encomenda.nr_entrega) continue;
    encomendas.push(encomenda);
  }

  return { encomendas, camposAusentes };
}

export const ROTULO_CAMPO: Record<Campo, string> = {
  romaneio: "Romaneio",
  data_romaneio: "Data Romaneio",
  motorista: "Motorista",
  placa: "Placa",
  remetente: "Remetente",
  nr_entrega: "Nr. Entrega",
  nome_pessoa: "Nome Pessoa",
  telefone: "Telefone",
  prazo_texto: "Prazo (texto)",
  prazo_final: "Prazo Final",
  situacao: "Situação",
  dias_ate_prazo: "Dias até Prazo",
  cep: "CEP",
  endereco: "Endereço",
  ponto_referencia: "Ponto de Referência",
  bairro: "Bairro",
  cidade_uf: "Cidade/UF",
  regiao: "Região",
  nome_regiao: "Nome Região",
  nota_fiscal: "Nota Fiscal",
  volumes: "Volumes",
  vol_nr: "Vol. Nº",
  pedido: "Pedido",
};
