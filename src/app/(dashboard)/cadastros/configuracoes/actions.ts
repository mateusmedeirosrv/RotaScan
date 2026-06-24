"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { registrarAuditoria } from "@/lib/auditoria";

const CHAVES_EDITAVEIS = [
  "bipagem_entrega_sem_recebimento",
  "som_confirmado_arquivo",
  "som_duplicado_arquivo",
  "som_erro_arquivo",
  "qrcode_etiqueta_largura_mm",
  "qrcode_etiqueta_altura_mm",
] as const;

export async function salvarConfiguracoes(valores: Record<string, string>) {
  const supabase = await requireAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: atuais } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", CHAVES_EDITAVEIS);

  const valorAtualPorChave = new Map((atuais ?? []).map((c) => [c.chave, c.valor]));

  const alteracoes: Record<string, { de: string | undefined; para: string }> = {};
  for (const chave of CHAVES_EDITAVEIS) {
    const novoValor = valores[chave];
    if (novoValor === undefined) continue;
    const valorAtual = valorAtualPorChave.get(chave);
    if (novoValor !== valorAtual) {
      alteracoes[chave] = { de: valorAtual, para: novoValor };
    }
  }

  if (Object.keys(alteracoes).length === 0) {
    return { error: null };
  }

  const { error } = await supabase
    .from("configuracoes")
    .upsert(
      Object.keys(alteracoes).map((chave) => ({
        chave,
        valor: alteracoes[chave].para,
        atualizado_por: user?.id ?? null,
      }))
    );

  if (error) return { error: "Não foi possível salvar as configurações." };

  await registrarAuditoria(supabase, {
    tipo: "configuracoes_alteradas",
    descricao: "Configurações alteradas pelo admin.",
    dados: { alteracoes },
  });

  revalidatePath("/cadastros/configuracoes");
  return { error: null };
}
