"use client";

import { useRef, useState } from "react";
import { read, utils } from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importarManifesto, prevalidarManifesto } from "./actions";
import {
  lerPlanilhaEncomendas,
  ROTULO_CAMPO,
  type EncomendaInput,
} from "@/lib/encomendas/planilha";

const CHAVES_CODIGO = ["codigo", "código", "code", "sku", "cod"];
const CHAVES_DESCRICAO = ["descricao", "descrição", "description", "desc", "produto", "item"];

type ItemDetectado = { codigo: string; descricao: string | null };
type Preview = { encontradas: number; extras: number; faltantes: number };

function normalizar(texto: string) {
  return texto.trim().toLowerCase();
}

function detectarItens(sheet: ReturnType<typeof read>["Sheets"][string]): ItemDetectado[] {
  const linhasObjeto = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (!linhasObjeto.length) return [];

  const cabecalhos = Object.keys(linhasObjeto[0]);
  const chaveCodigo = cabecalhos.find((c) => CHAVES_CODIGO.includes(normalizar(c)));
  const chaveDescricao = cabecalhos.find((c) =>
    CHAVES_DESCRICAO.includes(normalizar(c))
  );

  if (chaveCodigo) {
    return linhasObjeto
      .map((linha) => ({
        codigo: String(linha[chaveCodigo] ?? "").trim(),
        descricao: chaveDescricao
          ? String(linha[chaveDescricao] ?? "").trim() || null
          : null,
      }))
      .filter((item) => item.codigo);
  }

  // sem cabeçalho reconhecido: usa posição (1ª coluna = código, 2ª = descrição)
  const linhasArray = utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  return linhasArray
    .slice(1)
    .map((linha) => ({
      codigo: String(linha[0] ?? "").trim(),
      descricao: linha[1] ? String(linha[1]).trim() || null : null,
    }))
    .filter((item) => item.codigo);
}

export function ManifestoUpload({ operacaoId }: { operacaoId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemDetectado[] | null>(null);
  const [encomendas, setEncomendas] = useState<EncomendaInput[] | null>(null);
  const [camposAusentes, setCamposAusentes] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [validando, setValidando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  function limpar() {
    setNomeArquivo(null);
    setItens(null);
    setEncomendas(null);
    setCamposAusentes([]);
    setPreview(null);
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: "array" });
    const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];

    // Layout v2.0 (Romaneio, Nro. Entrega, Nota Fiscal...): cada linha vira uma
    // encomenda; o Nro. Entrega é o código conferido no manifesto.
    const planilhaEncomendas = lerPlanilhaEncomendas(primeiraAba);
    let itensDetectados: ItemDetectado[];
    if (planilhaEncomendas) {
      const porCodigo = new Map<string, ItemDetectado>();
      for (const e of planilhaEncomendas.encomendas) {
        if (e.nr_entrega && !porCodigo.has(e.nr_entrega)) {
          porCodigo.set(e.nr_entrega, { codigo: e.nr_entrega, descricao: e.nome_pessoa });
        }
      }
      itensDetectados = [...porCodigo.values()];
      setEncomendas(planilhaEncomendas.encomendas);
      setCamposAusentes(planilhaEncomendas.camposAusentes.map((c) => ROTULO_CAMPO[c]));
    } else {
      itensDetectados = detectarItens(primeiraAba);
      setEncomendas(null);
      setCamposAusentes([]);
    }

    if (!itensDetectados.length) {
      toast.error("Não foi possível identificar códigos na planilha.");
      limpar();
      return;
    }

    setNomeArquivo(file.name);
    setItens(itensDetectados);
    setValidando(true);
    const result = await prevalidarManifesto(operacaoId, itensDetectados);
    setValidando(false);

    if (result.error || !result.preview) {
      toast.error(result.error ?? "Não foi possível validar o manifesto.");
      limpar();
      return;
    }

    setPreview(result.preview);
  }

  async function handleConfirmar() {
    if (!itens || !nomeArquivo) return;
    setEnviando(true);
    const result = await importarManifesto(operacaoId, nomeArquivo, itens, encomendas);
    setEnviando(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      encomendas
        ? `Manifesto importado com ${encomendas.length} encomenda(s).`
        : "Manifesto importado."
    );
    limpar();
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Importar manifesto (.xlsx)</p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleArquivo}
      />

      {!itens ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          Selecionar arquivo
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {nomeArquivo} — {itens.length} código(s) detectado(s)
            {encomendas && ` · ${encomendas.length} encomenda(s)/volume(s) com dados completos`}
          </p>
          {encomendas && camposAusentes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Colunas não encontradas na planilha (ficarão em branco): {camposAusentes.join(", ")}
            </p>
          )}

          {validando ? (
            <p className="text-sm text-muted-foreground">Validando códigos...</p>
          ) : preview ? (
            <div className="flex gap-6 text-sm">
              <span>
                <span className="font-medium">{preview.encontradas}</span> já recebido(s)
              </span>
              <span>
                <span className="font-medium">{preview.extras}</span> serão confirmados
                automaticamente
              </span>
              <span>
                <span className="font-medium">{preview.faltantes}</span> com código inválido
                (não serão confirmados)
              </span>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button type="button" disabled={enviando || validando || !preview} onClick={handleConfirmar}>
              {enviando ? "Importando..." : "Confirmar importação"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={enviando}
              onClick={() => {
                limpar();
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
