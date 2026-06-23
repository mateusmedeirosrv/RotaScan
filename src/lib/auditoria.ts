import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database.types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function registrarAuditoria(
  supabase: SupabaseClient,
  input: { tipo: string; descricao: string; dados?: Json }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("auditoria").insert({
    tipo: input.tipo,
    descricao: input.descricao,
    usuario_id: user.id,
    dados: input.dados ?? null,
  });
}
