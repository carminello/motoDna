'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Bike, MessageSquare, Activity, TrendingUp, ShieldCheck, Camera, Wrench, Clock, Sparkles, Wifi, UserCheck, Calendar } from 'lucide-react';
import Logo from '@/components/Logo';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart
} from 'recharts';
import { AdminSkeleton } from '@/components/skeletons';

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/admin/stats').then(async r => {
      if (r.status === 401) return router.push('/');
      const d = await r.json();
      if (r.status === 403) return setError('Accesso riservato');
      if (d.error) return setError(d.error);
      setData(d);
    }).catch(() => setError('Errore di rete'));
  }, [router]);

  if (error) return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <Card className="metallic p-8 max-w-md text-center">
        <ShieldCheck className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <div className="text-xl font-bold mb-2">Accesso negato</div>
        <p className="text-sm text-neutral-400 mb-4">{error}</p>
        <Link href="/dashboard"><Button variant="outline">Torna alla dashboard</Button></Link>
      </Card>
    </div>
  );

  if (!data) return <AdminSkeleton />;

  const { stats, chart_registrations_30d, recent_users } = data;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="border-b border-white/5 sticky top-0 bg-black/70 backdrop-blur z-40">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <Logo size={26} />
          <span className="font-bold">Admin Console</span>
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 ml-2"><ShieldCheck className="w-3 h-3 mr-1" />ADMIN</Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 pt-8">
        <div className="text-xs mono text-orange-400 uppercase tracking-widest mb-2">// Console amministratore</div>
        <h1 className="text-3xl md:text-4xl font-bold mb-6">Panoramica piattaforma</h1>

        {/* Primary stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat icon={Users} label="Utenti totali" value={stats.total_users} accent />
          <Stat icon={UserCheck} label="Online (24h)" value={stats.online_24h} pulse />
          <Stat icon={Calendar} label="Nuovi oggi" value={stats.new_today} />
          <Stat icon={TrendingUp} label="Ultimi 7 giorni" value={stats.new_7d} />
        </div>

        {/* Growth chart */}
        <Card className="metallic p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Crescita utenti · ultimi 30 giorni</h3>
              <p className="text-xs text-neutral-500">Nuove registrazioni per giorno</p>
            </div>
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 mono text-[10px]">30D</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart_registrations_30d}>
                <defs>
                  <linearGradient id="orangeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#666" style={{ fontSize: 11 }} interval={4} />
                <YAxis stroke="#666" style={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333', borderRadius: 8 }} labelStyle={{ color: '#F97316' }} />
                <Area type="monotone" dataKey="users" stroke="#F97316" fill="url(#orangeFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Secondary metrics grid */}
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-orange-400" />Attività community</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat icon={Bike} label="Moto registrate" value={stats.total_bikes} />
          <Stat icon={MessageSquare} label="Post-it community" value={stats.total_postits} />
          <Stat icon={MessageSquare} label="Messaggi scambiati" value={stats.total_messages} />
          <Stat icon={Wifi} label="Scansioni NFC" value={stats.total_scans} />
        </div>

        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-orange-400" />Contenuti creati</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Stat icon={Camera} label="Foto galleria" value={stats.total_gallery} />
          <Stat icon={Wrench} label="Manutenzioni" value={stats.total_maintenance} />
          <Stat icon={Clock} label="Eventi timeline" value={stats.total_timeline} />
          <Stat icon={Sparkles} label="Modifiche" value={stats.total_modifications} />
        </div>

        {/* Recent users */}
        <Card className="metallic p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-orange-400" />Ultimi utenti registrati</h3>
          <div className="space-y-2">
            {recent_users.map(u => (
              <div key={u.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                  {u.profile_photo ? <img src={u.profile_photo} alt="" className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-neutral-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{u.first_name || u.username}</span>
                    {u.is_admin && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Admin</Badge>}
                  </div>
                  <div className="text-xs text-neutral-500 mono truncate">{u.email}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs mono text-neutral-400">{new Date(u.created_at).toLocaleDateString('it-IT')}</div>
                  {u.last_seen && <div className="text-[10px] mono text-emerald-400">visto {new Date(u.last_seen).toLocaleDateString('it-IT')}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent, pulse }) {
  return (
    <Card className={`metallic p-4 ${accent ? 'border-orange-500/30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-4 h-4 ${accent ? 'text-orange-400' : 'text-neutral-400'}`} />
        {pulse && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
      </div>
      <div className={`text-3xl font-bold font-mono ${accent ? 'text-orange-400' : ''}`}>{typeof value === 'number' ? value.toLocaleString('it-IT') : value}</div>
      <div className="text-[10px] mono uppercase text-neutral-500 tracking-wider mt-1">{label}</div>
    </Card>
  );
}
