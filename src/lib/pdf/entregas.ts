import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type LinhaPdfEntrega = {
  codigo: string;
  rota: string;
  motorista: string;
  bipadoEm: string;
  volume: string;
  nrEntrega: string;
  notaFiscal: string;
  nomePessoa: string;
  endereco: string;
  bairro: string;
  prazo: string;
};

type Coluna = { titulo: string; largura: number; valor: (l: LinhaPdfEntrega, i: number) => string };

const MARGEM = 24;
const FONTE = 7;
const FONTE_CABECALHO = 7;
const ALTURA_LINHA = 11;
const COR_TEXTO = rgb(0.08, 0.08, 0.08);
const COR_SUAVE = rgb(0.4, 0.4, 0.4);
const COR_FAIXA = rgb(0.94, 0.95, 0.97);
const COR_CABECALHO = rgb(0.12, 0.16, 0.27);

// Larguras somam 794pt = A4 paisagem (842pt) menos as margens.
const COLUNAS: Coluna[] = [
  { titulo: "#", largura: 22, valor: (_, i) => String(i + 1) },
  { titulo: "Código", largura: 92, valor: (l) => l.codigo },
  { titulo: "Rota", largura: 58, valor: (l) => l.rota },
  { titulo: "Motorista", largura: 74, valor: (l) => l.motorista },
  { titulo: "Vol.", largura: 30, valor: (l) => l.volume },
  { titulo: "Nr. Entrega", largura: 70, valor: (l) => l.nrEntrega },
  { titulo: "NF", largura: 50, valor: (l) => l.notaFiscal },
  { titulo: "Destinatário", largura: 104, valor: (l) => l.nomePessoa },
  { titulo: "Endereço", largura: 165, valor: (l) => l.endereco },
  { titulo: "Bairro", largura: 82, valor: (l) => l.bairro },
  { titulo: "Prazo", largura: 47, valor: (l) => l.prazo },
];

// Helvetica padrão do pdf-lib só codifica WinAnsi: troca o que não couber.
const SUBSTITUICOES: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", "•": "-", " ": " ",
};

function sanitizar(texto: string): string {
  let saida = "";
  for (const ch of texto.normalize("NFC")) {
    if (SUBSTITUICOES[ch]) saida += SUBSTITUICOES[ch];
    else {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 32 || (code >= 127 && code < 160)) saida += " ";
      else saida += code <= 255 ? ch : "?";
    }
  }
  return saida;
}

function caber(texto: string, fonte: PDFFont, tamanho: number, largura: number): string {
  const limpo = sanitizar(texto);
  if (fonte.widthOfTextAtSize(limpo, tamanho) <= largura) return limpo;
  let corte = limpo;
  while (corte.length > 1 && fonte.widthOfTextAtSize(`${corte}...`, tamanho) > largura) {
    corte = corte.slice(0, -1);
  }
  return `${corte}...`;
}

export async function gerarPdfEntregas(input: {
  titulo: string;
  subtitulo: string;
  linhas: LinhaPdfEntrega[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const fonteBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [largura, altura] = [PageSizes.A4[1], PageSizes.A4[0]]; // paisagem

  const paginas: PDFPage[] = [];
  let pagina: PDFPage;
  let y = 0;

  function novaPagina() {
    pagina = doc.addPage([largura, altura]);
    paginas.push(pagina);
    y = altura - MARGEM;

    if (paginas.length === 1) {
      pagina.drawText(sanitizar(input.titulo), { x: MARGEM, y: y - 12, size: 13, font: fonteBold, color: COR_TEXTO });
      pagina.drawText(sanitizar(input.subtitulo), { x: MARGEM, y: y - 26, size: 8.5, font: fonte, color: COR_SUAVE });
      y -= 38;
    }

    // Cabeçalho da tabela (repetido em toda página)
    pagina.drawRectangle({
      x: MARGEM,
      y: y - ALTURA_LINHA - 2,
      width: largura - 2 * MARGEM,
      height: ALTURA_LINHA + 2,
      color: COR_CABECALHO,
    });
    let x = MARGEM;
    for (const coluna of COLUNAS) {
      pagina.drawText(caber(coluna.titulo, fonteBold, FONTE_CABECALHO, coluna.largura - 4), {
        x: x + 2,
        y: y - ALTURA_LINHA + 1.5,
        size: FONTE_CABECALHO,
        font: fonteBold,
        color: rgb(1, 1, 1),
      });
      x += coluna.largura;
    }
    y -= ALTURA_LINHA + 2;
  }

  novaPagina();

  input.linhas.forEach((linha, i) => {
    if (y - ALTURA_LINHA < MARGEM + 14) novaPagina();
    if (i % 2 === 1) {
      pagina.drawRectangle({
        x: MARGEM,
        y: y - ALTURA_LINHA,
        width: largura - 2 * MARGEM,
        height: ALTURA_LINHA,
        color: COR_FAIXA,
      });
    }
    let x = MARGEM;
    for (const coluna of COLUNAS) {
      pagina.drawText(caber(coluna.valor(linha, i), fonte, FONTE, coluna.largura - 4), {
        x: x + 2,
        y: y - ALTURA_LINHA + 3,
        size: FONTE,
        font: fonte,
        color: COR_TEXTO,
      });
      x += coluna.largura;
    }
    y -= ALTURA_LINHA;
  });

  if (input.linhas.length === 0) {
    paginas[0].drawText("Nenhuma bipagem encontrada.", { x: MARGEM, y: y - 14, size: 9, font: fonte, color: COR_SUAVE });
  }

  paginas.forEach((p, i) => {
    const rodape = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(sanitizar(rodape), {
      x: largura - MARGEM - fonte.widthOfTextAtSize(sanitizar(rodape), 7),
      y: MARGEM - 10,
      size: 7,
      font: fonte,
      color: COR_SUAVE,
    });
  });

  return doc.save();
}
