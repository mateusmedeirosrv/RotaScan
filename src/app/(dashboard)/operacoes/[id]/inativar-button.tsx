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
import { inativarOperacao, reativarOperacao } from "./actions";

export function InativarOperacaoButton({
  operacaoId,
  ativa,
}: {
  operacaoId: string;
  ativa: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleConfirmar() {
    setEnviando(true);
    const result = ativa
      ? await inativarOperacao(operacaoId)
      : await reativarOperacao(operacaoId);
    setEnviando(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(ativa ? "Operação inativada." : "Operação reativada.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">{ativa ? "Inativar operação" : "Reativar operação"}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ativa ? "Inativar operação" : "Reativar operação"}</DialogTitle>
          <DialogDescription>
            {ativa
              ? "Operações inativas (ex.: treinamento) continuam visíveis nas listagens, mas saem dos indicadores do Dashboard. Os dados não são excluídos. Tem certeza?"
              : "A operação volta a contar nos indicadores do Dashboard. Tem certeza?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={enviando} onClick={handleConfirmar}>
            {enviando ? "Salvando..." : ativa ? "Inativar" : "Reativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
