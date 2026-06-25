"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "@/lib/auth/guards";
import { registrarAuditoria } from "@/lib/auditoria";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type ManifestoItemInput = { codigo: string; descricao: string | null };

async function categorizarItens(
  supabase: Supabase,
  transportadoraId: string,
  regexValidacao: string | null,
  itens: ManifestoItemInput[]
) {
  const { data: bipagens } = await supabase
    .from("bipagens")
    .select("codigo")
    .eq("transportadora_id", transportadoraId)
    .eq("tipo_evento", "RECEBIMENTO");

  const codigosBipados = new Set((bipagens ?? []).map((b) => b.codigo));
  const regex = regexValidacao ? new RegExp(regexValidacao) : null;

  let encontradas = 0;
  const validos: string[] = [];
  const invalidos: string[] = [];

  for (const codigo of new Set(itens.map((i) => i.codigo))) {
    if (codigosBipados.has(codigo)) {
      encontradas++;
    } else if (!regex || regex.test(codigo)) {
      validos.push(codigo);
    } else {
      invalidos.push(codigo);
    }
  }

  return { encontradas, validos, invalidos };
}

async function carregarOperacaoParaManifesto(supabase: Supabase, operacaoId: string) {
  const { data: operacao } = await supabase
    .from("operacoes")
    .select("status, tipo_evento, transportadora_id, galpao_id")
    .eq("id", operacaoId)
    .maybeSingle();

  if (!operacao || operacao.tipo_evento !== "RECEBIMENTO") {
    return { erro: "Operação inválida para importação de manifesto." } as const;
  }
  if (operacao.status !== "EM_ANDAMENTO") {
    return {
      erro: "O manifesto precisa ser importado antes de finalizar a operação.",
    } as const;
  }

  const { data: transportadora } = await supabase
    .from("transportadoras")
    .select("regex_validacao")
    .eq("id", operacao.transportadora_id)
    .maybeSingle();

  return { erro: null, operacao, regexValidacao: transportadora?.regex_validacao ?? null } as const;
}

export async function prevalidarManifesto(operacaoId: string, itens: ManifestoItemInput[]) {
  const { supabase } = await requireAuth();

  const contexto = await carregarOperacaoParaManifesto(supabase, operacaoId);
  if (contexto.erro) return { error: contexto.erro, preview: null };

  const { encontradas, validos, invalidos } = await categorizarItens(
    supabase,
    contexto.operacao.transportadora_id,
    contexto.regexValidacao,
    itens
  );

  return {
    error: null,
    preview: { encontradas, extras: validos.length, faltantes: invalidos.length },
  };
}

export async function importarManifesto(
  operacaoId: string,
  nomeArquivo: string,
  itens: ManifestoItemInput[]
) {
  const { supabase, colaborador } = await requireAuth();

  const contexto = await carregarOperacaoParaManifesto(supabase, operacaoId);
  if (contexto.erro) return { error: contexto.erro };
  const { operacao, regexValidacao } = contexto;

  const { data: rotaRecebimento } = await supabase
    .from("rotas")
    .select("id")
    .eq("galpao_id", operacao.galpao_id)
    .eq("eh_recebimento", true)
    .maybeSingle();

  if (!rotaRecebimento) {
    return { error: "Rota de recebimento padrão não encontrada para este galpão." };
  }

  const { encontradas, validos, invalidos } = await categorizarItens(
    supabase,
    operacao.transportadora_id,
    regexValidacao,
    itens
  );

  const { data: manifesto, error: manifestoError } = await supabase
    .from("manifestos")
    .insert({
      operacao_id: operacaoId,
      nome_arquivo: nomeArquivo,
      total_itens: itens.length,
      encontradas,
      faltantes: invalidos.length,
      extras: validos.length,
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

  if (validos.length > 0) {
    const { error: bipagensError } = await supabase.from("bipagens").insert(
      validos.map((codigo) => ({
        operacao_id: operacaoId,
        rota_id: rotaRecebimento.id,
        motorista_id: null,
        transportadora_id: operacao.transportadora_id,
        codigo,
        tipo_evento: "RECEBIMENTO" as const,
        colaborador_id: colaborador.id,
        sincronizado_em: new Date().toISOString(),
      }))
    );

    if (bipagensError) {
      await supabase.from("manifestos").delete().eq("id", manifesto.id);
      return {
        error:
          "Não foi possível confirmar automaticamente os códigos do manifesto. Tente novamente.",
      };
    }
  }

  revalidatePath(`/operacoes/${operacaoId}`);
  return { error: null };
}

export async function finalizarOperacao(operacaoId: string) {
  const { supabase } = await requireAuth();

  const { data: operacao } = await supabase
    .from("operacoes")
    .select("tipo_evento")
    .eq("id", operacaoId)
    .maybeSingle();

  if (operacao?.tipo_evento === "RECEBIMENTO") {
    const { data: manifesto } = await supabase
      .from("manifestos")
      .select("id")
      .eq("operacao_id", operacaoId)
      .maybeSingle();

    if (!manifesto) {
      return { error: "Importe o manifesto antes de finalizar esta operação de recebimento." };
    }
  }

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

export async function inativarOperacao(operacaoId: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("operacoes")
    .update({ ativa: false })
    .eq("id", operacaoId);

  if (error) return { error: "Não foi possível inativar a operação." };

  await registrarAuditoria(supabase, {
    tipo: "operacao_inativada",
    descricao: "Operação inativada (ex.: treinamento) e removida dos indicadores do Dashboard.",
    dados: { operacao_id: operacaoId },
  });

  revalidatePath(`/operacoes/${operacaoId}`);
  revalidatePath("/operacoes");
  revalidatePath("/operacoes/ativas");
  return { error: null };
}

export async function reativarOperacao(operacaoId: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("operacoes")
    .update({ ativa: true })
    .eq("id", operacaoId);

  if (error) return { error: "Não foi possível reativar a operação." };

  await registrarAuditoria(supabase, {
    tipo: "operacao_reativada",
    descricao: "Operação reativada e volta a contar nos indicadores do Dashboard.",
    dados: { operacao_id: operacaoId },
  });

  revalidatePath(`/operacoes/${operacaoId}`);
  revalidatePath("/operacoes");
  revalidatePath("/operacoes/ativas");
  return { error: null };
}
