"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { buscarBipagensOperacao, desfazerBipagem } from "@/lib/bipagem/registrar";
import { dbOffline } from "@/lib/bipagem/db-offline";
import type { Database } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ItemBusca = {
  chave: string;
  id: string;
  codigo: string;
  rotaId: string;
  bipadoEm: string;
  motivo: string | null;
  pendente: boolean;
};

export function ExcluirBipagemDialog({
  open,
  onOpenChange,
  supabase,
  operacaoId,
  rotas,
  onExcluida,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabase: SupabaseClient<Database>;
  operacaoId: string;
  rotas: { id: string; nome: string }[];
  onExcluida: (item: { rotaId: string; pendente: boolean }) => void;
}) {
  const [termo, setTermo] = useState("");
  const [termoBusca, setTermoBusca] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Debounce da busca no servidor
  useEffect(() => {
    const id = setTimeout(() => setTermoBusca(termo.trim()), 250);
    return () => clearTimeout(id);
  }, [termo]);

  function alterarAberto(aberto: boolean) {
    if (!aberto) {
      setTermo("");
      setTermoBusca("");
      setConfirmando(null);
    }
    onOpenChange(aberto);
  }

  const { data: doServidor, isFetching } = useQuery({
    queryKey: ["bipagem-busca", operacaoId, termoBusca],
    queryFn: () => buscarBipagensOperacao(supabase, operacaoId, termoBusca),
    enabled: open,
    staleTime: 0,
  });

  const pendentes = useLiveQuery(
    () =>
      dbOffline.fila
        .filter(
          (item) =>
            item.payload.operacao_id === operacaoId &&
            item.status === "pendente" &&
            item.payload.codigo.includes(termoBusca.toUpperCase())
        )
        .toArray(),
    [operacaoId, termoBusca],
    []
  );

  const itens: ItemBusca[] = [
    ...(pendentes ?? []).map((p) => ({
      chave: `p-${p.id}`,
      id: String(p.id),
      codigo: p.payload.codigo,
      rotaId: p.payload.rota_id,
      bipadoEm: p.payload.bipado_em,
      motivo: p.payload.motivo ?? null,
      pendente: true,
    })),
    ...(doServidor ?? []).map((b) => ({
      chave: `s-${b.id}`,
      id: b.id,
      codigo: b.codigo,
      rotaId: b.rota_id,
      bipadoEm: b.bipado_em,
      motivo: b.motivo,
      pendente: false,
    })),
  ].sort((a, b) => (a.bipadoEm < b.bipadoEm ? 1 : -1));

  const nomeRota = new Map(rotas.map((r) => [r.id, r.nome]));

  async function excluir(item: ItemBusca) {
    setExcluindo(true);
    try {
      if (item.pendente) {
        await dbOffline.fila.delete(Number(item.id));
      } else {
        await desfazerBipagem(supabase, item.id);
      }
      toast.success(`Bipagem ${item.codigo} excluída.`);
      setConfirmando(null);
      onExcluida({ rotaId: item.rotaId, pendente: item.pendente });
    } catch {
      toast.error("Não foi possível excluir. Colaborador só exclui as próprias bipagens; gerente, as do próprio galpão.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={alterarAberto}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Excluir bipagem</DialogTitle>
          <DialogDescription>
            Digite ou bipe o código para localizar. A busca vale para todas as rotas desta
            operação.
          </DialogDescription>
        </DialogHeader>

        <input
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value.toUpperCase());
            setConfirmando(null);
          }}
          onKeyDown={(e) => {
            // Enter com um único resultado já pede a confirmação (fluxo com scanner)
            if (e.key === "Enter") {
              e.preventDefault();
              if (itens.length === 1) setConfirmando(itens[0].chave);
            }
          }}
          placeholder="Código da encomenda"
          autoFocus
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-input bg-transparent px-3 font-mono outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />

        <div className="max-h-80 overflow-y-auto">
          {itens.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {isFetching ? "Buscando..." : "Nenhuma bipagem encontrada nesta operação."}
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {itens.map((item) => (
                <li
                  key={item.chave}
                  className={cn(
                    "flex items-center justify-between gap-3 py-2",
                    confirmando === item.chave && "bg-red-500/10"
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-mono">{item.codigo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {nomeRota.get(item.rotaId) ?? "—"} ·{" "}
                      {new Date(item.bipadoEm).toLocaleTimeString("pt-BR")}
                      {item.pendente && " · pendente de sincronização"}
                      {item.motivo && ` · ${item.motivo}`}
                    </p>
                  </div>
                  {confirmando === item.chave ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={excluindo}
                        onClick={() => setConfirmando(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={excluindo}
                        autoFocus
                        onClick={() => excluir(item)}
                      >
                        {excluindo ? "Excluindo..." : "Confirmar exclusão"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setConfirmando(item.chave)}
                    >
                      Excluir
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
