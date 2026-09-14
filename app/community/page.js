'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, MessageSquare, Users, Bike, MapPin, ExternalLink, User as UserIcon } from 'lucide-react';
import Logo from '@/components/Logo';
import { CommunitySkeleton } from '@/components/skeletons';

export default function CommunityPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (query = '') => {
    setError(null);
    try {
      const url = query ? `/api/community/users?q=${encodeURIComponent(query)}` : '/api/community/users';
      const res = await fetch(url);
      if (res.status === 401) return router.push('/');
      const data = await res.json();
      if (data.error) setError(data.error);
      else setUsers(data.users || []);
    } catch (e) {
      setError('Errore di rete');
    } finally {
      setLoading(false);
    }
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
          <span>{users.length} {users.length === 1 ? 'utente' : 'utenti'}</span>
        </div>

        {error && (
          <Card className="metallic p-6 border-red-500/30 mb-4 text-sm text-red-400">Errore: {error}</Card>
        )}

        {loading ? (
          <CommunitySkeleton />
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 text-sm">Nessun utente trovato</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {users.map(u => (
              <Card key={u.id} className="metallic overflow-hidden group hover:border-orange-500/40 transition flex flex-col">
                {/* Cover image - prominent */}
                <div className="relative h-52 overflow-hidden bg-neutral-900">
                  {u.sample_photo ? (
                    <img src={u.sample_photo} alt={u.sample_model || 'moto'} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-black flex items-center justify-center">
                      <Bike className="w-16 h-16 text-neutral-800" strokeWidth={1} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  {u.sample_public_id && (
                    <Badge className="absolute top-3 left-3 bg-black/70 backdrop-blur border-white/20 mono text-[10px]">{u.sample_public_id}</Badge>
                  )}
                  {u.is_self && (
                    <Badge className="absolute top-3 right-3 bg-orange-500 text-white text-[10px]">Tu</Badge>
                  )}
                  {u.sample_brand && u.sample_model && (
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="text-[10px] mono uppercase text-neutral-300">{u.sample_brand}</div>
                      <div className="text-lg font-bold text-white leading-tight">{u.sample_model} {u.sample_year && <span className="text-neutral-400 font-normal mono text-sm">· {u.sample_year}</span>}</div>
                    </div>
                  )}
                </div>

                {/* User info */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-neutral-950 flex items-center justify-center overflow-hidden shrink-0">
                      {u.profile_photo ? <img src={u.profile_photo} alt={u.username} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-neutral-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{u.first_name || u.username}</div>
                      <div className="text-xs text-neutral-500 mono truncate">@{u.username}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-xs text-neutral-400">
                    <span className="flex items-center gap-1"><Bike className="w-3 h-3" />{u.bike_count} moto</span>
                    {u.country && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{u.country}</span>}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link href={`/u/${u.id}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full"><UserIcon className="w-3 h-3 mr-1" />Profilo</Button>
                    </Link>
                    {!u.is_self && (
                      <Link href={`/messages/${u.id}`} className="flex-1">
                        <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-500"><MessageSquare className="w-3 h-3 mr-1" />Scrivi</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
