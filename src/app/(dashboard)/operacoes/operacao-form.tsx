"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarOperacao } from "./actions";
import type { Database } from "@/lib/types/database.types";

type Transportadora = Database["public"]["Tables"]["transportadoras"]["Row"];
type TipoEvento = Database["public"]["Tables"]["operacoes"]["Row"]["tipo_evento"];

const TIPOS_EVENTO: { value: TipoEvento; label: string }[] = [
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "ENTREGA", label: "Entrega" },
  { value: "DEVOLUCAO_ORIGEM", label: "Devolução à Origem" },
  { value: "RETORNO", label: "Retorno" },
];

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

const schema = z.object({
  transportadora_id: z.string().min(1, "Selecione a transportadora"),
  data: z.string().min(1, "Informe a data"),
  tipo_evento: z.enum(["RECEBIMENTO", "ENTREGA", "DEVOLUCAO_ORIGEM", "RETORNO"]),
});

type FormData = z.infer<typeof schema>;

export function OperacaoFormDialog({
  transportadoras,
  trigger,
}: {
  transportadoras: Transportadora[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaultValues = {
    transportadora_id: "",
    data: hoje(),
    tipo_evento: "RECEBIMENTO" as TipoEvento,
  };

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  async function onSubmit(data: FormData) {
    const result = await criarOperacao(data);

    if (result.error || !result.id) {
      toast.error(result.error ?? "Não foi possível criar a operação.");
      return;
    }

    toast.success("Operação criada.");
    setOpen(false);
    router.push(`/operacoes/${result.id}`);
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
          <DialogTitle>Nova operação</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="transportadora_id">Transportadora</Label>
            <Controller
              name="transportadora_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="transportadora_id" className="w-full">
                    <SelectValue placeholder="Selecione a transportadora">
                      {(value: string) =>
                        transportadoras.find((t) => t.id === value)?.nome ??
                        "Selecione a transportadora"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {transportadoras.map((transportadora) => (
                      <SelectItem key={transportadora.id} value={transportadora.id}>
                        {transportadora.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.transportadora_id && (
              <p className="text-sm text-destructive">
                {errors.transportadora_id.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" {...register("data")} />
            {errors.data && (
              <p className="text-sm text-destructive">{errors.data.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="tipo_evento">Tipo de evento</Label>
            <Controller
              name="tipo_evento"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tipo_evento" className="w-full">
                    <SelectValue placeholder="Selecione o tipo de evento">
                      {(value: string) =>
                        TIPOS_EVENTO.find((t) => t.value === value)?.label ??
                        "Selecione o tipo de evento"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_EVENTO.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar operação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
