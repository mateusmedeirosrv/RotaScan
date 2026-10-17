"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GrupoChecklist, type OpcaoChecklist } from "@/components/grupo-checklist";
import { filtrosParaParams, type FiltrosPesquisa } from "./consulta";

const TIPO_EVENTO_OPCOES = [
  { id: "RECEBIMENTO", nome: "Recebimento" },
  { id: "ENTREGA", nome: "Entrega" },
  { id: "DEVOLUCAO_ORIGEM", nome: "Devolução à Origem" },
  { id: "RETORNO", nome: "Retorno" },
];

const FILTROS_VAZIOS: FiltrosPesquisa = {
  codigo: "",
  transportadoras: [],
  motoristas: [],
  rotas: [],
  colaboradores: [],
  tipos: [],
  dataInicio: "",
  dataFim: "",
};

export function PesquisaFiltros({
  filtrosAtuais,
  transportadoras,
  motoristas,
  rotas,
  colaboradores,
}: {
  filtrosAtuais: FiltrosPesquisa;
  transportadoras: OpcaoChecklist[];
  motoristas: OpcaoChecklist[];
  rotas: OpcaoChecklist[];
  colaboradores: OpcaoChecklist[];
}) {
  const router = useRouter();
  const [filtros, setFiltros] = useState(filtrosAtuais);

  function setFiltro<K extends keyof FiltrosPesquisa>(chave: K, valor: FiltrosPesquisa[K]) {
    setFiltros((f) => ({ ...f, [chave]: valor }));
  }

  function aplicar(e?: React.FormEvent) {
    e?.preventDefault();
    router.push(`/pesquisa?${filtrosParaParams(filtros).toString()}`);
  }

  function limpar() {
    setFiltros(FILTROS_VAZIOS);
    router.push("/pesquisa");
  }

  const temFiltroAtivo = filtrosParaParams(filtros).toString() !== "";

  return (
    <form onSubmit={aplicar} className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1 space-y-1">
          <Label htmlFor="pesquisa-codigo">Código da encomenda</Label>
          <Input
            id="pesquisa-codigo"
            value={filtros.codigo}
            onChange={(e) => setFiltro("codigo", e.target.value)}
            placeholder="Parte do código, ou vários códigos separados por espaço/vírgula"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pesquisa-inicio">De</Label>
          <Input
            id="pesquisa-inicio"
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => setFiltro("dataInicio", e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pesquisa-fim">Até</Label>
          <Input
            id="pesquisa-fim"
            type="date"
            value={filtros.dataFim}
            onChange={(e) => setFiltro("dataFim", e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <GrupoChecklist
          label="Tipo"
          opcoes={TIPO_EVENTO_OPCOES}
          selecionados={filtros.tipos}
          onChange={(v) => setFiltro("tipos", v)}
        />
        <GrupoChecklist
          label="Transportadora"
          opcoes={transportadoras}
          selecionados={filtros.transportadoras}
          onChange={(v) => setFiltro("transportadoras", v)}
        />
        <GrupoChecklist
          label="Motorista"
          opcoes={motoristas}
          selecionados={filtros.motoristas}
          onChange={(v) => setFiltro("motoristas", v)}
          buscavel
          className="w-52"
        />
        <GrupoChecklist
          label="Rota"
          opcoes={rotas}
          selecionados={filtros.rotas}
          onChange={(v) => setFiltro("rotas", v)}
          buscavel
          className="w-52"
        />
        <GrupoChecklist
          label="Colaborador"
          opcoes={colaboradores}
          selecionados={filtros.colaboradores}
          onChange={(v) => setFiltro("colaboradores", v)}
          buscavel
          className="w-52"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit">Pesquisar</Button>
        <Button type="button" variant="outline" onClick={limpar} disabled={!temFiltroAtivo}>
          Limpar filtros
        </Button>
      </div>
    </form>
  );
}
