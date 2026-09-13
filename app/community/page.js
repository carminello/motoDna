'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, MessageSquare, Users, Bike, MapPin } from 'lucide-react';
import Logo from '@/components/Logo';

export default function CommunityPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [me, setMe] = useState(null);

  const load = async (query = '') => {
    const url = query ? `/api/community/users?q=${encodeURIComponent(query)}` : '/api/community/users';
    const res = await fetch(url);
    if (res.status === 401) return router.push('/');
    const data = await res.json();
    setUsers(data.users || []);
  };

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setMe(d.user));
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="border-b border-white/5 sticky top-0 bg-black/70 backdrop-blur z-40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <Logo size={26} />
          <span className="font-bold">Community</span>
          <div className="flex-1" />
          <Link href="/messages"><Button variant="outline" size="sm"><MessageSquare className="w-3 h-3 mr-1" />Messaggi</Button></Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 pt-8">
        <div className="mb-6">
          <div className="text-xs mono text-orange-400 uppercase tracking-widest mb-2">// Community MotoDNA</div>
          <h1 className="text-3xl md:text-4xl font-bold">Motociclisti connessi</h1>
          <p className="text-neutral-400 mt-1">Scopri altri proprietari, ammira le loro moto, scambia messaggi privati.</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per username, nome..." className="pl-10" />
        </div>

        <div className="flex items-center gap-2 mb-4 text-sm text-neutral-500">
          <Users className="w-4 h-4" />
          <span>{users.length} utenti</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(u => (
            <Card key={u.id} className="metallic overflow-hidden group hover:border-orange-500/40 transition">
              {u.sample_photo ? (
                <div className="relative h-32 overflow-hidden">
                  <img src={u.sample_photo} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
                  {u.sample_model && <Badge className="absolute top-2 right-2 bg-black/70 border-white/20 mono text-[10px]">{u.sample_model}</Badge>}
                </div>
              ) : (
                <div className="h-32 bg-gradient-to-br from-neutral-900 to-black flex items-center justify-center opacity-50">
                  <Bike className="w-12 h-12 text-neutral-700" />
                </div>
              )}
              <div className="p-4 -mt-8 relative">
                <div className="w-14 h-14 rounded-full bg-neutral-800 border-4 border-neutral-950 flex items-center justify-center overflow-hidden mb-3">
                  {u.profile_photo ? <img src={u.profile_photo} alt={u.username} className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-neutral-500" />}
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{u.first_name || u.username}</div>
                  {u.is_self && <Badge className="bg-orange-500/20 text-orange-400 text-[10px]">Tu</Badge>}
                </div>
                <div className="text-xs text-neutral-500 mono">@{u.username}</div>
                <div className="flex items-center gap-3 mt-3 text-xs text-neutral-400">
                  <span className="flex items-center gap-1"><Bike className="w-3 h-3" />{u.bike_count} {u.bike_count === 1 ? 'moto' : 'moto'}</span>
                  {u.country && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{u.country}</span>}
                </div>
                {!u.is_self && (
                  <Link href={`/messages/${u.id}`}>
                    <Button size="sm" className="w-full mt-3 bg-orange-600 hover:bg-orange-500"><MessageSquare className="w-3 h-3 mr-1" />Messaggio</Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
        {users.length === 0 && (
          <div className="text-center py-16 text-neutral-500 text-sm">Nessun utente trovato</div>
        )}
      </div>
    </div>
  );
}
