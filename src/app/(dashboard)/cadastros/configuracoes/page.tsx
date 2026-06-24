import { requireAdmin } from "@/lib/auth/guards";
import { ConfiguracoesForm } from "./configuracoes-form";
import { SenhaOverrideForm } from "./senha-override-form";

export default async function ConfiguracoesPage() {
  const supabase = await requireAdmin();

  const { data } = await supabase.from("configuracoes").select("chave, valor");
  const valores = Object.fromEntries(
    (data ?? [])
      .filter((c) => c.chave !== "senha_override")
      .map((c) => [c.chave, c.valor])
  );

  return (
    <main className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Configurações</h1>

      <div className="flex flex-wrap items-start gap-6">
        <ConfiguracoesForm valores={valores} />
        <SenhaOverrideForm />
      </div>
    </main>
  );
}
