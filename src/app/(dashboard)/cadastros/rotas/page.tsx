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
import { RotaFormDialog } from "./rota-form";

export default async function RotasPage() {
  const { supabase } = await requireAdminOrGerente();

  const [{ data: rotas }, { data: galpoes }, { data: rotaBairros }] =
    await Promise.all([
      supabase.from("rotas").select("*").order("nome"),
      supabase.from("galpoes").select("*").order("nome"),
      supabase.from("rota_bairros").select("rota_id"),
    ]);

  const galpoesPorId = new Map((galpoes ?? []).map((g) => [g.id, g]));
  const contagemPorRota = new Map<string, number>();
  for (const item of rotaBairros ?? []) {
    contagemPorRota.set(item.rota_id, (contagemPorRota.get(item.rota_id) ?? 0) + 1);
  }

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Rotas</h1>
        <RotaFormDialog
          galpoes={galpoes ?? []}
          trigger={<Button disabled={!galpoes?.length}>Nova rota</Button>}
        />
      </div>

      {!galpoes?.length && (
        <p className="text-sm text-muted-foreground">
          Nenhum galpão disponível para cadastrar rotas.
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Galpão</TableHead>
            <TableHead>Bairros</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rotas?.length ? (
            rotas.map((rota) => (
              <TableRow key={rota.id}>
                <TableCell>
                  <Link
                    href={`/cadastros/rotas/${rota.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {rota.nome}
                  </Link>
                </TableCell>
                <TableCell>
                  {galpoesPorId.get(rota.galpao_id)?.nome ?? "—"}
                </TableCell>
                <TableCell>{contagemPorRota.get(rota.id) ?? 0}</TableCell>
                <TableCell>{rota.ativa ? "Ativa" : "Inativa"}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/cadastros/rotas/${rota.id}`} />}
                  >
                    Abrir
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                Nenhuma rota cadastrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
