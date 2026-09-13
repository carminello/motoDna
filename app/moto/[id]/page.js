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
import { ArrowLeft, Wrench, Clock, Sparkles, Image as Img, FileText, Wifi, Plus, ExternalLink, Copy, RefreshCw, Bell, Camera, Trash2, Edit3, Eye, EyeOff, Settings, Gauge, Pencil, MessageSquare } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import Logo from '@/components/Logo';
import ImageUploader from '@/components/ImageUploader';
import IconSelect from '@/components/IconSelect';
import { MAINTENANCE_ICONS, TIMELINE_ICONS, MODIFICATION_ICONS, GALLERY_ICONS, DOCUMENT_ICONS } from '@/lib/categoryIcons';

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
  const { moto, maintenance, timeline, modifications, gallery, documents, reminders, nfc, postits = [] } = data;

  const publicUrl = `${window.location.origin}/m/${moto.public_id}`;

  const post = async (kind, payload) => {
    const res = await fetch(`/api/motorcycles/${id}/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await res.json();
    if (!res.ok) { toast.error(j.error); return null; }
    toast.success('Aggiunto');
    load();
    return j.item;
  };

  const del = async (kind, itemId) => {
    if (!confirm('Eliminare definitivamente questo elemento?')) return;
    const res = await fetch(`/api/motorcycles/${id}/${kind}/${itemId}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Eliminato'); load(); }
  };

  const patch = async (kind, itemId, updates) => {
    const res = await fetch(`/api/motorcycles/${id}/${kind}/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    if (res.ok) { load(); }
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
          <div className="flex gap-4 mt-2 text-sm text-neutral-300 mono items-center">
            <span>{moto.year}</span><span>·</span><span>{moto.engine_cc}cc</span><span>·</span>
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-orange-400" />
              <span>{(moto.current_mileage || 0).toLocaleString('it-IT')} km</span>
              <QuickKmUpdate current={moto.current_mileage || 0} onSave={(km) => updateMoto({ current_mileage: km })} variant="hero" />
            </span>
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
            <TabsTrigger value="bacheca"><MessageSquare className="w-3 h-3 mr-1" />Bacheca {postits.length > 0 && <Badge className="ml-1 bg-orange-500/20 text-orange-400 text-[9px] px-1">{postits.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="nfc"><Wifi className="w-3 h-3 mr-1" />NFC</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 grid md:grid-cols-2 gap-4">
            <Card className="metallic p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Scheda tecnica</h3>
                <EditMotoDialog moto={moto} onSave={updateMoto} trigger={<Button size="sm" variant="outline"><Edit3 className="w-3 h-3 mr-1" />Modifica</Button>} />
              </div>
              <dl className="space-y-2 text-sm">
                {[['Marca', moto.brand], ['Modello', moto.model], ['Versione', moto.version], ['Anno', moto.year], ['Cilindrata', moto.engine_cc + ' cc'], ['Motore', moto.engine_type], ['Colore', moto.color]].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-white/5 py-2">
                    <dt className="text-neutral-500 mono uppercase text-xs">{k}</dt>
                    <dd className="font-medium">{v || '—'}</dd>
                  </div>
                ))}
                <div className="flex justify-between items-center border-b border-white/5 py-2">
                  <dt className="text-neutral-500 mono uppercase text-xs">Km attuali</dt>
                  <dd className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-base text-orange-400">{(moto.current_mileage || 0).toLocaleString('it-IT')}</span>
                    <QuickKmUpdate current={moto.current_mileage || 0} onSave={(km) => updateMoto({ current_mileage: km })} />
                  </dd>
                </div>
              </dl>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs mono uppercase text-neutral-500">Profilo pubblico</div>
                  <div className="text-xs text-neutral-400">{moto.public_profile ? 'Visibile a chi scansiona il tag NFC' : 'Nascosto - solo tu vedi la moto'}</div>
                </div>
                <Switch checked={moto.public_profile} onCheckedChange={(v) => updateMoto({ public_profile: v })} />
              </div>
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Descrizione</h3>
                  <EditableDescription current={moto.description} onSave={(v) => updateMoto({ description: v })} />
                </div>
                <p className="text-sm text-neutral-300 whitespace-pre-wrap">{moto.description || <span className="text-neutral-500 italic">Nessuna descrizione. Clicca "Modifica" per raccontare la storia della tua moto.</span>}</p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-6">
            <SectionHeader title="Interventi di manutenzione">
              <AddDialog title="Nuovo intervento" onSubmit={(v) => post('maintenance', v)} fields={[
                { name: 'title', label: 'Titolo', required: true },
                { name: 'service_type', label: 'Categoria', type: 'iconselect', options: MAINTENANCE_ICONS },
                { name: 'date', label: 'Data', type: 'date' },
                { name: 'mileage', label: 'Km', type: 'number' },
                { name: 'cost', label: 'Costo €', type: 'number' },
                { name: 'description', label: 'Descrizione', type: 'textarea' },
              ]} />
            </SectionHeader>
            <div className="space-y-3">
              {maintenance.map(m => (
                <Card key={m.id} className="metallic p-4 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><Badge variant="outline" className="mono text-[10px]">{m.service_type}</Badge><span className="font-semibold">{m.title}</span></div>
                    <div className="text-sm text-neutral-400 mt-1">{m.description}</div>
                    <div className="text-xs mono text-neutral-500 mt-2">{new Date(m.date).toLocaleDateString('it-IT')} · {(m.mileage || 0).toLocaleString('it-IT')} km · €{m.cost}</div>
                  </div>
                  <ItemActions isPublic={m.is_public} onToggle={(v) => patch('maintenance', m.id, { is_public: v })} onDelete={() => del('maintenance', m.id)} />
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <SectionHeader title="Timeline della moto">
              <AddDialog title="Nuovo evento" onSubmit={(v) => post('timeline', v)} fields={[
                { name: 'title', label: 'Titolo', required: true },
                { name: 'event_type', label: 'Tipo', type: 'iconselect', options: TIMELINE_ICONS },
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1"><Badge variant="outline" className="mono text-[10px]">{t.event_type}</Badge><span className="text-xs text-neutral-500 mono">{new Date(t.event_date).toLocaleDateString('it-IT')}</span></div>
                        <div className="font-semibold">{t.title}</div>
                        <div className="text-sm text-neutral-400 mt-1">{t.description}</div>
                      </div>
                      <ItemActions isPublic={t.is_public} onToggle={(v) => patch('timeline', t.id, { is_public: v })} onDelete={() => del('timeline', t.id)} />
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="modifications" className="mt-6">
            <SectionHeader title="Modifiche">
              <AddDialog title="Nuova modifica" onSubmit={(v) => post('modifications', v)} fields={[
                { name: 'name', label: 'Nome', required: true },
                { name: 'category', label: 'Categoria', type: 'iconselect', options: MODIFICATION_ICONS },
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Badge variant="outline" className="mono text-[10px] mb-2">{m.category}</Badge>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-neutral-500 mono mb-2">{m.brand} {m.model}</div>
                      <div className="text-sm text-neutral-400">{m.description}</div>
                    </div>
                    <ItemActions isPublic={m.is_public} onToggle={(v) => patch('modifications', m.id, { is_public: v })} onDelete={() => del('modifications', m.id)} />
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <SectionHeader title="Galleria">
              <AddDialog title="Aggiungi foto" onSubmit={(v) => post('gallery', v)} fields={[
                { name: 'file_url', label: 'Immagine', required: true, type: 'upload' },
                { name: 'caption', label: 'Didascalia' },
                { name: 'category', label: 'Categoria', type: 'iconselect', options: GALLERY_ICONS },
              ]} />
            </SectionHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {gallery.map(g => (
                <div key={g.id} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-900 group">
                  <img src={g.file_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt={g.caption} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => patch('gallery', g.id, { is_public: !g.is_public })} className="p-1.5 rounded-md bg-black/70 hover:bg-black text-white" title={g.is_public ? 'Rendi privata' : 'Rendi pubblica'}>
                      {g.is_public ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-400" />}
                    </button>
                    <button onClick={() => del('gallery', g.id)} className="p-1.5 rounded-md bg-red-600/90 hover:bg-red-500 text-white" title="Elimina">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {!g.is_public && <Badge className="absolute top-2 left-2 bg-black/70 text-neutral-400 text-[10px]"><EyeOff className="w-2.5 h-2.5 mr-1" />PRIVATA</Badge>}
                  <div className="absolute bottom-2 left-2 text-xs text-white">{g.caption}</div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <SectionHeader title="Documenti (privati)">
              <AddDialog title="Aggiungi documento" onSubmit={(v) => post('documents', v)} fields={[
                { name: 'title', label: 'Titolo', required: true },
                { name: 'document_type', label: 'Tipo', type: 'iconselect', options: DOCUMENT_ICONS },
                { name: 'file_url', label: 'File (PDF o immagine)', type: 'upload', accept: 'image/*,application/pdf' },
                { name: 'document_date', label: 'Data', type: 'date' },
              ]} />
            </SectionHeader>
            <div className="space-y-2">
              {documents.length === 0 && <p className="text-sm text-neutral-500">Nessun documento caricato. I documenti sono privati per default.</p>}
              {documents.map(d => (
                <Card key={d.id} className="metallic p-3 flex items-center justify-between gap-3">
                  <div className="flex-1"><Badge variant="outline" className="mono text-[10px] mr-2">{d.document_type}</Badge><span className="font-medium">{d.title}</span></div>
                  <div className="flex items-center gap-2">
                    {d.file_url && <a href={d.file_url} target="_blank" rel="noopener" className="text-xs text-orange-400 hover:underline">Apri</a>}
                    <span className="text-xs text-neutral-500 mono">{d.document_date ? new Date(d.document_date).toLocaleDateString('it-IT') : ''}</span>
                    <ItemActions isPublic={d.is_public} onToggle={(v) => patch('documents', d.id, { is_public: v })} onDelete={() => del('documents', d.id)} />
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bacheca" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Bacheca dei visitatori</h2>
                <p className="text-xs text-neutral-500">I post-it lasciati da chi scansiona il tuo tag NFC. Puoi nascondere i messaggi indesiderati.</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold mono">{postits.length}</div>
                <div className="text-[10px] mono uppercase text-neutral-500">Totali</div>
              </div>
            </div>
            {postits.length === 0 ? (
              <Card className="metallic p-10 text-center text-neutral-500 text-sm">
                Nessun post-it ricevuto. Condividi il tuo tag NFC per iniziare a raccogliere messaggi!
              </Card>
            ) : (
              <div className="space-y-2">
                {postits.map(pt => (
                  <Card key={pt.id} className={`metallic p-4 flex items-start justify-between gap-3 ${pt.is_hidden ? 'opacity-50' : ''}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{pt.author_name}</span>
                        <span className="text-[10px] mono text-neutral-500">{new Date(pt.created_at).toLocaleString('it-IT')}</span>
                        {pt.is_hidden && <Badge className="bg-red-500/20 text-red-400 text-[10px]"><EyeOff className="w-2.5 h-2.5 mr-1" />NASCOSTO</Badge>}
                      </div>
                      <p className="text-sm text-neutral-200 whitespace-pre-wrap">{pt.message}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => patch('postits', pt.id, { is_hidden: !pt.is_hidden })} className="p-1.5 rounded-md hover:bg-white/5 text-neutral-400 hover:text-white transition" title={pt.is_hidden ? 'Rendi visibile' : 'Nascondi'}>
                        {pt.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button onClick={() => del('postits', pt.id)} className="p-1.5 rounded-md hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition" title="Elimina">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
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

function QuickKmUpdate({ current, onSave, variant = 'inline' }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(current || 0));
  useEffect(() => { setValue(String(current || 0)); }, [current, open]);
  const save = async (e) => {
    e.preventDefault();
    const km = parseInt(value);
    if (isNaN(km) || km < 0) return toast.error('Km non validi');
    if (km < current && !confirm(`I nuovi km (${km.toLocaleString('it-IT')}) sono inferiori agli attuali (${current.toLocaleString('it-IT')}). Continuare?`)) return;
    await onSave(km);
    toast.success('Km aggiornati');
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'hero' ? (
          <button type="button" className="ml-1 p-1 rounded-md bg-black/50 hover:bg-orange-500/20 border border-white/10 hover:border-orange-500/40 transition" title="Aggiorna km">
            <Pencil className="w-3 h-3 text-orange-400" />
          </button>
        ) : (
          <button type="button" className="p-1.5 rounded-md hover:bg-orange-500/10 text-neutral-400 hover:text-orange-400 transition" title="Aggiorna km">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-neutral-950 border-white/10 max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Gauge className="w-5 h-5 text-orange-400" />Aggiorna chilometraggio</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <div className="text-xs text-neutral-500 mb-2">Km attuali: <span className="mono text-neutral-300">{current.toLocaleString('it-IT')}</span></div>
            <Label>Nuovi km</Label>
            <Input type="number" min="0" step="1" value={value} onChange={(e) => setValue(e.target.value)} placeholder="es. 15420" autoFocus className="text-2xl font-mono text-orange-400 h-14" />
            {parseInt(value) > current && (
              <div className="text-xs text-emerald-400 mt-2 mono">+{(parseInt(value) - current).toLocaleString('it-IT')} km percorsi</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Annulla</Button>
            <Button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-500">Salva</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditableDescription({ current, onSave }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current || '');
  useEffect(() => { setValue(current || ''); }, [current]);
  const save = async () => { await onSave(value); setOpen(false); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Edit3 className="w-3 h-3 mr-1" />Modifica</Button>
      </DialogTrigger>
      <DialogContent className="bg-neutral-950 border-white/10 max-w-xl">
        <DialogHeader><DialogTitle>Descrizione della moto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">Racconta la storia, le caratteristiche uniche o il carattere della tua moto. Verrà mostrata anche nel profilo pubblico se attivo.</p>
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={8} placeholder="La mia café racer costruita a mano..." />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Annulla</Button>
            <Button type="button" className="flex-1 bg-orange-600 hover:bg-orange-500" onClick={save}>Salva</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemActions({ isPublic, onToggle, onDelete }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={() => onToggle(!isPublic)} className="p-1.5 rounded-md hover:bg-white/5 text-neutral-400 hover:text-white transition" title={isPublic ? 'Pubblico - clic per privato' : 'Privato - clic per pubblico'}>
        {isPublic ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4" />}
      </button>
      <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition" title="Elimina">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function EditMotoDialog({ moto, onSave, trigger }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(moto);
  useEffect(() => { setF(moto); }, [moto]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    await onSave({
      brand: f.brand, model: f.model, version: f.version,
      year: f.year ? parseInt(f.year) : null,
      engine_cc: f.engine_cc ? parseInt(f.engine_cc) : null,
      engine_type: f.engine_type, color: f.color,
      current_mileage: f.current_mileage ? parseInt(f.current_mileage) : 0,
      description: f.description, main_photo: f.main_photo,
      public_profile: !!f.public_profile,
    });
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || <Button size="sm" variant="outline"><Settings className="w-3 h-3 mr-1" />Modifica</Button>}</DialogTrigger>
      <DialogContent className="bg-neutral-950 border-white/10 max-w-2xl">
        <DialogHeader><DialogTitle>Modifica dati moto</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3 max-h-[75vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Marca</Label><Input value={f.brand || ''} onChange={set('brand')} /></div>
            <div><Label>Modello</Label><Input value={f.model || ''} onChange={set('model')} /></div>
            <div><Label>Versione</Label><Input value={f.version || ''} onChange={set('version')} /></div>
            <div><Label>Anno</Label><Input type="number" value={f.year || ''} onChange={set('year')} /></div>
            <div><Label>Cilindrata (cc)</Label><Input type="number" value={f.engine_cc || ''} onChange={set('engine_cc')} /></div>
            <div><Label>Tipo motore</Label><Input value={f.engine_type || ''} onChange={set('engine_type')} /></div>
            <div><Label>Colore</Label><Input value={f.color || ''} onChange={set('color')} /></div>
            <div><Label>Km attuali</Label><Input type="number" value={f.current_mileage || ''} onChange={set('current_mileage')} placeholder="15420" /></div>
          </div>
          <div><Label>Descrizione</Label><Textarea rows={4} value={f.description || ''} onChange={set('description')} /></div>
          <div><Label>Foto principale</Label><ImageUploader currentUrl={f.main_photo} onUploaded={(u) => setF({ ...f, main_photo: u.url })} /></div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/50">
            <div>
              <div className="font-medium">Profilo pubblico</div>
              <div className="text-xs text-neutral-500">Se disattivato, chi scansiona il tag NFC non potrà vedere la moto</div>
            </div>
            <Switch checked={!!f.public_profile} onCheckedChange={(v) => setF({ ...f, public_profile: v })} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Annulla</Button>
            <Button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-500">Salva modifiche</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
      <DialogContent className="bg-neutral-950 border-white/10 max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          {fields.map(f => (
            <div key={f.name}>
              <Label>{f.label}{f.required && ' *'}</Label>
              {f.type === 'upload' ? (
                <ImageUploader accept={f.accept || 'image/*'} label="Carica" currentUrl={values[f.name]} onUploaded={(u) => setValues({ ...values, [f.name]: u.url })} />
              ) : f.type === 'iconselect' ? (
                <div className="mt-2"><IconSelect value={values[f.name] || ''} onChange={(v) => setValues({ ...values, [f.name]: v })} options={f.options} columns={5} /></div>
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
