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
  const galpaoId = params.galpao_id;
  const transportadoraId = params.transportadora_id;
  const tipoEvento = params.tipo_evento as TipoEvento | undefined;
  const operacaoId = params.operacao_id;
  const rotaId = params.rota_id;
  const colaboradorId = params.colaborador_id;
  const motoristaId = params.motorista_id;

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
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_galpao_id: galpaoId ?? null,
      p_transportadora_id: transportadoraId ?? null,
      p_tipo_evento: tipoEvento ?? null,
      p_operacao_id: operacaoId ?? null,
      p_rota_id: rotaId ?? null,
      p_colaborador_id: colaboradorId ?? null,
      p_motorista_id: motoristaId ?? null,
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
    por_tipo_evento: [],
    recebimento_total: 0,
    entrega_total: 0,
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
          galpaoId={galpaoId}
          transportadoraId={transportadoraId}
          tipoEvento={tipoEvento}
          operacaoId={operacaoId}
          rotaId={rotaId}
          colaboradorId={colaboradorId}
          motoristaId={motoristaId}
        />
      </div>

      <DashboardFiltros
        dataInicio={dataInicio}
        dataFim={dataFim}
        galpaoId={galpaoId}
        transportadoraId={transportadoraId}
        tipoEvento={tipoEvento}
        operacaoId={operacaoId}
        rotaId={rotaId}
        colaboradorId={colaboradorId}
        motoristaId={motoristaId}
        galpoes={galpoes}
        transportadoras={transportadoras ?? []}
        operacoes={operacoes}
        rotas={rotas ?? []}
        colaboradores={colaboradores ?? []}
        motoristas={motoristas ?? []}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
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

      <DashboardCharts dados={dados} />
    </main>
  );
}
