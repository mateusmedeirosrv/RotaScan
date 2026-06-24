import { requireAdmin } from "@/lib/auth/guards";
import { AuditoriaTable } from "./auditoria-table";

export default async function AuditoriaPage() {
  const supabase = await requireAdmin();

  const [{ data: linhas }, { data: colaboradores }] = await Promise.all([
    supabase
      .from("auditoria")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(200),
    supabase.from("colaboradores").select("user_id, nome"),
  ]);

  const nomesPorUsuarioId = new Map(
    (colaboradores ?? []).map((c) => [c.user_id, c.nome])
  );

  return (
    <main className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Auditoria</h1>
      <p className="text-sm text-muted-foreground">Últimos 200 registros.</p>
      <AuditoriaTable linhas={linhas ?? []} nomesPorUsuarioId={nomesPorUsuarioId} />
    </main>
  );
}
