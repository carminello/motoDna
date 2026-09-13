'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Send, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import Logo from '@/components/Logo';

export default function AcceptTransferPage({ params }) {
  const { code } = use(params);
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user || null));
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) return; // not logged in, show login prompt
    fetch(`/api/transfer/${code}`).then(r => r.json()).then(d => {
      if (d.error) setError(d.error);
      else setPreview(d);
    });
  }, [user, code]);

  const accept = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/transfer/${code}/accept`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Moto trasferita! Ora è tua.');
      router.push(`/moto/${data.moto.id}`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (user === undefined) return <div className="min-h-screen bg-black flex items-center justify-center text-neutral-500">Caricamento...</div>;

  if (!user) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-5">
      <Card className="metallic p-8 max-w-md text-center">
        <Logo size={48} className="mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Accedi per ricevere la moto</h1>
        <p className="text-sm text-neutral-400 mb-2">Il codice di trasferimento è valido, ma devi prima creare (o accedere a) il tuo account MotoDNA.</p>
        <div className="mono text-orange-400 text-lg my-4 tracking-widest">{code}</div>
        <Link href={`/?redirect=/transfer/${code}`}>
          <Button className="w-full bg-orange-600 hover:bg-orange-500">Accedi / Registrati <ArrowRight className="w-4 h-4 ml-1" /></Button>
        </Link>
      </Card>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-5">
      <Card className="metallic p-8 max-w-md text-center">
        <KeyRound className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Codice non valido</h1>
        <p className="text-sm text-neutral-400 mb-4">{error}</p>
        <div className="mono text-neutral-500 mb-4">{code}</div>
        <Link href="/dashboard"><Button variant="outline" className="w-full">Torna alla dashboard</Button></Link>
      </Card>
    </div>
  );

  if (!preview) return <div className="min-h-screen bg-black flex items-center justify-center text-neutral-500">Caricamento...</div>;

  const { moto, transfer } = preview;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/5 sticky top-0 bg-black/70 backdrop-blur z-40">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <Logo size={26} />
          <span className="font-bold">Ricevi una moto</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="text-xs mono text-orange-400 uppercase tracking-widest mb-2">// Codice ricevuto: {transfer.code}</div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Diventa il nuovo proprietario</h1>
        <p className="text-neutral-400 mb-6">Sta per essere trasferita a te la seguente moto. La sua storia, manutenzione, modifiche e foto ti seguiranno.</p>

        <Card className="metallic overflow-hidden mb-6">
          {moto.main_photo && <div className="relative h-64"><img src={moto.main_photo} alt={moto.model} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" /><Badge className="absolute top-3 left-3 mono bg-black/70 border-white/20">{moto.public_id}</Badge></div>}
          <div className="p-6">
            <div className="text-xs mono uppercase text-neutral-500">{moto.brand}</div>
            <h2 className="text-3xl font-bold tracking-tight">{moto.model}</h2>
            <div className="text-neutral-400 mono mt-1">{moto.year} · {moto.engine_cc}cc · {(moto.current_mileage || 0).toLocaleString('it-IT')} km</div>
            {moto.description && <p className="text-sm text-neutral-300 mt-4 whitespace-pre-wrap">{moto.description}</p>}
          </div>
        </Card>

        <Card className="metallic p-6 mb-6 border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /><h3 className="font-semibold">Cosa succede quando accetti</h3></div>
          <ul className="text-sm text-neutral-400 space-y-1 mt-2 list-disc pl-5">
            <li>Diventi l'unico proprietario e amministratore della moto</li>
            <li>Il vecchio proprietario perde ogni accesso di modifica</li>
            <li>Storia, manutenzione, modifiche, galleria e documenti rimangono</li>
            <li>L'ID MotoDNA <span className="mono text-orange-400">{moto.public_id}</span> e il tag NFC restano gli stessi</li>
            <li>Il passaggio viene registrato nello storico proprietà</li>
          </ul>
        </Card>

        <div className="flex gap-3">
          <Link href="/dashboard" className="flex-1"><Button variant="outline" className="w-full">Non ora</Button></Link>
          <Button onClick={accept} disabled={busy} className="flex-1 bg-orange-600 hover:bg-orange-500">
            {busy ? 'Trasferimento...' : 'Accetta e prendi in carico'} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
