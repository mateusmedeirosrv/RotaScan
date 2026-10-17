"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { finalizarOperacao } from "./actions";

export function FinalizarOperacaoButton({
  operacaoId,
  semManifesto = false,
}: {
  operacaoId: string;
  semManifesto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleConfirmar() {
    setEnviando(true);
    const result = await finalizarOperacao(operacaoId, semManifesto);
    setEnviando(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Operação finalizada.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Finalizar operação</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar operação</DialogTitle>
          <DialogDescription>
            Depois de finalizada, a operação não pode mais receber bipagens
            nem ser editada (exceto por um admin). Tem certeza?
          </DialogDescription>
        </DialogHeader>
        {semManifesto && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            Nenhum manifesto foi importado. A conferência (encontradas,
            faltantes e extras) não será feita e não poderá ser importada
            depois de finalizar.
          </p>
        )}
        <DialogFooter>
          <Button disabled={enviando} onClick={handleConfirmar}>
            {enviando
              ? "Finalizando..."
              : semManifesto
                ? "Finalizar sem manifesto"
                : "Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
