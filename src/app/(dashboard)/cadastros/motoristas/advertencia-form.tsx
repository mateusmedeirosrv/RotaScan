"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { criarAdvertencia } from "./actions";
import { gerarPdfAdvertencia } from "@/lib/pdf/advertencia";
import type { Database } from "@/lib/types/database.types";

type Motorista = Database["public"]["Tables"]["motoristas"]["Row"];

const schema = z.object({
  motivo: z.string().min(1, "Informe o motivo da advertência"),
  data_vigencia: z.string().min(1, "Informe a data de vigência"),
  local: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function formatarDataBR(isoDate: string) {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function AdvertenciaFormDialog({
  motorista,
  trigger,
}: {
  motorista: Motorista;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);

  const defaultValues = { motivo: "", data_vigencia: hoje(), local: "" };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  async function onSubmit(data: FormData) {
    const result = await criarAdvertencia({
      motorista_id: motorista.id,
      galpao_id: motorista.galpao_id,
      motivo: data.motivo,
      data_vigencia: data.data_vigencia,
      local: data.local || null,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    try {
      const bytes = await gerarPdfAdvertencia({
        motoristaNome: motorista.nome,
        motoristaCpf: motorista.cpf,
        motivo: data.motivo,
        dataVigencia: formatarDataBR(data.data_vigencia),
        local: data.local || null,
      });
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      toast.error("Advertência registrada, mas não foi possível gerar o PDF.");
      setOpen(false);
      return;
    }

    toast.success("Advertência registrada.");
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset(defaultValues);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Advertência — {motorista.nome}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea id="motivo" rows={4} autoFocus {...register("motivo")} />
            {errors.motivo && (
              <p className="text-sm text-destructive">{errors.motivo.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="data_vigencia">Vigência a partir de</Label>
            <Input id="data_vigencia" type="date" {...register("data_vigencia")} />
            {errors.data_vigencia && (
              <p className="text-sm text-destructive">{errors.data_vigencia.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="local">Local (opcional)</Label>
            <Input id="local" placeholder="Ex: Jataí/GO" {...register("local")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Gerando..." : "Registrar e gerar PDF"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
