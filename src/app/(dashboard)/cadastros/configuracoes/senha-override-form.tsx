"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SenhaOverrideForm() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!novaSenha) {
      toast.error("Informe a nova senha.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("alterar_senha_override", {
        p_nova_senha: novaSenha,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Senha de override alterada.");
      setNovaSenha("");
      setConfirmarSenha("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Senha de override</h2>

      <div className="space-y-1">
        <Label htmlFor="nova_senha">Nova senha</Label>
        <Input
          id="nova_senha"
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirmar_senha">Confirmar nova senha</Label>
        <Input
          id="confirmar_senha"
          type="password"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Alterando..." : "Alterar senha"}
      </Button>
    </form>
  );
}
