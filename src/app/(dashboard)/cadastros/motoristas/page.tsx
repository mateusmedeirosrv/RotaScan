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
import { MotoristaFormDialog } from "./motorista-form";

export default async function MotoristasPage() {
  const { supabase } = await requireAdminOrGerente();

  const [{ data: motoristas }, { data: galpoes }] = await Promise.all([
    supabase.from("motoristas").select("*").order("nome"),
    supabase.from("galpoes").select("*").order("nome"),
  ]);

  const galpoesPorId = new Map((galpoes ?? []).map((g) => [g.id, g]));

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Motoristas</h1>
        <MotoristaFormDialog
          galpoes={galpoes ?? []}
          trigger={<Button disabled={!galpoes?.length}>Novo motorista</Button>}
        />
      </div>

      {!galpoes?.length && (
        <p className="text-sm text-muted-foreground">
          Nenhum galpão disponível para cadastrar motoristas.
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Galpão</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead>CNH</TableHead>
            <TableHead>Placa</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {motoristas?.length ? (
            motoristas.map((motorista) => (
              <TableRow key={motorista.id}>
                <TableCell>{motorista.nome}</TableCell>
                <TableCell>
                  {galpoesPorId.get(motorista.galpao_id)?.nome ?? "—"}
                </TableCell>
                <TableCell>{motorista.cpf ?? "—"}</TableCell>
                <TableCell>{motorista.cnh ?? "—"}</TableCell>
                <TableCell>{motorista.placa ?? "—"}</TableCell>
                <TableCell>{motorista.telefone ?? "—"}</TableCell>
                <TableCell>{motorista.ativo ? "Ativo" : "Inativo"}</TableCell>
                <TableCell>
                  <MotoristaFormDialog
                    motorista={motorista}
                    galpoes={galpoes ?? []}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Editar
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center text-muted-foreground"
              >
                Nenhum motorista cadastrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
