import { requireAuth } from "@/lib/auth/guards";
import { QrCodeGenerator } from "./qrcode-generator";

export default async function QrCodePage() {
  await requireAuth();

  return (
    <main className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Gerar etiquetas QR Code</h1>
      <p className="text-sm text-muted-foreground">
        Cole ou digite os códigos (um por linha) para gerar um PDF A4 com etiquetas de
        21,0 × 38,2 mm — útil para re-etiquetar encomendas com etiqueta original danificada.
      </p>
      <QrCodeGenerator />
    </main>
  );
}
