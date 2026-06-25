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

const TIPO_EVENTO_LABEL: Record<string, string> = {
  RECEBIMENTO: "Recebimento",
  ENTREGA: "Entrega",
  DEVOLUCAO_ORIGEM: "Devolução à Origem",
  RETORNO: "Retorno",
};

export default async function OperacoesPage() {
  const { supabase, colaborador } = await requireAuth();

  const [{ data: transportadoras }, { data: galpoes }, { data: operacoes }] =
    await Promise.all([
      supabase.from("transportadoras").select("*").order("nome"),
      supabase.from("galpoes").select("*").order("nome"),
      supabase
        .from("operacoes")
        .select("*")
        .eq("colaborador_id", colaborador.id)
        .order("iniciada_em", { ascending: false }),
    ]);

  const transportadorasAtivas = (transportadoras ?? []).filter((t) => t.ativo);
  const galpoesAtivos = (galpoes ?? []).filter((g) => g.ativo);

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

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Operações</h1>
        <OperacaoFormDialog
          transportadoras={transportadorasAtivas}
          galpoes={galpoesAtivos}
          galpaoIdPadrao={colaborador.galpao_id}
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

      <Table>
        <TableHeader>
          <TableRow>
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
              return (
                <TableRow key={operacao.id}>
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
                colSpan={6}
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
