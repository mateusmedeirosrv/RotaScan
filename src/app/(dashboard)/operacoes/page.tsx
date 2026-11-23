import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OperacaoFormDialog } from "./operacao-form";
import { OperacoesFiltros } from "./operacoes-filtros";
import type { TipoEvento, StatusOperacao } from "@/lib/types/database.types";

const TIPO_EVENTO_LABEL: Record<string, string> = {
  RECEBIMENTO: "Recebimento",
  ENTREGA: "Entrega",
  DEVOLUCAO_ORIGEM: "Devolução à Origem",
  RETORNO: "Retorno",
  CONFERENCIA: "Conferência",
};

export default async function OperacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { supabase, colaborador } = await requireAuth();
  const params = await searchParams;

  const selectedColaboradores = params.colaboradores?.split(",").filter(Boolean) ?? [];
  const selectedGalpoes = params.galpoes?.split(",").filter(Boolean) ?? [];
  const selectedTransportadoras = params.transportadoras?.split(",").filter(Boolean) ?? [];
  const selectedTipos = params.tipos?.split(",").filter(Boolean) ?? [];
  const selectedStatus = params.status?.split(",").filter(Boolean) ?? [];
  const selectedData = params.data ?? "";

  let operacoesQuery = supabase
    .from("operacoes")
    .select("*")
    .order("iniciada_em", { ascending: false });

  if (selectedColaboradores.length > 0) {
    operacoesQuery = operacoesQuery.in("colaborador_id", selectedColaboradores);
  }
  if (selectedGalpoes.length > 0) {
    operacoesQuery = operacoesQuery.in("galpao_id", selectedGalpoes);
  }
  if (selectedTransportadoras.length > 0) {
    operacoesQuery = operacoesQuery.in("transportadora_id", selectedTransportadoras);
  }
  if (selectedTipos.length > 0) {
    operacoesQuery = operacoesQuery.in("tipo_evento", selectedTipos as TipoEvento[]);
  }
  if (selectedStatus.length > 0) {
    operacoesQuery = operacoesQuery.in("status", selectedStatus as StatusOperacao[]);
  }
  if (selectedData) {
    operacoesQuery = operacoesQuery.eq("data", selectedData);
  }

  const [
    { data: transportadoras },
    { data: galpoes },
    { data: colaboradores },
    { data: operacoes },
  ] = await Promise.all([
    supabase.from("transportadoras").select("*").order("nome"),
    supabase.from("galpoes").select("*").order("nome"),
    supabase.from("colaboradores").select("id, nome").order("nome"),
    operacoesQuery,
  ]);

  const transportadorasAtivas = (transportadoras ?? []).filter((t) => t.ativo);
  const galpoesAtivos = (galpoes ?? []).filter((g) => g.ativo);

  const GALPAO_PADRAO_ID = "0dd7d7dd-3ccc-4d4f-9dce-7e32024d6c97";
  const galpaoIdPadrao = galpoesAtivos.some((g) => g.id === GALPAO_PADRAO_ID)
    ? GALPAO_PADRAO_ID
    : colaborador.galpao_id;

  const operacaoIds = (operacoes ?? []).map((o) => o.id);
  const { data: bipagens } = operacaoIds.length
    ? await supabase.from("bipagens").select("operacao_id").in("operacao_id", operacaoIds)
    : { data: [] as { operacao_id: string }[] };

  const quantidadePorOperacao = new Map<string, number>();
  for (const bipagem of bipagens ?? []) {
    quantidadePorOperacao.set(
      bipagem.operacao_id,
      (quantidadePorOperacao.get(bipagem.operacao_id) ?? 0) + 1
    );
  }

  const colaboradorMap = new Map((colaboradores ?? []).map((c) => [c.id, c.nome]));

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Operações</h1>
        <OperacaoFormDialog
          transportadoras={transportadorasAtivas}
          galpoes={galpoesAtivos}
          galpaoIdPadrao={galpaoIdPadrao}
          trigger={
            <Button
              disabled={!transportadorasAtivas.length || !galpoesAtivos.length}
            >
              Nova operação
            </Button>
          }
        />
      </div>

      {!transportadorasAtivas.length && (
        <p className="text-sm text-muted-foreground">
          Nenhuma transportadora ativa disponível.
        </p>
      )}

      {!galpoesAtivos.length && (
        <p className="text-sm text-muted-foreground">
          Nenhum galpão ativo disponível.
        </p>
      )}

      <OperacoesFiltros
        colaboradores={colaboradores ?? []}
        galpoes={galpoes ?? []}
        transportadoras={transportadoras ?? []}
        colaboradoresSelecionados={selectedColaboradores}
        galpoesSelecionados={selectedGalpoes}
        transportadorasSelecionadas={selectedTransportadoras}
        tiposSelecionados={selectedTipos}
        statusSelecionados={selectedStatus}
        dataSelecionada={selectedData}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            <TableHead>Galpão</TableHead>
            <TableHead>Transportadora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {operacoes?.length ? (
            operacoes.map((operacao) => {
              const transportadora = transportadoras?.find(
                (t) => t.id === operacao.transportadora_id
              );
              const galpao = galpoes?.find((g) => g.id === operacao.galpao_id);
              return (
                <TableRow key={operacao.id}>
                  <TableCell>{colaboradorMap.get(operacao.colaborador_id) ?? "—"}</TableCell>
                  <TableCell>{galpao?.nome ?? "—"}</TableCell>
                  <TableCell>{transportadora?.nome ?? "—"}</TableCell>
                  <TableCell>{TIPO_EVENTO_LABEL[operacao.tipo_evento]}</TableCell>
                  <TableCell>{operacao.data}</TableCell>
                  <TableCell>
                    {operacao.status === "EM_ANDAMENTO"
                      ? "Em andamento"
                      : "Finalizada"}
                    {!operacao.ativa && " · Inativa"}
                  </TableCell>
                  <TableCell>
                    {quantidadePorOperacao.get(operacao.id) ?? 0}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/operacoes/${operacao.id}`} />}
                    >
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center text-muted-foreground"
              >
                Nenhuma operação ainda.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
