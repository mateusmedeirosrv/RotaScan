"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import type { Database } from "@/lib/types/database.types";

type TipoEvento = Database["public"]["Tables"]["operacoes"]["Row"]["tipo_evento"];

type OperacaoInput = {
  galpao_id: string;
  transportadora_id: string;
  data: string;
  tipo_evento: TipoEvento;
};

export async function criarOperacao(input: OperacaoInput) {
  const { supabase, colaborador } = await requireAuth();

  const { data, error } = await supabase
    .from("operacoes")
    .insert({
      ...input,
      colaborador_id: colaborador.id,
      finalizada_em: null,
    })
    .select("id")
    .single();

  if (error) return { error: "Não foi possível criar a operação.", id: null };

  revalidatePath("/operacoes");
  return { error: null, id: data.id };
}
