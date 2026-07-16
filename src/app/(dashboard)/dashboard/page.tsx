import { requireAdminOrGerente } from "@/lib/auth/guards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardFiltros } from "./filtros";
import { DashboardCharts } from "./charts";
import { ExportarExcelButton } from "./exportar-excel-button";
import type { TipoEvento } from "@/lib/types/database.types";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { supabase, papel } = await requireAdminOrGerente();

  const dataInicio = params.data_inicio || inicioDoMes();
  const dataFim = params.data_fim || hoje();

  const galpaoIds        = params.galpoes?.split(",").filter(Boolean) ?? [];
  const transportadoraIds = params.transportadoras?.split(",").filter(Boolean) ?? [];
  const tiposEvento      = (params.tipos?.split(",").filter(Boolean) ?? []) as TipoEvento[];
  const operacaoIds      = params.operacoes?.split(",").filter(Boolean) ?? [];
  const rotaIds          = params.rotas?.split(",").filter(Boolean) ?? [];
  const colaboradorIds   = params.colaboradores?.split(",").filter(Boolean) ?? [];
  const motoristaIds     = params.motoristas?.split(",").filter(Boolean) ?? [];

  const [
    { data: galpoes },
    { data: transportadoras },
    { data: operacoesRaw },
    { data: rotas },
    { data: colaboradores },
    { data: motoristas },
    { data: kpis, error: kpisError },
  ] = await Promise.all([
    papel === "admin"
      ? supabase.from("galpoes").select("id, nome").order("nome")
      : Promise.resolve({ data: null }),
    supabase.from("transportadoras").select("id, nome").order("nome"),
    supabase
      .from("operacoes")
      .select("id, data, tipo_evento, transportadora_id")
      .order("data", { ascending: false })
      .limit(200),
    supabase.from("rotas").select("id, nome").order("nome"),
    supabase.from("colaboradores").select("id, nome").order("nome"),
    supabase.from("motoristas").select("id, nome").order("nome"),
    supabase.rpc("dashboard_kpis", {
      p_data_inicio:        dataInicio,
      p_data_fim:           dataFim,
      p_galpao_ids:         galpaoIds.length > 0 ? galpaoIds : null,
      p_transportadora_ids: transportadoraIds.length > 0 ? transportadoraIds : null,
      p_tipos_evento:       tiposEvento.length > 0 ? tiposEvento : null,
      p_operacao_ids:       operacaoIds.length > 0 ? operacaoIds : null,
      p_rota_ids:           rotaIds.length > 0 ? rotaIds : null,
      p_colaborador_ids:    colaboradorIds.length > 0 ? colaboradorIds : null,
      p_motorista_ids:      motoristaIds.length > 0 ? motoristaIds : null,
    }),
  ]);

  if (kpisError) throw new Error(kpisError.message);

  const transportadorasPorId = new Map((transportadoras ?? []).map((t) => [t.id, t.nome]));
  const TIPO_EVENTO_LABEL: Record<string, string> = {
    RECEBIMENTO: "Recebimento",
    ENTREGA: "Entrega",
    DEVOLUCAO_ORIGEM: "Devolução à Origem",
    RETORNO: "Retorno",
  };
  const operacoes = (operacoesRaw ?? []).map((o) => ({
    id: o.id,
    nome: `${transportadorasPorId.get(o.transportadora_id) ?? "—"} · ${TIPO_EVENTO_LABEL[o.tipo_evento]} · ${o.data}`,
  }));

  const dados = kpis ?? {
    total: 0,
    por_dia: [],
    por_transportadora: [],
    por_motorista: [],
    ranking_colaboradores: [],
    por_tipo_evento: [],
    por_dia_transportadora: [],
    heatmap_galpao_tipo: [],
    por_rota_treemap: [],
    funil: { recebido: 0, bipado: 0, em_rota: 0, entregue: 0 },
    sankey_fluxo: { recebido: 0, entregue: 0, devolvido: 0, retornado: 0, em_aberto: 0 },
    recebimento_total: 0,
    entrega_total: 0,
    entrega_duplicados_total: 0,
    overrides_aplicados: 0,
  };

  const diferencaAbs = dados.entrega_total - dados.recebimento_total;
  const diferencaPct =
    dados.recebimento_total > 0 ? (diferencaAbs / dados.recebimento_total) * 100 : null;

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <ExportarExcelButton
          dataInicio={dataInicio}
          dataFim={dataFim}
          galpaoIds={galpaoIds}
          transportadoraIds={transportadoraIds}
          tiposEvento={tiposEvento}
          operacaoIds={operacaoIds}
          rotaIds={rotaIds}
          colaboradorIds={colaboradorIds}
          motoristaIds={motoristaIds}
        />
      </div>

      <DashboardFiltros
        dataInicio={dataInicio}
        dataFim={dataFim}
        galpoes={galpoes}
        transportadoras={transportadoras ?? []}
        operacoes={operacoes}
        rotas={rotas ?? []}
        colaboradores={colaboradores ?? []}
        motoristas={motoristas ?? []}
        galpoesSelecionados={galpaoIds}
        transportadorasSelecionadas={transportadoraIds}
        tiposSelecionados={tiposEvento}
        operacoesSelecionadas={operacaoIds}
        rotasSelecionadas={rotaIds}
        colaboradoresSelecionados={colaboradorIds}
        motoristasSelecionados={motoristaIds}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total bipado</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{dados.total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Recebimento</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{dados.recebimento_total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Entrega</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{dados.entrega_total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Entregas duplicadas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{dados.entrega_duplicados_total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Diferença Receb. × Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {diferencaAbs > 0 ? "+" : ""}
            {diferencaAbs}
            {diferencaPct !== null && (
              <span className="ml-1 text-sm text-muted-foreground">
                ({diferencaPct > 0 ? "+" : ""}
                {diferencaPct.toFixed(1)}%)
              </span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Overrides aplicados</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{dados.overrides_aplicados}</CardContent>
        </Card>
      </div>

      <DashboardCharts dados={dados} diferencaAbs={diferencaAbs} diferencaPct={diferencaPct} />
    </main>
  );
}
