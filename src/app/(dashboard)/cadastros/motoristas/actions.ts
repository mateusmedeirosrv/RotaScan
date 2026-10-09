"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrGerente } from "@/lib/auth/guards";

type MotoristaInput = {
  galpao_id: string;
  nome: string;
  cpf: string | null;
  cnh: string | null;
  placa: string | null;
  telefone: string | null;
};

export async function criarMotorista(input: MotoristaInput) {
  const { supabase } = await requireAdminOrGerente();
  const { error } = await supabase.from("motoristas").insert({
    ...input,
    ativo: true,
  });

  if (error) return { error: "Não foi possível salvar o motorista." };

  revalidatePath("/cadastros/motoristas");
  return { error: null };
}

export async function atualizarMotorista(
  id: string,
  input: MotoristaInput & { ativo: boolean }
) {
  const { supabase } = await requireAdminOrGerente();
  const { error } = await supabase
    .from("motoristas")
    .update(input)
    .eq("id", id);

  if (error) return { error: "Não foi possível salvar o motorista." };

  revalidatePath("/cadastros/motoristas");
  return { error: null };
}

type AdvertenciaInput = {
  motorista_id: string;
  galpao_id: string;
  motivo: string;
  data_vigencia: string;
  local: string | null;
};

export async function criarAdvertencia(input: AdvertenciaInput) {
  const { supabase } = await requireAdminOrGerente();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select("id")
    .eq("user_id", user!.id)
    .single();

  const { error } = await supabase.from("advertencias").insert({
    ...input,
    colaborador_id: colaborador!.id,
  });

  if (error) return { error: "Não foi possível registrar a advertência." };

  return { error: null };
}
