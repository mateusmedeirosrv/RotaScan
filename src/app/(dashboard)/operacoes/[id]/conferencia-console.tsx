"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { ArrowRight, FileSpreadsheet, Search } from "lucide-react";
import { utils, writeFile } from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { tocarSom } from "@/lib/sounds";
import { registrarBipagem, desfazerBipagem } from "@/lib/bipagem/registrar";
import { dbOffline } from "@/lib/bipagem/db-offline";
import { formatarDataBr, formatarPrazo, formatarVolume } from "@/lib/encomendas/consulta";
import type { Database } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Encomenda = Database["public"]["Tables"]["encomendas"]["Row"];
type Transportadora = { id: string; nome: string };
type CodigoVinculado = { id: string; codigo: string; bipadoEm: string; pendente: boolean };

const LIMITE_RESULTADOS = 50;
const PAGINA_EXPORT = 1000; // limite de linhas por request do PostgREST
const LOTE_IDS_EXPORT = 200;
const DEBOUNCE_PESQUISA_MS = 300;

// Envio automático da leitura do scanner (mesma heurística da tela de bipagem):
// rajada de teclas rápidas seguida de pausa = fim da leitura.
const INTERVALO_MAX_SCANNER_MS = 60;
const PAUSA_FIM_DE_LEITURA_MS = 120;
const TAMANHO_MIN_ENVIO_AUTOMATICO = 4;

const FLASH_CLASSE = {
  confirmado: "bg-green-500/25",
  duplicado: "bg-yellow-500/25",
  erro: "bg-red-500/25",
} as const;

const CAMPOS_DETALHE: { campo: keyof Encomenda; rotulo: string; formato?: (e: Encomenda) => string }[] = [
  { campo: "nr_entrega", rotulo: "Nr. Entrega" },
  { campo: "vol_nr", rotulo: "Volume", formato: (e) => formatarVolume(e) },
  { campo: "nota_fiscal", rotulo: "Nota Fiscal" },
  { campo: "pedido", rotulo: "Pedido" },
  { campo: "nome_pessoa", rotulo: "Destinatário" },
  { campo: "telefone", rotulo: "Telefone" },
  { campo: "endereco", rotulo: "Endereço" },
  { campo: "ponto_referencia", rotulo: "Ponto de Referência" },
  { campo: "bairro", rotulo: "Bairro" },
  { campo: "cep", rotulo: "CEP" },
  { campo: "cidade_uf", rotulo: "Cidade/UF" },
  { campo: "regiao", rotulo: "Região", formato: (e) => [e.regiao, e.nome_regiao].filter(Boolean).join(" · ") },
  { campo: "prazo_final", rotulo: "Prazo", formato: (e) => formatarPrazo(e) },
  { campo: "situacao", rotulo: "Situação" },
  { campo: "remetente", rotulo: "Remetente" },
  { campo: "romaneio", rotulo: "Romaneio", formato: (e) => [e.romaneio, formatarDataBr(e.data_romaneio)].filter(Boolean).join(" · ") },
  { campo: "motorista", rotulo: "Motorista / Placa", formato: (e) => [e.motorista, e.placa].filter(Boolean).join(" · ") },
  { campo: "data_importacao", rotulo: "Data Importação", formato: (e) => formatarDataBr(e.data_importacao) },
];

type Rajada = { ultimoEm: number; tamanho: number; rapida: boolean };

// Atualiza o ritmo da digitação e diz se ainda é uma rajada de scanner.
function registrarTecla(rajada: Rajada, tamanho: number): boolean {
  const agora = performance.now();
  if (rajada.tamanho === 0) rajada.rapida = true;
  else if (agora - rajada.ultimoEm > INTERVALO_MAX_SCANNER_MS) rajada.rapida = false;
  rajada.ultimoEm = agora;
  rajada.tamanho = tamanho;
  return rajada.rapida;
}

function escaparLike(termo: string) {
  return termo.replace(/[%_\\]/g, "\\$&");
}

export function ConferenciaConsole({
  operacaoId,
  colaboradorId,
  transportadoraId,
  rotaId,
  transportadoras,
  sons,
}: {
  operacaoId: string;
  colaboradorId: string;
  transportadoraId: string;
  rotaId: string;
  transportadoras: Transportadora[];
  sons: { confirmado: string; duplicado: string; erro: string };
}) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const pesquisaRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const rajadaRef = useRef<Rajada>({ ultimoEm: 0, tamanho: 0, rapida: true });
  const envioAutomaticoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dataImportacao, setDataImportacao] = useState("");
  const [transportadoraFiltro, setTransportadoraFiltro] = useState(transportadoraId);
  const [pesquisa, setPesquisa] = useState("");
  const [pesquisaDebounced, setPesquisaDebounced] = useState("");
  const [selecionada, setSelecionada] = useState<Encomenda | null>(null);
  const [flash, setFlash] = useState<keyof typeof FLASH_CLASSE | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setPesquisaDebounced(pesquisa.trim()), DEBOUNCE_PESQUISA_MS);
    return () => clearTimeout(id);
  }, [pesquisa]);

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
    return () => {
      if (envioAutomaticoRef.current) clearTimeout(envioAutomaticoRef.current);
    };
  }, []);

  useEffect(() => {
    function aoSincronizar() {
      queryClient.invalidateQueries({ queryKey: ["conferencia-codigos"] });
      queryClient.invalidateQueries({ queryKey: ["conferencia-contagens"] });
    }
    window.addEventListener("rotascan:fila-sync", aoSincronizar);
    return () => window.removeEventListener("rotascan:fila-sync", aoSincronizar);
  }, [queryClient]);

  const termos = useMemo(
    () => pesquisaDebounced.toLowerCase().split(/\s+/).filter(Boolean),
    [pesquisaDebounced]
  );
  const pesquisaAtiva = termos.length > 0 || !!dataImportacao;
  const [exportando, setExportando] = useState(false);

  // Exporta TODAS as encomendas dos filtros atuais (sem o limite da tela),
  // com os códigos vinculados na Conferência. Sem filtros: todas da transportadora.
  async function exportarExcel() {
    setExportando(true);
    try {
      const encomendas: Encomenda[] = [];
      for (let inicio = 0; ; inicio += PAGINA_EXPORT) {
        let query = supabase
          .from("encomendas")
          .select("*")
          .eq("transportadora_id", transportadoraFiltro)
          .order("data_importacao", { ascending: false })
          .order("nr_entrega", { ascending: true })
          .order("vol_nr", { ascending: true })
          .range(inicio, inicio + PAGINA_EXPORT - 1);
        if (dataImportacao) query = query.eq("data_importacao", dataImportacao);
        for (const termo of termos) query = query.ilike("busca", `%${escaparLike(termo)}%`);
        const { data, error } = await query;
        if (error) throw error;
        encomendas.push(...(data ?? []));
        if (!data || data.length < PAGINA_EXPORT) break;
      }

      if (!encomendas.length) {
        toast.error("Nenhuma encomenda encontrada para os filtros atuais.");
        return;
      }

      const codigosPorEncomenda = new Map<string, string[]>();
      for (let i = 0; i < encomendas.length; i += LOTE_IDS_EXPORT) {
        const ids = encomendas.slice(i, i + LOTE_IDS_EXPORT).map((e) => e.id);
        const { data, error } = await supabase
          .from("bipagens")
          .select("encomenda_id, codigo")
          .eq("tipo_evento", "CONFERENCIA")
          .in("encomenda_id", ids);
        if (error) throw error;
        for (const b of data ?? []) {
          if (!b.encomenda_id) continue;
          const lista = codigosPorEncomenda.get(b.encomenda_id) ?? [];
          lista.push(b.codigo);
          codigosPorEncomenda.set(b.encomenda_id, lista);
        }
      }

      const nomeTransportadora = transportadoras.find((t) => t.id === transportadoraFiltro)?.nome ?? "";
      const linhas = encomendas.map((e) => {
        const codigosVinculados = codigosPorEncomenda.get(e.id) ?? [];
        return {
          "Data Importação": formatarDataBr(e.data_importacao),
          Transportadora: nomeTransportadora,
          Romaneio: e.romaneio ?? "",
          "Data Romaneio": formatarDataBr(e.data_romaneio),
          Motorista: e.motorista ?? "",
          Placa: e.placa ?? "",
          Remetente: e.remetente ?? "",
          "Nr. Entrega": e.nr_entrega ?? "",
          "Nome Pessoa": e.nome_pessoa ?? "",
          Telefone: e.telefone ?? "",
          "Prazo (texto)": e.prazo_texto ?? "",
          "Prazo Final": formatarDataBr(e.prazo_final),
          Situação: e.situacao ?? "",
          "Dias até Prazo": e.dias_ate_prazo ?? "",
          CEP: e.cep ?? "",
          Endereço: e.endereco ?? "",
          "Ponto de Referência": e.ponto_referencia ?? "",
          Bairro: e.bairro ?? "",
          "Cidade/UF": e.cidade_uf ?? "",
          Região: e.regiao ?? "",
          "Nome Região": e.nome_regiao ?? "",
          "Nota Fiscal": e.nota_fiscal ?? "",
          Volumes: e.volumes ?? "",
          "Vol. Nº": e.vol_nr ?? "",
          Pedido: e.pedido ?? "",
          Conferida: codigosVinculados.length ? "Sim" : "Não",
          "Qtd. Códigos": codigosVinculados.length,
          "Códigos Vinculados": codigosVinculados.join(", "),
        };
      });

      const planilha = utils.json_to_sheet(linhas);
      const livro = utils.book_new();
      utils.book_append_sheet(livro, planilha, "Encomendas");
      const sufixo = dataImportacao || new Date().toISOString().slice(0, 10);
      writeFile(livro, `conferencia-encomendas-${sufixo}.xlsx`);
      toast.success(`${encomendas.length} encomenda(s) exportada(s).`);
    } catch {
      toast.error("Não foi possível exportar as encomendas.");
    } finally {
      setExportando(false);
    }
  }

  const { data: resultados, isFetching: buscando } = useQuery({
    queryKey: ["conferencia-busca", transportadoraFiltro, dataImportacao, termos.join(" ")],
    queryFn: async () => {
      let query = supabase
        .from("encomendas")
        .select("*")
        .eq("transportadora_id", transportadoraFiltro)
        .order("importado_em", { ascending: false })
        .order("nr_entrega", { ascending: true })
        .order("vol_nr", { ascending: true })
        .limit(LIMITE_RESULTADOS);
      if (dataImportacao) query = query.eq("data_importacao", dataImportacao);
      for (const termo of termos) query = query.ilike("busca", `%${escaparLike(termo)}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: pesquisaAtiva && !!transportadoraFiltro,
    placeholderData: (anterior) => anterior,
  });

  const idsResultados = useMemo(() => (resultados ?? []).map((e) => e.id), [resultados]);

  // Quantos códigos já estão vinculados a cada encomenda listada
  const { data: contagens } = useQuery({
    queryKey: ["conferencia-contagens", idsResultados.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bipagens")
        .select("encomenda_id")
        .eq("tipo_evento", "CONFERENCIA")
        .in("encomenda_id", idsResultados);
      if (error) throw error;
      const mapa: Record<string, number> = {};
      for (const linha of data ?? []) {
        if (linha.encomenda_id) mapa[linha.encomenda_id] = (mapa[linha.encomenda_id] ?? 0) + 1;
      }
      return mapa;
    },
    enabled: idsResultados.length > 0,
    placeholderData: (anterior) => anterior,
  });

  const { data: vinculados } = useQuery({
    queryKey: ["conferencia-codigos", selecionada?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bipagens")
        .select("id, codigo, bipado_em")
        .eq("tipo_evento", "CONFERENCIA")
        .eq("encomenda_id", selecionada!.id)
        .order("bipado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selecionada,
  });

  const pendentes = useLiveQuery(
    () =>
      dbOffline.fila
        .filter(
          (item) =>
            item.status === "pendente" &&
            item.payload.operacao_id === operacaoId &&
            item.payload.encomenda_id === selecionada?.id
        )
        .toArray(),
    [operacaoId, selecionada?.id],
    []
  );

  const codigos: CodigoVinculado[] = useMemo(
    () => [
      ...(pendentes ?? []).map((item) => ({
        id: `pendente-${item.id}`,
        codigo: item.payload.codigo,
        bipadoEm: item.payload.bipado_em,
        pendente: true,
      })),
      ...(vinculados ?? []).map((b) => ({
        id: b.id,
        codigo: b.codigo,
        bipadoEm: b.bipado_em,
        pendente: false,
      })),
    ],
    [pendentes, vinculados]
  );

  function feedback(status: keyof typeof FLASH_CLASSE) {
    tocarSom(sons[status]);
    setFlash(status);
    setTimeout(() => setFlash(null), 250);
  }

  function focarScan() {
    requestAnimationFrame(() => scanRef.current?.focus());
  }

  function selecionar(encomenda: Encomenda) {
    setSelecionada(encomenda);
    focarScan();
  }

  function fecharSelecao() {
    setSelecionada(null);
    // Próxima encomenda: limpa a busca e deixa o cursor pronto para digitar.
    setPesquisa("");
    setPesquisaDebounced("");
    requestAnimationFrame(() => pesquisaRef.current?.focus());
  }

  function atualizarContagem(encomendaId: string, delta: number) {
    queryClient.setQueryData(
      ["conferencia-contagens", idsResultados.join(",")],
      (old: Record<string, number> | undefined) => ({
        ...old,
        [encomendaId]: Math.max(0, (old?.[encomendaId] ?? 0) + delta),
      })
    );
  }

  async function informarCodigoJaVinculado(codigo: string) {
    const { data } = await supabase
      .from("bipagens")
      .select("encomenda_id")
      .eq("tipo_evento", "CONFERENCIA")
      .eq("transportadora_id", transportadoraId)
      .eq("codigo", codigo)
      .limit(1)
      .maybeSingle();

    if (data?.encomenda_id === selecionada?.id) {
      toast.warning(`O código ${codigo} já está vinculado a esta encomenda.`);
      return;
    }
    if (data?.encomenda_id) {
      const { data: outra } = await supabase
        .from("encomendas")
        .select("nr_entrega, vol_nr, volumes, nome_pessoa")
        .eq("id", data.encomenda_id)
        .maybeSingle();
      if (outra) {
        toast.warning(
          `O código ${codigo} já está vinculado à encomenda ${outra.nr_entrega ?? "—"} (vol. ${
            formatarVolume(outra) || "—"
          }${outra.nome_pessoa ? ` · ${outra.nome_pessoa}` : ""}).`
        );
        return;
      }
    }
    toast.warning(`O código ${codigo} já está vinculado a outra encomenda.`);
  }

  async function processarCodigo(bruto: string) {
    const codigo = bruto.trim().toUpperCase();
    if (!codigo) return;

    if (!selecionada) {
      feedback("erro");
      toast.error("Selecione uma encomenda antes de bipar.");
      return;
    }

    const encomenda = selecionada;
    const resultado = await registrarBipagem(supabase, {
      operacao_id: operacaoId,
      rota_id: rotaId,
      motorista_id: null,
      transportadora_id: transportadoraId,
      codigo,
      tipo_evento: "CONFERENCIA",
      colaborador_id: colaboradorId,
      encomenda_id: encomenda.id,
    });

    if (resultado.status === "confirmado") {
      feedback("confirmado");
      queryClient.setQueryData(
        ["conferencia-codigos", encomenda.id],
        (old: { id: string; codigo: string; bipado_em: string }[] | undefined) => [
          { id: resultado.bipagem.id, codigo: resultado.bipagem.codigo, bipado_em: resultado.bipagem.bipado_em },
          ...(old ?? []),
        ]
      );
      atualizarContagem(encomenda.id, 1);
    } else if (resultado.status === "pendente") {
      feedback("confirmado");
    } else if (resultado.status === "duplicado") {
      feedback("duplicado");
      await informarCodigoJaVinculado(codigo);
    } else {
      feedback("erro");
      toast.error(resultado.mensagem);
    }
  }

  async function removerVinculo(item: CodigoVinculado) {
    if (!selecionada) return;
    try {
      if (item.pendente) {
        await dbOffline.fila.delete(Number(item.id.replace("pendente-", "")));
      } else {
        await desfazerBipagem(supabase, item.id);
        queryClient.setQueryData(
          ["conferencia-codigos", selecionada.id],
          (old: { id: string }[] | undefined) => (old ?? []).filter((b) => b.id !== item.id)
        );
        atualizarContagem(selecionada.id, -1);
      }
      toast.success(`Código ${item.codigo} desvinculado.`);
    } catch {
      toast.error("Não foi possível remover o código (sem permissão ou offline).");
    }
    focarScan();
  }

  function limparScan() {
    if (scanRef.current) scanRef.current.value = "";
    if (envioAutomaticoRef.current) clearTimeout(envioAutomaticoRef.current);
    envioAutomaticoRef.current = null;
    rajadaRef.current.tamanho = 0;
  }

  function handleScanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value.toUpperCase();
    e.target.value = valor;
    if (!valor) {
      limparScan();
      return;
    }

    const rapida = registrarTecla(rajadaRef.current, valor.length);

    if (envioAutomaticoRef.current) clearTimeout(envioAutomaticoRef.current);
    envioAutomaticoRef.current = null;
    if (!rapida || valor.length < TAMANHO_MIN_ENVIO_AUTOMATICO) return;

    envioAutomaticoRef.current = setTimeout(() => {
      const codigo = scanRef.current?.value ?? "";
      if (!codigo) return;
      limparScan();
      void processarCodigo(codigo);
    }, PAUSA_FIM_DE_LEITURA_MS);
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const codigo = scanRef.current?.value ?? "";
    limparScan();
    await processarCodigo(codigo);
  }

  function handlePesquisaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    setPesquisaDebounced(pesquisa.trim());
    if (resultados?.length === 1) selecionar(resultados[0]);
  }

  return (
    <div className="relative space-y-4 rounded-lg border p-4">
      {flash && (
        <div className={cn("pointer-events-none fixed inset-0 z-40 transition-opacity", FLASH_CLASSE[flash])} />
      )}

      <div className="flex items-center gap-2 text-xs">
        <span className={cn("inline-block h-2 w-2 rounded-full", online ? "bg-green-500" : "bg-red-500")} />
        <span className="text-muted-foreground">
          {online ? "Online" : "Offline — a pesquisa de encomendas exige conexão"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[170px_220px_1fr]">
        <div className="space-y-1">
          <Label htmlFor="data_importacao">Data Importação</Label>
          <Input
            id="data_importacao"
            type="date"
            value={dataImportacao}
            onChange={(e) => setDataImportacao(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="transportadora_filtro">Transportadora</Label>
          <Select
            value={transportadoraFiltro}
            onValueChange={(v) => v && setTransportadoraFiltro(v as string)}
          >
            <SelectTrigger id="transportadora_filtro" className="w-full">
              <SelectValue placeholder="Transportadora">
                {(value: string) => transportadoras.find((t) => t.id === value)?.nome ?? "Transportadora"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {transportadoras.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pesquisa">Pesquisa</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="pesquisa"
              ref={pesquisaRef}
              autoFocus
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              onKeyDown={handlePesquisaKeyDown}
              placeholder="Nr. entrega, NF, pedido, nome, endereço, bairro, telefone, romaneio..."
              autoComplete="off"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {pesquisaAtiva
            ? "A exportação inclui todas as encomendas dos filtros atuais (sem o limite da tela)."
            : "Sem filtros: a exportação inclui todas as encomendas da transportadora."}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exportando || !online}
          onClick={exportarExcel}
        >
          <FileSpreadsheet className="size-4" />
          {exportando ? "Exportando..." : "Exportar Excel"}
        </Button>
      </div>

      {!pesquisaAtiva ? (
        <p className="text-sm text-muted-foreground">
          Informe a data de importação e/ou um termo de pesquisa para localizar a encomenda.
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {buscando
              ? "Pesquisando..."
              : `${resultados?.length ?? 0} encomenda(s)${
                  (resultados?.length ?? 0) >= LIMITE_RESULTADOS ? ` (exibindo as ${LIMITE_RESULTADOS} primeiras — refine a pesquisa)` : ""
                }`}
          </p>
          {(resultados?.length ?? 0) > 0 && (
            <div className="max-h-80 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr. Entrega</TableHead>
                    <TableHead>Vol.</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead>NF</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Importação</TableHead>
                    <TableHead className="text-right">Códigos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados!.map((e) => (
                    <TableRow
                      key={e.id}
                      onClick={() => selecionar(e)}
                      className={cn(
                        "cursor-pointer",
                        selecionada?.id === e.id && "bg-primary/10 hover:bg-primary/15"
                      )}
                    >
                      <TableCell className="font-mono">{e.nr_entrega}</TableCell>
                      <TableCell>{formatarVolume(e)}</TableCell>
                      <TableCell className="max-w-48 truncate">{e.nome_pessoa}</TableCell>
                      <TableCell className="max-w-64 truncate">{e.endereco}</TableCell>
                      <TableCell>{e.bairro}</TableCell>
                      <TableCell>{e.nota_fiscal}</TableCell>
                      <TableCell>{formatarPrazo(e)}</TableCell>
                      <TableCell>{formatarDataBr(e.data_importacao)}</TableCell>
                      <TableCell className="text-right font-semibold">{contagens?.[e.id] ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {selecionada && (
        <div className="space-y-4 rounded-lg border-2 border-primary/60 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Encomenda selecionada
              </p>
              <p className="text-lg font-semibold">
                <span className="font-mono">{selecionada.nr_entrega}</span>
                {formatarVolume(selecionada) && ` · Vol. ${formatarVolume(selecionada)}`}
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={fecharSelecao}
              className="h-11 shrink-0 px-5 text-base font-semibold shadow-md ring-2 ring-primary/30"
            >
              Próxima encomenda
              <ArrowRight className="size-5" />
            </Button>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3 lg:grid-cols-4">
            {CAMPOS_DETALHE.map(({ campo, rotulo, formato }) => {
              const valor = formato ? formato(selecionada) : selecionada[campo];
              return (
                <div key={campo} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                  <dd className="break-words">{valor === null || valor === "" ? "—" : String(valor)}</dd>
                </div>
              );
            })}
          </dl>

          <form onSubmit={handleScanSubmit} className="space-y-1">
            <Label htmlFor="codigo_conferencia">
              Bipe os QR Codes e códigos de barras do pacote
            </Label>
            {/* input nativo: limpeza síncrona durante a rajada do scanner */}
            <input
              id="codigo_conferencia"
              ref={scanRef}
              onChange={handleScanChange}
              placeholder="Bipe o código aqui"
              autoComplete="off"
              className="h-14 w-full rounded-lg border border-input bg-transparent px-3 text-lg outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </form>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              Códigos vinculados: <strong>{codigos.length}</strong>
            </p>
            {codigos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum código vinculado ainda.</p>
            ) : (
              <ul className="divide-y text-sm">
                {codigos.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-1.5">
                    <span className="break-all font-mono">{item.codigo}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className={cn("text-xs", item.pendente ? "text-blue-600" : "text-green-600")}>
                        {item.pendente ? "pendente de sincronização" : "vinculado"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removerVinculo(item)}
                      >
                        Remover
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            onClick={fecharSelecao}
            className="h-12 w-full text-base font-semibold shadow-md"
          >
            Próxima encomenda
            <ArrowRight className="size-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
