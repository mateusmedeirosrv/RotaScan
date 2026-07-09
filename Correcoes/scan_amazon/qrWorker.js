self.importScripts('https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js');

self.onmessage = async (e) => {
  const { codigo } = e.data;

  try {
    const url = await QRCode.toDataURL(codigo, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: "L"
    });

    const base64 = url.split(",")[1];

    self.postMessage({
      ok: true,
      codigo,
      base64
    });

  } catch (err) {
    self.postMessage({
      ok: false,
      codigo
    });
  }
};