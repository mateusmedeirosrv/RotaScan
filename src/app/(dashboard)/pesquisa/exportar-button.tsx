"use client";

import { useState } from "react";
import { utils, writeFile } from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportarPesquisa } from "./actions";
import type { FiltrosPesquisa } from "./consulta";

export function ExportarPesquisaButton({
  filtros,
  disabled,
}: {
  filtros: FiltrosPesquisa;
  disabled?: boolean;
}) {
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    try {
      const resultado = await exportarPesquisa(filtros);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      if (!resultado.linhas.length) {
        toast.error("Nenhum resultado para exportar.");
        return;
      }
      if (resultado.truncado) {
        toast.warning("Export limitado a 20.000 linhas. Use mais filtros para ver tudo.");
      }

      const livro = utils.book_new();
      utils.book_append_sheet(livro, utils.json_to_sheet(resultado.linhas), "Pesquisa");
      writeFile(livro, `rotascan-pesquisa-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("Não foi possível exportar a pesquisa.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <Button variant="outline" onClick={exportar} disabled={disabled || exportando}>
      {exportando ? "Exportando..." : "Exportar Excel"}
    </Button>
  );
}
