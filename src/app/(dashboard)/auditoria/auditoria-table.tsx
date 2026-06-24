"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database, Json } from "@/lib/types/database.types";

type Auditoria = Database["public"]["Tables"]["auditoria"]["Row"];

const TODOS = "todos";

function formatarDados(dados: Json | null) {
  if (!dados) return "—";
  return JSON.stringify(dados);
}

export function AuditoriaTable({
  linhas,
  nomesPorUsuarioId,
}: {
  linhas: Auditoria[];
  nomesPorUsuarioId: Map<string, string>;
}) {
  const [tipoFiltro, setTipoFiltro] = useState(TODOS);

  const tipos = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.tipo))).sort(),
    [linhas]
  );

  const linhasFiltradas = useMemo(
    () => (tipoFiltro === TODOS ? linhas : linhas.filter((l) => l.tipo === tipoFiltro)),
    [linhas, tipoFiltro]
  );

  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-1">
        <Label htmlFor="tipo_filtro">Tipo</Label>
        <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v ?? TODOS)}>
          <SelectTrigger id="tipo_filtro" className="w-full">
            <SelectValue placeholder="Todos">
              {(value: string) => (value === TODOS ? "Todos" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {tipos.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {tipo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Dados</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhasFiltradas.length ? (
            linhasFiltradas.map((linha) => (
              <TableRow key={linha.id}>
                <TableCell>{new Date(linha.criado_em).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{linha.tipo}</TableCell>
                <TableCell>
                  {linha.usuario_id ? nomesPorUsuarioId.get(linha.usuario_id) ?? "—" : "—"}
                </TableCell>
                <TableCell>{linha.descricao}</TableCell>
                <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                  {formatarDados(linha.dados)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhum registro de auditoria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
