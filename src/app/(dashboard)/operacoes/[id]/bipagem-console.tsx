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
  existeRecebimentoPrevio,
  tentarOverride,
} from "@/lib/bipagem/registrar";
import { dbOffline } from "@/lib/bipagem/db-offline";
import { ExcluirBipagemDialog } from "./excluir-bipagem-dialog";
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
  motivo?: string | null;
};

const FLASH_CLASSE: Record<"confirmado" | "duplicado" | "erro", string> = {
  confirmado: "bg-green-500/25",
  duplicado: "bg-yellow-500/25",
  erro: "bg-red-500/25",
};

// Envio automático de códigos sem tamanho fixo: o scanner digita em rajada
// (poucos ms entre caracteres); uma pausa após a rajada indica fim da leitura.
const INTERVALO_MAX_SCANNER_MS = 60;
const PAUSA_FIM_DE_LEITURA_MS = 120;
const TAMANHO_MIN_ENVIO_AUTOMATICO = 4;

const ESPECIAL_REGEX =/[\\^$.*+?()[\]{}|]/;

// Prefixo fixo (em maiúsculas) de um trecho de regex, ou null se não for reconhecido.
// Aceita literal (TBR), grupo de alternativas equivalentes ((?:tbr|TBR)) e
// classes por letra ([Tt][Bb][Rr]) — o campo de bipagem sempre converte para maiúsculas.
function prefixoFixo(trecho: string): string | null {
  if (!ESPECIAL_REGEX.test(trecho)) return trecho.toUpperCase();

  const grupo = /^\((?:\?:)?([^()]*)\)$/.exec(trecho);
  if (grupo) {
    const alternativas = grupo[1].split("|");
    if (alternativas.some((a) => ESPECIAL_REGEX.test(a))) return null;
    const unicas = new Set(alternativas.map((a) => a.toUpperCase()));
    return unicas.size === 1 ? [...unicas][0] : null;
  }

  if (/^(?:\[[^\]\\^-]+\])+$/.test(trecho)) {
    let prefixo = "";
    for (const classe of trecho.slice(1, -1).split("][")) {
      const unicas = new Set(classe.toUpperCase());
      if (unicas.size !== 1) return null;
      prefixo += [...unicas][0];
    }
    return prefixo;
  }

  return null;
}

// Trecho literal inicial de um regex (ex.: "ML\d+" -> "ML"), em maiúsculas.
function prefixoLiteral(fonte: string): string {
  if (fonte.includes("|")) return "";
  let prefixo = "";
  for (const caractere of fonte) {
    if (ESPECIAL_REGEX.test(caractere)) {
      // Quantificador torna o último caractere opcional/repetido: não é fixo
      if ("?*{".includes(caractere)) prefixo = prefixo.slice(0, -1);
      break;
    }
    prefixo += caractere;
  }
  return prefixo.toUpperCase();
}

// Analisa o regex de validação para a checagem em tempo real (char a char).
// Para "^prefixo\d{N}$" retorna o prefixo e o comprimento total esperado; formatos
// que não seguem esse padrão ficam sem comprimento e são validados só no Enter.
function analisarRegex(regexFonte: string): { prefixo: string; comprimento: number | null } {
  const ancorado = regexFonte.startsWith("^") && regexFonte.endsWith("$");
  let fonte = regexFonte.startsWith("^") ? regexFonte.slice(1) : regexFonte;
  if (fonte.endsWith("$")) fonte = fonte.slice(0, -1);

  const digitos = /^(.*?)(?:\\d|\[0-9\])\{(\d+)\}$/.exec(fonte);
  if (digitos) {
    const prefixo = prefixoFixo(digitos[1]);
    if (prefixo === null) return { prefixo: "", comprimento: null };
    return { prefixo, comprimento: ancorado ? prefixo.length + Number(digitos[2]) : null };
  }

  return { prefixo: prefixoLiteral(fonte), comprimento: null };
}

// Compara apenas a parte já digitada com o prefixo esperado (prefixo incompleto = válido).
function prefixoAindaValido(prefixo: string, valorAtual: string): boolean {
  if (!prefixo) return true;
  const tamanho = Math.min(prefixo.length, valorAtual.length);
  return prefixo.slice(0, tamanho) === valorAtual.slice(0, tamanho);
}

function lerEstadoLocal(
  operacaoId: string
): {
  rotaAtivaId?: string;
  motoristasPorRota?: Record<string, string>;
  modoDuplicadoPorRota?: Record<string, boolean>;
} {
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
  // null = transportadora sem regex cadastrado (qualquer código não vazio é aceito)
  const validacao = useMemo(() => {
    if (!regexValidacao) return null;
    return { regex: new RegExp(regexValidacao, "i"), ...analisarRegex(regexValidacao) };
  }, [regexValidacao]);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const motivoDialogInputRef = useRef<HTMLInputElement>(null);
  const travadoRef = useRef(false);
  // Ritmo da digitação do código atual, para distinguir scanner (rajada) de teclado
  const rajadaRef = useRef({ ultimoEm: 0, tamanho: 0, rapida: true });
  const envioAutomaticoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (envioAutomaticoRef.current) clearTimeout(envioAutomaticoRef.current);
    };
  }, []);

  const [rotaAtivaId, setRotaAtivaId] = useState(() => rotas[0]?.id ?? "");
  const [motoristasPorRota, setMotoristasPorRota] = useState<Record<string, string>>({});
  const [modoDuplicadoPorRota, setModoDuplicadoPorRota] = useState<Record<string, boolean>>({});
  const [codigoInput, setCodigoInput] = useState(""); // mantido só para handleSubmit via Enter
  const [motivoDialogAberto, setMotivoDialogAberto] = useState(false);
  const [motivoCodigoPendente, setMotivoCodigoPendente] = useState<string | null>(null);
  const [motivoTexto, setMotivoTexto] = useState("");
  const [overlayRotaAberto, setOverlayRotaAberto] = useState(false);
  const [overlayIndice, setOverlayIndice] = useState(0);
  const [flash, setFlash] = useState<"confirmado" | "duplicado" | "erro" | null>(null);
  const [overrideAberto, setOverrideAberto] = useState(false);
  const [overrideCodigo, setOverrideCodigo] = useState<string | null>(null);
  const [senhaOverride, setSenhaOverride] = useState("");
  const [enviandoOverride, setEnviandoOverride] = useState(false);
  const [online, setOnline] = useState(true);
  const [exclusaoAberta, setExclusaoAberta] = useState(false);

  const motoristaObrigatorio = tipoEvento !== "RECEBIMENTO";
  const seletorRotaVisivel = tipoEvento !== "RECEBIMENTO";
  const motivoVisivel = tipoEvento === "RETORNO" || tipoEvento === "DEVOLUCAO_ORIGEM";
  const seletorDuplicadoVisivel = tipoEvento === "ENTREGA";
  const motoristaAtivoId = motoristasPorRota[rotaAtivaId] ?? "";
  const duplicadoAtivo = modoDuplicadoPorRota[rotaAtivaId] ?? false;

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
      setModoDuplicadoPorRota((atual) => salva.modoDuplicadoPorRota ?? atual);
      return;
    }
    localStorage.setItem(
      `rotascan:bipagem:${operacaoId}`,
      JSON.stringify({ rotaAtivaId, motoristasPorRota, modoDuplicadoPorRota })
    );
  }, [operacaoId, rotaAtivaId, motoristasPorRota, modoDuplicadoPorRota, rotas, motoristas]);

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

  // Wake Lock: impede a tela de apagar durante a bipagem
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    async function ativarWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch { /* dispositivo não suporta ou permissão negada */ }
    }

    function aoVoltar() {
      if (document.visibilityState === "visible") ativarWakeLock();
    }

    ativarWakeLock();
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      wakeLock?.release().catch(() => {});
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
          motivo: linha.motivo,
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
      motivo: item.payload.motivo,
    }));
    return [...pendentesComoEvento, ...(ultimos ?? [])]
      .sort((a, b) => (a.bipadoEm < b.bipadoEm ? 1 : -1))
      .slice(0, 10);
  }, [pendentesRotaAtiva, ultimos]);

  const totalConfirmadoOperacao =
    Object.values(contagens ?? {}).reduce((a, b) => a + b, 0) + (pendentesOperacao?.length ?? 0);
  const [sessao, setSessao] = useState({ duplicado: 0, erro: 0 });
  const [duplicadosConfirmados, setDuplicadosConfirmados] = useState(0);

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
        !motivoDialogAberto &&
        !exclusaoAberta &&
        document.activeElement !== inputRef.current &&
        document.activeElement !== motivoDialogInputRef.current
      ) {
        inputRef.current?.focus();
      }
    }, 750);
    return () => clearInterval(id);
  }, [overlayRotaAberto, overrideAberto, motivoDialogAberto, exclusaoAberta]);

  useEffect(() => {
    if (!seletorRotaVisivel) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F2" && !overrideAberto && !exclusaoAberta) {
        e.preventDefault();
        setOverlayIndice(rotas.findIndex((r) => r.id === rotaAtivaId));
        setOverlayRotaAberto(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [seletorRotaVisivel, overrideAberto, exclusaoAberta, rotaAtivaId, rotas]);

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

  async function inserir(codigo: string, overrideAplicado: boolean, motivo: string | null = null) {
    const duplicadoNoMomento = duplicadoAtivo;
    const resultado = await registrarBipagem(supabase, {
      operacao_id: operacaoId,
      rota_id: rotaAtivaId,
      motorista_id: tipoEvento === "RECEBIMENTO" ? null : motoristaAtivoId,
      transportadora_id: transportadoraId,
      codigo,
      tipo_evento: tipoEvento,
      colaborador_id: colaboradorId,
      override_aplicado: overrideAplicado,
      motivo,
      duplicado: duplicadoNoMomento,
    });

    if (resultado.status === "confirmado") {
      dispararFeedback("confirmado");
      if (duplicadoNoMomento) setDuplicadosConfirmados((n) => n + 1);
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
              motivo: resultado.bipagem.motivo,
            },
            ...(old ?? []),
          ].slice(0, 10)
      );
    } else if (resultado.status === "pendente") {
      dispararFeedback("confirmado");
      if (duplicadoNoMomento) setDuplicadosConfirmados((n) => n + 1);
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

    if (validacao && !validacao.regex.test(codigo)) {
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

    if (motivoVisivel) {
      setMotivoCodigoPendente(codigo);
      setMotivoDialogAberto(true);
      return;
    }

    await inserir(codigo, false);
  }

  async function confirmarMotivo() {
    if (!motivoCodigoPendente) return;
    const motivo = motivoTexto.trim() || null;
    const codigo = motivoCodigoPendente;
    setMotivoDialogAberto(false);
    setMotivoCodigoPendente(null);
    setMotivoTexto("");
    await inserir(codigo, false, motivo);
    focarInput();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const codigo = inputRef.current?.value ?? "";
    limparInput();
    await processarCodigo(codigo);
  }

  function limparInput() {
    if (inputRef.current) inputRef.current.value = "";
    if (envioAutomaticoRef.current) clearTimeout(envioAutomaticoRef.current);
    envioAutomaticoRef.current = null;
    rajadaRef.current.tamanho = 0;
  }

  // Códigos sem tamanho fixo conhecido: registra sozinho quando a rajada do scanner
  // termina. Digitação manual (intervalos longos entre teclas) continua exigindo Enter.
  function agendarEnvioAutomatico(valor: string) {
    const rajada = rajadaRef.current;
    const agora = performance.now();
    if (rajada.tamanho === 0) rajada.rapida = true;
    else if (agora - rajada.ultimoEm > INTERVALO_MAX_SCANNER_MS) rajada.rapida = false;
    rajada.ultimoEm = agora;
    rajada.tamanho = valor.length;

    if (envioAutomaticoRef.current) clearTimeout(envioAutomaticoRef.current);
    envioAutomaticoRef.current = null;
    if (!rajada.rapida || valor.length < TAMANHO_MIN_ENVIO_AUTOMATICO) return;

    envioAutomaticoRef.current = setTimeout(() => {
      const codigo = inputRef.current?.value ?? "";
      if (!codigo || travadoRef.current) return;
      limparInput();
      void processarCodigo(codigo);
    }, PAUSA_FIM_DE_LEITURA_MS);
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
    const up = e.target.value.toUpperCase();
    e.target.value = up;

    if (travadoRef.current) {
      e.target.value = "";
      return;
    }

    if (!up) {
      limparInput();
      return;
    }

    // Sem regex cadastrado na transportadora: aceita qualquer código, ao fim da leitura
    if (!validacao) {
      agendarEnvioAutomatico(up);
      return;
    }

    // Prefixo literal do regex (ex.: TBR) validado char a char
    if (!prefixoAindaValido(validacao.prefixo, up)) {
      dispararErroFormato(up);
      return;
    }

    // Formatos fora do padrão "prefixo + \d{N}" são validados ao fim da leitura
    if (validacao.comprimento === null) {
      agendarEnvioAutomatico(up);
      return;
    }

    // Após o prefixo, só dígitos são permitidos — rejeita qualquer caractere inválido imediatamente
    if (up.length > validacao.prefixo.length && !/^\d+$/.test(up.slice(validacao.prefixo.length))) {
      dispararErroFormato(up);
      return;
    }

    if (up.length > validacao.comprimento) {
      dispararErroFormato(up);
      return;
    }

    // Código completo e válido
    if (up.length === validacao.comprimento && validacao.regex.test(up)) {
      limparInput();
      void processarCodigo(up);
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

  function aoExcluirBipagem({ rotaId, pendente }: { rotaId: string; pendente: boolean }) {
    queryClient.invalidateQueries({ queryKey: ["bipagem-busca", operacaoId] });
    // Pendentes saem da fila do Dexie e as telas se atualizam sozinhas
    if (pendente) return;
    queryClient.setQueryData(
      ["bipagem-contagens", operacaoId],
      (old: Record<string, number> | undefined) => ({
        ...old,
        [rotaId]: Math.max(0, (old?.[rotaId] ?? 1) - 1),
      })
    );
    queryClient.invalidateQueries({ queryKey: ["bipagem-ultimos", operacaoId, rotaId] });
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

      {seletorDuplicadoVisivel && (
        <div className="space-y-1">
          <Label>Código único ou duplicado?</Label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setModoDuplicadoPorRota((m) => ({ ...m, [rotaAtivaId]: false }));
                focarInput();
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                !duplicadoAtivo ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              Único
            </button>
            <button
              type="button"
              onClick={() => {
                setModoDuplicadoPorRota((m) => ({ ...m, [rotaAtivaId]: true }));
                focarInput();
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                duplicadoAtivo ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              Duplicado
            </button>
            {duplicadoAtivo && (
              <span className="text-xs text-muted-foreground">
                Mesmo código TBR pode ser bipado múltiplas vezes
              </span>
            )}
          </div>
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
        {seletorDuplicadoVisivel && (
          <span>Entregas duplicadas: <strong>{duplicadosConfirmados}</strong></span>
        )}
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
        onClick={() => setExclusaoAberta(true)}
      >
        Excluir bipagem
      </Button>

      <ul className="divide-y text-sm">
        {ultimosCombinados.map((evento) => (
          <li key={evento.id} className="flex items-center justify-between gap-4 py-1.5">
            <span className="font-mono">{evento.codigo}</span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-3">
              {evento.motivo && (
                <span className="truncate text-xs text-muted-foreground">{evento.motivo}</span>
              )}
              <span
                className={cn(
                  "shrink-0 text-xs",
                  evento.status === "confirmado" && "text-green-600",
                  evento.status === "pendente" && "text-blue-600",
                  evento.status === "duplicado" && "text-yellow-600",
                  evento.status === "erro" && "text-red-600"
                )}
              >
                {evento.status === "pendente" ? "pendente de sincronização" : evento.status}
              </span>
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

      <ExcluirBipagemDialog
        open={exclusaoAberta}
        onOpenChange={(open) => {
          setExclusaoAberta(open);
          if (!open) focarInput();
        }}
        supabase={supabase}
        operacaoId={operacaoId}
        rotas={rotas}
        onExcluida={aoExcluirBipagem}
      />

      <Dialog
        open={motivoDialogAberto}
        onOpenChange={(open) => {
          setMotivoDialogAberto(open);
          if (!open) {
            setMotivoCodigoPendente(null);
            setMotivoTexto("");
            focarInput();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo</DialogTitle>
            <DialogDescription>
              Código: <strong>{motivoCodigoPendente}</strong>
            </DialogDescription>
          </DialogHeader>
          <input
            ref={motivoDialogInputRef}
            value={motivoTexto}
            onChange={(e) => setMotivoTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmarMotivo()}
            placeholder="Ex.: cliente ausente (opcional)"
            autoFocus
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMotivoDialogAberto(false); setMotivoCodigoPendente(null); setMotivoTexto(""); focarInput(); }}>
              Cancelar
            </Button>
            <Button onClick={confirmarMotivo}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
