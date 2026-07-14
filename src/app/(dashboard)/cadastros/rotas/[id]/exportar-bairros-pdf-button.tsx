"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { gerarPdfBairrosRota } from "@/lib/pdf/rota-bairros";

function slugificar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ExportarBairrosPdfButton({
  nomeRota,
  bairros,
}: {
  nomeRota: string;
  bairros: string[];
}) {
  const [gerando, setGerando] = useState(false);

  async function exportar() {
    setGerando(true);
    try {
      const bytes = await gerarPdfBairrosRota(bairros);
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rotascan-bairros-${slugificar(nomeRota)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Button type="button" variant="outline" disabled={gerando || bairros.length === 0} onClick={exportar}>
      {gerando ? "Gerando..." : "Exportar PDF (bairros)"}
    </Button>
  );
}
