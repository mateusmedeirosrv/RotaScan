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
    <header className="border-b">
      <nav className="flex items-center gap-4 px-6 py-3">
        <Link href="/" className="font-heading text-sm font-semibold">
          RotaScan
        </Link>

        {links.length > 0 && (
          <div className="flex items-center gap-3 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-muted-foreground transition-colors hover:text-foreground",
                  pathname.startsWith(link.href) && "font-medium text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {pendentes > 0 && (
            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-700">
              {pendentes} pendente{pendentes > 1 ? "s" : ""} de sincronização
            </span>
          )}
          {nome && (
            <span className="text-sm text-muted-foreground">{nome}</span>
          )}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </nav>
    </header>
  );
}
