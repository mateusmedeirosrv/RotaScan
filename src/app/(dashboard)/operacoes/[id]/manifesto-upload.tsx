"use client";

import { useRef, useState } from "react";
import { read, utils } from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importarManifesto } from "./actions";

const CHAVES_CODIGO = ["codigo", "código", "code", "sku", "cod"];
const CHAVES_DESCRICAO = ["descricao", "descrição", "description", "desc", "produto", "item"];

type ItemDetectado = { codigo: string; descricao: string | null };

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
  const [enviando, setEnviando] = useState(false);

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: "array" });
    const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
    const itensDetectados = detectarItens(primeiraAba);

    if (!itensDetectados.length) {
      toast.error("Não foi possível identificar códigos na planilha.");
      setNomeArquivo(null);
      setItens(null);
      return;
    }

    setNomeArquivo(file.name);
    setItens(itensDetectados);
  }

  async function handleConfirmar() {
    if (!itens || !nomeArquivo) return;
    setEnviando(true);
    const result = await importarManifesto(operacaoId, nomeArquivo, itens);
    setEnviando(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Manifesto importado.");
    setNomeArquivo(null);
    setItens(null);
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
          </p>
          <div className="flex gap-2">
            <Button type="button" disabled={enviando} onClick={handleConfirmar}>
              {enviando ? "Importando..." : "Confirmar importação"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={enviando}
              onClick={() => {
                setNomeArquivo(null);
                setItens(null);
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
