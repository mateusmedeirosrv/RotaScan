import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EncomendaResumo } from "@/lib/types/database.types";

type Supabase = SupabaseClient<Database>;

const LOTE_CODIGOS = 500;

// Dados da encomenda (planilha do Recebimento) para cada código bipado.
// Códigos sem encomenda localizada ficam fora do mapa.
export async function buscarEncomendasPorCodigos(
  supabase: Supabase,
  transportadoraId: string,
  codigos: string[]
): Promise<Record<string, EncomendaResumo>> {
  const unicos = [...new Set(codigos.filter(Boolean))];
  const mapa: Record<string, EncomendaResumo> = {};

  for (let i = 0; i < unicos.length; i += LOTE_CODIGOS) {
    const { data, error } = await supabase.rpc("encomendas_por_codigos", {
      p_transportadora_id: transportadoraId,
      p_codigos: unicos.slice(i, i + LOTE_CODIGOS),
    });
    if (error) throw error;
    for (const linha of data ?? []) mapa[linha.codigo] = linha;
  }

  return mapa;
}

export function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export function formatarVolume(e: { volumes: number | null; vol_nr: number | null } | null | undefined): string {
  if (!e) return "";
  if (e.vol_nr && e.volumes) return `${e.vol_nr}/${e.volumes}`;
  return e.volumes ? String(e.volumes) : e.vol_nr ? String(e.vol_nr) : "";
}

export function formatarPrazo(
  e: { prazo_final: string | null; prazo_texto: string | null } | null | undefined
): string {
  if (!e) return "";
  return formatarDataBr(e.prazo_final) || e.prazo_texto || "";
}
