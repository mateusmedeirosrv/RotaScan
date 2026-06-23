"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrGerente } from "@/lib/auth/guards";

type RotaCriarInput = { galpao_id: string; nome: string };
type RotaAtualizarInput = { galpao_id: string; nome: string; ativa: boolean };

export async function criarRota(input: RotaCriarInput) {
  const { supabase } = await requireAdminOrGerente();
  const { data, error } = await supabase
    .from("rotas")
    .insert({ ...input, ativa: true })
    .select("id")
    .single();

  if (error) return { error: "Não foi possível salvar a rota.", id: null };

  revalidatePath("/cadastros/rotas");
  return { error: null, id: data.id };
}

export async function atualizarRota(id: string, input: RotaAtualizarInput) {
  const { supabase } = await requireAdminOrGerente();
  const { error } = await supabase.from("rotas").update(input).eq("id", id);

  if (error) return { error: "Não foi possível salvar a rota." };

  revalidatePath("/cadastros/rotas");
  revalidatePath(`/cadastros/rotas/${id}`);
  return { error: null };
}

export async function adicionarBairroNaRota(rotaId: string, bairroId: string) {
  const { supabase } = await requireAdminOrGerente();

  const { data: ultimo } = await supabase
    .from("rota_bairros")
    .select("ordem")
    .eq("rota_id", rotaId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ordem = (ultimo?.ordem ?? -1) + 1;

  const { error } = await supabase
    .from("rota_bairros")
    .insert({ rota_id: rotaId, bairro_id: bairroId, ordem });

  if (error) return { error: "Não foi possível adicionar o bairro." };

  revalidatePath(`/cadastros/rotas/${rotaId}`);
  return { error: null };
}

export async function removerBairroDaRota(rotaId: string, bairroId: string) {
  const { supabase } = await requireAdminOrGerente();
  const { error } = await supabase
    .from("rota_bairros")
    .delete()
    .eq("rota_id", rotaId)
    .eq("bairro_id", bairroId);

  if (error) return { error: "Não foi possível remover o bairro." };

  revalidatePath(`/cadastros/rotas/${rotaId}`);
  return { error: null };
}

export async function moverBairro(
  rotaId: string,
  bairroId: string,
  direcao: "cima" | "baixo"
) {
  const { supabase } = await requireAdminOrGerente();

  const { data: itens } = await supabase
    .from("rota_bairros")
    .select("bairro_id, ordem")
    .eq("rota_id", rotaId)
    .order("ordem", { ascending: true });

  if (!itens) return { error: "Não foi possível reordenar." };

  const index = itens.findIndex((item) => item.bairro_id === bairroId);
  const vizinhoIndex = direcao === "cima" ? index - 1 : index + 1;

  if (index === -1 || vizinhoIndex < 0 || vizinhoIndex >= itens.length) {
    return { error: null };
  }

  const atual = itens[index];
  const vizinho = itens[vizinhoIndex];

  const [{ error: erro1 }, { error: erro2 }] = await Promise.all([
    supabase
      .from("rota_bairros")
      .update({ ordem: vizinho.ordem })
      .eq("rota_id", rotaId)
      .eq("bairro_id", atual.bairro_id),
    supabase
      .from("rota_bairros")
      .update({ ordem: atual.ordem })
      .eq("rota_id", rotaId)
      .eq("bairro_id", vizinho.bairro_id),
  ]);

  if (erro1 || erro2) return { error: "Não foi possível reordenar." };

  revalidatePath(`/cadastros/rotas/${rotaId}`);
  return { error: null };
}
