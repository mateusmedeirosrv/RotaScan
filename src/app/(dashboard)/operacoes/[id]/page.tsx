import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { ManifestoUpload } from "./manifesto-upload";
import { FinalizarOperacaoButton } from "./finalizar-button";
import { BipagemConsole } from "./bipagem-console";
import { ConflitosSection } from "./conflitos-section";

const TIPO_EVENTO_LABEL: Record<string, string> = {
  RECEBIMENTO: "Recebimento",
  ENTREGA: "Entrega",
  DEVOLUCAO_ORIGEM: "Devolução à Origem",
  RETORNO: "Retorno",
};

export default async function OperacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, colaborador } = await requireAuth();

  const { data: operacao } = await supabase
    .from("operacoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!operacao) redirect("/operacoes");

  const { data: transportadora } = await supabase
    .from("transportadoras")
    .select("*")
    .eq("id", operacao.transportadora_id)
    .maybeSingle();

  const { data: manifesto } = await supabase
    .from("manifestos")
    .select("*")
    .eq("operacao_id", id)
    .maybeSingle();

  const ehRecebimento = operacao.tipo_evento === "RECEBIMENTO";
  const finalizada = operacao.status === "FINALIZADA";

  let dadosBipagem: {
    rotas: { id: string; nome: string }[];
    motoristas: { id: string; nome: string }[];
    bloqueioConfig: "BLOQUEAR" | "PERMITIR_COM_ALERTA" | "PERMITIR";
    sons: { confirmado: string; duplicado: string; erro: string };
  } | null = null;

  if (!finalizada) {
    const [{ data: rotas }, { data: motoristas }, { data: config }, { data: sonsConfig }] =
      await Promise.all([
        supabase
          .from("rotas")
          .select("id, nome")
          .eq("galpao_id", operacao.galpao_id)
          .eq("ativa", true)
          .order("nome"),
        supabase
          .from("motoristas")
          .select("id, nome")
          .eq("galpao_id", operacao.galpao_id)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("configuracoes")
          .select("valor")
          .eq("chave", "bipagem_entrega_sem_recebimento")
          .maybeSingle(),
        supabase
          .from("configuracoes")
          .select("chave, valor")
          .in("chave", ["som_confirmado_arquivo", "som_duplicado_arquivo", "som_erro_arquivo"]),
      ]);

    const valoresSons = Object.fromEntries((sonsConfig ?? []).map((c) => [c.chave, c.valor]));

    dadosBipagem = {
      rotas: rotas ?? [],
      motoristas: motoristas ?? [],
      bloqueioConfig:
        (config?.valor as "BLOQUEAR" | "PERMITIR_COM_ALERTA" | "PERMITIR" | undefined) ??
        "PERMITIR",
      sons: {
        confirmado: valoresSons.som_confirmado_arquivo ?? "/sounds/confirmado.wav",
        duplicado: valoresSons.som_duplicado_arquivo ?? "/sounds/duplicado.wav",
        erro: valoresSons.som_erro_arquivo ?? "/sounds/erro.wav",
      },
    };
  }

  let conferencia: { encontradas: number; faltantes: number; extras: number } | null =
    null;

  if (ehRecebimento && finalizada && manifesto) {
    const [{ data: itensManifesto }, { data: bipagens }] = await Promise.all([
      supabase.from("manifesto_itens").select("codigo").eq("manifesto_id", manifesto.id),
      supabase
        .from("bipagens")
        .select("codigo")
        .eq("operacao_id", id)
        .eq("tipo_evento", "RECEBIMENTO"),
    ]);

    const codigosManifesto = new Set((itensManifesto ?? []).map((i) => i.codigo));
    const codigosBipados = new Set((bipagens ?? []).map((b) => b.codigo));

    const encontradas = [...codigosManifesto].filter((c) =>
      codigosBipados.has(c)
    ).length;
    const faltantes = codigosManifesto.size - encontradas;
    const extras = [...codigosBipados].filter(
      (c) => !codigosManifesto.has(c)
    ).length;

    conferencia = { encontradas, faltantes, extras };
  }

  return (
    <main className="space-y-6 p-6">
      <Link
        href="/operacoes"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Voltar para Operações
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {transportadora?.nome ?? "—"} · {TIPO_EVENTO_LABEL[operacao.tipo_evento]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {operacao.data} ·{" "}
            {finalizada ? "Finalizada" : "Em andamento"}
          </p>
        </div>
        {!finalizada && <FinalizarOperacaoButton operacaoId={operacao.id} />}
      </div>

      {ehRecebimento && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Manifesto</h2>
          {manifesto ? (
            <p className="text-sm text-muted-foreground">
              {manifesto.nome_arquivo} — {manifesto.total_itens} item(ns)
              importado(s)
            </p>
          ) : (
            <ManifestoUpload operacaoId={operacao.id} />
          )}
        </div>
      )}

      {!finalizada && dadosBipagem && (
        <BipagemConsole
          operacaoId={operacao.id}
          colaboradorId={colaborador.id}
          transportadoraId={operacao.transportadora_id}
          regexValidacao={transportadora?.regex_validacao ?? null}
          tipoEvento={operacao.tipo_evento}
          rotas={dadosBipagem.rotas}
          motoristas={dadosBipagem.motoristas}
          bloqueioConfig={dadosBipagem.bloqueioConfig}
          sons={dadosBipagem.sons}
        />
      )}

      <ConflitosSection operacaoId={operacao.id} />

      {conferencia && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Conferência</h2>
          <div className="flex gap-6 text-sm">
            <span>
              <span className="font-medium">{conferencia.encontradas}</span>{" "}
              encontradas
            </span>
            <span>
              <span className="font-medium">{conferencia.faltantes}</span>{" "}
              faltantes
            </span>
            <span>
              <span className="font-medium">{conferencia.extras}</span> extras
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
