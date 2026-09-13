'use client';
import { useEffect, useState, use } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Cpu, Wifi, Gauge, Calendar, Wrench, Sparkles, Image as ImgIcon, MapPin, Zap, ShieldCheck, ChevronRight } from 'lucide-react';
import Logo from '@/components/Logo';

export default function PublicProfile({ params }) {
  const { public_id } = use(params);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/public/${public_id}`).then(r => r.json()).then(d => {
      if (d.error) setError(d.error);
      else setData(d);
    });
  }, [public_id]);

  if (error) return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="text-center">
        <Cpu className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
        <div className="text-2xl font-bold mb-2">Moto non trovata</div>
        <div className="text-neutral-500 mono">{public_id}</div>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="animate-pulse text-neutral-500">Caricamento...</div>
    </div>
  );

  const { moto, owner, maintenance, timeline, modifications, gallery, scan_count } = data;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top brand bar */}
      <div className="border-b border-white/5 bg-black/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold text-sm">MotoDNA</span>
          </div>
          <a href="/" className="text-xs mono text-neutral-500 hover:text-white">CREA IL TUO →</a>
        </div>
      </div>

      {/* Hero passport */}
      <section className="relative">
        <div className="relative h-[70vh] min-h-[500px] overflow-hidden">
          {moto.main_photo && (
            <>
              <img src={moto.main_photo} alt={moto.model} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/50" />
              <div className="absolute inset-0 grid-pattern opacity-30" />
            </>
          )}

          <div className="relative h-full max-w-5xl mx-auto px-5 flex flex-col justify-end pb-10">
            {/* Passport-style header */}
            <div className="mb-6 flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-orange-500/30">
                <Wifi className="w-3 h-3 text-orange-400 animate-pulse" />
                <span className="text-xs mono text-orange-400 uppercase tracking-widest">Live NFC Profile</span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">🟢 ATTIVA</Badge>
            </div>

            <div className="text-xs mono text-neutral-400 uppercase tracking-[0.3em]">{moto.brand}</div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none mt-1">{moto.model}</h1>
            {moto.version && <div className="text-xl text-neutral-300 mt-2 font-light italic">{moto.version}</div>}

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="px-4 py-2.5 metallic rounded-lg">
                <div className="text-[10px] mono uppercase text-neutral-500">Anno</div>
                <div className="text-lg font-bold">{moto.year}</div>
              </div>
              <div className="px-4 py-2.5 metallic rounded-lg">
                <div className="text-[10px] mono uppercase text-neutral-500">Cilindrata</div>
                <div className="text-lg font-bold">{moto.engine_cc} cc</div>
              </div>
              <div className="px-4 py-2.5 metallic rounded-lg">
                <div className="text-[10px] mono uppercase text-neutral-500">Km</div>
                <div className="text-lg font-bold mono">{(moto.current_mileage || 0).toLocaleString('it-IT')}</div>
              </div>
              <div className="px-4 py-2.5 metallic rounded-lg border-orange-500/30">
                <div className="text-[10px] mono uppercase text-neutral-500">ID MotoDNA</div>
                <div className="text-lg font-bold mono text-orange-400">{moto.public_id}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Motorsport-style stats bar */}
      <section className="border-y border-white/10 bg-neutral-950">
        <div className="max-w-5xl mx-auto px-5 py-4 grid grid-cols-4 gap-4">
          <StatMini label="Scansioni NFC" value={scan_count?.toLocaleString('it-IT') || '0'} icon={Wifi} />
          <StatMini label="Interventi" value={maintenance.length} icon={Wrench} />
          <StatMini label="Modifiche" value={modifications.length} icon={Sparkles} />
          <StatMini label="Eventi" value={timeline.length} icon={Calendar} />
        </div>
      </section>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-5 py-10">
        {/* Description */}
        {moto.description && (
          <Card className="metallic p-6 mb-8">
            <div className="text-xs mono uppercase text-orange-400 mb-3 tracking-widest">// Descrizione</div>
            <p className="text-neutral-200 leading-relaxed whitespace-pre-wrap">{moto.description}</p>
            {owner && (
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-sm text-neutral-500">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Proprietario verificato: <span className="text-neutral-300">@{owner.username}</span></span>
              </div>
            )}
          </Card>
        )}

        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="bg-neutral-900/50 border border-white/10 w-full overflow-x-auto">
            <TabsTrigger value="timeline"><Calendar className="w-3 h-3 mr-1" />Timeline</TabsTrigger>
            <TabsTrigger value="maintenance"><Wrench className="w-3 h-3 mr-1" />Manutenzione</TabsTrigger>
            <TabsTrigger value="modifications"><Sparkles className="w-3 h-3 mr-1" />Modifiche</TabsTrigger>
            <TabsTrigger value="gallery"><ImgIcon className="w-3 h-3 mr-1" />Galleria</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-6">
            <div className="text-xs mono uppercase text-orange-400 mb-6 tracking-widest">// La storia della moto</div>
            <div className="relative border-l-2 border-gradient-to-b from-orange-500/50 to-transparent ml-3 pl-8 space-y-6">
              <div className="absolute left-[10px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-orange-500 via-orange-500/30 to-transparent" />
              {timeline.map((t, i) => (
                <div key={t.id} className="relative">
                  <div className="absolute -left-[41px] w-4 h-4 rounded-full bg-orange-500 border-4 border-black shadow-[0_0_20px_rgba(238,100,50,0.6)]" />
                  <Card className="metallic p-5 hover:border-orange-500/30 transition">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="mono text-[10px] border-orange-500/30 text-orange-400">{t.event_type}</Badge>
                      <span className="text-xs text-neutral-500 mono">{new Date(t.event_date).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      {t.mileage > 0 && <span className="text-xs text-neutral-500 mono">· {t.mileage.toLocaleString('it-IT')} km</span>}
                    </div>
                    <div className="text-lg font-semibold">{t.title}</div>
                    {t.description && <div className="text-sm text-neutral-400 mt-1">{t.description}</div>}
                  </Card>
                </div>
              ))}
              {timeline.length === 0 && <div className="text-neutral-500 text-sm">Nessun evento pubblico</div>}
            </div>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-6">
            <div className="text-xs mono uppercase text-orange-400 mb-6 tracking-widest">// Interventi tecnici</div>
            <div className="space-y-3">
              {maintenance.map(m => (
                <Card key={m.id} className="metallic p-4 hover:border-orange-500/30 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="mono text-[10px] border-white/20">{m.service_type}</Badge>
                        <span className="font-semibold">{m.title}</span>
                        {m.verified && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">✓ Certificato</Badge>}
                      </div>
                      {m.description && <div className="text-sm text-neutral-400 mt-1">{m.description}</div>}
                      <div className="text-xs mono text-neutral-500 mt-2">
                        {new Date(m.date).toLocaleDateString('it-IT')} · {(m.mileage || 0).toLocaleString('it-IT')} km
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </div>
                </Card>
              ))}
              {maintenance.length === 0 && <div className="text-neutral-500 text-sm">Nessun intervento pubblico</div>}
            </div>
          </TabsContent>

          <TabsContent value="modifications" className="mt-6">
            <div className="text-xs mono uppercase text-orange-400 mb-6 tracking-widest">// Modifiche &amp; upgrade</div>
            <div className="grid md:grid-cols-2 gap-3">
              {modifications.map(m => (
                <Card key={m.id} className="metallic p-5">
                  <Badge variant="outline" className="mono text-[10px] border-orange-500/30 text-orange-400 mb-2">{m.category}</Badge>
                  <div className="text-lg font-bold">{m.name}</div>
                  {(m.brand || m.model) && <div className="text-xs mono text-neutral-500 mb-2">{m.brand} {m.model}</div>}
                  {m.description && <div className="text-sm text-neutral-400 mt-2">{m.description}</div>}
                </Card>
              ))}
              {modifications.length === 0 && <div className="text-neutral-500 text-sm">Nessuna modifica pubblica</div>}
            </div>
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <div className="text-xs mono uppercase text-orange-400 mb-6 tracking-widest">// Galleria fotografica</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {gallery.map(g => (
                <div key={g.id} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-900 group">
                  <img src={g.file_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={g.caption} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {g.caption && <div className="absolute bottom-2 left-2 right-2 text-xs text-white font-medium">{g.caption}</div>}
                </div>
              ))}
              {gallery.length === 0 && <div className="text-neutral-500 text-sm">Nessuna foto pubblica</div>}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* CTA Footer */}
      <footer className="border-t border-white/5 bg-neutral-950 mt-10">
        <div className="max-w-5xl mx-auto px-5 py-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/5 text-orange-400 text-[10px] mono uppercase tracking-widest mb-4">
            <Zap className="w-3 h-3" /> Powered by MotoDNA
          </div>
          <h2 className="text-2xl font-bold mb-2">Il passaporto digitale della tua moto</h2>
          <p className="text-neutral-400 text-sm mb-6 max-w-md mx-auto">Crea il tuo profilo MotoDNA, associa un tag NFC e la storia della tua moto sarà sempre con lei.</p>
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg font-semibold transition">
            Crea il tuo MotoDNA <ChevronRight className="w-4 h-4" />
          </a>
          <div className="mt-8 text-[10px] mono text-neutral-600 uppercase tracking-widest">
            MOTODNA · {moto.public_id} · V0.1
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatMini({ icon: Icon, label, value }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 text-orange-400 mx-auto mb-1" />
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-[10px] mono uppercase text-neutral-500 tracking-widest">{label}</div>
    </div>
  );
}
