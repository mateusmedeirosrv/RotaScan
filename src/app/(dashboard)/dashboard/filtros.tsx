"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const TIPO_EVENTO_OPCOES = [
  { id: "RECEBIMENTO", nome: "Recebimento" },
  { id: "ENTREGA", nome: "Entrega" },
  { id: "DEVOLUCAO_ORIGEM", nome: "Devolução à Origem" },
  { id: "RETORNO", nome: "Retorno" },
  { id: "CONFERENCIA", nome: "Conferência" },
];

type Opcao = { id: string; nome: string };

export function DashboardFiltros({
  dataInicio,
  dataFim,
  galpoes,
  transportadoras,
  operacoes,
  rotas,
  colaboradores,
  motoristas,
  galpoesSelecionados,
  transportadorasSelecionadas,
  tiposSelecionados,
  operacoesSelecionadas,
  rotasSelecionadas,
  colaboradoresSelecionados,
  motoristasSelecionados,
}: {
  dataInicio: string;
  dataFim: string;
  galpoes: Opcao[] | null;
  transportadoras: Opcao[];
  operacoes: Opcao[];
  rotas: Opcao[];
  colaboradores: Opcao[];
  motoristas: Opcao[];
  galpoesSelecionados: string[];
  transportadorasSelecionadas: string[];
  tiposSelecionados: string[];
  operacoesSelecionadas: string[];
  rotasSelecionadas: string[];
  colaboradoresSelecionados: string[];
  motoristasSelecionados: string[];
}) {
  const router = useRouter();

  const [filtros, setFiltros] = useState({
    data_inicio: dataInicio,
    data_fim: dataFim,
    galpoes: galpoesSelecionados,
    transportadoras: transportadorasSelecionadas,
    tipos: tiposSelecionados,
    operacoes: operacoesSelecionadas,
    rotas: rotasSelecionadas,
    colaboradores: colaboradoresSelecionados,
    motoristas: motoristasSelecionados,
  });

  function setFiltro<K extends keyof typeof filtros>(chave: K, valor: (typeof filtros)[K]) {
    setFiltros((f) => ({ ...f, [chave]: valor }));
  }

  function aplicar() {
    const params = new URLSearchParams();
    params.set("data_inicio", filtros.data_inicio);
    params.set("data_fim", filtros.data_fim);
    if (filtros.galpoes.length > 0) params.set("galpoes", filtros.galpoes.join(","));
    if (filtros.transportadoras.length > 0) params.set("transportadoras", filtros.transportadoras.join(","));
    if (filtros.tipos.length > 0) params.set("tipos", filtros.tipos.join(","));
    if (filtros.operacoes.length > 0) params.set("operacoes", filtros.operacoes.join(","));
    if (filtros.rotas.length > 0) params.set("rotas", filtros.rotas.join(","));
    if (filtros.colaboradores.length > 0) params.set("colaboradores", filtros.colaboradores.join(","));
    if (filtros.motoristas.length > 0) params.set("motoristas", filtros.motoristas.join(","));
    router.push(`/dashboard?${params.toString()}`);
  }

  function limpar() {
    setFiltros({
      data_inicio: inicioDoMes(),
      data_fim: hoje(),
      galpoes: [],
      transportadoras: [],
      tipos: [],
      operacoes: [],
      rotas: [],
      colaboradores: [],
      motoristas: [],
    });
    router.push("/dashboard");
  }

  const temFiltroAtivo =
    filtros.galpoes.length > 0 ||
    filtros.transportadoras.length > 0 ||
    filtros.tipos.length > 0 ||
    filtros.operacoes.length > 0 ||
    filtros.rotas.length > 0 ||
    filtros.colaboradores.length > 0 ||
    filtros.motoristas.length > 0;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="data_inicio">De</Label>
          <Input
            id="data_inicio"
            type="date"
            value={filtros.data_inicio}
            onChange={(e) => setFiltro("data_inicio", e.target.value)}
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="data_fim">Até</Label>
          <Input
            id="data_fim"
            type="date"
            value={filtros.data_fim}
            onChange={(e) => setFiltro("data_fim", e.target.value)}
            className="w-36"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {galpoes && (
          <GrupoChecklist
            label="Galpão"
            opcoes={galpoes}
            selecionados={filtros.galpoes}
            onChange={(v) => setFiltro("galpoes", v)}
          />
        )}
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
          label="Operação"
          opcoes={operacoes}
          selecionados={filtros.operacoes}
          onChange={(v) => setFiltro("operacoes", v)}
          scrollavel
        />
        <GrupoChecklist
          label="Rota"
          opcoes={rotas}
          selecionados={filtros.rotas}
          onChange={(v) => setFiltro("rotas", v)}
          scrollavel
        />
        <GrupoChecklist
          label="Colaborador"
          opcoes={colaboradores}
          selecionados={filtros.colaboradores}
          onChange={(v) => setFiltro("colaboradores", v)}
        />
        <GrupoChecklist
          label="Motorista"
          opcoes={motoristas}
          selecionados={filtros.motoristas}
          onChange={(v) => setFiltro("motoristas", v)}
          scrollavel
        />
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

function GrupoChecklist({
  label,
  opcoes,
  selecionados,
  onChange,
  scrollavel,
}: {
  label: string;
  opcoes: Opcao[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  scrollavel?: boolean;
}) {
  const isTodos = selecionados.length === 0;

  function toggle(id: string) {
    if (selecionados.includes(id)) {
      onChange(selecionados.filter((s) => s !== id));
    } else {
      onChange([...selecionados, id]);
    }
  }

  return (
    <div className="space-y-1.5 min-w-36">
      <p className="text-sm font-medium">{label}</p>
      <div className={scrollavel ? "max-h-48 overflow-y-auto space-y-1.5 pr-1" : "space-y-1.5"}>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isTodos}
            onChange={() => !isTodos && onChange([])}
            className="h-4 w-4 accent-primary"
          />
          Todos
        </label>
        {opcoes.map((opcao) => (
          <label key={opcao.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selecionados.includes(opcao.id)}
              onChange={() => toggle(opcao.id)}
              className="h-4 w-4 accent-primary"
            />
            {opcao.nome}
          </label>
        ))}
      </div>
    </div>
  );
}
