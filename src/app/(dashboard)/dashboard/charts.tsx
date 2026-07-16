"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardKpis } from "@/lib/types/database.types";
import { VolumeDiarioChart } from "./charts/volume-diario";
import { DistribuicaoTipoEventoChart } from "./charts/distribuicao-tipo-evento";
import { PorTransportadoraChart } from "./charts/por-transportadora";
import { RankingChart } from "./charts/ranking";
import { RankingMotoristasChart } from "./charts/ranking-motoristas";
import { ComparativoTransportadorasChart } from "./charts/comparativo-transportadoras";
import { FunilChart } from "./charts/funil";
import { HeatmapGalpaoChart } from "./charts/heatmap-galpao";
import { TreemapRotasChart } from "./charts/treemap-rotas";
import { SankeyFluxoChart } from "./charts/sankey-fluxo";

export function DashboardCharts({
  dados,
  diferencaAbs,
  diferencaPct,
}: {
  dados: DashboardKpis;
  diferencaAbs: number;
  diferencaPct: number | null;
}) {
  if (dados.total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma bipagem encontrada para o período e filtros selecionados.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Volume diário</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumeDiarioChart dados={dados.por_dia} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por tipo de evento</CardTitle>
          </CardHeader>
          <CardContent>
            <DistribuicaoTipoEventoChart dados={dados.por_tipo_evento} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por transportadora</CardTitle>
          </CardHeader>
          <CardContent>
            <PorTransportadoraChart dados={dados.por_transportadora} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Série comparativa: Amazon × Magalu</CardTitle>
          </CardHeader>
          <CardContent>
            <ComparativoTransportadorasChart dados={dados.por_dia_transportadora} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de colaboradores (bipagem)</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart
              dados={dados.ranking_colaboradores.map((d) => ({
                nome: d.colaborador,
                total: d.total,
                dias_trabalhados: d.dias_trabalhados,
                media_dia: d.media_dia,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de motoristas (entrega)</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingMotoristasChart dados={dados.por_motorista} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Galpão × tipo de evento</CardTitle>
          </CardHeader>
          <CardContent>
            <HeatmapGalpaoChart dados={dados.heatmap_galpao_tipo} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volume por rota (insucesso em cor)</CardTitle>
          </CardHeader>
          <CardContent>
            <TreemapRotasChart dados={dados.por_rota_treemap} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funil operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <FunilChart funil={dados.funil} diferencaAbs={diferencaAbs} diferencaPct={diferencaPct} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo de itens recebidos</CardTitle>
        </CardHeader>
        <CardContent>
          <SankeyFluxoChart dados={dados.sankey_fluxo} />
        </CardContent>
      </Card>
    </div>
  );
}
