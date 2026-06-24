"use client";

import { useState } from "react";
import { utils, writeFile } from "xlsx";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { TipoEvento } from "@/lib/types/database.types";

export function ExportarExcelButton({
  dataInicio,
  dataFim,
  galpaoId,
  transportadoraId,
  tipoEvento,
  operacaoId,
  rotaId,
  colaboradorId,
  motoristaId,
}: {
  dataInicio: string;
  dataFim: string;
  galpaoId?: string;
  transportadoraId?: string;
  tipoEvento?: TipoEvento;
  operacaoId?: string;
  rotaId?: string;
  colaboradorId?: string;
  motoristaId?: string;
}) {
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("dashboard_bipagens_export", {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_galpao_id: galpaoId ?? null,
        p_transportadora_id: transportadoraId ?? null,
        p_tipo_evento: tipoEvento ?? null,
        p_operacao_id: operacaoId ?? null,
        p_rota_id: rotaId ?? null,
        p_colaborador_id: colaboradorId ?? null,
        p_motorista_id: motoristaId ?? null,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (!data.linhas.length) {
        toast.error("Nenhuma bipagem encontrada para os filtros atuais.");
        return;
      }

      if (data.truncado) {
        toast.warning("Export limitado a 20.000 linhas — estreite o período ou os filtros para ver tudo.");
      }

      const linhas = data.linhas.map((l) => ({
        "Tipo Encomenda": l.tipo_encomenda,
        "Tipo Evento": l.tipo_evento,
        Operação: l.operacao,
        Rota: l.rota,
        Colaborador: l.colaborador,
        "Data/Hora da bipagem": new Date(l.data_hora).toLocaleString("pt-BR"),
        Motorista: l.motorista ?? "—",
        Código: l.codigo,
        Status: l.status,
      }));

      const planilha = utils.json_to_sheet(linhas);
      const livro = utils.book_new();
      utils.book_append_sheet(livro, planilha, "Bipagens");
      writeFile(livro, `rotascan-bipagens-${dataInicio}-a-${dataFim}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <Button type="button" variant="outline" disabled={exportando} onClick={exportar}>
      {exportando ? "Exportando..." : "Exportar Excel"}
    </Button>
  );
}
