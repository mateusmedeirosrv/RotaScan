import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { dbOffline, type BipagemPendentePayload } from "./db-offline";

type Supabase = SupabaseClient<Database>;
type BipagemRow = Database["public"]["Tables"]["bipagens"]["Row"];

export type ResultadoBipagem =
  | { status: "confirmado"; bipagem: BipagemRow }
  | { status: "duplicado" }
  | { status: "erro"; mensagem: string }
  | { status: "pendente" };

export function isUniqueViolation(error: { code?: string; message?: string }) {
  return error.code === "23505" || error.message?.includes("duplicate key") === true;
}

// postgrest-js retorna code: "" (string vazia) quando o fetch falha por
// problema de rede — diferente de um erro real do Postgres, que sempre
// vem com um code (ex. 23505). Ausência de code == "estava offline".
export function isFalhaDeRede(error: { code?: string }) {
  return !error.code;
}

export type BloqueioConfig = "BLOQUEAR" | "PERMITIR_COM_ALERTA" | "PERMITIR";

export async function buscarBloqueioConfig(supabase: Supabase): Promise<BloqueioConfig> {
  const { data } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "bipagem_entrega_sem_recebimento")
    .maybeSingle();

  return (data?.valor as BloqueioConfig | undefined) ?? "PERMITIR";
}

async function enfileirar(payload: BipagemPendentePayload): Promise<void> {
  await dbOffline.fila.add({
    payload,
    status: "pendente",
    criadoEm: new Date().toISOString(),
  });
}

export async function registrarBipagem(
  supabase: Supabase,
  input: Omit<BipagemPendentePayload, "bipado_em"> & { bipado_em?: string }
): Promise<ResultadoBipagem> {
  const payload: BipagemPendentePayload = {
    ...input,
    bipado_em: input.bipado_em ?? new Date().toISOString(),
  };

  if (!navigator.onLine) {
    await enfileirar(payload);
    return { status: "pendente" };
  }

  const { data, error } = await supabase
    .from("bipagens")
    .insert({ ...payload, sincronizado_em: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    if (isFalhaDeRede(error)) {
      await enfileirar(payload);
      return { status: "pendente" };
    }
    if (isUniqueViolation(error)) return { status: "duplicado" };
    return { status: "erro", mensagem: error.message };
  }

  return { status: "confirmado", bipagem: data };
}

export async function buscarUltimasBipagens(
  supabase: Supabase,
  operacaoId: string,
  rotaId: string,
  limite = 10
): Promise<BipagemRow[]> {
  const { data, error } = await supabase
    .from("bipagens")
    .select("*")
    .eq("operacao_id", operacaoId)
    .eq("rota_id", rotaId)
    .order("bipado_em", { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data ?? [];
}

export async function buscarContagemPorRota(
  supabase: Supabase,
  operacaoId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("bipagens")
    .select("rota_id")
    .eq("operacao_id", operacaoId);

  if (error) throw error;

  const contagens: Record<string, number> = {};
  for (const linha of data ?? []) {
    contagens[linha.rota_id] = (contagens[linha.rota_id] ?? 0) + 1;
  }
  return contagens;
}

// Bipagens da operação (todas as rotas) cujo código contém o termo; sem termo, as mais recentes.
export async function buscarBipagensOperacao(
  supabase: Supabase,
  operacaoId: string,
  termo: string,
  limite = 20
): Promise<BipagemRow[]> {
  let query = supabase
    .from("bipagens")
    .select("*")
    .eq("operacao_id", operacaoId)
    .order("bipado_em", { ascending: false })
    .limit(limite);

  const limpo = termo.trim();
  if (limpo) query = query.ilike("codigo", `%${limpo.replace(/[%_\\]/g, "\\$&")}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function desfazerBipagem(supabase: Supabase, bipagemId: string): Promise<void> {
  const { error } = await supabase.rpc("desfazer_bipagem", { p_bipagem_id: bipagemId });
  if (error) throw error;
}

export async function existeRecebimentoPrevio(
  supabase: Supabase,
  transportadoraId: string,
  codigo: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("bipagens")
    .select("id", { count: "exact", head: true })
    .eq("transportadora_id", transportadoraId)
    .eq("codigo", codigo)
    .eq("tipo_evento", "RECEBIMENTO");

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function tentarOverride(
  supabase: Supabase,
  params: { senhaTentativa: string; codigo: string; operacaoId: string; rotaId: string }
): Promise<boolean> {
  const { data, error } = await supabase.rpc("tentar_override", {
    senha_tentativa: params.senhaTentativa,
    p_codigo: params.codigo,
    p_operacao_id: params.operacaoId,
    p_rota_id: params.rotaId,
  });

  if (error) throw error;
  return data === true;
}
