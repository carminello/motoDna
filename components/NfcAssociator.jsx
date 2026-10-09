
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Wifi, WifiOff, Loader2, CheckCircle2, Smartphone, AlertTriangle, X, RefreshCw, ScanLine, ExternalLink } from 'lucide-react';

export default function NfcAssociator({ motorcycle, onAssociated }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [scannedUid, setScannedUid] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [controller, setController] = useState(null);
  const [supported, setSupported] = useState(true);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTg = Boolean(
        window.Telegram?.WebApp?.initData || 
        navigator.userAgent.includes('Telegram')
      );
      setIsTelegram(isTg);
      setSupported('NDEFReader' in window && !isTg);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      if (controller) controller.abort();
      setPhase('idle');
      setScannedUid(null);
      setErrorMsg('');
    }
  }, [open]);

  const openInExternalBrowser = () => {
    if (typeof window !== 'undefined') {
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(window.location.href);
      } else {
        window.open(window.location.href, '_system');
      }
    }
  };

  const startScan = async () => {
    setPhase('scanning');
    setErrorMsg('');
    setScannedUid(null);

    if (isTelegram || !supported) {
      setPhase('error');
      setErrorMsg('Per scansionare i tag NFC dal telefono è necessario aprire la pagina con Google Chrome.');
      return;
    }

    try {
      const ndef = new window.NDEFReader();
      const ac = new AbortController();
      setController(ac);
      await ndef.scan({ signal: ac.signal });
      ndef.addEventListener('readingerror', () => {
        setPhase('error');
        setErrorMsg('Impossibile leggere il tag. Riprova avvicinando il telefono.');
      });
      ndef.addEventListener('reading', async (event) => {
        const uid = event.serialNumber || `nfc-${Date.now()}`;
        setScannedUid(uid);
        try {
          const res = await fetch(`/api/motorcycles/${motorcycle.id}/nfc/associate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag_uid: uid }),
          });
          const data = await res.json();
          if (!res.ok) {
            setPhase('error');
            setErrorMsg(data.error || 'Associazione non riuscita');
            return;
          }
          setPhase('success');
          onAssociated?.(data);
          ac.abort();
        } catch (e) {
          setPhase('error');
          setErrorMsg('Errore di rete durante l\'associazione');
        }
      });
    } catch (err) {
      setPhase('error');
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Permesso NFC negato dal browser.');
      } else if (err.name === 'NotSupportedError') {
        setErrorMsg('Il tuo dispositivo non supporta NFC.');
      } else {
        setErrorMsg(err.message || 'Impossibile avviare lo scan NFC');
      }
    }
  };

  const finishWithManual = async (manualUid) => {
    if (!manualUid?.trim()) return;
    try {
      const res = await fetch(`/api/motorcycles/${motorcycle.id}/nfc/associate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_uid: manualUid.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase('error');
        setErrorMsg(data.error || 'Associazione non riuscita');
        return;
      }
      setScannedUid(manualUid.trim());
      setPhase('success');
      onAssociated?.(data);
    } catch (e) {
      setPhase('error');
      setErrorMsg('Errore di rete');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full bg-orange-600 hover:bg-orange-500 h-14 text-base font-semibold">
          <Wifi className="w-5 h-5 mr-2" /> Associa Tag NFC
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-neutral-950 border-white/10 max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-orange-400" />
            Associa Tag NFC
          </DialogTitle>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="p-6 text-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-500/20 to-red-600/10 border-2 border-orange-500/30 flex items-center justify-center mx-auto mb-6">
              <Smartphone className="w-16 h-16 text-orange-400" strokeWidth={1.2} />
            </div>
            <h3 className="text-xl font-bold mb-2">Pronto ad associare</h3>
            <p className="text-sm text-neutral-400 mb-6">
              Avvicina il tag NFC alla parte posteriore del telefono.
            </p>

            {/* BOX AVVISO E PULSANTE CHROME SEMPRE PRESENTE SE NON È CHROME DIRETTO */}
            {(!supported || isTelegram) && (
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 text-left mb-4">
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-orange-400">Serve Google Chrome</div>
                    <p className="text-xs text-neutral-300 mt-1 mb-3">
                      I browser interni non possono leggere i tag NFC. Apri questa pagina in Chrome per completare l'associazione.
                    </p>
                    <Button onClick={openInExternalBrowser} size="sm" className="w-full bg-orange-600 hover:bg-orange-500 font-semibold">
                      <ExternalLink className="w-4 h-4 mr-2" /> Apri in Google Chrome
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={startScan} className="w-full h-12 bg-orange-600 hover:bg-orange-500 text-base font-semibold" disabled={!supported}>
              <ScanLine className="w-5 h-5 mr-2" /> Avvia scansione NFC
            </Button>

            {(!supported || isTelegram) && (
              <ManualFallback onSubmit={finishWithManual} />
            )}
          </div>
        )}

        {phase === 'scanning' && (
          <div className="p-6 text-center">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-orange-500/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border-4 border-orange-500/50 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Wifi className="w-16 h-16 text-orange-400 animate-pulse" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2">Avvicina il tag NFC</h3>
            <p className="text-sm text-neutral-400 mb-6">Tieni il telefono vicino al tag NFC...</p>
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin mx-auto" />
            <Button variant="ghost" size="sm" className="mt-6" onClick={() => { controller?.abort(); setPhase('idle'); }}>
              <X className="w-4 h-4 mr-1" /> Annulla
            </Button>
          </div>
        )}

        {phase === 'success' && (
          <div className="p-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500/30 to-green-600/10 border-2 border-emerald-500/50 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(52,211,153,0.6)]">
              <CheckCircle2 className="w-20 h-20 text-emerald-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-bold mb-1">Tag NFC associato</h3>
            <p className="text-sm text-neutral-400 mb-6">Tag collegato con successo a:</p>
            <div className="p-4 rounded-xl metallic mb-4">
              <div className="text-xs mono uppercase text-neutral-500">{motorcycle.brand}</div>
              <div className="text-lg font-bold">{motorcycle.model}</div>
              <div className="text-xs mono text-orange-400 mt-2">{motorcycle.public_id}</div>
              {scannedUid && <div className="text-[10px] mono text-neutral-500 mt-1 break-all">UID: {scannedUid}</div>}
            </div>
            <Button onClick={() => setOpen(false)} className="w-full h-12 bg-orange-600 hover:bg-orange-500 text-base font-semibold">
              Perfetto!
            </Button>
          </div>
        )}

        {phase === 'error' && (
          <div className="p-6 text-center">
            <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">NFC su Telegram</h3>
            <p className="text-sm text-neutral-300 mb-6">{errorMsg}</p>
            
            <Button onClick={openInExternalBrowser} className="w-full h-12 bg-orange-600 hover:bg-orange-500 text-base font-semibold mb-3">
              <ExternalLink className="w-5 h-5 mr-2" /> Apri in Google Chrome
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Chiudi</Button>
              <Button className="flex-1 bg-neutral-800 hover:bg-neutral-700" onClick={() => setPhase('idle')}>
                <RefreshCw className="w-4 h-4 mr-1" /> Riprova
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManualFallback({ onSubmit }) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');
  if (!show) return (
    <button type="button" onClick={() => setShow(true)} className="mt-4 text-xs text-neutral-500 hover:text-orange-400 underline">
      Inserisci UID manualmente
    </button>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(value); }} className="mt-4 space-y-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="04:aa:bb:cc:dd:ee:ff" className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-sm mono focus:border-orange-500 focus:outline-none" autoFocus />
      <Button type="submit" size="sm" className="w-full bg-orange-600 hover:bg-orange-500">Associa</Button>
    </form>
  );
}
