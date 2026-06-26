"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { tocarSom } from "@/lib/sounds";
import {
  registrarBipagem,
  buscarUltimasBipagens,
  buscarContagemPorRota,
  desfazerBipagem,
  existeRecebimentoPrevio,
  tentarOverride,
} from "@/lib/bipagem/registrar";
import { dbOffline } from "@/lib/bipagem/db-offline";
import type { Database } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TipoEvento = Database["public"]["Tables"]["operacoes"]["Row"]["tipo_evento"];
type BloqueioConfig = "BLOQUEAR" | "PERMITIR_COM_ALERTA" | "PERMITIR";

type Rota = { id: string; nome: string };
type Motorista = { id: string; nome: string };

type EventoBipagem = {
  id: string;
  codigo: string;
  status: "confirmado" | "duplicado" | "erro" | "pendente";
  bipadoEm: string;
};

const FLASH_CLASSE: Record<"confirmado" | "duplicado" | "erro", string> = {
  confirmado: "bg-green-500/25",
  duplicado: "bg-yellow-500/25",
  erro: "bg-red-500/25",
};

// Extrai o prefixo literal de um regex de validação (ex.: "^TBR\d{9}$" -> "TBR").
function prefixoLiteral(regexFonte: string): string {
  const fonte = regexFonte.startsWith("^") ? regexFonte.slice(1) : regexFonte;
  let prefixo = "";
  for (const caractere of fonte) {
    if (/[\\^$.*+?()[\]{}|]/.test(caractere)) break;
    prefixo += caractere;
  }
  return prefixo;
}

// Se o regex for "prefixo + \d{N}", retorna o comprimento total esperado.
// Para formatos que não seguem esse padrão, retorna null (sem corte por tamanho).
function comprimentoMaximo(regexFonte: string, prefixo: string): number | null {
  let fonte = regexFonte.startsWith("^") ? regexFonte.slice(1) : regexFonte;
  if (fonte.endsWith("$")) fonte = fonte.slice(0, -1);
  const resto = fonte.slice(prefixo.length);
  const match = /^\\d\{(\d+)\}$/.exec(resto);
  return match ? prefixo.length + Number(match[1]) : null;
}

// Compara apenas a parte já digitada com o prefixo esperado (prefixo incompleto = válido).
function prefixoAindaValido(prefixo: string, valorAtual: string): boolean {
  if (!prefixo) return true;
  const tamanho = Math.min(prefixo.length, valorAtual.length);
  return prefixo.slice(0, tamanho) === valorAtual.slice(0, tamanho);
}

function lerEstadoLocal(
  operacaoId: string
): { rotaAtivaId?: string; motoristasPorRota?: Record<string, string> } {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`rotascan:bipagem:${operacaoId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function BipagemConsole({
  operacaoId,
  colaboradorId,
  transportadoraId,
  regexValidacao,
  tipoEvento,
  rotas,
  motoristas,
  bloqueioConfig,
  sons,
}: {
  operacaoId: string;
  colaboradorId: string;
  transportadoraId: string;
  regexValidacao: string | null;
  tipoEvento: TipoEvento;
  rotas: Rota[];
  motoristas: Motorista[];
  bloqueioConfig: BloqueioConfig;
  sons: { confirmado: string; duplicado: string; erro: string };
}) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const motivoInputRef = useRef<HTMLInputElement>(null);
  const travadoRef = useRef(false);

  const [rotaAtivaId, setRotaAtivaId] = useState(() => rotas[0]?.id ?? "");
  const [motoristasPorRota, setMotoristasPorRota] = useState<Record<string, string>>({});
  const [codigoInput, setCodigoInput] = useState(""); // mantido só para handleSubmit via Enter
  const [motivoInput, setMotivoInput] = useState("");
  const [overlayRotaAberto, setOverlayRotaAberto] = useState(false);
  const [overlayIndice, setOverlayIndice] = useState(0);
  const [flash, setFlash] = useState<"confirmado" | "duplicado" | "erro" | null>(null);
  const [overrideAberto, setOverrideAberto] = useState(false);
  const [overrideCodigo, setOverrideCodigo] = useState<string | null>(null);
  const [senhaOverride, setSenhaOverride] = useState("");
  const [enviandoOverride, setEnviandoOverride] = useState(false);
  const [online, setOnline] = useState(true);

  const motoristaObrigatorio = tipoEvento !== "RECEBIMENTO";
  const seletorRotaVisivel = tipoEvento !== "RECEBIMENTO";
  const motivoVisivel = tipoEvento === "RETORNO" || tipoEvento === "DEVOLUCAO_ORIGEM";
  const motoristaAtivoId = motoristasPorRota[rotaAtivaId] ?? "";

  const hidratadoRef = useRef(false);

  useEffect(() => {
    if (!hidratadoRef.current) {
      hidratadoRef.current = true;
      const salva = lerEstadoLocal(operacaoId);
      setRotaAtivaId((atual) =>
        salva.rotaAtivaId && rotas.some((r) => r.id === salva.rotaAtivaId) ? salva.rotaAtivaId : atual
      );
      setMotoristasPorRota((atual) =>
        salva.motoristasPorRota
          ? Object.fromEntries(
              Object.entries(salva.motoristasPorRota).filter(([, motoristaId]) =>
                motoristas.some((m) => m.id === motoristaId)
              )
            )
          : atual
      );
      return;
    }
    localStorage.setItem(
      `rotascan:bipagem:${operacaoId}`,
      JSON.stringify({ rotaAtivaId, motoristasPorRota })
    );
  }, [operacaoId, rotaAtivaId, motoristasPorRota, rotas, motoristas]);

  useEffect(() => {
    function aoMudarConexao() {
      setOnline(navigator.onLine);
    }
    aoMudarConexao();
    window.addEventListener("online", aoMudarConexao);
    window.addEventListener("offline", aoMudarConexao);
    return () => {
      window.removeEventListener("online", aoMudarConexao);
      window.removeEventListener("offline", aoMudarConexao);
    };
  }, []);

  useEffect(() => {
    function aoSincronizar() {
      queryClient.invalidateQueries({ queryKey: ["bipagem-contagens", operacaoId] });
      queryClient.invalidateQueries({ queryKey: ["bipagem-ultimos", operacaoId, rotaAtivaId] });
    }
    window.addEventListener("rotascan:fila-sync", aoSincronizar);
    return () => window.removeEventListener("rotascan:fila-sync", aoSincronizar);
  }, [queryClient, operacaoId, rotaAtivaId]);

  const { data: contagens } = useQuery({
    queryKey: ["bipagem-contagens", operacaoId],
    queryFn: () => buscarContagemPorRota(supabase, operacaoId),
    staleTime: Infinity,
  });

  const { data: ultimos } = useQuery({
    queryKey: ["bipagem-ultimos", operacaoId, rotaAtivaId],
    queryFn: async () => {
      const linhas = await buscarUltimasBipagens(supabase, operacaoId, rotaAtivaId);
      return linhas.map(
        (linha): EventoBipagem => ({
          id: linha.id,
          codigo: linha.codigo,
          status: "confirmado",
          bipadoEm: linha.bipado_em,
        })
      );
    },
    staleTime: Infinity,
    enabled: !!rotaAtivaId,
  });

  const pendentesRotaAtiva = useLiveQuery(
    () =>
      dbOffline.fila
        .where("[payload.operacao_id+payload.rota_id]")
        .equals([operacaoId, rotaAtivaId])
        .filter((item) => item.status === "pendente")
        .toArray(),
    [operacaoId, rotaAtivaId],
    []
  );

  const pendentesOperacao = useLiveQuery(
    () =>
      dbOffline.fila
        .filter((item) => item.payload.operacao_id === operacaoId && item.status === "pendente")
        .toArray(),
    [operacaoId],
    []
  );

  const pendentesPorRota = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const item of pendentesOperacao ?? []) {
      mapa[item.payload.rota_id] = (mapa[item.payload.rota_id] ?? 0) + 1;
    }
    return mapa;
  }, [pendentesOperacao]);

  const ultimosCombinados = useMemo((): EventoBipagem[] => {
    const pendentesComoEvento: EventoBipagem[] = (pendentesRotaAtiva ?? []).map((item) => ({
      id: String(item.id),
      codigo: item.payload.codigo,
      status: "pendente",
      bipadoEm: item.payload.bipado_em,
    }));
    return [...pendentesComoEvento, ...(ultimos ?? [])]
      .sort((a, b) => (a.bipadoEm < b.bipadoEm ? 1 : -1))
      .slice(0, 10);
  }, [pendentesRotaAtiva, ultimos]);

  const totalConfirmadoOperacao =
    Object.values(contagens ?? {}).reduce((a, b) => a + b, 0) + (pendentesOperacao?.length ?? 0);
  const [sessao, setSessao] = useState({ duplicado: 0, erro: 0 });
  const ultimoItem = ultimosCombinados[0];

  function focarInput() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // Rede de segurança: o foco do scanner nunca pode ficar perdido — exceto
  // enquanto o colaborador está digitando no campo Motivo.
  useEffect(() => {
    const id = setInterval(() => {
      if (
        !overlayRotaAberto &&
        !overrideAberto &&
        document.activeElement !== inputRef.current &&
        document.activeElement !== motivoInputRef.current
      ) {
        inputRef.current?.focus();
      }
    }, 750);
    return () => clearInterval(id);
  }, [overlayRotaAberto, overrideAberto]);

  useEffect(() => {
    if (!seletorRotaVisivel) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F2" && !overrideAberto) {
        e.preventDefault();
        setOverlayIndice(rotas.findIndex((r) => r.id === rotaAtivaId));
        setOverlayRotaAberto(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [seletorRotaVisivel, overrideAberto, rotaAtivaId, rotas]);

  useEffect(() => {
    if (!overlayRotaAberto) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOverlayRotaAberto(false);
        focarInput();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setOverlayIndice((i) => Math.min(i + 1, rotas.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setOverlayIndice((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const rota = rotas[overlayIndice];
        if (rota) setRotaAtivaId(rota.id);
        setOverlayRotaAberto(false);
        focarInput();
      } else if (/^[1-9]$/.test(e.key)) {
        const rota = rotas[Number(e.key) - 1];
        if (rota) {
          setRotaAtivaId(rota.id);
          setOverlayRotaAberto(false);
          focarInput();
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [overlayRotaAberto, overlayIndice, rotas]);

  function dispararFeedback(status: "confirmado" | "duplicado" | "erro") {
    tocarSom(sons[status]);
    setFlash(status);
    setTimeout(() => setFlash(null), 250);
  }

  function adicionarEventoSessao(codigo: string, status: "duplicado" | "erro") {
    dispararFeedback(status);
    setSessao((s) => ({ ...s, [status]: s[status] + 1 }));
    queryClient.setQueryData(
      ["bipagem-ultimos", operacaoId, rotaAtivaId],
      (old: EventoBipagem[] | undefined) =>
        [{ id: crypto.randomUUID(), codigo, status, bipadoEm: new Date().toISOString() }, ...(old ?? [])].slice(0, 10)
    );
  }

  async function inserir(codigo: string, overrideAplicado: boolean) {
    const resultado = await registrarBipagem(supabase, {
      operacao_id: operacaoId,
      rota_id: rotaAtivaId,
      motorista_id: tipoEvento === "RECEBIMENTO" ? null : motoristaAtivoId,
      transportadora_id: transportadoraId,
      codigo,
      tipo_evento: tipoEvento,
      colaborador_id: colaboradorId,
      override_aplicado: overrideAplicado,
      motivo: motivoVisivel ? motivoInput.trim() || null : null,
    });

    if (resultado.status === "confirmado") {
      dispararFeedback("confirmado");
      queryClient.setQueryData(
        ["bipagem-contagens", operacaoId],
        (old: Record<string, number> | undefined) => ({
          ...old,
          [rotaAtivaId]: (old?.[rotaAtivaId] ?? 0) + 1,
        })
      );
      queryClient.setQueryData(
        ["bipagem-ultimos", operacaoId, rotaAtivaId],
        (old: EventoBipagem[] | undefined) =>
          [
            {
              id: resultado.bipagem.id,
              codigo: resultado.bipagem.codigo,
              status: "confirmado" as const,
              bipadoEm: resultado.bipagem.bipado_em,
            },
            ...(old ?? []),
          ].slice(0, 10)
      );
    } else if (resultado.status === "pendente") {
      dispararFeedback("confirmado");
    } else if (resultado.status === "duplicado") {
      adicionarEventoSessao(codigo, "duplicado");
    } else {
      toast.error(resultado.mensagem);
      adicionarEventoSessao(codigo, "erro");
    }
  }

  async function processarCodigo(codigoBruto: string) {
    const codigo = codigoBruto.trim();
    if (!codigo) return;

    const regexEfetivo = regexValidacao ?? "^[Tt][Bb][Rr]\\d{9}$";
    if (!new RegExp(regexEfetivo, "i").test(codigo)) {
      adicionarEventoSessao(codigo, "erro");
      return;
    }

    if (motoristaObrigatorio && !motoristaAtivoId) {
      toast.error("Selecione um motorista antes de bipar.");
      adicionarEventoSessao(codigo, "erro");
      return;
    }

    if (online && tipoEvento === "ENTREGA" && bloqueioConfig !== "PERMITIR") {
      try {
        const jaRecebido = await existeRecebimentoPrevio(supabase, transportadoraId, codigo);
        if (!jaRecebido) {
          if (bloqueioConfig === "PERMITIR_COM_ALERTA") {
            toast.warning("Entrega sem recebimento prévio registrado.");
          } else {
            setOverrideCodigo(codigo);
            setOverrideAberto(true);
            return;
          }
        }
      } catch {
        // Falha ao verificar recebimento prévio (rede instável mesmo com
        // navigator.onLine true): não bloqueia o bipe — enfileira e deixa
        // a checagem real acontecer no sync, igual ao fluxo offline.
      }
    }

    await inserir(codigo, false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const codigo = inputRef.current?.value ?? "";
    if (inputRef.current) inputRef.current.value = "";
    await processarCodigo(codigo);
  }

  function limparInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function dispararErroFormato(valorInvalido: string) {
    // Trava por 120ms para engolir o restante do burst do scanner
    travadoRef.current = true;
    limparInput();
    adicionarEventoSessao(valorInvalido, "erro");
    setTimeout(() => {
      limparInput();
      travadoRef.current = false;
      inputRef.current?.focus();
    }, 120);
  }

  function handleCodigoChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Descarta tudo enquanto travado — absorve burst do scanner após erro
    if (travadoRef.current) {
      e.target.value = "";
      return;
    }

    // Normaliza para maiúsculo diretamente no DOM (sem passar por estado React)
    const up = e.target.value.toUpperCase();
    e.target.value = up;

    if (!up) return;

    if (regexValidacao) {
      if (new RegExp(regexValidacao, "i").test(up)) {
        limparInput();
        void processarCodigo(up);
        return;
      }
      const prefixo = prefixoLiteral(regexValidacao);
      const maximo = comprimentoMaximo(regexValidacao, prefixo);
      const invalido =
        !prefixoAindaValido(prefixo.toUpperCase(), up) ||
        (maximo !== null && up.length > maximo);
      if (invalido) dispararErroFormato(up);
      return;
    }

    // Sem regex: valida TBR diretamente (TBR + 9 dígitos = 12 chars)
    if (/^TBR\d{9}$/.test(up)) {
      limparInput();
      void processarCodigo(up);
      return;
    }

    const prefixoDigitado = up.slice(0, Math.min(3, up.length));
    const prefixoEsperado = "TBR".slice(0, prefixoDigitado.length);
    if (prefixoDigitado !== prefixoEsperado || up.length > 12) {
      dispararErroFormato(up);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (travadoRef.current) e.preventDefault();
  }

  async function confirmarOverride() {
    if (!overrideCodigo) return;
    setEnviandoOverride(true);
    try {
      const ok = await tentarOverride(supabase, {
        senhaTentativa: senhaOverride,
        codigo: overrideCodigo,
        operacaoId,
        rotaId: rotaAtivaId,
      });

      if (ok) {
        await inserir(overrideCodigo, true);
        setOverrideAberto(false);
        setOverrideCodigo(null);
        setSenhaOverride("");
      } else {
        toast.error("Senha de override incorreta.");
        dispararFeedback("erro");
      }
    } finally {
      setEnviandoOverride(false);
    }
  }

  async function handleDesfazer() {
    if (!ultimoItem || ultimoItem.status === "duplicado" || ultimoItem.status === "erro") return;

    if (ultimoItem.status === "pendente") {
      await dbOffline.fila.delete(Number(ultimoItem.id));
      toast.success("Bipagem pendente removida.");
      focarInput();
      return;
    }

    try {
      await desfazerBipagem(supabase, ultimoItem.id);
      queryClient.setQueryData(
        ["bipagem-ultimos", operacaoId, rotaAtivaId],
        (old: EventoBipagem[] | undefined) => (old ?? []).filter((e) => e.id !== ultimoItem.id)
      );
      queryClient.setQueryData(
        ["bipagem-contagens", operacaoId],
        (old: Record<string, number> | undefined) => ({
          ...old,
          [rotaAtivaId]: Math.max(0, (old?.[rotaAtivaId] ?? 1) - 1),
        })
      );
      toast.success("Bipagem desfeita.");
    } catch {
      toast.error("Não foi possível desfazer a bipagem.");
    } finally {
      focarInput();
    }
  }

  if (rotas.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Nenhuma rota cadastrada neste galpão. Cadastre uma rota antes de bipar.
      </div>
    );
  }

  return (
    <div className="relative space-y-4 rounded-lg border p-4">
      {flash && (
        <div className={cn("pointer-events-none fixed inset-0 z-40 transition-opacity", FLASH_CLASSE[flash])} />
      )}

      <div className="flex items-center gap-2 text-xs">
        <span className={cn("inline-block h-2 w-2 rounded-full", online ? "bg-green-500" : "bg-red-500")} />
        <span className="text-muted-foreground">{online ? "Online" : "Offline"}</span>
        {(pendentesOperacao?.length ?? 0) > 0 && (
          <span className="text-muted-foreground">
            · {pendentesOperacao?.length} pendente{(pendentesOperacao?.length ?? 0) > 1 ? "s" : ""} de sincronização
          </span>
        )}
      </div>

      {seletorRotaVisivel && (
        <div className="flex flex-wrap items-center gap-2">
          {rotas.map((rota) => (
            <button
              key={rota.id}
              type="button"
              onClick={() => {
                setRotaAtivaId(rota.id);
                focarInput();
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                rota.id === rotaAtivaId ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              {rota.nome} · {(contagens?.[rota.id] ?? 0) + (pendentesPorRota[rota.id] ?? 0)}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">(F2 para trocar de rota)</span>
        </div>
      )}

      {motoristaObrigatorio && (
        <div className="space-y-1">
          <Label>Motorista (rota: {rotas.find((r) => r.id === rotaAtivaId)?.nome ?? "—"})</Label>
          <div className="flex flex-wrap items-center gap-2">
            {motoristas.map((motorista) => (
              <button
                key={motorista.id}
                type="button"
                onClick={() => {
                  setMotoristasPorRota((m) => ({ ...m, [rotaAtivaId]: motorista.id }));
                  focarInput();
                }}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm",
                  motorista.id === motoristaAtivoId
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground"
                )}
              >
                {motorista.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {motivoVisivel && (
        <div className="max-w-xs space-y-1">
          <Label htmlFor="motivo">Motivo (opcional)</Label>
          <Input
            id="motivo"
            ref={motivoInputRef}
            value={motivoInput}
            onChange={(e) => setMotivoInput(e.target.value)}
            placeholder="Ex.: cliente ausente"
          />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* input nativo obrigatório: Base UI (@base-ui/react/input) não expõe o DOM
            nativo diretamente via ref/e.target, impedindo a limpeza síncrona do scanner */}
        <input
          ref={inputRef}
          autoFocus
          onChange={handleCodigoChange}
          onKeyDown={handleKeyDown}
          placeholder="Bipe o código aqui"
          autoComplete="off"
          className="h-14 w-full rounded-lg border border-input bg-transparent px-3 text-lg outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </form>

      <div className="flex gap-6 text-sm">
        <span>Confirmados: <strong>{totalConfirmadoOperacao}</strong></span>
        <span>Duplicados: <strong>{sessao.duplicado}</strong></span>
        <span>Erros: <strong>{sessao.erro}</strong></span>
        <span className="text-muted-foreground">
          Rota ativa: {(contagens?.[rotaAtivaId] ?? 0) + (pendentesPorRota[rotaAtivaId] ?? 0)}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!ultimoItem || ultimoItem.status === "duplicado" || ultimoItem.status === "erro"}
        onClick={handleDesfazer}
      >
        Desfazer última bipagem
      </Button>

      <ul className="divide-y text-sm">
        {ultimosCombinados.map((evento) => (
          <li key={evento.id} className="flex items-center justify-between py-1.5">
            <span>{evento.codigo}</span>
            <span
              className={cn(
                "text-xs",
                evento.status === "confirmado" && "text-green-600",
                evento.status === "pendente" && "text-blue-600",
                evento.status === "duplicado" && "text-yellow-600",
                evento.status === "erro" && "text-red-600"
              )}
            >
              {evento.status === "pendente" ? "pendente de sincronização" : evento.status}
            </span>
          </li>
        ))}
      </ul>

      {seletorRotaVisivel && overlayRotaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-72 rounded-lg border bg-popover p-2 text-popover-foreground">
            {rotas.map((rota, i) => (
              <button
                key={rota.id}
                type="button"
                onClick={() => {
                  setRotaAtivaId(rota.id);
                  setOverlayRotaAberto(false);
                  focarInput();
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm",
                  i === overlayIndice && "bg-foreground text-background"
                )}
              >
                <span>{rota.nome}</span>
                <span className="text-xs">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={overrideAberto}
        onOpenChange={(open) => {
          setOverrideAberto(open);
          if (!open) {
            setOverrideCodigo(null);
            setSenhaOverride("");
            focarInput();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrega sem recebimento prévio</DialogTitle>
            <DialogDescription>
              O código <strong>{overrideCodigo}</strong> não tem recebimento registrado. Informe a
              senha de override para liberar esta bipagem.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            value={senhaOverride}
            onChange={(e) => setSenhaOverride(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmarOverride()}
            placeholder="Senha de override"
            autoFocus
          />
          <DialogFooter>
            <Button disabled={enviandoOverride || !senhaOverride} onClick={confirmarOverride}>
              {enviandoOverride ? "Verificando..." : "Liberar bipagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
