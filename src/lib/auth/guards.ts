import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select("papel")
    .eq("user_id", user.id)
    .single();

  if (colaborador?.papel !== "admin") redirect("/");

  return supabase;
}

export async function requireAdminOrGerente() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select("papel")
    .eq("user_id", user.id)
    .single();

  if (colaborador?.papel !== "admin" && colaborador?.papel !== "gerente") {
    redirect("/");
  }

  return { supabase, papel: colaborador.papel };
}

export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select("id, galpao_id, papel")
    .eq("user_id", user.id)
    .single();

  if (!colaborador) redirect("/login");

  return { supabase, colaborador };
}
