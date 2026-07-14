import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminOrGerente } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { RotaFormDialog } from "../rota-form";
import { RotaBairrosEditor } from "./rota-bairros-editor";
import { ExportarBairrosPdfButton } from "./exportar-bairros-pdf-button";

export default async function RotaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdminOrGerente();

  const { data: rota } = await supabase
    .from("rotas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!rota) redirect("/cadastros/rotas");

  const { data: galpoes } = await supabase
    .from("galpoes")
    .select("*")
    .order("nome");

  const galpao = (galpoes ?? []).find((g) => g.id === rota.galpao_id);

  if (!galpao) redirect("/cadastros/rotas");

  const galpaoIdsMesmaCidade = (galpoes ?? [])
    .filter((g) => g.cidade_id === galpao.cidade_id)
    .map((g) => g.id);

  const [{ data: rotaBairros }, { data: bairrosCidade }, { data: rotasMesmaCidade }] =
    await Promise.all([
      supabase
        .from("rota_bairros")
        .select("*")
        .eq("rota_id", id)
        .order("ordem"),
      supabase
        .from("bairros")
        .select("*")
        .eq("cidade_id", galpao.cidade_id)
        .order("nome"),
      supabase.from("rotas").select("id").in("galpao_id", galpaoIdsMesmaCidade),
    ]);

  const rotaIdsMesmaCidade = (rotasMesmaCidade ?? []).map((r) => r.id);
  const { data: bairrosEmUso } = rotaIdsMesmaCidade.length
    ? await supabase
        .from("rota_bairros")
        .select("bairro_id, rota_id")
        .in("rota_id", rotaIdsMesmaCidade)
    : { data: [] };

  const bairrosPorId = new Map((bairrosCidade ?? []).map((b) => [b.id, b]));
  const idsJaAdicionados = new Set((rotaBairros ?? []).map((rb) => rb.bairro_id));
  const idsUsadosEmOutrasRotas = new Set(
    (bairrosEmUso ?? [])
      .filter((rb) => rb.rota_id !== id)
      .map((rb) => rb.bairro_id)
  );

  const bairrosOrdenados = (rotaBairros ?? []).map((rb) => ({
    bairroId: rb.bairro_id,
    ordem: rb.ordem,
    nome: bairrosPorId.get(rb.bairro_id)?.nome ?? "—",
  }));

  const bairrosDisponiveis = (bairrosCidade ?? [])
    .filter((b) => !idsJaAdicionados.has(b.id) && !idsUsadosEmOutrasRotas.has(b.id))
    .map((b) => ({ id: b.id, nome: b.nome }));

  return (
    <main className="space-y-6 p-6">
      <Link
        href="/cadastros/rotas"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Voltar para Rotas
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{rota.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {galpao.nome} · {rota.ativa ? "Ativa" : "Inativa"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportarBairrosPdfButton
            nomeRota={rota.nome}
            bairros={bairrosOrdenados.map((b) => b.nome)}
          />
          <RotaFormDialog
            rota={rota}
            galpoes={galpoes ?? []}
            trigger={<Button variant="outline">Editar dados</Button>}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Bairros da rota</h2>
        <RotaBairrosEditor
          rotaId={rota.id}
          bairrosOrdenados={bairrosOrdenados}
          bairrosDisponiveis={bairrosDisponiveis}
        />
      </div>
    </main>
  );
}
