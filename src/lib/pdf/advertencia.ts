import { PDFDocument, PageSizes, StandardFonts, PDFFont, PDFPage, rgb } from "pdf-lib";

const MM = 2.834645669;
const MARGEM_MM = 20;

// Fixo para esta operação — não há campo de "responsável legal" no schema
// hoje (galpão não tem razão social/CNPJ). Ajustar aqui se precisar trocar.
const RESPONSAVEL_NOME = "Stélida Cristina Cabral Rodrigues";
const RESPONSAVEL_CNPJ = "43.615.981/0001-94";

const PARAGRAFOS = (nome: string) => [
  `Prezado(a) Sr(a). ${nome}, pela presente comunicamos que Vossa Senhoria está recebendo esta ADVERTÊNCIA POR TEMPO INDETERMINADO, em razão do(s) motivo(s) descrito(s) abaixo, os quais configuram descumprimento das obrigações e normas estabelecidas para a prestação do serviço de entregas.`,
  `Solicitamos a imediata adequação de conduta às normas internas e operacionais vigentes. Alertamos que a reincidência na mesma falta, ou o cometimento de outra infração de natureza semelhante, poderá resultar na aplicação de penalidades mais severas, incluindo a suspensão ou o encerramento do vínculo de prestação de serviços, nos termos do contrato firmado e da legislação aplicável.`,
  `A presente advertência será arquivada nos registros internos e poderá ser considerada em futuras avaliações de desempenho e conduta.`,
];

function quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, larguraMax: number): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";

  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= larguraMax) {
      atual = tentativa;
    } else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function gerarPdfAdvertencia(input: {
  motoristaNome: string;
  motoristaCpf: string | null;
  motivo: string;
  dataVigencia: string;
  local: string | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const [pageWidth, pageHeight] = PageSizes.A4;
  const page = doc.addPage([pageWidth, pageHeight]);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const fonteBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margemEsquerda = MARGEM_MM * MM;
  const margemDireita = MARGEM_MM * MM;
  const margemSuperior = MARGEM_MM * MM;
  const larguraDisponivel = pageWidth - margemEsquerda - margemDireita;

  let y = pageHeight - margemSuperior;

  function linha(texto: string, opts: { size?: number; bold?: boolean; center?: boolean; color?: ReturnType<typeof rgb> } = {}) {
    const size = opts.size ?? 10.5;
    const f = opts.bold ? fonteBold : fonte;
    const largura = f.widthOfTextAtSize(texto, size);
    const x = opts.center ? margemEsquerda + (larguraDisponivel - largura) / 2 : margemEsquerda;
    page.drawText(texto, { x, y, size, font: f, color: opts.color ?? rgb(0.07, 0.07, 0.07) });
  }

  function paragrafo(texto: string, opts: { size?: number; leading?: number } = {}) {
    const size = opts.size ?? 10.5;
    const leading = opts.leading ?? size * 1.3;
    for (const l of quebrarLinhas(texto, fonte, size, larguraDisponivel)) {
      linha(l, { size });
      y -= leading;
    }
  }

  function linhaHorizontal(page: PDFPage, x: number, largura: number, yLinha: number) {
    page.drawLine({
      start: { x, y: yLinha },
      end: { x: x + largura, y: yLinha },
      thickness: 0.75,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  // Título
  linha("CARTA DE ADVERTÊNCIA", { size: 14, bold: true, center: true });
  y -= 18;
  linha(`Advertência por Tempo Indeterminado — vigência a partir de ${input.dataVigencia}`, {
    size: 11,
    bold: true,
    center: true,
  });
  y -= 22;

  // Caixa com dados do motorista
  const caixaAltura = 46;
  page.drawRectangle({
    x: margemEsquerda,
    y: y - caixaAltura,
    width: larguraDisponivel,
    height: caixaAltura,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });
  y -= 14;
  const cpfTexto = input.motoristaCpf ?? "—";
  page.drawText("Motorista: ", { x: margemEsquerda + 10, y, size: 10.5, font: fonteBold });
  page.drawText(input.motoristaNome, {
    x: margemEsquerda + 10 + fonteBold.widthOfTextAtSize("Motorista: ", 10.5),
    y,
    size: 10.5,
    font: fonte,
  });
  y -= 16;
  page.drawText("CPF: ", { x: margemEsquerda + 10, y, size: 10.5, font: fonteBold });
  page.drawText(cpfTexto, {
    x: margemEsquerda + 10 + fonteBold.widthOfTextAtSize("CPF: ", 10.5),
    y,
    size: 10.5,
    font: fonte,
  });
  y -= 26;

  // Parágrafos padrão
  for (const p of PARAGRAFOS(input.motoristaNome)) {
    paragrafo(p);
    y -= 8;
  }

  // Motivo
  linha("MOTIVO", { size: 11.5, bold: true });
  y -= 6;
  linhaHorizontal(page, margemEsquerda, larguraDisponivel, y + 3);
  y -= 14;
  paragrafo(input.motivo);
  y -= 14;

  // Local / Data
  const localTexto = input.local?.trim();
  page.drawText("Local: ", { x: margemEsquerda, y, size: 10.5, font: fonteBold });
  const xLocalValor = margemEsquerda + fonteBold.widthOfTextAtSize("Local: ", 10.5);
  if (localTexto) {
    page.drawText(localTexto, { x: xLocalValor, y, size: 10.5, font: fonte });
  } else {
    linhaHorizontal(page, xLocalValor, 160, y - 2);
  }

  const xData = margemEsquerda + larguraDisponivel / 2;
  page.drawText("Data: ", { x: xData, y, size: 10.5, font: fonteBold });
  page.drawText(input.dataVigencia, {
    x: xData + fonteBold.widthOfTextAtSize("Data: ", 10.5),
    y,
    size: 10.5,
    font: fonte,
  });
  y -= 46;

  // Assinaturas
  const larguraAssinatura = 220;
  const xAssinaturaMotorista = margemEsquerda + (larguraDisponivel / 2 - larguraAssinatura) / 2;
  const xAssinaturaResponsavel = margemEsquerda + larguraDisponivel / 2 + (larguraDisponivel / 2 - larguraAssinatura) / 2;

  linhaHorizontal(page, xAssinaturaMotorista, larguraAssinatura, y);
  linhaHorizontal(page, xAssinaturaResponsavel, larguraAssinatura, y);
  y -= 14;

  function textoCentralizado(texto: string, xBase: number, size: number, bold: boolean) {
    const f = bold ? fonteBold : fonte;
    const largura = f.widthOfTextAtSize(texto, size);
    page.drawText(texto, { x: xBase + (larguraAssinatura - largura) / 2, y, size, font: f });
  }

  textoCentralizado(input.motoristaNome, xAssinaturaMotorista, 10.5, true);
  textoCentralizado(RESPONSAVEL_NOME, xAssinaturaResponsavel, 10.5, true);
  y -= 13;
  const legendaMotorista = input.motoristaCpf ? `CPF ${input.motoristaCpf} — Motorista` : "Motorista";
  textoCentralizado(legendaMotorista, xAssinaturaMotorista, 9, false);
  textoCentralizado(`CNPJ ${RESPONSAVEL_CNPJ} — Responsável`, xAssinaturaResponsavel, 9, false);
  y -= 34;

  // Testemunhas (caso de recusa de assinatura)
  linha(
    "Caso o motorista se recuse a assinar, solicita-se a assinatura de duas testemunhas que",
    { size: 9, color: rgb(0.35, 0.35, 0.35) }
  );
  y -= 11;
  linha("presenciaram a comunicação da advertência e a recusa.", {
    size: 9,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 26;

  const larguraTestemunha = larguraDisponivel / 2 - 12;
  linhaHorizontal(page, margemEsquerda, larguraTestemunha, y);
  linhaHorizontal(page, margemEsquerda + larguraDisponivel / 2 + 12, larguraTestemunha, y);
  y -= 11;
  linha("Nome / CPF", { size: 9, color: rgb(0.35, 0.35, 0.35) });
  page.drawText("Nome / CPF", {
    x: margemEsquerda + larguraDisponivel / 2 + 12,
    y,
    size: 9,
    font: fonte,
    color: rgb(0.35, 0.35, 0.35),
  });

  return doc.save();
}
