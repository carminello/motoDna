'use client';
import { useEffect, useState, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Wrench, Clock, Sparkles, Image as Img, FileText, Wifi, Plus, ExternalLink, Copy, RefreshCw, Bell, Camera } from 'lucide-react';
import Logo from '@/components/Logo';
import ImageUploader from '@/components/ImageUploader';

const MAINT_TYPES = ['ENGINE','OIL','FILTER','BRAKES','TYRES','CHAIN','BATTERY','ELECTRICAL','SUSPENSION','CARBURATION','COOLING','EXHAUST','BODYWORK','OTHER'];
const EVENT_TYPES = ['PURCHASE','RESTORATION','MAINTENANCE','MODIFICATION','ACCIDENT','TRIP','RACE','MEETUP','MILESTONE','OTHER'];
const MOD_CATS = ['ENGINE','EXHAUST','SUSPENSION','BRAKES','ELECTRICAL','BODY','LIGHTING','WHEELS','TYRES','CONTROLS','SEAT','OTHER'];
const DOC_TYPES = ['INVOICE','RECEIPT','MANUAL','CERTIFICATE','SERVICE_DOCUMENT','RESTORATION_DOCUMENT','OTHER'];

export default function MotoPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState(null);

  const load = () => fetch(`/api/motorcycles/${id}`).then(r => r.json()).then(d => {
    if (d.error) { toast.error(d.error); router.push('/dashboard'); return; }
    setData(d);
  });

  useEffect(() => { load(); }, [id]);

  if (!data) return <div className="min-h-screen bg-black flex items-center justify-center text-neutral-500">Caricamento...</div>;
  const { moto, maintenance, timeline, modifications, gallery, documents, reminders, nfc } = data;

  const publicUrl = `${window.location.origin}/m/${moto.public_id}`;

  const post = async (kind, payload) => {
    const res = await fetch(`/api/motorcycles/${id}/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await res.json();
    if (!res.ok) { toast.error(j.error); return null; }
    toast.success('Aggiunto');
    load();
    return j.item;
  };

  const regenNfc = async () => {
    const res = await fetch(`/api/motorcycles/${id}/nfc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (res.ok) { toast.success('Nuovo tag NFC generato'); load(); }
  };

  const updateMoto = async (patch) => {
    const res = await fetch(`/api/motorcycles/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (res.ok) { toast.success('Aggiornato'); load(); }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <header className="border-b border-white/5 sticky top-0 bg-black/70 backdrop-blur z-40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <Logo size={26} />
          <div className="flex-1">
            <div className="text-xs mono text-neutral-500 uppercase">{moto.brand}</div>
            <div className="font-bold tracking-tight leading-none">{moto.model}</div>
          </div>
          <a href={`/m/${moto.public_id}`} target="_blank" rel="noopener">
            <Button size="sm" variant="outline" className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10"><ExternalLink className="w-3 h-3 mr-1" /> Profilo pubblico</Button>
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="relative h-64 md:h-80 overflow-hidden group">
        {moto.main_photo && <img src={moto.main_photo} className="w-full h-full object-cover" alt={moto.model} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <ChangeMainPhoto currentUrl={moto.main_photo} onChange={(url) => updateMoto({ main_photo: url })} />
        <div className="absolute bottom-0 left-0 right-0 max-w-6xl mx-auto px-5 pb-6">
          <Badge className="bg-black/70 mono border-white/20 mb-2">{moto.public_id}</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{moto.brand} {moto.model}</h1>
          <div className="flex gap-4 mt-2 text-sm text-neutral-300 mono">
            <span>{moto.year}</span><span>·</span><span>{moto.engine_cc}cc</span><span>·</span><span>{(moto.current_mileage || 0).toLocaleString('it-IT')} km</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 pt-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-neutral-900 w-full overflow-x-auto flex justify-start">
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="maintenance"><Wrench className="w-3 h-3 mr-1" />Manutenzione</TabsTrigger>
            <TabsTrigger value="timeline"><Clock className="w-3 h-3 mr-1" />Timeline</TabsTrigger>
            <TabsTrigger value="modifications"><Sparkles className="w-3 h-3 mr-1" />Modifiche</TabsTrigger>
            <TabsTrigger value="gallery"><Img className="w-3 h-3 mr-1" />Galleria</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="w-3 h-3 mr-1" />Documenti</TabsTrigger>
            <TabsTrigger value="nfc"><Wifi className="w-3 h-3 mr-1" />NFC</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 grid md:grid-cols-2 gap-4">
            <Card className="metallic p-6">
              <h3 className="text-lg font-semibold mb-4">Scheda tecnica</h3>
              <dl className="space-y-2 text-sm">
                {[['Marca', moto.brand], ['Modello', moto.model], ['Versione', moto.version], ['Anno', moto.year], ['Cilindrata', moto.engine_cc + ' cc'], ['Motore', moto.engine_type], ['Colore', moto.color], ['Km attuali', (moto.current_mileage || 0).toLocaleString('it-IT')]].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-white/5 py-2">
                    <dt className="text-neutral-500 mono uppercase text-xs">{k}</dt>
                    <dd className="font-medium">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <div className="space-y-4">
              <Card className="metallic p-6">
                <div className="flex items-center gap-2 mb-2"><Wifi className="w-4 h-4 text-orange-400" /><h3 className="font-semibold">Tag NFC attivo</h3></div>
                <div className="text-xs mono text-neutral-500 uppercase mt-2">Scansioni totali</div>
                <div className="text-3xl font-bold">{nfc?.scan_count || 0}</div>
                <div className="mt-3 p-3 bg-black/50 rounded-lg text-xs mono break-all text-neutral-400">{publicUrl}</div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Copiato'); }}><Copy className="w-3 h-3 mr-1" />Copia URL</Button>
                </div>
              </Card>
              <Card className="metallic p-6">
                <h3 className="font-semibold mb-3">Descrizione</h3>
                <p className="text-sm text-neutral-300 whitespace-pre-wrap">{moto.description || 'Nessuna descrizione'}</p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-6">
            <SectionHeader title="Interventi di manutenzione">
              <AddDialog title="Nuovo intervento" onSubmit={(v) => post('maintenance', v)} fields={[
                { name: 'title', label: 'Titolo', required: true },
                { name: 'service_type', label: 'Categoria', type: 'select', options: MAINT_TYPES },
                { name: 'date', label: 'Data', type: 'date' },
                { name: 'mileage', label: 'Km', type: 'number' },
                { name: 'cost', label: 'Costo €', type: 'number' },
                { name: 'description', label: 'Descrizione', type: 'textarea' },
              ]} />
            </SectionHeader>
            <div className="space-y-3">
              {maintenance.map(m => (
                <Card key={m.id} className="metallic p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2"><Badge variant="outline" className="mono text-[10px]">{m.service_type}</Badge><span className="font-semibold">{m.title}</span></div>
                    <div className="text-sm text-neutral-400 mt-1">{m.description}</div>
                    <div className="text-xs mono text-neutral-500 mt-2">{new Date(m.date).toLocaleDateString('it-IT')} · {(m.mileage || 0).toLocaleString('it-IT')} km · €{m.cost}</div>
                  </div>
                  {m.verified && <Badge className="bg-emerald-500/20 text-emerald-400">✓ Certificato</Badge>}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <SectionHeader title="Timeline della moto">
              <AddDialog title="Nuovo evento" onSubmit={(v) => post('timeline', v)} fields={[
                { name: 'title', label: 'Titolo', required: true },
                { name: 'event_type', label: 'Tipo', type: 'select', options: EVENT_TYPES },
                { name: 'event_date', label: 'Data', type: 'date' },
                { name: 'mileage', label: 'Km', type: 'number' },
                { name: 'description', label: 'Descrizione', type: 'textarea' },
              ]} />
            </SectionHeader>
            <div className="relative border-l-2 border-orange-500/30 ml-3 pl-8 space-y-6">
              {timeline.map(t => (
                <div key={t.id} className="relative">
                  <div className="absolute -left-[41px] w-4 h-4 rounded-full bg-orange-500 border-4 border-black" />
                  <Card className="metallic p-4">
                    <div className="flex items-center gap-2 mb-1"><Badge variant="outline" className="mono text-[10px]">{t.event_type}</Badge><span className="text-xs text-neutral-500 mono">{new Date(t.event_date).toLocaleDateString('it-IT')}</span></div>
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-sm text-neutral-400 mt-1">{t.description}</div>
                  </Card>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="modifications" className="mt-6">
            <SectionHeader title="Modifiche">
              <AddDialog title="Nuova modifica" onSubmit={(v) => post('modifications', v)} fields={[
                { name: 'name', label: 'Nome', required: true },
                { name: 'category', label: 'Categoria', type: 'select', options: MOD_CATS },
                { name: 'brand', label: 'Marca' },
                { name: 'model', label: 'Modello' },
                { name: 'installation_date', label: 'Data installazione', type: 'date' },
                { name: 'installation_mileage', label: 'Km', type: 'number' },
                { name: 'cost', label: 'Costo €', type: 'number' },
                { name: 'description', label: 'Descrizione', type: 'textarea' },
              ]} />
            </SectionHeader>
            <div className="grid md:grid-cols-2 gap-3">
              {modifications.map(m => (
                <Card key={m.id} className="metallic p-4">
                  <Badge variant="outline" className="mono text-[10px] mb-2">{m.category}</Badge>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-xs text-neutral-500 mono mb-2">{m.brand} {m.model}</div>
                  <div className="text-sm text-neutral-400">{m.description}</div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <SectionHeader title="Galleria">
              <AddDialog title="Aggiungi foto" onSubmit={(v) => post('gallery', v)} fields={[
                { name: 'file_url', label: 'Immagine', required: true, type: 'upload' },
                { name: 'caption', label: 'Didascalia' },
                { name: 'category', label: 'Categoria', type: 'select', options: ['PROFILE','RESTORATION','MAINTENANCE','MODIFICATION','TRIP','MEETUP','BEFORE_AFTER','OTHER'] },
              ]} />
            </SectionHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {gallery.map(g => (
                <div key={g.id} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-900 group">
                  <img src={g.file_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt={g.caption} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 text-xs text-white">{g.caption}</div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <SectionHeader title="Documenti (privati)">
              <AddDialog title="Aggiungi documento" onSubmit={(v) => post('documents', v)} fields={[
                { name: 'title', label: 'Titolo', required: true },
                { name: 'document_type', label: 'Tipo', type: 'select', options: DOC_TYPES },
                { name: 'file_url', label: 'File (PDF o immagine)', type: 'upload', accept: 'image/*,application/pdf' },
                { name: 'document_date', label: 'Data', type: 'date' },
              ]} />
            </SectionHeader>
            <div className="space-y-2">
              {documents.length === 0 && <p className="text-sm text-neutral-500">Nessun documento caricato. I documenti sono privati per default.</p>}
              {documents.map(d => (
                <Card key={d.id} className="metallic p-3 flex items-center justify-between">
                  <div><Badge variant="outline" className="mono text-[10px] mr-2">{d.document_type}</Badge><span className="font-medium">{d.title}</span></div>
                  <span className="text-xs text-neutral-500 mono">{d.document_date ? new Date(d.document_date).toLocaleDateString('it-IT') : ''}</span>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="nfc" className="mt-6">
            <Card className="metallic p-6">
              <div className="flex items-center gap-2 mb-4"><Wifi className="w-5 h-5 text-orange-400" /><h3 className="text-lg font-semibold">Configurazione tag NFC</h3></div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs mono uppercase text-neutral-500">Public ID MotoDNA</div>
                  <div className="text-2xl font-bold mono text-orange-400 my-2">{moto.public_id}</div>
                  <div className="text-xs mono uppercase text-neutral-500 mt-4">Tag UID</div>
                  <div className="mono text-neutral-300">{nfc?.tag_uid || 'nessuno'}</div>
                  <div className="text-xs mono uppercase text-neutral-500 mt-4">Stato</div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 mt-1">{nfc?.status || 'INATTIVO'}</Badge>
                </div>
                <div>
                  <div className="text-xs mono uppercase text-neutral-500">URL da scrivere sul tag NFC</div>
                  <div className="p-3 mt-2 bg-black/60 rounded-lg text-sm mono break-all text-orange-300 border border-orange-500/20">{publicUrl}</div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Button size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Copiato'); }}><Copy className="w-3 h-3 mr-1" />Copia URL</Button>
                    <Button size="sm" variant="outline" onClick={regenNfc}><RefreshCw className="w-3 h-3 mr-1" />Sostituisci tag</Button>
                  </div>
                  <p className="text-xs text-neutral-500 mt-4">Scrivi questo URL sul tuo tag NFC usando un&apos;app come NFC Tools. Chi lo scansiona vede solo i dati pubblici.</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="text-xs mono uppercase text-neutral-500">Scansioni registrate</div>
                <div className="text-4xl font-bold">{nfc?.scan_count || 0}</div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ChangeMainPhoto({ currentUrl, onChange }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const handle = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.url);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handle(e.target.files?.[0])} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="absolute top-3 right-3 z-10 bg-black/70 backdrop-blur border border-white/20 hover:border-orange-500/50 rounded-lg px-3 py-2 text-xs flex items-center gap-1 transition">
        <Camera className="w-3 h-3" /> {busy ? 'Caricamento...' : 'Cambia foto'}
      </button>
    </>
  );
}

function SectionHeader({ title, children }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function AddDialog({ title, onSubmit, fields }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    const result = await onSubmit(values);
    if (result !== null) { setOpen(false); setValues({}); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="bg-orange-600 hover:bg-orange-500"><Plus className="w-4 h-4 mr-1" />Aggiungi</Button></DialogTrigger>
      <DialogContent className="bg-neutral-950 border-white/10">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 max-h-[70vh] overflow-y-auto">
          {fields.map(f => (
            <div key={f.name}>
              <Label>{f.label}{f.required && ' *'}</Label>
              {f.type === 'upload' ? (
                <ImageUploader accept={f.accept || 'image/*'} label="Carica" currentUrl={values[f.name]} onUploaded={(u) => setValues({ ...values, [f.name]: u.url })} />
              ) : f.type === 'textarea' ? (
                <Textarea value={values[f.name] || ''} onChange={e => setValues({ ...values, [f.name]: e.target.value })} rows={3} />
              ) : f.type === 'select' ? (
                <Select value={values[f.name] || ''} onValueChange={(v) => setValues({ ...values, [f.name]: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>{f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input type={f.type || 'text'} required={f.required} placeholder={f.placeholder} value={values[f.name] || ''} onChange={e => setValues({ ...values, [f.name]: e.target.value })} />
              )}
            </div>
          ))}
          <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-500">Salva</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
