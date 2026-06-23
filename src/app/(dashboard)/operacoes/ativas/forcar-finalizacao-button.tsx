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
import { forcarFinalizacao } from "./actions";

export function ForcarFinalizacaoButton({ operacaoId }: { operacaoId: string }) {
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleConfirmar() {
    setEnviando(true);
    const result = await forcarFinalizacao(operacaoId);
    setEnviando(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Operação finalizada forçadamente.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Forçar finalização</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forçar finalização</DialogTitle>
          <DialogDescription>
            Isso finaliza a operação de outro colaborador sem passar pelo
            fluxo normal. A ação fica registrada na auditoria. Tem certeza?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" disabled={enviando} onClick={handleConfirmar}>
            {enviando ? "Finalizando..." : "Forçar finalização"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
