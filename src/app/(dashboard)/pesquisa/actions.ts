"use server";

import { requireAuth } from "@/lib/auth/guards";
import {
  TIPO_EVENTO_LABEL,
  carregarCadastros,
  carregarOperacoes,
  consultarBipagens,
  type FiltrosPesquisa,
} from "./consulta";

const LIMITE_EXPORT = 20000;
const LOTE = 1000;

export async function exportarPesquisa(filtros: FiltrosPesquisa) {
  const { supabase } = await requireAuth();

  const bipagens = [];
  for (let inicio = 0; inicio < LIMITE_EXPORT; inicio += LOTE) {
    const { data, error } = await consultarBipagens(supabase, filtros).range(
      inicio,
      inicio + LOTE - 1
    );
    if (error) return { error: "Não foi possível exportar a pesquisa.", linhas: [], truncado: false };
    bipagens.push(...(data ?? []));
    if ((data ?? []).length < LOTE) break;
  }

  const cadastros = await carregarCadastros(supabase);
  const nome = (lista: { id: string; nome: string }[]) => new Map(lista.map((i) => [i.id, i.nome]));
  const transportadoras = nome(cadastros.transportadoras);
  const motoristas = nome(cadastros.motoristas);
  const rotas = nome(cadastros.rotas);
  const colaboradores = nome(cadastros.colaboradores);
  const operacoes = await carregarOperacoes(supabase, bipagens.map((b) => b.operacao_id));

  const linhas = bipagens.map((b) => {
    const operacao = operacoes.get(b.operacao_id);
    return {
      "Data/Hora": new Date(b.bipado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      Código: b.codigo,
      Tipo: TIPO_EVENTO_LABEL[b.tipo_evento] ?? b.tipo_evento,
      Transportadora: transportadoras.get(b.transportadora_id) ?? "—",
      Rota: rotas.get(b.rota_id) ?? "—",
      Motorista: b.motorista_id ? motoristas.get(b.motorista_id) ?? "—" : "—",
      Colaborador: colaboradores.get(b.colaborador_id) ?? "—",
      "Data da operação": operacao?.data ?? "—",
      "Status da operação": operacao?.status === "FINALIZADA" ? "Finalizada" : "Em andamento",
      Motivo: b.motivo ?? "",
      Duplicado: b.duplicado ? "Sim" : "Não",
      Override: b.override_aplicado ? "Sim" : "Não",
    };
  });

  return { error: null, linhas, truncado: bipagens.length >= LIMITE_EXPORT };
}
