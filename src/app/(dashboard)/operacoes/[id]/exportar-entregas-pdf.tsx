"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { gerarPdfEntregas, type LinhaPdfEntrega } from "@/lib/pdf/entregas";
import {
  buscarEncomendasPorCodigos,
  formatarPrazo,
  formatarVolume,
} from "@/lib/encomendas/consulta";

const PAGINA = 1000; // limite de linhas por request do PostgREST

type BipagemPdf = {
  codigo: string;
  rota_id: string;
  motorista_id: string | null;
  bipado_em: string;
};

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// PDF paisagem com as bipagens de Entrega da operação + dados da encomenda
// (Volume, Nr. Entrega, NF, Destinatário, Endereço, Bairro, Prazo).
export function ExportarEntregasPdfButton({
  operacaoId,
  transportadoraId,
  transportadoraNome,
  dataOperacao,
  rotaAtiva,
}: {
  operacaoId: string;
  transportadoraId: string;
  transportadoraNome: string;
  dataOperacao: string;
  rotaAtiva?: { id: string; nome: string } | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [gerando, setGerando] = useState<"rota" | "todas" | null>(null);

  async function exportar(escopo: "rota" | "todas") {
    setGerando(escopo);
    try {
      const bipagens: BipagemPdf[] = [];
      for (let inicio = 0; ; inicio += PAGINA) {
        let query = supabase
          .from("bipagens")
          .select("codigo, rota_id, motorista_id, bipado_em")
          .eq("operacao_id", operacaoId)
          .order("bipado_em", { ascending: true })
          .range(inicio, inicio + PAGINA - 1);
        if (escopo === "rota" && rotaAtiva) query = query.eq("rota_id", rotaAtiva.id);
        const { data, error } = await query;
        if (error) throw error;
        bipagens.push(...(data ?? []));
        if (!data || data.length < PAGINA) break;
      }

      const rotaIds = [...new Set(bipagens.map((b) => b.rota_id))];
      const motoristaIds = [...new Set(bipagens.map((b) => b.motorista_id).filter((id): id is string => !!id))];

      const [{ data: rotas }, { data: motoristas }, encomendas] = await Promise.all([
        rotaIds.length
          ? supabase.from("rotas").select("id, nome").in("id", rotaIds)
          : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
        motoristaIds.length
          ? supabase.from("motoristas").select("id, nome").in("id", motoristaIds)
          : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
        buscarEncomendasPorCodigos(supabase, transportadoraId, bipagens.map((b) => b.codigo)),
      ]);

      const nomeRota = new Map((rotas ?? []).map((r) => [r.id, r.nome]));
      const nomeMotorista = new Map((motoristas ?? []).map((m) => [m.id, m.nome]));

      const linhas: LinhaPdfEntrega[] = bipagens
        .map((b) => {
          const e = encomendas[b.codigo];
          return {
            codigo: b.codigo,
            rota: nomeRota.get(b.rota_id) ?? "",
            motorista: (b.motorista_id && nomeMotorista.get(b.motorista_id)) || "",
            bipadoEm: b.bipado_em,
            volume: formatarVolume(e),
            nrEntrega: e?.nr_entrega ?? "",
            notaFiscal: e?.nota_fiscal ?? "",
            nomePessoa: e?.nome_pessoa ?? "",
            endereco: e?.endereco ?? "",
            bairro: e?.bairro ?? "",
            prazo: formatarPrazo(e),
          };
        })
        .sort((a, b) => a.rota.localeCompare(b.rota, "pt-BR") || (a.bipadoEm < b.bipadoEm ? -1 : 1));

      const semDados = linhas.filter((l) => !l.nrEntrega).length;
      const escopoTexto = escopo === "rota" && rotaAtiva ? `Rota ${rotaAtiva.nome}` : "Todas as rotas";
      const pdf = await gerarPdfEntregas({
        titulo: `Entregas · ${transportadoraNome} · ${dataOperacao.split("-").reverse().join("/")}`,
        subtitulo: `${escopoTexto} · ${linhas.length} bipagem(ns)${
          semDados ? ` · ${semDados} sem encomenda localizada` : ""
        } · gerado em ${formatarDataHora(new Date().toISOString())}`,
        linhas,
      });

      const blob = new Blob([pdf as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `entregas-${dataOperacao}${
        escopo === "rota" && rotaAtiva ? `-${rotaAtiva.nome.replace(/[^\w-]+/g, "_")}` : ""
      }.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível gerar o PDF das entregas.");
    } finally {
      setGerando(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {rotaAtiva && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={gerando !== null}
          onClick={() => exportar("rota")}
        >
          <FileDown className="size-4" />
          {gerando === "rota" ? "Gerando..." : `PDF rota ${rotaAtiva.nome}`}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={gerando !== null}
        onClick={() => exportar("todas")}
      >
        <FileDown className="size-4" />
        {gerando === "todas" ? "Gerando..." : "PDF todas as rotas"}
      </Button>
    </div>
  );
}
