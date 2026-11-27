import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { dbOffline, type ItemFila } from "./db-offline";
import {
  buscarBloqueioConfig,
  existeRecebimentoPrevio,
  MENSAGEM_ENCOMENDA_JA_ENTREGUE,
  isEncomendaJaEntregue,
  isFalhaDeRede,
  isUniqueViolation,
  tentarOverride,
} from "./registrar";

type Supabase = SupabaseClient<Database>;

let sincronizando = false;

export async function sincronizarFila(supabase: Supabase): Promise<void> {
  if (sincronizando || !navigator.onLine) return;
  sincronizando = true;

  try {
    const bloqueioConfig = await buscarBloqueioConfig(supabase);
    const pendentes = await dbOffline.fila.where("status").equals("pendente").sortBy("criadoEm");

    for (const item of pendentes) {
      if (!navigator.onLine || item.id === undefined) break;

      if (item.payload.tipo_evento === "ENTREGA" && bloqueioConfig !== "PERMITIR") {
        const jaRecebido = await existeRecebimentoPrevio(
          supabase,
          item.payload.transportadora_id,
          item.payload.codigo
        );
        if (!jaRecebido && bloqueioConfig === "BLOQUEAR") {
          await dbOffline.fila.update(item.id, {
            status: "conflito",
            exigeOverride: true,
            erro: "Entrega sem recebimento prévio — requer senha de override.",
          });
          continue;
        }
      }

      const { error } = await supabase
        .from("bipagens")
        .insert({ ...item.payload, sincronizado_em: new Date().toISOString() });

      if (!error) {
        await dbOffline.fila.delete(item.id);
        continue;
      }

      if (isFalhaDeRede(error)) break;

      if (isUniqueViolation(error)) {
        await dbOffline.fila.update(item.id, {
          status: "conflito",
          erro: isEncomendaJaEntregue(error)
            ? MENSAGEM_ENCOMENDA_JA_ENTREGUE
            : "Código duplicado — já bipado anteriormente.",
        });
        continue;
      }

      await dbOffline.fila.update(item.id, { status: "conflito", erro: error.message });
    }
  } finally {
    sincronizando = false;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("rotascan:fila-sync"));
    }
  }
}

export async function descartarConflito(itemId: number): Promise<void> {
  await dbOffline.fila.delete(itemId);
}

export async function resolverConflitoComOverride(
  supabase: Supabase,
  item: ItemFila,
  senhaTentativa: string
): Promise<{ ok: boolean }> {
  if (item.id === undefined) return { ok: false };

  const ok = await tentarOverride(supabase, {
    senhaTentativa,
    codigo: item.payload.codigo,
    operacaoId: item.payload.operacao_id,
    rotaId: item.payload.rota_id,
  });

  if (!ok) return { ok: false };

  const { error } = await supabase.from("bipagens").insert({
    ...item.payload,
    override_aplicado: true,
    sincronizado_em: new Date().toISOString(),
  });

  if (error) {
    await dbOffline.fila.update(item.id, { erro: error.message });
    return { ok: false };
  }

  await dbOffline.fila.delete(item.id);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rotascan:fila-sync"));
  }
  return { ok: true };
}
