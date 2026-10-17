"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type OpcaoChecklist = { id: string; nome: string };

// Lista de checkboxes com opção "Todos" (nenhum selecionado = sem filtro).
// Com `buscavel`, mostra um campo para filtrar listas longas (motoristas, rotas).
export function GrupoChecklist({
  label,
  opcoes,
  selecionados,
  onChange,
  buscavel = false,
  className,
}: {
  label: string;
  opcoes: OpcaoChecklist[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  buscavel?: boolean;
  className?: string;
}) {
  const [busca, setBusca] = useState("");
  const isTodos = selecionados.length === 0;

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? opcoes.filter((o) => o.nome.toLowerCase().includes(termo))
    : opcoes;

  function toggle(id: string) {
    if (selecionados.includes(id)) {
      onChange(selecionados.filter((s) => s !== id));
    } else {
      onChange([...selecionados, id]);
    }
  }

  return (
    <div className={cn("min-w-36 space-y-1.5", className)}>
      <p className="text-sm font-medium">
        {label}
        {selecionados.length > 0 && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({selecionados.length})
          </span>
        )}
      </p>
      {buscavel && (
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar..."
          className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring"
        />
      )}
      <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isTodos}
          onChange={() => !isTodos && onChange([])}
          className="h-4 w-4 accent-primary"
        />
        Todos
      </label>
      <div className={cn(buscavel && "max-h-48 space-y-1.5 overflow-y-auto pr-1")}>
        {visiveis.map((opcao) => (
          <label
            key={opcao.id}
            className="flex cursor-pointer select-none items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selecionados.includes(opcao.id)}
              onChange={() => toggle(opcao.id)}
              className="h-4 w-4 accent-primary"
            />
            {opcao.nome}
          </label>
        ))}
        {buscavel && visiveis.length === 0 && (
          <p className="text-xs text-muted-foreground">Nada encontrado.</p>
        )}
      </div>
    </div>
  );
}
