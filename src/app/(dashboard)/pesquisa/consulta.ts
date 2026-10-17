import type { createClient } from "@/lib/supabase/server";
import type { TipoEvento } from "@/lib/types/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const TIPO_EVENTO_LABEL: Record<string, string> = {
  RECEBIMENTO: "Recebimento",
  ENTREGA: "Entrega",
  DEVOLUCAO_ORIGEM: "Devolução à Origem",
  RETORNO: "Retorno",
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

// Vários códigos (separados por espaço, vírgula ou linha) = busca exata em lote;
// um código só = busca parcial (ex.: últimos dígitos).
function termosCodigo(codigo: string) {
  return codigo.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean);
}

export function consultarBipagens(
  supabase: Supabase,
  filtros: FiltrosPesquisa,
  opcoes: { contar?: boolean } = {}
) {
  let query = supabase
    .from("bipagens")
    .select("*", opcoes.contar ? { count: "exact" } : undefined)
    .order("bipado_em", { ascending: false });

  const termos = termosCodigo(filtros.codigo);
  if (termos.length === 1) {
    query = query.ilike("codigo", `%${termos[0].replace(/[%_\\]/g, "\\$&")}%`);
  } else if (termos.length > 1) {
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

export async function carregarOperacoes(supabase: Supabase, ids: string[]) {
  if (!ids.length) return new Map<string, { data: string; status: string }>();
  const { data } = await supabase
    .from("operacoes")
    .select("id, data, status")
    .in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((o) => [o.id, { data: o.data, status: o.status }]));
}
