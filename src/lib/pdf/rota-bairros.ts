import { PDFDocument, PageSizes, StandardFonts } from "pdf-lib";

const MM = 2.834645669;
const MARGEM_ESQUERDA_MM = 28;
const MARGEM_SUPERIOR_MM = 30;
const MARGEM_DIREITA_MM = 15;
const MARGEM_INFERIOR_MM = 15;
const FATOR_ESPACAMENTO = 1.7;
const FONTE_MAX_PT = 56;
const FONTE_MIN_PT = 8;

// Gera 1 folha A4 (retrato) com os nomes dos bairros da rota, um por linha,
// em fonte grande e espaçamento generoso para leitura à distância (etiqueta
// de palete). O tamanho da fonte é calculado a partir da quantidade de
// bairros para que todos caibam numa única página, sem quebrar para a
// próxima — quanto menos bairros, maiores as letras.
export async function gerarPdfBairrosRota(nomesBairros: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const [pageWidth, pageHeight] = PageSizes.A4;
  const page = doc.addPage([pageWidth, pageHeight]);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);

  const nomes = nomesBairros.map((nome) => nome.toUpperCase());
  if (nomes.length === 0) return doc.save();

  const margemEsquerda = MARGEM_ESQUERDA_MM * MM;
  const margemSuperior = MARGEM_SUPERIOR_MM * MM;
  const larguraDisponivel = pageWidth - margemEsquerda - MARGEM_DIREITA_MM * MM;
  const alturaDisponivel = pageHeight - margemSuperior - MARGEM_INFERIOR_MM * MM;

  let fontSize = Math.min(FONTE_MAX_PT, alturaDisponivel / (nomes.length * FATOR_ESPACAMENTO));
  while (fontSize > FONTE_MIN_PT) {
    const maiorLargura = Math.max(...nomes.map((nome) => fonte.widthOfTextAtSize(nome, fontSize)));
    if (maiorLargura <= larguraDisponivel) break;
    fontSize -= 0.5;
  }

  const alturaLinha = fontSize * FATOR_ESPACAMENTO;
  const topo = pageHeight - margemSuperior;

  nomes.forEach((nome, i) => {
    const y = topo - (i + 1) * alturaLinha + (alturaLinha - fontSize) / 2;
    page.drawText(nome, { x: margemEsquerda, y, size: fontSize, font: fonte });
  });

  return doc.save();
}
