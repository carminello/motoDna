'use client';
import { useEffect, useState } from 'react';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Gauge, 
  Plus, 
  Wifi, 
  Wrench, 
  Calendar, 
  Bell, 
  LogOut, 
  Cpu, 
  ArrowUpRight, 
  Users, 
  MessageSquare, 
  ShieldCheck, 
  CheckCircle2, 
  User as UserIcon,
  Sparkles,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import Logo from '@/components/Logo';
import ImageUploader from '@/components/ImageUploader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/label';
import { Label } from '@/components/ui/label';
import { DashboardSkeleton } from '@/components/skeletons';
export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [unread, setUnread] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
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
      try {
        const hasDemo = (dash.motos || []).some(m => m.is_demo);
        if (hasDemo) {
          const seen = parseInt(localStorage.getItem('motodna_welcome_seen') || '0', 10) || 0;
          if (seen < 2) {
            setShowWelcome(true);
            localStorage.setItem('motodna_welcome_seen', String(seen + 1));
          }
        }
      } catch (e) {}
    });
  }, [router]);
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };
  if (!data) return <DashboardSkeleton />;
  const totalKm = (data.motos || []).reduce((acc, m) => acc + (m.current_mileage || 0), 0);
  return (
    <div className="min-h-screen bg-[#070708] text-white pb-24 selection:bg-orange-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-black/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="transition transform group-hover:scale-105">
              <Logo size={32} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-base leading-none">MotoDNA</span>
              <span className="text-[9px] mono uppercase text-orange-400/80 tracking-widest mt-0.5">GARAGE EDITION</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {user?.is_admin && (
              <Link href="/admin">
                <Button size="sm" className="bg-red-600/90 hover:bg-red-500 text-white h-9 shadow-sm shadow-red-900/40">
                  <ShieldCheck className="w-4 h-4 mr-1" />Admin
                </Button>
              </Link>
            )}
            <Link href="/community">
              <Button variant="ghost" size="sm" className="text-neutral-300 hover:text-white hover:bg-white/5">
                <Users className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">Community</span>
              </Button>
            </Link>
            <Link href="/messages">
              <Button variant="ghost" size="sm" className="text-neutral-300 hover:text-white hover:bg-white/5 relative">
                <MessageSquare className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">Messaggi</span>
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unread}
                  </span>
                )}
              </Button>
            </Link>
            <ProfileButton user={user} onUpdated={(u) => setUser(u)} onLogout={logout} />
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-5 pt-8">
        
        {/* INSEGNA DEL GARAGE (Workshop Hero Banner) */}
        <div className="relative mb-8 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-neutral-900/90 via-[#0c0c0d] to-black p-6 md:p-8 shadow-2xl">
          {/* Illuminazione d'officina - Glow soffuso arancio e ambra */}
          <div className="absolute -top-20 left-10 w-80 h-44 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 right-10 w-80 h-44 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.04] via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-orange-500/10 border border-orange-500/30 text-orange-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Officina Privata · Box #01
                </span>
                <span className="text-neutral-600 mono text-xs">•</span>
                <span className="text-xs text-neutral-400 mono">DNA Hub Biker</span>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-100 to-neutral-400">
                Il Garage di {user?.first_name || user?.username || 'Biker'}
              </h1>
              
              <p className="text-neutral-400 text-sm mt-2 max-w-xl leading-relaxed">
                Il passaporto digitale, la manutenzione programmata e lo storico delle tue moto. Tutto pronto sui cavalletti.
              </p>
              {/* Badges di stato rapido dell'Officina */}
              <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-neutral-300 bg-black/60 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
                  <span className="text-orange-400 font-mono font-bold text-sm">{data.motos.length}</span>
                  <span className="text-neutral-400">{data.motos.length === 1 ? 'Moto Parcheggiata' : 'Moto Parcheggiate'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-300 bg-black/60 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
                  <span className="text-orange-400 font-mono font-bold text-sm">{totalKm.toLocaleString('it-IT')}</span>
                  <span className="text-neutral-400">Km Percorsi Totali</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                  <span>NFC & Telegram Connessi</span>
                </div>
              </div>
            </div>
            {/* Pulsante Parcheggia Moto */}
            <div className="shrink-0 flex items-center">
              <Link href="/moto/new">
                <Button className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-semibold shadow-lg shadow-orange-600/30 h-12 px-6 rounded-xl border border-orange-400/30 transition transform hover:scale-[1.02]">
                  <Plus className="w-5 h-5 mr-1.5" /> Parcheggia nuova moto
                </Button>
              </Link>
            </div>
          </div>
        </div>
        {/* Banner Benvenuto se c'è moto demo */}
        {showWelcome && data.motos.some(m => m.is_demo) && (
          <Card className="metallic border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-red-600/5 p-5 mb-8 flex items-start gap-3 rounded-xl shadow-lg">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 border border-orange-500/30">
              <Wrench className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-white mb-1">Benvenuto nel tuo Garage!</div>
              <p className="text-sm text-neutral-300">
                Abbiamo preparato una Honda VF400F dimostrativa sul cavalletto. Clicca <span className="mono text-orange-400 font-medium">Personalizza</span> per configurarla con la tua moto reale (targa, foto, chilometri e dettagli tecnici).
              </p>
            </div>
            <Link href={`/moto/${data.motos.find(m => m.is_demo).id}`}>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-500 shrink-0 font-medium">
                Personalizza <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </Card>
        )}
        {/* STRUMENTI OFFICINA / STATISTICHE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-10">
          <StatCard 
            icon={Gauge} 
            label="Moto negli stalli" 
            value={data.motos.length} 
            subtitle="Box attivi" 
          />
          <StatCard 
            icon={Wrench} 
            label="Lavori eseguiti" 
            value={data.recent_maintenance.length} 
            subtitle="Tagliandi registrati" 
          />
          <StatCard 
            icon={Bell} 
            label="Manutenzioni & Scadenze" 
            value={data.reminders.length} 
            subtitle={data.reminders.length > 0 ? "Da eseguire" : "Tutto a posto"} 
            accent={data.reminders.length > 0} 
          />
          <StatCard 
            icon={Wifi} 
            label="Passaporti NFC" 
            value={data.motos.length} 
            subtitle="Tag pronti al tap" 
            accent 
          />
        </div>
        {/* GLI STALLI DEL GARAGE (Motorcycles Grid) */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <h2 className="text-xl font-bold tracking-tight text-white uppercase">Gli Stalli del Garage</h2>
            </div>
            <span className="text-xs text-neutral-500 mono">{data.motos.length} {data.motos.length === 1 ? 'veicolo' : 'veicoli'}</span>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {data.motos.map((m, idx) => (
              <Link key={m.id} href={`/moto/${m.id}`} className="block group">
                <Card className="metallic overflow-hidden rounded-2xl border-white/10 group-hover:border-orange-500/60 transition-all duration-300 shadow-xl group-hover:shadow-orange-500/10 cursor-pointer">
                  {/* Foto Hero dello Stallo */}
                  <div className="relative h-56 overflow-hidden bg-neutral-950 border-b border-white/5">
                    {m.main_photo ? (
                      <img 
                        src={m.main_photo} 
                        alt={m.model} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 bg-gradient-to-b from-neutral-900 to-black">
                        <Gauge className="w-12 h-12 mb-2 stroke-[1.2] text-neutral-700" />
                        <span className="text-xs mono uppercase tracking-wider text-neutral-500">Nessuna foto caricata</span>
                      </div>
                    )}
                    
                    {/* Sfumatura scura per leggibilità */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                    {/* Stallo # e Targa a rilievo */}
                    <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-white/10 text-[10px] mono font-bold text-orange-400">
                        STALLO #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <Badge className="bg-black/80 backdrop-blur-md border-white/10 mono text-[10px] text-neutral-300">
                        {m.public_id}
                      </Badge>
                    </div>
                    {/* Status badge */}
                    <div className="absolute top-3.5 right-3.5">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 backdrop-blur-md font-medium text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                        {m.status || 'Pronta'}
                      </Badge>
                    </div>
                    {/* Info in sovraimpressione in basso alla foto */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div>
                        <div className="text-[11px] mono uppercase tracking-wider text-orange-400/90 font-bold">{m.brand}</div>
                        <div className="text-2xl font-black tracking-tight text-white drop-shadow-md">{m.model}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-neutral-300 font-medium bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-white/5">
                          {m.year} · {m.engine_cc}cc
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Dettagli e Azioni da Officina */}
                  <div className="p-5 bg-gradient-to-b from-[#121214] to-[#0a0a0c]">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                      <div>
                        <div className="text-[10px] mono uppercase text-neutral-500 font-semibold tracking-wider">Contachilometri</div>
                        <div className="font-mono text-xl font-bold text-white tracking-tight flex items-baseline gap-1">
                          {(m.current_mileage || 0).toLocaleString('it-IT')} 
                          <span className="text-xs text-neutral-500 font-normal">km</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Bottone per vedere il profilo pubblico / NFC */}
                        <button
                          type="button"
                          onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation(); 
                            window.open(`/m/${m.public_id}`, '_blank', 'noopener'); 
                          }}
                          className="text-xs text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Wifi className="w-3.5 h-3.5" />
                          <span>Passaporto NFC</span>
                        </button>
                        <div className="w-8 h-8 rounded-lg bg-neutral-800/60 border border-white/5 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-orange-500/40 transition">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 flex items-center justify-between text-xs text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-neutral-500" /> Scheda & Modifiche
                      </span>
                      <span className="text-neutral-500 mono text-[11px] group-hover:text-orange-400 transition">
                        Apri scheda completa →
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
            {/* STALLO VUOTO / PARCHEGGIA MOTO */}
            <Link href="/moto/new" className="block group">
              <div className="h-full min-h-[300px] rounded-2xl border-2 border-dashed border-neutral-800/90 hover:border-orange-500/50 bg-neutral-950/40 hover:bg-neutral-900/30 p-8 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer">
                <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:border-orange-500/40 group-hover:bg-orange-500/10 transition-all duration-300">
                  <Plus className="w-6 h-6 text-neutral-400 group-hover:text-orange-400 transition-colors" />
                </div>
                <div className="text-[11px] mono uppercase tracking-wider text-orange-400/80 font-bold mb-1">
                  Stallo #{String(data.motos.length + 1).padStart(2, '0')} Libero
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-orange-300 transition-colors">
                  Parcheggia un'altra moto
                </h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-relaxed">
                  Aggiungi un nuovo veicolo al tuo garage per generare il suo passaporto digitale MotoDNA.
                </p>
                <Button size="sm" variant="outline" className="mt-5 border-white/10 group-hover:border-orange-500/40 text-neutral-300 group-hover:text-white group-hover:bg-orange-500/10">
                  Aggiungi al Box
                </Button>
              </div>
            </Link>
          </div>
        </div>
        {/* BANCO DA LAVORO (Interventi & Promemoria) */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Ultimi interventi */}
          <Card className="metallic p-6 rounded-2xl border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Banco da Lavoro</h3>
                  <div className="text-[10px] mono text-neutral-500 uppercase">Ultimi interventi registrati</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {data.recent_maintenance.length === 0 && (
                <div className="text-sm text-neutral-500 py-6 text-center border border-dashed border-white/5 rounded-xl">
                  Nessun intervento registrato sul banco da lavoro
                </div>
              )}
              {data.recent_maintenance.map(m => (
                <div key={m.id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-sm hover:border-white/10 transition">
                  <div>
                    <div className="font-semibold text-neutral-200">{m.title}</div>
                    <div className="text-xs text-neutral-500 mono mt-0.5">
                      {new Date(m.date).toLocaleDateString('it-IT')} · {(m.mileage || 0).toLocaleString('it-IT')} km
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] mono border-orange-500/30 text-orange-300 bg-orange-500/5">
                    {m.service_type}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
          {/* Tabellone Promemoria & Scadenze */}
          <Card className="metallic p-6 rounded-2xl border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Tabellone Scadenze</h3>
                  <div className="text-[10px] mono text-neutral-500 uppercase">Promemoria e manutenzioni</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {data.reminders.length === 0 && (
                <div className="text-sm text-neutral-500 py-6 text-center border border-dashed border-white/5 rounded-xl">
                  Nessuna scadenza in programma. Tutte le moto sono in regola!
                </div>
              )}
              {data.reminders.map(r => (
                <div key={r.id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-sm gap-2 hover:border-white/10 transition">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-200 truncate">{r.title}</div>
                    <div className="text-xs text-neutral-500 mono mt-0.5">
                      {r.target_date ? new Date(r.target_date).toLocaleDateString('it-IT') : ''}
                      {r.target_mileage ? ` · ${r.target_mileage.toLocaleString('it-IT')} km` : ''}
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 shrink-0 h-8 text-xs" 
                    onClick={async () => {
                      const res = await fetch(`/api/reminders/${r.id}/complete`, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({}) 
                      });
                      if (res.ok) {
                        toast.success('Intervento completato e archiviato');
                        fetch('/api/dashboard').then(r => r.json()).then(setData);
                      }
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Completa
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
function StatCard({ icon: Icon, label, value, subtitle, accent }) {
  return (
    <div className={`metallic rounded-2xl p-4.5 border transition-all duration-300 hover:border-orange-500/40 ${accent ? 'border-orange-500/30 bg-orange-500/[0.03]' : 'border-white/5'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-neutral-400'}`}>
          <Icon className="w-4 h-4" />
        </div>
        {subtitle && (
          <span className="text-[10px] mono text-neutral-500">{subtitle}</span>
        )}
      </div>
      <div className="text-2xl md:text-3xl font-black text-white tracking-tight">{value}</div>
      <div className="text-[11px] mono uppercase text-neutral-400 mt-0.5 tracking-wide">{label}</div>
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
