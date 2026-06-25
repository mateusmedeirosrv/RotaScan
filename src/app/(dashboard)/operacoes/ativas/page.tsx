import Link from "next/link";
import { requireAdminOrGerente } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ForcarFinalizacaoButton } from "./forcar-finalizacao-button";

const TIPO_EVENTO_LABEL: Record<string, string> = {
  RECEBIMENTO: "Recebimento",
  ENTREGA: "Entrega",
  DEVOLUCAO_ORIGEM: "Devolução à Origem",
  RETORNO: "Retorno",
};

export default async function OperacoesAtivasPage() {
  const { supabase, papel } = await requireAdminOrGerente();

  const [{ data: operacoes }, { data: transportadoras }, { data: colaboradores }] =
    await Promise.all([
      supabase
        .from("operacoes")
        .select("*")
        .eq("status", "EM_ANDAMENTO")
        .order("iniciada_em", { ascending: false }),
      supabase.from("transportadoras").select("*"),
      supabase.from("colaboradores").select("*"),
    ]);

  const transportadorasPorId = new Map(
    (transportadoras ?? []).map((t) => [t.id, t])
  );
  const colaboradoresPorId = new Map(
    (colaboradores ?? []).map((c) => [c.id, c])
  );

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
      <h1 className="text-xl font-semibold">Operações ativas</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            <TableHead>Transportadora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Iniciada em</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead className="w-48" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {operacoes?.length ? (
            operacoes.map((operacao) => (
              <TableRow key={operacao.id}>
                <TableCell>
                  {colaboradoresPorId.get(operacao.colaborador_id)?.nome ?? "—"}
                </TableCell>
                <TableCell>
                  {transportadorasPorId.get(operacao.transportadora_id)?.nome ??
                    "—"}
                </TableCell>
                <TableCell>
                  {TIPO_EVENTO_LABEL[operacao.tipo_evento]}
                  {!operacao.ativa && " · Inativa"}
                </TableCell>
                <TableCell>{operacao.data}</TableCell>
                <TableCell>
                  {new Date(operacao.iniciada_em).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>
                  {quantidadePorOperacao.get(operacao.id) ?? 0}
                </TableCell>
                <TableCell className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/operacoes/${operacao.id}`} />}
                  >
                    Abrir
                  </Button>
                  {papel === "admin" && (
                    <ForcarFinalizacaoButton operacaoId={operacao.id} />
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                Nenhuma operação em andamento.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
