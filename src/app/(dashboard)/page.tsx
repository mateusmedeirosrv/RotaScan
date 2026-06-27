import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HomeEntregasChart } from "./home-entregas-chart";

type QuickCard = { href: string; title: string; desc: string };

const CARDS_TODOS: QuickCard[] = [
  { href: "/operacoes", title: "Operações", desc: "Ver e iniciar operações de bipagem" },
  { href: "/ferramentas/qrcode", title: "Etiquetas QR", desc: "Gerar etiquetas para encomendas" },
];

const CARDS_GERENTE: QuickCard[] = [
  { href: "/operacoes/ativas", title: "Operações ativas", desc: "Acompanhar operações em andamento" },
  { href: "/dashboard", title: "Dashboard", desc: "Relatórios e indicadores operacionais" },
  { href: "/cadastros/motoristas", title: "Motoristas", desc: "Gerenciar motoristas terceirizados" },
  { href: "/cadastros/rotas", title: "Rotas", desc: "Bairros e sequências de entrega" },
];

const CARDS_ADMIN: QuickCard[] = [
  { href: "/cadastros/colaboradores", title: "Colaboradores", desc: "Usuários e perfis de acesso" },
  { href: "/cadastros/galpoes", title: "Galpões", desc: "Centros de distribuição cadastrados" },
  { href: "/cadastros/transportadoras", title: "Transportadoras", desc: "Amazon, Magalu e outras" },
  { href: "/cadastros/cidades", title: "Cidades", desc: "Municípios e estados" },
  { href: "/cadastros/bairros", title: "Bairros", desc: "Bairros para composição de rotas" },
  { href: "/auditoria", title: "Auditoria", desc: "Logs de sobrescritas e acessos" },
  { href: "/cadastros/configuracoes", title: "Configurações", desc: "Parâmetros do sistema" },
];

function Card({ href, title, desc }: QuickCard) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-[--brand-orange]/40"
    >
      <span
        className="text-sm font-semibold transition-colors group-hover:text-[--brand-orange]"
        style={{ color: "var(--brand-navy)" }}
      >
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </Link>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: colaborador }, { data: entregasRows }] = await Promise.all([
    user
      ? supabase.from("colaboradores").select("papel, nome").eq("user_id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.rpc("home_entregas_chart"),
  ]);

  const papel = colaborador?.papel ?? null;
  const primeiroNome = (colaborador?.nome ?? user?.email ?? "").split(" ")[0];

  const cards = [
    ...CARDS_TODOS,
    ...(papel === "admin" || papel === "gerente" ? CARDS_GERENTE : []),
    ...(papel === "admin" ? CARDS_ADMIN : []),
  ];

  return (
    <main className="space-y-8 p-6">
      <div className="space-y-1">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--brand-navy)" }}
        >
          Bem-vindo, {primeiroNome}
        </h1>
        <p className="text-sm text-muted-foreground">
          Logística last-mile · Jataí/GO
        </p>
        <div className="mt-3 h-[3px] w-14 rounded-full brand-stripe" />
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Acesso rápido
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.href} {...card} />
          ))}
        </div>
      </div>

      {/* Gráfico de entregas */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Entregas por transportadora — últimos 3 meses (períodos de 15 dias)
        </p>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <HomeEntregasChart rows={entregasRows ?? []} />
        </div>
      </div>
    </main>
  );
}
