import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TIPO_EVENTO_LABEL,
  carregarCadastros,
  carregarOperacoes,
  consultarBipagens,
  filtrosParaParams,
  lerFiltros,
} from "./consulta";
import { PesquisaFiltros } from "./pesquisa-filtros";
import { ExportarPesquisaButton } from "./exportar-button";

const POR_PAGINA = 100;

export default async function PesquisaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { supabase } = await requireAuth();
  const params = await searchParams;
  const filtros = lerFiltros(params);
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const inicio = (pagina - 1) * POR_PAGINA;

  const [cadastros, { data: bipagens, count, error }] = await Promise.all([
    carregarCadastros(supabase),
    consultarBipagens(supabase, filtros, { contar: true }).range(inicio, inicio + POR_PAGINA - 1),
  ]);

  const operacoes = await carregarOperacoes(
    supabase,
    (bipagens ?? []).map((b) => b.operacao_id)
  );

  const nomes = (lista: { id: string; nome: string }[]) => new Map(lista.map((i) => [i.id, i.nome]));
  const transportadoras = nomes(cadastros.transportadoras);
  const motoristas = nomes(cadastros.motoristas);
  const rotas = nomes(cadastros.rotas);
  const colaboradores = nomes(cadastros.colaboradores);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  function linkPagina(destino: number) {
    const p = filtrosParaParams(filtros);
    if (destino > 1) p.set("pagina", String(destino));
    return `/pesquisa?${p.toString()}`;
  }

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Pesquisa</h1>
        <ExportarPesquisaButton filtros={filtros} disabled={total === 0} />
      </div>

      <PesquisaFiltros
        key={JSON.stringify(filtros)}
        filtrosAtuais={filtros}
        transportadoras={cadastros.transportadoras}
        motoristas={cadastros.motoristas}
        rotas={cadastros.rotas}
        colaboradores={cadastros.colaboradores}
      />

      {error ? (
        <p className="text-sm text-red-600">Não foi possível carregar a pesquisa.</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString("pt-BR")} bipagem(ns) encontrada(s)
        </p>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Transportadora</TableHead>
              <TableHead>Rota</TableHead>
              <TableHead>Motorista</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Operação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bipagens?.length ? (
              bipagens.map((b) => {
                const operacao = operacoes.get(b.operacao_id);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(b.bipado_em).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </TableCell>
                    <TableCell className="font-mono">
                      {b.codigo}
                      {b.duplicado && (
                        <span className="ml-2 text-xs text-yellow-600">duplicado</span>
                      )}
                      {b.override_aplicado && (
                        <span className="ml-2 text-xs text-orange-600">override</span>
                      )}
                    </TableCell>
                    <TableCell>{TIPO_EVENTO_LABEL[b.tipo_evento] ?? b.tipo_evento}</TableCell>
                    <TableCell>{transportadoras.get(b.transportadora_id) ?? "—"}</TableCell>
                    <TableCell>{rotas.get(b.rota_id) ?? "—"}</TableCell>
                    <TableCell>
                      {b.motorista_id ? motoristas.get(b.motorista_id) ?? "—" : "—"}
                    </TableCell>
                    <TableCell>{colaboradores.get(b.colaborador_id) ?? "—"}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {b.motivo ?? ""}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/operacoes/${b.operacao_id}`}
                        className="whitespace-nowrap hover:underline"
                      >
                        {operacao?.data ?? "—"}
                        <span
                          className={cn(
                            "ml-2 text-xs",
                            operacao?.status === "FINALIZADA"
                              ? "text-muted-foreground"
                              : "text-green-600"
                          )}
                        >
                          {operacao?.status === "FINALIZADA" ? "finalizada" : "em andamento"}
                        </span>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Nenhuma bipagem encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          {pagina > 1 ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={linkPagina(pagina - 1)} />}
            >
              Anterior
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Anterior
            </Button>
          )}
          <span className="text-muted-foreground">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={linkPagina(pagina + 1)} />}
            >
              Próxima
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Próxima
            </Button>
          )}
        </div>
      )}
    </main>
  );
}
