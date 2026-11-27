import { createClient } from "@/lib/supabase/server";
import { PainelPendencias } from "./painel-pendencias";

// Data de hoje no fuso de Jataí/GO (YYYY-MM-DD)
function hojeSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const hoje = hojeSaoPaulo();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: colaborador }, { data: pendencias, error }] = await Promise.all([
    user
      ? supabase.from("colaboradores").select("nome").eq("user_id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.rpc("painel_entregas_pendentes", { p_hoje: hoje }),
  ]);

  const primeiroNome = (colaborador?.nome ?? user?.email ?? "").split(" ")[0];

  return (
    <main className="space-y-8 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold" style={{ color: "var(--brand-navy)" }}>
          Bem-vindo, {primeiroNome}
        </h1>
        <p className="text-sm text-muted-foreground">Logística last-mile · Jataí/GO</p>
        <div className="mt-3 h-[3px] w-14 rounded-full brand-stripe" />
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Entregas pendentes por prazo — encomendas conferidas
        </p>
        {error ? (
          <p className="text-sm text-red-600">Não foi possível carregar as entregas pendentes.</p>
        ) : (
          <PainelPendencias linhas={pendencias ?? []} hoje={hoje} diaSelecionado={params.dia} />
        )}
      </div>
    </main>
  );
}
