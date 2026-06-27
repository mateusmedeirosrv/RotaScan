"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/login/actions";
import { dbOffline } from "@/lib/bipagem/db-offline";
import type { Database } from "@/lib/types/database.types";

type Papel = Database["public"]["Tables"]["colaboradores"]["Row"]["papel"];

const LINKS_TODOS = [
  { href: "/operacoes", label: "Operações" },
  { href: "/ferramentas/qrcode", label: "Etiquetas QR" },
];

const LINKS_ADMIN = [
  { href: "/cadastros/cidades", label: "Cidades" },
  { href: "/cadastros/bairros", label: "Bairros" },
  { href: "/cadastros/galpoes", label: "Galpões" },
  { href: "/cadastros/transportadoras", label: "Transportadoras" },
  { href: "/cadastros/colaboradores", label: "Colaboradores" },
  { href: "/cadastros/configuracoes", label: "Configurações" },
  { href: "/auditoria", label: "Auditoria" },
];

const LINKS_ADMIN_OU_GERENTE = [
  { href: "/cadastros/motoristas", label: "Motoristas" },
  { href: "/cadastros/rotas", label: "Rotas" },
  { href: "/operacoes/ativas", label: "Operações ativas" },
  { href: "/dashboard", label: "Dashboard" },
];

export function DashboardNav({
  papel,
  nome,
}: {
  papel: Papel | null;
  nome: string | null;
}) {
  const pathname = usePathname();
  const pendentes = useLiveQuery(
    () => dbOffline.fila.where("status").equals("pendente").count(),
    [],
    0
  );

  const links = [
    ...LINKS_TODOS,
    ...(papel === "admin" ? LINKS_ADMIN : []),
    ...(papel === "admin" || papel === "gerente" ? LINKS_ADMIN_OU_GERENTE : []),
  ];

  return (
    <header>
      <nav
        className="flex items-center gap-4 px-6 py-3"
        style={{ backgroundColor: "var(--brand-navy)" }}
      >
        <Link
          href="/"
          className="font-heading text-sm font-bold tracking-wide text-white shrink-0"
        >
          Rota<span style={{ color: "var(--brand-orange)" }}>Scan</span>
        </Link>

        {links.length > 0 && (
          <div className="flex items-center gap-1 text-sm overflow-x-auto">
            {links.map((link) => {
              const ativo = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={
                    ativo
                      ? { backgroundColor: "var(--brand-orange)", color: "var(--brand-navy)" }
                      : undefined
                  }
                  className={cn(
                    "whitespace-nowrap rounded px-3 py-1.5 transition-colors",
                    ativo
                      ? "font-semibold"
                      : "text-white/55 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 shrink-0">
          {pendentes > 0 && (
            <span className="rounded-full border border-yellow-500/40 bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-300">
              {pendentes} pendente{pendentes > 1 ? "s" : ""} de sincronização
            </span>
          )}
          {nome && (
            <span className="hidden text-sm text-white/45 sm:inline">{nome}</span>
          )}
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-white/55 hover:bg-white/10 hover:text-white"
            >
              Sair
            </Button>
          </form>
        </div>
      </nav>

      {/* Speed stripe — assinatura visual Amazon→Magalu */}
      <div className="h-[2px] brand-stripe" />
    </header>
  );
}
