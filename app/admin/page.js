'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ArrowLeft, Users, Bike, MessageSquare, Activity, TrendingUp, ShieldCheck, Camera, Wrench, Clock, Sparkles, Wifi, UserCheck, Calendar, Send, Megaphone, Trash2, Search, AlertTriangle } from 'lucide-react';
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

        {/* Broadcast panel */}
        <BroadcastPanel totalUsers={stats.total_users} />

        <PasswordResetRequestsPanel />

        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-orange-400" />Contenuti creati</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Stat icon={Camera} label="Foto galleria" value={stats.total_gallery} />
          <Stat icon={Wrench} label="Manutenzioni" value={stats.total_maintenance} />
          <Stat icon={Clock} label="Eventi timeline" value={stats.total_timeline} />
          <Stat icon={Sparkles} label="Modifiche" value={stats.total_modifications} />
        </div>

        {/* Recent users */}
        <Card className="metallic p-6 mb-6">
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

        {/* User management (with delete) */}
        <UsersManagementPanel />
      </div>
    </div>
  );
}


function PasswordResetRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/password-reset-requests');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossibile caricare le richieste');
      setRequests(data.requests || []);
    } catch (e) {
      setError(e.message || 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const decide = async (requestId, action) => {
    setBusyId(requestId);
    try {
      const res = await fetch(`/api/admin/password-reset-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operazione non riuscita');
      toast.success(action === 'approve' ? 'Richiesta approvata: email di reset inviata se l’account esiste' : 'Richiesta rifiutata');
      await load();
    } catch (e) {
      toast.error(e.message || 'Errore');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="metallic p-6 mb-8 border-orange-500/20">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-orange-400" />Richieste recupero password</h3>
          <p className="text-xs text-neutral-500 mt-1">Richieste arrivate dal bot Telegram. Approvando, MotoDNA invia un link monouso all’email dell’account, valido 30 minuti.</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>Aggiorna</Button>
      </div>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-neutral-500 py-5 text-center">Caricamento richieste…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-neutral-500 py-5 text-center">Nessuna richiesta in attesa.</p>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium break-all">{r.email}</div>
                <div className="text-xs text-neutral-500 mt-1">Telegram chat: {r.chat_id}</div>
                <div className="text-xs text-neutral-500">Ricevuta: {new Date(r.created_at).toLocaleString('it-IT')}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" className="bg-orange-600 hover:bg-orange-500" disabled={busyId !== null} onClick={() => decide(r.id, 'approve')}>
                  {busyId === r.id ? 'Attendi…' : 'Approva'}
                </Button>
                <Button size="sm" variant="outline" className="text-red-400 border-red-500/30" disabled={busyId !== null} onClick={() => decide(r.id, 'reject')}>
                  Rifiuta
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
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

function BroadcastPanel({ totalUsers }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  // Recipients: every user except the admin themselves.
  const recipients = Math.max(0, (totalUsers || 0) - 1);

  const send = async () => {
    const text = content.trim();
    if (!text) return toast.error('Messaggio vuoto');
    if (!window.confirm(`Confermi l'invio del messaggio a ${recipients} utenti? L'operazione non è annullabile.`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setLastResult({ sent: data.sent, when: new Date(), preview: text.slice(0, 60) });
      setContent('');
      setOpen(false);
      toast.success(`Messaggio inviato a ${data.sent} utenti`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="metallic p-6 mb-8 border-orange-500/20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h3 className="font-semibold flex items-center gap-2 mb-1"><Megaphone className="w-4 h-4 text-orange-400" />Comunicazione broadcast</h3>
          <p className="text-sm text-neutral-400">
            Invia un messaggio a <span className="text-orange-400 font-semibold mono">{recipients.toLocaleString('it-IT')}</span> utenti in un colpo solo. Ognuno lo riceverà nella propria inbox <span className="mono">/messages</span> come conversazione privata con te.
          </p>
          {lastResult && (
            <div className="mt-3 text-xs text-emerald-400 mono">
              ✓ Ultimo invio: {lastResult.sent} destinatari · {lastResult.when.toLocaleString('it-IT')}
              <div className="text-neutral-500 truncate">"{lastResult.preview}"</div>
            </div>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-500 shrink-0"><Send className="w-4 h-4 mr-1" />Nuovo messaggio</Button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-950 border-white/10 max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-orange-400" />Messaggio broadcast</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 text-xs text-neutral-300">
                Verrà creata una conversazione 1:1 con ciascuno dei <span className="text-orange-400 font-semibold">{recipients.toLocaleString('it-IT')}</span> utenti. Ogni destinatario vedrà il messaggio come proveniente dal tuo account.
              </div>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                maxLength={2000}
                placeholder="Es. Ciao a tutti, abbiamo appena rilasciato il supporto NFC..."
                className="resize-none"
                autoFocus
              />
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="mono">{content.length}/2000</span>
                <span>Il messaggio non può essere modificato o revocato dopo l'invio.</span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>Annulla</Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-500" onClick={send} disabled={busy || !content.trim() || recipients === 0}>
                  {busy ? 'Invio...' : `Invia a ${recipients.toLocaleString('it-IT')} utenti`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}

function UsersManagementPanel() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const url = query ? `/api/admin/users?q=${encodeURIComponent(query)}` : '/api/admin/users';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const onDeleted = (id) => setUsers(prev => prev.filter(u => u.id !== id));

  return (
    <Card className="metallic p-6 border-red-500/20">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" />Gestione utenti</h3>
          <p className="text-xs text-neutral-500">Cerca un utente e cancella l'account definitivamente. L'operazione elimina anche moto, foto, messaggi e storia — non è reversibile.</p>
        </div>
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per email, username, nome..." className="pl-10" />
        </div>
      </div>

      {error && <div className="text-xs text-red-400 mb-3 mono">{error}</div>}

      <div className="space-y-1">
        {loading ? (
          <div className="text-sm text-neutral-500 py-6 text-center">Caricamento...</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-neutral-500 py-6 text-center">Nessun utente trovato</div>
        ) : (
          users.map(u => (
            <UserRow key={u.id} user={u} onDeleted={() => onDeleted(u.id)} />
          ))
        )}
      </div>

      {!loading && users.length > 0 && (
        <div className="mt-3 text-[10px] mono text-neutral-500 uppercase tracking-wider">
          {users.length} risultat{users.length === 1 ? 'o' : 'i'} · massimo 200
        </div>
      )}
    </Card>
  );
}

function UserRow({ user, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const canDelete = confirmText.trim().toLowerCase() === (user.email || '').toLowerCase() && !user.is_admin;

  const doDelete = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      toast.success(`Utente eliminato: ${data.deleted.motorcycles} moto, ${data.deleted.child_documents} record collegati`);
      onDeleted();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      setOpen(false);
      setConfirmText('');
    }
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
        {user.profile_photo ? <img src={user.profile_photo} alt="" className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-neutral-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{user.first_name || user.username}</span>
          {user.is_admin && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Admin</Badge>}
          {user.bike_count > 0 && <span className="text-[10px] mono text-neutral-500"><Bike className="w-2.5 h-2.5 inline mr-0.5" />{user.bike_count}</span>}
        </div>
        <div className="text-xs text-neutral-500 mono truncate">{user.email}</div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-xs mono text-neutral-400">{new Date(user.created_at).toLocaleDateString('it-IT')}</div>
        {user.last_seen && <div className="text-[10px] mono text-emerald-400">visto {new Date(user.last_seen).toLocaleDateString('it-IT')}</div>}
      </div>
      <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(''); }}>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="text-red-400 border-red-500/30 hover:bg-red-500/10 shrink-0"
            disabled={user.is_admin}
            title={user.is_admin ? 'Impossibile cancellare un altro admin' : 'Cancella utente'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-neutral-950 border-red-500/20 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />Cancellazione permanente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-neutral-300">
                <p>Stai per cancellare <b className="text-white">{user.first_name || user.username}</b> (<span className="mono text-neutral-400">{user.email}</span>) e:</p>
                <ul className="list-disc pl-5 text-neutral-400 space-y-0.5">
                  <li>{user.bike_count} mot{user.bike_count === 1 ? 'o' : 'o'} e tutta la loro storia (manutenzione, timeline, modifiche, gallery, documenti)</li>
                  <li>Tutti i messaggi inviati e ricevuti</li>
                  <li>Reminders, tag NFC, transfer, ownership history</li>
                </ul>
                <p className="text-red-400 text-xs">L'operazione NON è reversibile.</p>
                <div className="pt-2">
                  <p className="text-xs text-neutral-400 mb-1">Per confermare, digita l'email dell'utente:</p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={user.email}
                    className="mono text-sm"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doDelete(); }}
              disabled={!canDelete || busy}
              className="bg-red-600 hover:bg-red-500 text-white disabled:opacity-40"
            >
              {busy ? 'Cancellazione...' : 'Cancella definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

