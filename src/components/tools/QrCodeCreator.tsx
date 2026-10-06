import { useEffect, useState } from 'react';
import { QrCode, Download } from 'lucide-react';
import { qrPayload, generateQr, type QrMode } from '@/data/qrTools';
import { ui, useUiLanguage } from '@/i18n/ui';
import { Field } from './LifeToolParts';
import './birthdayQr.css';

export default function QrCodeCreator() {
  useUiLanguage();
  const [value, setValue] = useState(''), [mode, setMode] = useState<QrMode>('link');
  const [result, setResult] = useState<Awaited<ReturnType<typeof generateQr>> | null>(null), [failure, setFailure] = useState<{ payload: string; message: string } | null>(null);
  let payload = '', error = '';
  try { payload = qrPayload(value, mode); } catch (cause) { error = (cause as Error).message; }
  useEffect(() => {
    if (!payload) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void generateQr(payload).then(qr => { if (active) { setResult(qr); setFailure(null); } }).catch(() => { if (active) setFailure({ payload, message: 'Could not create this QR code. Try shorter content.' }); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [payload]);
  const current = !error && result?.payload === payload ? result : null;
  const generationError = failure?.payload === payload ? failure.message : '';
  return <section className="pt-workbench" aria-label={ui('QR Code Creator')}>
    <p className="lt-notice">{ui('Your content stays in this browser. QR codes are generated locally and do not expire.')}</p>
    <div className="qr-workspace"><div className="life-form">
      <Field label="Content type"><select value={mode} onChange={e => setMode(e.target.value as QrMode)}><option value="link">{ui('Website link')}</option><option value="text">{ui('Plain text')}</option></select></Field>
      <Field label={mode === 'link' ? 'Website link' : 'QR content'}><textarea rows={6} maxLength={2000} placeholder={mode === 'link' ? 'https://example.com' : ui('Type your text here')} value={value} onChange={e => setValue(e.target.value)} spellCheck={mode === 'text'} /></Field>
      <p className="lt-storage-note">{new TextEncoder().encode(value).length} / 2,000 {ui('UTF-8 bytes')}</p>
      <p role="status" className={value && (error || generationError) ? 'pt-error' : 'lt-storage-note'}>{ui(error || generationError || (current ? 'Ready to scan' : 'Creating QR code…'))}</p>
      {current && <div className="pt-actions"><a className="lt-button primary" href={current.png} download="pluto-qr-code.png"><Download size={16} aria-hidden="true" />{ui('Download PNG')}</a><a className="lt-button" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(current.svg)}`} download="pluto-qr-code.svg"><Download size={16} aria-hidden="true" />{ui('Download SVG')}</a></div>}
      <p className="lt-storage-note">{ui('Scan the preview with a phone camera. A QR code keeps the exact content you enter; changing a website does not update the code.')}</p>
    </div><div className="qr-preview">{current ? <img src={current.png} alt={ui('QR code preview')} width={1024} height={1024} /> : <div className="qr-placeholder"><QrCode size={96} strokeWidth={1} aria-hidden="true" /><p>{ui('Your QR code will appear here')}</p></div>}</div></div>
  </section>;
}
