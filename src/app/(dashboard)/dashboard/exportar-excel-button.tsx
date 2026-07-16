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
  galpaoIds,
  transportadoraIds,
  tiposEvento,
  operacaoIds,
  rotaIds,
  colaboradorIds,
  motoristaIds,
}: {
  dataInicio: string;
  dataFim: string;
  galpaoIds: string[];
  transportadoraIds: string[];
  tiposEvento: TipoEvento[];
  operacaoIds: string[];
  rotaIds: string[];
  colaboradorIds: string[];
  motoristaIds: string[];
}) {
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("dashboard_bipagens_export", {
        p_data_inicio:        dataInicio,
        p_data_fim:           dataFim,
        p_galpao_ids:         galpaoIds.length > 0 ? galpaoIds : null,
        p_transportadora_ids: transportadoraIds.length > 0 ? transportadoraIds : null,
        p_tipos_evento:       tiposEvento.length > 0 ? tiposEvento : null,
        p_operacao_ids:       operacaoIds.length > 0 ? operacaoIds : null,
        p_rota_ids:           rotaIds.length > 0 ? rotaIds : null,
        p_colaborador_ids:    colaboradorIds.length > 0 ? colaboradorIds : null,
        p_motorista_ids:      motoristaIds.length > 0 ? motoristaIds : null,
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
        Motivo: l.motivo ?? "—",
        Duplicado: l.duplicado ? "Sim" : "Não",
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
