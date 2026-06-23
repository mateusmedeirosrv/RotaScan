"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { registrarAuditoria } from "@/lib/auditoria";

export async function forcarFinalizacao(operacaoId: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("operacoes")
    .update({ status: "FINALIZADA", finalizada_em: new Date().toISOString() })
    .eq("id", operacaoId);

  if (error) return { error: "Não foi possível finalizar a operação." };

  await registrarAuditoria(supabase, {
    tipo: "finalizacao_forcada",
    descricao: "Operação finalizada forçadamente por um admin.",
    dados: { operacao_id: operacaoId },
  });

  revalidatePath("/operacoes/ativas");
  revalidatePath(`/operacoes/${operacaoId}`);
  return { error: null };
}
