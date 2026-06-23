"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";

type ManifestoItemInput = { codigo: string; descricao: string | null };

export async function importarManifesto(
  operacaoId: string,
  nomeArquivo: string,
  itens: ManifestoItemInput[]
) {
  const { supabase } = await requireAuth();

  const { data: manifesto, error: manifestoError } = await supabase
    .from("manifestos")
    .insert({
      operacao_id: operacaoId,
      nome_arquivo: nomeArquivo,
      total_itens: itens.length,
    })
    .select("id")
    .single();

  if (manifestoError || !manifesto) {
    const jaExiste = manifestoError?.code === "23505";
    return {
      error: jaExiste
        ? "Esta operação já tem um manifesto importado."
        : "Não foi possível importar o manifesto.",
    };
  }

  const { error: itensError } = await supabase.from("manifesto_itens").insert(
    itens.map((item) => ({
      manifesto_id: manifesto.id,
      codigo: item.codigo,
      descricao: item.descricao,
    }))
  );

  if (itensError) {
    await supabase.from("manifestos").delete().eq("id", manifesto.id);
    return {
      error:
        "Não foi possível importar os itens do manifesto (verifique se há códigos duplicados na planilha).",
    };
  }

  revalidatePath(`/operacoes/${operacaoId}`);
  return { error: null };
}

export async function finalizarOperacao(operacaoId: string) {
  const { supabase } = await requireAuth();

  const { error } = await supabase
    .from("operacoes")
    .update({ status: "FINALIZADA", finalizada_em: new Date().toISOString() })
    .eq("id", operacaoId);

  if (error) return { error: "Não foi possível finalizar a operação." };

  revalidatePath(`/operacoes/${operacaoId}`);
  revalidatePath("/operacoes");
  revalidatePath("/operacoes/ativas");
  return { error: null };
}
