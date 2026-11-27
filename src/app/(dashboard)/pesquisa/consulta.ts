import type { createClient } from "@/lib/supabase/server";
import type { EncomendaResumo, TipoEvento } from "@/lib/types/database.types";
import { buscarEncomendasPorCodigos } from "@/lib/encomendas/consulta";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const TIPO_EVENTO_LABEL: Record<string, string> = {
  RECEBIMENTO: "Recebimento",
  ENTREGA: "Entrega",
  DEVOLUCAO_ORIGEM: "Devolução à Origem",
  RETORNO: "Retorno",
  CONFERENCIA: "Conferência",
};

export type FiltrosPesquisa = {
  codigo: string;
  transportadoras: string[];
  motoristas: string[];
  rotas: string[];
  colaboradores: string[];
  tipos: string[];
  dataInicio: string;
  dataFim: string;
};

// Fuso fixo de Jataí/GO (sem horário de verão)
const FUSO = "-03:00";

function lista(valor: string | undefined) {
  return valor?.split(",").filter(Boolean) ?? [];
}

export function lerFiltros(params: Record<string, string | undefined>): FiltrosPesquisa {
  return {
    codigo: params.codigo ?? "",
    transportadoras: lista(params.transportadoras),
    motoristas: lista(params.motoristas),
    rotas: lista(params.rotas),
    colaboradores: lista(params.colaboradores),
    tipos: lista(params.tipos),
    dataInicio: params.inicio ?? "",
    dataFim: params.fim ?? "",
  };
}

export function filtrosParaParams(filtros: FiltrosPesquisa) {
  const params = new URLSearchParams();
  if (filtros.codigo.trim()) params.set("codigo", filtros.codigo.trim());
  if (filtros.transportadoras.length) params.set("transportadoras", filtros.transportadoras.join(","));
  if (filtros.motoristas.length) params.set("motoristas", filtros.motoristas.join(","));
  if (filtros.rotas.length) params.set("rotas", filtros.rotas.join(","));
  if (filtros.colaboradores.length) params.set("colaboradores", filtros.colaboradores.join(","));
  if (filtros.tipos.length) params.set("tipos", filtros.tipos.join(","));
  if (filtros.dataInicio) params.set("inicio", filtros.dataInicio);
  if (filtros.dataFim) params.set("fim", filtros.dataFim);
  return params;
}

// Vários códigos (separados por espaço, vírgula ou linha, todos com dígitos)
// = busca exata em lote. Qualquer outro texto = busca parcial no código E em
// todas as colunas da encomenda (destinatário, endereço, bairro, NF, Nro.
// Entrega, pedido, telefone, CEP...) via RPC pesquisar_bipagens.
function termosCodigo(codigo: string) {
  return codigo.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean);
}

export function consultarBipagens(
  supabase: Supabase,
  filtros: FiltrosPesquisa,
  opcoes: { contar?: boolean; apenasContagem?: boolean } = {}
) {
  const texto = filtros.codigo.trim();
  const termos = termosCodigo(texto);
  const loteCodigos = termos.length > 1 && termos.every((t) => /\d/.test(t));
  const contagem = opcoes.apenasContagem
    ? ({ count: "exact", head: true } as const)
    : opcoes.contar
      ? ({ count: "exact" } as const)
      : undefined;

  let query =
    texto && !loteCodigos
      ? supabase.rpc("pesquisar_bipagens", { p_termo: texto }, contagem).select("*")
      : supabase.from("bipagens").select("*", contagem);

  if (!opcoes.apenasContagem) query = query.order("bipado_em", { ascending: false });

  if (loteCodigos) {
    const variantes = new Set(termos.flatMap((t) => [t, t.toUpperCase()]));
    query = query.in("codigo", [...variantes]);
  }

  if (filtros.transportadoras.length) query = query.in("transportadora_id", filtros.transportadoras);
  if (filtros.motoristas.length) query = query.in("motorista_id", filtros.motoristas);
  if (filtros.rotas.length) query = query.in("rota_id", filtros.rotas);
  if (filtros.colaboradores.length) query = query.in("colaborador_id", filtros.colaboradores);
  if (filtros.tipos.length) query = query.in("tipo_evento", filtros.tipos as TipoEvento[]);
  if (filtros.dataInicio) query = query.gte("bipado_em", `${filtros.dataInicio}T00:00:00${FUSO}`);
  if (filtros.dataFim) query = query.lte("bipado_em", `${filtros.dataFim}T23:59:59.999${FUSO}`);

  return query;
}

// Entregas, retornos e entregas líquidas (Entrega − Retorno) dentro dos
// filtros atuais. Retornos do motorista abatem do total entregue.
export async function resumoEntregaRetorno(supabase: Supabase, filtros: FiltrosPesquisa) {
  const contar = async (tipo: TipoEvento) => {
    if (filtros.tipos.length && !filtros.tipos.includes(tipo)) return 0;
    const { count } = await consultarBipagens(supabase, filtros, { apenasContagem: true }).eq(
      "tipo_evento",
      tipo
    );
    return count ?? 0;
  };
  const [entregas, retornos] = await Promise.all([contar("ENTREGA"), contar("RETORNO")]);
  return { entregas, retornos, liquido: entregas - retornos };
}

export async function carregarCadastros(supabase: Supabase) {
  const [
    { data: transportadoras },
    { data: motoristas },
    { data: rotas },
    { data: colaboradores },
  ] = await Promise.all([
    supabase.from("transportadoras").select("id, nome").order("nome"),
    supabase.from("motoristas").select("id, nome").order("nome"),
    supabase.from("rotas").select("id, nome").order("nome"),
    supabase.from("colaboradores").select("id, nome").order("nome"),
  ]);

  return {
    transportadoras: transportadoras ?? [],
    motoristas: motoristas ?? [],
    rotas: rotas ?? [],
    colaboradores: colaboradores ?? [],
  };
}

// Dados da encomenda (planilha do Recebimento) para as bipagens listadas,
// chaveados por `${transportadora_id}|${codigo}`.
export async function carregarEncomendas(
  supabase: Supabase,
  bipagens: { transportadora_id: string; codigo: string }[]
) {
  const porTransportadora = new Map<string, string[]>();
  for (const b of bipagens) {
    const lista = porTransportadora.get(b.transportadora_id) ?? [];
    lista.push(b.codigo);
    porTransportadora.set(b.transportadora_id, lista);
  }

  const mapa = new Map<string, EncomendaResumo>();
  await Promise.all(
    [...porTransportadora].map(async ([transportadoraId, codigos]) => {
      try {
        const encomendas = await buscarEncomendasPorCodigos(supabase, transportadoraId, codigos);
        for (const [codigo, e] of Object.entries(encomendas)) {
          mapa.set(`${transportadoraId}|${codigo}`, e);
        }
      } catch {
        // Sem dados da encomenda: a pesquisa continua mostrando a bipagem.
      }
    })
  );
  return mapa;
}

export async function carregarOperacoes(supabase: Supabase, ids: string[]) {
  if (!ids.length) return new Map<string, { data: string; status: string }>();
  const { data } = await supabase
    .from("operacoes")
    .select("id, data, status")
    .in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((o) => [o.id, { data: o.data, status: o.status }]));
}
