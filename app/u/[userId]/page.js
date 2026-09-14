'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageSquare, User as UserIcon, MapPin, Bike, Calendar, ExternalLink } from 'lucide-react';
import Logo from '@/components/Logo';
import { UserProfileSkeleton } from '@/components/skeletons';

export default function UserProfilePage({ params }) {
  const { userId } = use(params);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) return router.push('/');
      setMe(d.user);
    });
    fetch(`/api/community/users/${userId}`).then(async r => {
      if (r.status === 401) return router.push('/');
      const d = await r.json();
      if (d.error) setError(d.error);
      else setData(d);
    }).catch(() => setError('Errore di rete'));
  }, [userId]);

  if (error) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <Card className="metallic p-8 max-w-md text-center">
        <UserIcon className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
        <div className="text-xl font-bold mb-2">Utente non trovato</div>
        <p className="text-sm text-neutral-400 mb-4">{error}</p>
        <Link href="/community"><Button variant="outline">Torna alla Community</Button></Link>
      </Card>
    </div>
  );

  if (!data) return <UserProfileSkeleton />;

  const { user, bikes } = data;
  const isSelf = me?.id === user.id;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="border-b border-white/5 sticky top-0 bg-black/70 backdrop-blur z-40">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/community"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <Logo size={26} />
          <span className="font-bold">Profilo</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 pt-8">
        {/* Profile hero */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-32 h-32 rounded-full bg-neutral-800 border-4 border-neutral-950 shadow-[0_0_40px_-10px_rgba(238,100,50,0.4)] overflow-hidden flex items-center justify-center mb-4">
            {user.profile_photo ? (
              <img src={user.profile_photo} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-16 h-16 text-neutral-500" />
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">{user.first_name || user.username} {user.last_name || ''}</h1>
          <div className="text-sm mono text-orange-400 mt-1">@{user.username}</div>
          <div className="flex items-center gap-4 mt-3 text-xs text-neutral-400">
            {user.country && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{user.country}</span>}
            <span className="flex items-center gap-1"><Bike className="w-3 h-3" />{bikes.length} moto pubbliche</span>
            {user.created_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Iscritto {new Date(user.created_at).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}</span>}
          </div>
          {!isSelf && (
            <Link href={`/messages/${user.id}`} className="mt-5">
              <Button className="bg-orange-600 hover:bg-orange-500"><MessageSquare className="w-4 h-4 mr-1" />Scrivi un messaggio</Button>
            </Link>
          )}
        </div>

        {/* Bikes grid */}
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Bike className="w-4 h-4 text-orange-400" />Le sue moto pubbliche</h2>
        {bikes.length === 0 ? (
          <Card className="metallic p-10 text-center text-neutral-500 text-sm">Nessuna moto pubblica</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bikes.map(b => (
              <a key={b.id} href={`/m/${b.public_id}`} target="_blank" rel="noopener">
                <Card className="metallic overflow-hidden group hover:border-orange-500/40 transition cursor-pointer">
                  <div className="relative h-40 bg-neutral-900 overflow-hidden">
                    {b.main_photo ? (
                      <img src={b.main_photo} alt={b.model} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Bike className="w-12 h-12 text-neutral-700" strokeWidth={1} /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <Badge className="absolute top-2 left-2 bg-black/70 mono text-[10px] border-white/20">{b.public_id}</Badge>
                    <ExternalLink className="absolute top-2 right-2 w-4 h-4 text-white/60" />
                  </div>
                  <div className="p-4">
                    <div className="text-xs mono uppercase text-neutral-500">{b.brand}</div>
                    <div className="text-lg font-bold">{b.model}</div>
                    <div className="text-xs mono text-neutral-400 mt-1">{b.year} · {b.engine_cc}cc · {(b.current_mileage || 0).toLocaleString('it-IT')} km</div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
