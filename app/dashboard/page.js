'use client';
import { useEffect, useState } from 'react';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Gauge, Plus, Wifi, Wrench, Calendar, Bell, LogOut, Cpu, ArrowUpRight, Users, MessageSquare, ShieldCheck, CheckCircle2, User as UserIcon } from 'lucide-react';
import Logo from '@/components/Logo';
import ImageUploader from '@/components/ImageUploader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/messages-unread-count').then(r => r.json()).catch(() => ({ count: 0 })),
    ]).then(([me, dash, un]) => {
      if (!me.user) return router.push('/');
      setUser(me.user);
      setData(dash);
      setUnread(un.count || 0);
    });
  }, [router]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (!data) return <div className="min-h-screen bg-black flex items-center justify-center text-neutral-500">Caricamento...</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur bg-black/70 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-bold tracking-tight">MotoDNA</span>
          </Link>
          <div className="flex items-center gap-2">
            {user?.is_admin && (
              <Link href="/admin"><Button size="sm" className="bg-red-600/90 hover:bg-red-500 text-white h-9"><ShieldCheck className="w-4 h-4 mr-1" />Admin</Button></Link>
            )}
            <Link href="/community"><Button variant="ghost" size="sm" className="text-neutral-300 hover:text-white"><Users className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Community</span></Button></Link>
            <Link href="/messages"><Button variant="ghost" size="sm" className="text-neutral-300 hover:text-white relative"><MessageSquare className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Messaggi</span>{unread > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">{unread}</span>}</Button></Link>
            <ProfileButton user={user} onUpdated={(u) => setUser(u)} onLogout={logout} />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 pt-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-xs mono text-neutral-500 uppercase">Il tuo garage</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Ciao {user?.first_name || user?.username} 👋</h1>
          </div>
          <Link href="/moto/new">
            <Button className="bg-orange-600 hover:bg-orange-500"><Plus className="w-4 h-4 mr-1" /> Aggiungi moto</Button>
          </Link>
        </div>

        {data.motos.some(m => m.is_demo) && (
          <Card className="metallic border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-red-600/5 p-5 mb-6 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <div className="font-semibold mb-1">Benvenuto in MotoDNA!</div>
              <p className="text-sm text-neutral-300">Ti abbiamo precaricato una Honda VF400F di demo. Apri la moto e clicca <span className="mono text-orange-400">Modifica</span> per personalizzare marca, modello, anno, cilindrata, targa e foto — sarà pronta con il tuo MotoDNA univoco.</p>
            </div>
            <Link href={`/moto/${data.motos.find(m => m.is_demo).id}`}>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-500 shrink-0">Personalizza <ArrowUpRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </Card>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={Gauge} label="Moto totali" value={data.motos.length} />
          <StatCard icon={Wrench} label="Interventi" value={data.recent_maintenance.length} />
          <StatCard icon={Bell} label="Promemoria" value={data.reminders.length} />
          <StatCard icon={Wifi} label="Tag NFC attivi" value={data.motos.length} accent />
        </div>

        {/* Motorcycles grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">Le tue moto</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {data.motos.map(m => (
              <Link key={m.id} href={`/moto/${m.id}`} className="block">
                <Card className="metallic overflow-hidden hover:border-orange-500/50 transition group cursor-pointer">
                  <div className="relative h-48 overflow-hidden bg-neutral-900">
                    {m.main_photo && <img src={m.main_photo} alt={m.model} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />}
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-black/70 backdrop-blur border-white/10 mono text-[10px]">{m.public_id}</Badge>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">🟢 {m.status}</Badge>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs mono text-neutral-500 uppercase">{m.brand}</div>
                        <div className="text-xl font-bold tracking-tight">{m.model}</div>
                        <div className="text-sm text-neutral-400">{m.year} · {m.engine_cc}cc</div>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-neutral-500 group-hover:text-orange-400 transition" />
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] mono uppercase text-neutral-500">Km</div>
                        <div className="font-mono font-semibold">{(m.current_mileage || 0).toLocaleString('it-IT')}</div>
                      </div>
                      {/* Not an <a>: it would be nested inside the parent <Link>'s <a>.
                          Use a button + window.open to keep the same UX. */}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`/m/${m.public_id}`, '_blank', 'noopener'); }}
                        className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Wifi className="w-3 h-3" /> Profilo pubblico
                      </button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent maintenance + reminders */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="metallic p-5">
            <div className="flex items-center gap-2 mb-4"><Wrench className="w-4 h-4 text-orange-400" /><h3 className="font-semibold">Ultimi interventi</h3></div>
            <div className="space-y-3">
              {data.recent_maintenance.length === 0 && <div className="text-sm text-neutral-500">Nessun intervento registrato</div>}
              {data.recent_maintenance.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-neutral-500 mono">{new Date(m.date).toLocaleDateString('it-IT')} · {(m.mileage || 0).toLocaleString('it-IT')} km</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] mono">{m.service_type}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card className="metallic p-5">
            <div className="flex items-center gap-2 mb-4"><Bell className="w-4 h-4 text-orange-400" /><h3 className="font-semibold">Prossimi promemoria</h3></div>
            <div className="space-y-3">
              {data.reminders.length === 0 && <div className="text-sm text-neutral-500">Nessun promemoria</div>}
              {data.reminders.map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs text-neutral-500 mono">{r.target_date ? new Date(r.target_date).toLocaleDateString('it-IT') : ''}{r.target_mileage ? ` · ${r.target_mileage.toLocaleString('it-IT')} km` : ''}</div>
                  </div>
                  <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 shrink-0" onClick={async () => {
                    const res = await fetch(`/api/reminders/${r.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                    if (res.ok) {
                      toast.success('Promemoria completato + intervento registrato');
                      // Refetch dashboard
                      fetch('/api/dashboard').then(r => r.json()).then(setData);
                    }
                  }}><CheckCircle2 className="w-3 h-3 mr-1" />Completa</Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className={`metallic rounded-xl p-4 ${accent ? 'border-orange-500/30' : ''}`}>
      <Icon className={`w-4 h-4 mb-2 ${accent ? 'text-orange-400' : 'text-neutral-400'}`} />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[10px] mono uppercase text-neutral-500">{label}</div>
    </div>
  );
}

function ProfileButton({ user, onUpdated, onLogout }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', country: '', profile_photo: '' });

  useEffect(() => {
    if (user) setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || '',
      country: user.country || '',
      profile_photo: user.profile_photo || '',
    });
  }, [user]);

  const save = async (patch) => {
    const res = await fetch('/api/auth/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (res.ok) {
      const d = await res.json();
      onUpdated?.(d.user);
      toast.success('Profilo aggiornato');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-9 h-9 rounded-full bg-neutral-800 border border-white/10 hover:border-orange-500/40 flex items-center justify-center overflow-hidden transition ml-1" title="Il mio profilo">
          {user?.profile_photo ? <img src={user.profile_photo} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-neutral-400" />}
        </button>
      </DialogTrigger>
      <DialogContent className="bg-neutral-950 border-white/10 max-w-md">
        <DialogHeader><DialogTitle>Il mio profilo</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center py-4">
          <div className="w-24 h-24 rounded-full bg-neutral-800 border-4 border-neutral-900 overflow-hidden flex items-center justify-center mb-2">
            {form.profile_photo ? <img src={form.profile_photo} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-10 h-10 text-neutral-500" />}
          </div>
          <ImageUploaderCircle currentUrl={form.profile_photo} onUploaded={(u) => { setForm({ ...form, profile_photo: u.url }); save({ profile_photo: u.url }); }} />
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Nome</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} onBlur={() => save({ first_name: form.first_name })} /></div>
            <div><Label>Cognome</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} onBlur={() => save({ last_name: form.last_name })} /></div>
          </div>
          <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} onBlur={() => save({ username: form.username })} /></div>
          <div><Label>Paese</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} onBlur={() => save({ country: form.country })} placeholder="Italia" /></div>
          <div className="text-xs text-neutral-500">Email: {user?.email}</div>
          <Button variant="outline" className="w-full mt-4 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={onLogout}><LogOut className="w-4 h-4 mr-1" />Esci</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageUploaderCircle({ currentUrl, onUploaded }) {
  const [busy, setBusy] = useState(false);
  const inputRef = React.useRef(null);
  const handle = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUploaded(data);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? 'Caricamento...' : (currentUrl ? 'Cambia foto profilo' : 'Aggiungi foto profilo')}
      </Button>
    </>
  );
}
