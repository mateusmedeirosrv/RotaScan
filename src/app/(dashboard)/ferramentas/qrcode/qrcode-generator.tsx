"use client";

import { useMemo, useState } from "react";
import { PDFDocument, StandardFonts, PageSizes } from "pdf-lib";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MM = 2.834645669;

function base64ParaBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1];
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function gerarPdf(codigos: string[], larguraMm: number, alturaMm: number) {
  const [pageWidth, pageHeight] = PageSizes.A4;
  const labelW = larguraMm * MM;
  const labelH = alturaMm * MM;
  const colunas = Math.max(1, Math.floor(pageWidth / labelW));
  const linhas = Math.max(1, Math.floor(pageHeight / labelH));
  const porPagina = colunas * linhas;
  const margemX = (pageWidth - colunas * labelW) / 2;
  const margemY = (pageHeight - linhas * labelH) / 2;

  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);

  let page = doc.addPage([pageWidth, pageHeight]);

  for (let i = 0; i < codigos.length; i++) {
    const idxNaPagina = i % porPagina;
    if (i > 0 && idxNaPagina === 0) {
      page = doc.addPage([pageWidth, pageHeight]);
    }

    const codigo = codigos[i];
    const col = idxNaPagina % colunas;
    const linha = Math.floor(idxNaPagina / colunas);

    const celulaX = margemX + col * labelW;
    const celulaYTopo = pageHeight - margemY - linha * labelH;

    const dataUrl = await QRCode.toDataURL(codigo, { margin: 1, width: 200 });
    const png = await doc.embedPng(base64ParaBytes(dataUrl));

    const qrTamanho = labelW - 8;
    const qrX = celulaX + (labelW - qrTamanho) / 2;
    const qrY = celulaYTopo - 6 - qrTamanho;
    page.drawImage(png, { x: qrX, y: qrY, width: qrTamanho, height: qrTamanho });

    const tamanhoFonte = 7;
    const larguraTexto = fonte.widthOfTextAtSize(codigo, tamanhoFonte);
    const textoX = celulaX + (labelW - larguraTexto) / 2;
    page.drawText(codigo, { x: textoX, y: qrY - 10, size: tamanhoFonte, font: fonte });
  }

  return { bytes: await doc.save(), porPagina };
}

export function QrCodeGenerator({
  larguraMm,
  alturaMm,
}: {
  larguraMm: number;
  alturaMm: number;
}) {
  const [texto, setTexto] = useState("");
  const [gerando, setGerando] = useState(false);

  const codigos = useMemo(
    () =>
      texto
        .split("\n")
        .map((linha) => linha.trim())
        .filter(Boolean),
    [texto]
  );

  const porPaginaEstimado = useMemo(() => {
    const [pageWidth, pageHeight] = PageSizes.A4;
    const colunas = Math.max(1, Math.floor(pageWidth / (larguraMm * MM)));
    const linhas = Math.max(1, Math.floor(pageHeight / (alturaMm * MM)));
    return colunas * linhas;
  }, [larguraMm, alturaMm]);

  async function handleGerar() {
    setGerando(true);
    try {
      const { bytes } = await gerarPdf(codigos, larguraMm, alturaMm);
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rotascan-etiquetas-qrcode.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={"Cole ou digite os códigos, um por linha\nEx.: TBR374238668"}
        rows={10}
      />
      <p className="text-sm text-muted-foreground">
        {codigos.length} código(s) detectado(s)
        {codigos.length > 0 && ` · ${Math.ceil(codigos.length / porPaginaEstimado)} folha(s) A4`}
      </p>
      <Button type="button" disabled={!codigos.length || gerando} onClick={handleGerar}>
        {gerando ? "Gerando..." : "Gerar PDF"}
      </Button>
    </div>
  );
}
