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

export function FinalizarOperacaoButton({ operacaoId }: { operacaoId: string }) {
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleConfirmar() {
    setEnviando(true);
    const result = await finalizarOperacao(operacaoId);
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
        <DialogFooter>
          <Button disabled={enviando} onClick={handleConfirmar}>
            {enviando ? "Finalizando..." : "Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
