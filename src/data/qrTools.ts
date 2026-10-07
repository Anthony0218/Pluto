export type QrMode = 'link' | 'text';
export function qrPayload(value: string, mode: QrMode): string {
  const payload = mode === 'link' ? value.trim() : value;
  if (!payload.trim()) throw Error('Enter a link or text to create a QR code.');
  if (new TextEncoder().encode(payload).length > 2000) throw Error('This content is too long. Use up to 2,000 UTF-8 bytes.');
  if (mode === 'link') {
    let url: URL;
    try { url = new URL(payload); } catch { throw Error('Enter a complete web address starting with https:// or http://.'); }
    if (!['https:', 'http:'].includes(url.protocol)) throw Error('Enter a complete web address starting with https:// or http://.');
  }
  return payload;
}
export async function generateQr(payload: string) {
  const QRCode = (await import('qrcode')).default;
  const options = { errorCorrectionLevel: 'M' as const, margin: 4, width: 1024, color: { dark: '#000000', light: '#ffffff' } };
  const [svg, png] = await Promise.all([QRCode.toString(payload, { ...options, type: 'svg' }), QRCode.toDataURL(payload, options)]);
  return { payload, svg, png };
}

export function downloadQr(qr: Awaited<ReturnType<typeof generateQr>>, format: 'png' | 'svg') {
  const file = format === 'svg'
    ? new Blob([qr.svg], { type: 'image/svg+xml;charset=utf-8' })
    : new Blob([Uint8Array.from(atob(qr.png.split(',')[1]), byte => byte.charCodeAt(0))], { type: 'image/png' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pluto-qr-code.${format}`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
