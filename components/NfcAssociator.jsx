'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Wifi, WifiOff, Loader2, CheckCircle2, Smartphone, AlertTriangle, X, RefreshCw, ScanLine, ExternalLink, Globe, ArrowRight } from 'lucide-react';

export default function NfcAssociator({ motorcycle, onAssociated }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | scanning | success | error
  const [scannedUid, setScannedUid] = useState(null);
  const [writtenUrl, setWrittenUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [controller, setController] = useState(null);
  const [supported, setSupported] = useState(true);
  const [isTelegram, setIsTelegram] = useState(false);

  const publicUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/m/${motorcycle.public_id}` 
    : `/m/${motorcycle.public_id}`;

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

  const returnToTelegram = () => {
    setOpen(false);
    // 1. Tenta di chiudere la scheda di Chrome
    try { window.close(); } catch (e) {}
    // 2. Riapre direttamente l'app Telegram sul tuo bot
    window.location.href = 'tg://resolve?domain=motoDNA_app_bot';
    // Fallback nel caso lo schema tg:// non sia supportato dal browser
    setTimeout(() => {
      window.location.href = 'https://t.me/motoDNA_app_bot';
    }, 400);
  };

  const startScanAndWrite = async () => {
    setPhase('scanning');
    setErrorMsg('');
    setScannedUid(null);

    if (isTelegram || !supported) {
      setPhase('error');
      setErrorMsg('Per scrivere e scansionare i tag NFC è necessario usare Google Chrome su Android.');
      return;
    }

    try {
      const ndef = new window.NDEFReader();
      const ac = new AbortController();
      setController(ac);

      await ndef.scan({ signal: ac.signal });

      ndef.addEventListener('readingerror', () => {
        setPhase('error');
        setErrorMsg('Impossibile comunicare con il tag. Riprova tenendolo fermo contro il telefono.');
      });

      ndef.addEventListener('reading', async (event) => {
        const uid = event.serialNumber || `nfc-${Date.now()}`;
        setScannedUid(uid);

        // 1. SCRITTURA FISICA DEL LINK OSPITE SUL CHIP
        try {
          await ndef.write({
            records: [
              {
                recordType: 'url',
                data: publicUrl,
              }
            ]
          });
          setWrittenUrl(publicUrl);
        } catch (writeErr) {
          console.warn('Avviso scrittura NDEF:', writeErr);
        }

        // 2. ASSOCIAZIONE AL DATABASE
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
          setErrorMsg('Errore durante il salvataggio sul server.');
        }
      });
    } catch (err) {
      setPhase('error');
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Permesso NFC negato da Chrome. Abilitalo nelle impostazioni del sito.');
      } else if (err.name === 'NotSupportedError') {
        setErrorMsg('Il dispositivo non supporta NFC.');
      } else {
        setErrorMsg(err.message || 'Impossibile avviare la scrittura NFC.');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full bg-orange-600 hover:bg-orange-500 h-14 text-base font-semibold">
          <Wifi className="w-5 h-5 mr-2" /> Associa e Scrivi Tag NFC
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-neutral-950 border-white/10 max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-orange-400" />
            Scrivi e Associa Tag NFC
          </DialogTitle>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="p-6 text-center">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-500/20 to-red-600/10 border-2 border-orange-500/30 flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-14 h-14 text-orange-400" strokeWidth={1.2} />
            </div>
            <h3 className="text-xl font-bold mb-2">Pronto a programmare il Tag</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Scriveremo sul portachiavi il link pubblico ospite:
              <br />
              <span className="text-orange-400 font-mono text-[11px] break-all">{publicUrl}</span>
            </p>

            {(!supported || isTelegram) && (
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 text-left mb-4">
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-orange-400">Apri in Google Chrome</div>
                    <p className="text-xs text-neutral-300 mt-1 mb-3">
                      I browser interni non possono scrivere sui chip NFC. Apri la pagina in Chrome per programmare il tag.
                    </p>
                    <Button onClick={openInExternalBrowser} size="sm" className="w-full bg-orange-600 hover:bg-orange-500 font-semibold">
                      <ExternalLink className="w-4 h-4 mr-2" /> Apri in Google Chrome
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={startScanAndWrite} className="w-full h-12 bg-orange-600 hover:bg-orange-500 text-base font-semibold" disabled={!supported}>
              <ScanLine className="w-5 h-5 mr-2" /> Scrivi Link sul Portachiavi
            </Button>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="p-6 text-center">
            <div className="relative w-28 h-28 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full border-4 border-orange-500/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border-4 border-orange-500/50 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Wifi className="w-14 h-14 text-orange-400 animate-pulse" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-xl font-bold mb-1">Tieni il tag vicino al telefono</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Tieni il portachiavi a contatto con il retro del telefono per 2 secondi...
            </p>
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin mx-auto mb-4" />
            <Button variant="ghost" size="sm" onClick={() => { controller?.abort(); setPhase('idle'); }}>
              <X className="w-4 h-4 mr-1" /> Annulla
            </Button>
          </div>
        )}

        {phase === 'success' && (
          <div className="p-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/30 to-green-600/10 border-2 border-emerald-500/50 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(52,211,153,0.5)]">
              <CheckCircle2 className="w-14 h-14 text-emerald-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold mb-1">Portachiavi programmato! 🎉</h3>
            <p className="text-xs text-neutral-300 mb-4">
              Il tag è stato scritto e associato alla tua moto.
            </p>
            <div className="p-3 rounded-lg bg-neutral-900 border border-white/10 mb-4 text-left">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-1">
                <Globe className="w-3.5 h-3.5" /> Link Ospite Attivo:
              </div>
              <div className="text-[11px] mono text-neutral-300 break-all">{publicUrl}</div>
            </div>
            
            {/* Tasto che chiude Chrome e ti riporta subito su Telegram */}
            <Button onClick={returnToTelegram} className="w-full h-12 bg-orange-600 hover:bg-orange-500 font-semibold text-base shadow-lg shadow-orange-600/30">
              Fatto! Torna su Telegram <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {phase === 'error' && (
          <div className="p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <h3 className="text-lg font-bold mb-1">Ops!</h3>
            <p className="text-xs text-neutral-300 mb-4">{errorMsg}</p>
            
            <Button onClick={openInExternalBrowser} className="w-full h-11 bg-orange-600 hover:bg-orange-500 text-sm font-semibold mb-3">
              <ExternalLink className="w-4 h-4 mr-2" /> Apri in Google Chrome
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
