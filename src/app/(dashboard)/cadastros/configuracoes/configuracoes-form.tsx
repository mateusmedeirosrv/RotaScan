"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { salvarConfiguracoes } from "./actions";

const BLOQUEIO_OPCOES = [
  { value: "BLOQUEAR", label: "Bloquear" },
  { value: "PERMITIR_COM_ALERTA", label: "Permitir com alerta" },
  { value: "PERMITIR", label: "Permitir" },
];

const schema = z.object({
  bipagem_entrega_sem_recebimento: z.enum(["BLOQUEAR", "PERMITIR_COM_ALERTA", "PERMITIR"]),
  som_confirmado_arquivo: z.string().min(1, "Informe o caminho do arquivo"),
  som_duplicado_arquivo: z.string().min(1, "Informe o caminho do arquivo"),
  som_erro_arquivo: z.string().min(1, "Informe o caminho do arquivo"),
  qrcode_etiqueta_largura_mm: z
    .string()
    .refine((v) => Number(v) > 0, "Informe um valor maior que zero"),
  qrcode_etiqueta_altura_mm: z
    .string()
    .refine((v) => Number(v) > 0, "Informe um valor maior que zero"),
});

type FormData = z.infer<typeof schema>;

export function ConfiguracoesForm({ valores }: { valores: Record<string, string> }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      bipagem_entrega_sem_recebimento:
        (valores.bipagem_entrega_sem_recebimento as FormData["bipagem_entrega_sem_recebimento"]) ??
        "PERMITIR",
      som_confirmado_arquivo: valores.som_confirmado_arquivo ?? "",
      som_duplicado_arquivo: valores.som_duplicado_arquivo ?? "",
      som_erro_arquivo: valores.som_erro_arquivo ?? "",
      qrcode_etiqueta_largura_mm: valores.qrcode_etiqueta_largura_mm ?? "21.0",
      qrcode_etiqueta_altura_mm: valores.qrcode_etiqueta_altura_mm ?? "38.2",
    },
  });

  async function onSubmit(data: FormData) {
    const result = await salvarConfiguracoes(data);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Configurações salvas.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor="bipagem_entrega_sem_recebimento">
          Entrega sem recebimento prévio
        </Label>
        <Controller
          name="bipagem_entrega_sem_recebimento"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="bipagem_entrega_sem_recebimento" className="w-full">
                <SelectValue placeholder="Selecione">
                  {(value: string) =>
                    BLOQUEIO_OPCOES.find((o) => o.value === value)?.label ?? "Selecione"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BLOQUEIO_OPCOES.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="som_confirmado_arquivo">Som — confirmado</Label>
        <Input id="som_confirmado_arquivo" {...register("som_confirmado_arquivo")} />
        {errors.som_confirmado_arquivo && (
          <p className="text-sm text-destructive">{errors.som_confirmado_arquivo.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="som_duplicado_arquivo">Som — duplicado</Label>
        <Input id="som_duplicado_arquivo" {...register("som_duplicado_arquivo")} />
        {errors.som_duplicado_arquivo && (
          <p className="text-sm text-destructive">{errors.som_duplicado_arquivo.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="som_erro_arquivo">Som — erro</Label>
        <Input id="som_erro_arquivo" {...register("som_erro_arquivo")} />
        {errors.som_erro_arquivo && (
          <p className="text-sm text-destructive">{errors.som_erro_arquivo.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="qrcode_etiqueta_largura_mm">Etiqueta QR — largura (mm)</Label>
          <Input
            id="qrcode_etiqueta_largura_mm"
            type="number"
            step="0.1"
            {...register("qrcode_etiqueta_largura_mm")}
          />
          {errors.qrcode_etiqueta_largura_mm && (
            <p className="text-sm text-destructive">
              {errors.qrcode_etiqueta_largura_mm.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="qrcode_etiqueta_altura_mm">Etiqueta QR — altura (mm)</Label>
          <Input
            id="qrcode_etiqueta_altura_mm"
            type="number"
            step="0.1"
            {...register("qrcode_etiqueta_altura_mm")}
          />
          {errors.qrcode_etiqueta_altura_mm && (
            <p className="text-sm text-destructive">
              {errors.qrcode_etiqueta_altura_mm.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar configurações"}
      </Button>
    </form>
  );
}
