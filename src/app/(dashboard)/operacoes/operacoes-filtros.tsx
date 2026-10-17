"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GrupoChecklist } from "@/components/grupo-checklist";

const TIPO_EVENTO_OPCOES = [
  { id: "RECEBIMENTO", nome: "Recebimento" },
  { id: "ENTREGA", nome: "Entrega" },
  { id: "DEVOLUCAO_ORIGEM", nome: "Devolução à Origem" },
  { id: "RETORNO", nome: "Retorno" },
];

const STATUS_OPCOES = [
  { id: "EM_ANDAMENTO", nome: "Em andamento" },
  { id: "FINALIZADA", nome: "Finalizada" },
];

type Opcao = { id: string; nome: string };

type Props = {
  colaboradores: Opcao[];
  galpoes: Opcao[];
  transportadoras: Opcao[];
  colaboradoresSelecionados: string[];
  galpoesSelecionados: string[];
  transportadorasSelecionadas: string[];
  tiposSelecionados: string[];
  statusSelecionados: string[];
  dataSelecionada: string;
};

export function OperacoesFiltros({
  colaboradores,
  galpoes,
  transportadoras,
  colaboradoresSelecionados,
  galpoesSelecionados,
  transportadorasSelecionadas,
  tiposSelecionados,
  statusSelecionados,
  dataSelecionada,
}: Props) {
  const router = useRouter();

  const [filtros, setFiltros] = useState({
    colaboradores: colaboradoresSelecionados,
    galpoes: galpoesSelecionados,
    transportadoras: transportadorasSelecionadas,
    tipos: tiposSelecionados,
    status: statusSelecionados,
    data: dataSelecionada,
  });

  function setFiltro<K extends keyof typeof filtros>(chave: K, valor: (typeof filtros)[K]) {
    setFiltros((f) => ({ ...f, [chave]: valor }));
  }

  function aplicar() {
    const params = new URLSearchParams();
    if (filtros.colaboradores.length > 0) params.set("colaboradores", filtros.colaboradores.join(","));
    if (filtros.galpoes.length > 0) params.set("galpoes", filtros.galpoes.join(","));
    if (filtros.transportadoras.length > 0) params.set("transportadoras", filtros.transportadoras.join(","));
    if (filtros.tipos.length > 0) params.set("tipos", filtros.tipos.join(","));
    if (filtros.status.length > 0) params.set("status", filtros.status.join(","));
    if (filtros.data) params.set("data", filtros.data);
    router.push(`/operacoes?${params.toString()}`);
  }

  function limpar() {
    setFiltros({ colaboradores: [], galpoes: [], transportadoras: [], tipos: [], status: [], data: "" });
    router.push("/operacoes");
  }

  const temFiltroAtivo =
    filtros.colaboradores.length > 0 ||
    filtros.galpoes.length > 0 ||
    filtros.transportadoras.length > 0 ||
    filtros.tipos.length > 0 ||
    filtros.status.length > 0 ||
    !!filtros.data;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <GrupoChecklist
          label="Colaborador"
          opcoes={colaboradores}
          selecionados={filtros.colaboradores}
          onChange={(v) => setFiltro("colaboradores", v)}
        />
        <GrupoChecklist
          label="Galpão"
          opcoes={galpoes}
          selecionados={filtros.galpoes}
          onChange={(v) => setFiltro("galpoes", v)}
        />
        <GrupoChecklist
          label="Transportadora"
          opcoes={transportadoras}
          selecionados={filtros.transportadoras}
          onChange={(v) => setFiltro("transportadoras", v)}
        />
        <GrupoChecklist
          label="Tipo"
          opcoes={TIPO_EVENTO_OPCOES}
          selecionados={filtros.tipos}
          onChange={(v) => setFiltro("tipos", v)}
        />
        <GrupoChecklist
          label="Status"
          opcoes={STATUS_OPCOES}
          selecionados={filtros.status}
          onChange={(v) => setFiltro("status", v)}
        />
        <div className="space-y-2">
          <p className="text-sm font-medium">Data</p>
          <div className="space-y-1">
            <Label htmlFor="filtro-data" className="sr-only">Data</Label>
            <Input
              id="filtro-data"
              type="date"
              value={filtros.data}
              onChange={(e) => setFiltro("data", e.target.value)}
              className="w-36"
            />
            {filtros.data && (
              <button
                type="button"
                onClick={() => setFiltro("data", "")}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Limpar data
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" onClick={aplicar}>
          Aplicar filtros
        </Button>
        <Button type="button" variant="outline" onClick={limpar} disabled={!temFiltroAtivo}>
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
