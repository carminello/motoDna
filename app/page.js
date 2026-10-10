'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Wifi, Cpu, Zap, ShieldCheck, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';

export default function Landing() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', remember: true });

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) router.push('/dashboard');
    });
    // Prefill email from localStorage if previously remembered
    try {
      const saved = localStorage.getItem('motodna_last_email');
      if (saved) setForm(f => ({ ...f, email: saved }));
    } catch (e) {}
  }, [router]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = tab === 'login' ? { email: form.email, password: form.password, remember: form.remember } : form;
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      toast.success(tab === 'login' ? 'Bentornato' : 'Account creato - demo Honda VF400F precaricata');
      try {
        if (form.remember) localStorage.setItem('motodna_last_email', form.email);
        else localStorage.removeItem('motodna_last_email');
      } catch (err) {}
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Nav */}
      <nav className="border-b border-white/5 backdrop-blur bg-black/60 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={40} />
            <div>
              <div className="font-bold tracking-tight text-lg leading-none">MotoDNA</div>
              <div className="text-[10px] mono text-neutral-500 uppercase">Digital Identity</div>
            </div>
          </div>
          <a href="/dashboard" className="text-xs text-neutral-400 hover:text-white transition">Vai alla dashboard &rarr;</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black" />
        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-10 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/5 text-orange-400 text-xs mono uppercase mb-6">
              <Wifi className="w-3 h-3" /> NFC + Blockchain-ready
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Il <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">DNA digitale</span> della tua moto.
            </h1>
            <p className="mt-5 text-neutral-400 text-lg max-w-lg">
              Un tag NFC. Un profilo unico. Storia, manutenzione, modifiche, foto - il passaporto digitale che segue la tua moto per sempre.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="px-3 py-2 metallic rounded-lg text-xs mono text-neutral-400">
                <span className="text-orange-400">MDNA-84-VF4-7A92K</span>
              </div>
              <div className="px-3 py-2 metallic rounded-lg text-xs mono text-neutral-400 flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Ownership storicizzata
              </div>
              <div className="px-3 py-2 metallic rounded-lg text-xs mono text-neutral-400 flex items-center gap-2">
                <Zap className="w-3 h-3 text-orange-400" /> Tap &amp; view
              </div>
            </div>
          </div>

          {/* Auth card */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-orange-500/20 to-red-600/10 blur-3xl rounded-full" />
            <Card className="relative bg-neutral-950/80 backdrop-blur border-white/10 p-6 rounded-2xl">
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-neutral-900">
                  <TabsTrigger value="login">Accedi</TabsTrigger>
                  <TabsTrigger value="register">Registrati</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <form onSubmit={submit} className="space-y-4 mt-4">
                    <div><Label>Email</Label><Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="tu@motodna.app" /></div>
                    <div><Label>Password</Label><Input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></div>
                    <div className="text-right -mt-2"><a href="/forgot-password" className="text-sm text-orange-400 hover:text-orange-300">Password dimenticata?</a></div>
                    <label className="flex items-center gap-2 text-sm text-neutral-300 select-none cursor-pointer">
                      <input type="checkbox" checked={form.remember} onChange={e => setForm({ ...form, remember: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-neutral-900 accent-orange-500" />
                      Ricorda credenziali (90 giorni)
                    </label>
                    <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500">{loading ? '...' : 'Accedi'} <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  </form>
                </TabsContent>
                <TabsContent value="register">
                  <form onSubmit={submit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nome</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
                      <div><Label>Cognome</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
                    </div>
                    <div><Label>Email</Label><Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Password</Label><Input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
                    <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500">{loading ? '...' : 'Crea account + demo'} <ArrowRight className="w-4 h-4 ml-1" /></Button>
                    <p className="text-xs text-neutral-500 text-center">Al primo accesso trovi una Honda VF400F 1984 di demo</p>
                  </form>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative border-t border-white/5 bg-neutral-950/50">
        <div className="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-3 gap-6">
          {[
            { icon: Wifi, title: 'Tap NFC', text: 'Chi avvicina lo smartphone vede il profilo pubblico curato della moto. Zero app da installare.' },
            { icon: Cpu, title: 'ID univoco', text: 'MDNA-84-VF4-7A92K. Un identificativo permanente che sopravvive alla targa e al proprietario.' },
            { icon: ShieldCheck, title: 'Privacy by design', text: 'Tu decidi cosa mostrare. Documenti, costi ed email restano privati.' },
          ].map((f, i) => (
            <div key={i} className="metallic rounded-2xl p-6">
              <f.icon className="w-6 h-6 text-orange-400 mb-4" />
              <div className="font-semibold text-lg mb-1">{f.title}</div>
              <div className="text-sm text-neutral-400">{f.text}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-neutral-500 mono">
        MOTODNA · DIGITAL IDENTITY SYSTEM · V0.1
      </footer>
    </div>
  );
}
