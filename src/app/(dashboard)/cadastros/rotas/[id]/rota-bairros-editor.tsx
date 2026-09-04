"use client";

import { useState } from "react";
import { ArrowDown, ArrowDownAZ, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adicionarBairroNaRota,
  removerBairroDaRota,
  moverBairro,
  ordenarBairrosAlfabeticamente,
} from "../actions";

type BairroOrdenado = { bairroId: string; nome: string; ordem: number };
type BairroDisponivel = { id: string; nome: string };

export function RotaBairrosEditor({
  rotaId,
  bairrosOrdenados,
  bairrosDisponiveis,
}: {
  rotaId: string;
  bairrosOrdenados: BairroOrdenado[];
  bairrosDisponiveis: BairroDisponivel[];
}) {
  const [bairroParaAdicionar, setBairroParaAdicionar] = useState("");
  const [pendente, setPendente] = useState<string | null>(null);

  async function handleAdicionar() {
    if (!bairroParaAdicionar) return;
    setPendente("adicionar");
    const result = await adicionarBairroNaRota(rotaId, bairroParaAdicionar);
    setPendente(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setBairroParaAdicionar("");
  }

  async function handleRemover(bairroId: string) {
    setPendente(bairroId);
    const result = await removerBairroDaRota(rotaId, bairroId);
    setPendente(null);

    if (result.error) toast.error(result.error);
  }

  async function handleMover(bairroId: string, direcao: "cima" | "baixo") {
    setPendente(bairroId);
    const result = await moverBairro(rotaId, bairroId, direcao);
    setPendente(null);

    if (result.error) toast.error(result.error);
  }

  async function handleOrdenarAZ() {
    setPendente("ordenar");
    const result = await ordenarBairrosAlfabeticamente(rotaId);
    setPendente(null);

    if (result.error) toast.error(result.error);
  }

  return (
    <div className="space-y-4">
      {bairrosOrdenados.length > 1 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendente === "ordenar"}
            onClick={handleOrdenarAZ}
          >
            <ArrowDownAZ className="mr-1" />
            Ordenar A-Z
          </Button>
        </div>
      )}
      {bairrosOrdenados.length ? (
        <ul className="divide-y rounded-lg border">
          {bairrosOrdenados.map((item, index) => (
            <li
              key={item.bairroId}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span className="text-sm">
                <span className="mr-2 text-muted-foreground">
                  {index + 1}.
                </span>
                {item.nome}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0 || pendente === item.bairroId}
                  onClick={() => handleMover(item.bairroId, "cima")}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={
                    index === bairrosOrdenados.length - 1 ||
                    pendente === item.bairroId
                  }
                  onClick={() => handleMover(item.bairroId, "baixo")}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pendente === item.bairroId}
                  onClick={() => handleRemover(item.bairroId)}
                >
                  <X />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum bairro adicionado a esta rota ainda.
        </p>
      )}

      {bairrosDisponiveis.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            value={bairroParaAdicionar}
            onValueChange={(value) => setBairroParaAdicionar(value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um bairro para adicionar">
                {(value: string) =>
                  bairrosDisponiveis.find((b) => b.id === value)?.nome ??
                  "Selecione um bairro para adicionar"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {bairrosDisponiveis.map((bairro) => (
                <SelectItem key={bairro.id} value={bairro.id}>
                  {bairro.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={handleAdicionar}
            disabled={!bairroParaAdicionar || pendente === "adicionar"}
          >
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
