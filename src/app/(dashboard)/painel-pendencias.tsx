import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PainelPendenciaLinha } from "@/lib/types/database.types";
import { formatarDataBr } from "@/lib/encomendas/consulta";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

function rotuloDia(dia: string, hoje: string) {
  const n = diasEntre(hoje, dia);
  const semana = DIAS_SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()];
  return {
    curto: n === 0 ? "D · Hoje" : `D+${n}`,
    data: `${formatarDataBr(dia).slice(0, 5)} ${semana}`,
  };
}

function volume(l: PainelPendenciaLinha) {
  if (l.vol_nr && l.volumes) return `${l.vol_nr}/${l.volumes}`;
  return l.volumes ? String(l.volumes) : l.vol_nr ? String(l.vol_nr) : "";
}

// Sem motorista primeiro (atrasadas no topo), depois bairro e destinatário.
function ordenar(a: PainelPendenciaLinha, b: PainelPendenciaLinha) {
  const semA = a.motorista ? 1 : 0;
  const semB = b.motorista ? 1 : 0;
  if (semA !== semB) return semA - semB;
  if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
  return (
    (a.bairro ?? "").localeCompare(b.bairro ?? "", "pt-BR") ||
    (a.nome_pessoa ?? "").localeCompare(b.nome_pessoa ?? "", "pt-BR")
  );
}

export function PainelPendencias({
  linhas,
  hoje,
  diaSelecionado,
}: {
  linhas: PainelPendenciaLinha[];
  hoje: string;
  diaSelecionado: string | undefined;
}) {
  const dias = [...new Set(linhas.map((l) => l.dia))].sort();

  if (!dias.length) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm">
        Nenhuma encomenda conferida pendente de entrega.
      </div>
    );
  }

  const dia = diaSelecionado && dias.includes(diaSelecionado) ? diaSelecionado : dias[0];
  const indice = dias.indexOf(dia);
  const doDia = linhas.filter((l) => l.dia === dia);

  const porTransportadora = new Map<string, PainelPendenciaLinha[]>();
  for (const l of doDia) {
    const lista = porTransportadora.get(l.transportadora_id) ?? [];
    lista.push(l);
    porTransportadora.set(l.transportadora_id, lista);
  }
  const grupos = [...porTransportadora.values()]
    .map((itens) => ({
      nome: itens[0].transportadora.trim(),
      itens: itens.sort(ordenar),
      semMotorista: itens.filter((i) => !i.motorista).length,
    }))
    .sort((a, b) => b.semMotorista - a.semMotorista || a.nome.localeCompare(b.nome, "pt-BR"));

  const totalSem = doDia.filter((l) => !l.motorista).length;
  const linkDia = (d: string) => (d === dias[0] ? "/" : `/?dia=${d}`);
  const atual = rotuloDia(dia, hoje);

  return (
    <div className="space-y-4">
      {/* Paginação: uma página por dia de prazo (D, D+1, D+2...) */}
      <div className="flex flex-wrap items-center gap-2">
        <PaginaLink href={indice > 0 ? linkDia(dias[indice - 1]) : null}>‹ Anterior</PaginaLink>
        {dias.map((d) => {
          const r = rotuloDia(d, hoje);
          const pendentes = linhas.filter((l) => l.dia === d && !l.motorista).length;
          return (
            <Link
              key={d}
              href={linkDia(d)}
              className={cn(
                "flex flex-col items-center rounded-md border px-3 py-1 text-xs leading-tight transition-colors",
                d === dia
                  ? "border-[--brand-navy] bg-[--brand-navy] text-white"
                  : "bg-white hover:border-[--brand-orange]/60"
              )}
            >
              <span className="font-semibold">{r.curto}</span>
              <span className={d === dia ? "text-white/80" : "text-muted-foreground"}>{r.data}</span>
              {pendentes > 0 && (
                <span className={cn("font-semibold", d === dia ? "text-orange-200" : "text-orange-600")}>
                  {pendentes} s/ motorista
                </span>
              )}
            </Link>
          );
        })}
        <PaginaLink href={indice < dias.length - 1 ? linkDia(dias[indice + 1]) : null}>Próxima ›</PaginaLink>
      </div>

      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{atual.curto}</strong> ({atual.data}) · {doDia.length} encomenda(s)
        conferida(s) ·{" "}
        <strong className={totalSem ? "text-orange-600" : "text-green-700"}>{totalSem} sem motorista</strong> ·{" "}
        {doDia.length - totalSem} com motorista
      </p>

      {grupos.map((g) => (
        <div key={g.nome} className="rounded-lg border bg-white shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
            <span className="font-semibold" style={{ color: "var(--brand-navy)" }}>
              {g.nome}
            </span>
            <span className="text-xs text-muted-foreground">
              <strong className={g.semMotorista ? "text-orange-600" : "text-green-700"}>
                {g.semMotorista} sem motorista
              </strong>{" "}
              · {g.itens.length - g.semMotorista} com motorista · {g.itens.length} no total
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Nr. Entrega</TableHead>
                  <TableHead>Nota Fiscal</TableHead>
                  <TableHead>Vol.</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.itens.map((l) => (
                  <TableRow key={l.encomenda_id} className={cn(!l.motorista && "bg-orange-50/60")}>
                    <TableCell className="whitespace-nowrap">
                      {l.motorista ? (
                        <span>
                          {l.motorista}
                          {l.rota && <span className="ml-1 text-xs text-muted-foreground">· {l.rota}</span>}
                        </span>
                      ) : (
                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700">
                          Sem motorista
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{l.nr_entrega ?? ""}</TableCell>
                    <TableCell>{l.nota_fiscal ?? ""}</TableCell>
                    <TableCell>{volume(l)}</TableCell>
                    <TableCell className="max-w-48 truncate" title={l.nome_pessoa ?? undefined}>
                      {l.nome_pessoa ?? ""}
                    </TableCell>
                    <TableCell className="max-w-64 truncate" title={l.endereco ?? undefined}>
                      {l.endereco ?? ""}
                    </TableCell>
                    <TableCell>{l.bairro ?? ""}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatarDataBr(l.prazo_final) || l.prazo_texto || ""}
                      {l.atrasada && (
                        <span className="ml-1 text-xs font-semibold text-red-600">atrasada</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}

function PaginaLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return (
      <span className="rounded-md border px-3 py-2 text-xs text-muted-foreground/50">{children}</span>
    );
  }
  return (
    <Link href={href} className="rounded-md border bg-white px-3 py-2 text-xs hover:border-[--brand-orange]/60">
      {children}
    </Link>
  );
}
