'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageSquare, Users, Inbox } from 'lucide-react';
import Logo from '@/components/Logo';

function timeAgo(date) {
  const d = new Date(date);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'ora';
  if (s < 3600) return `${Math.floor(s / 60)}m fa`;
  if (s < 86400) return `${Math.floor(s / 3600)}h fa`;
  if (s < 604800) return `${Math.floor(s / 86400)}g fa`;
  return d.toLocaleDateString('it-IT');
}

export default function MessagesInbox() {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/messages').then(r => {
      if (r.status === 401) return router.push('/');
      return r.json();
    }).then(d => { if (d) setConversations(d.conversations || []); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="border-b border-white/5 sticky top-0 bg-black/70 backdrop-blur z-40">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <Logo size={26} />
          <span className="font-bold">Messaggi</span>
          <div className="flex-1" />
          <Link href="/community"><Button variant="outline" size="sm"><Users className="w-3 h-3 mr-1" />Community</Button></Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 pt-8">
        <div className="text-xs mono text-orange-400 uppercase tracking-widest mb-2">// Inbox</div>
        <h1 className="text-3xl md:text-4xl font-bold mb-6">Conversazioni</h1>

        {loading ? (
          <div className="text-neutral-500 text-sm">Caricamento...</div>
        ) : conversations.length === 0 ? (
          <Card className="metallic p-10 text-center">
            <Inbox className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
            <div className="font-semibold mb-1">Nessun messaggio</div>
            <p className="text-sm text-neutral-500 mb-4">Vai nella Community e inizia a scambiare messaggi con gli altri motociclisti.</p>
            <Link href="/community"><Button className="bg-orange-600 hover:bg-orange-500"><Users className="w-3 h-3 mr-1" />Vai alla Community</Button></Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations.map(c => (
              <Link key={c.user.id} href={`/messages/${c.user.id}`}>
                <Card className={`metallic p-4 flex items-center gap-3 hover:border-orange-500/40 transition cursor-pointer ${c.unread > 0 ? 'border-orange-500/30 bg-orange-500/5' : ''}`}>
                  <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                    {c.user.profile_photo ? <img src={c.user.profile_photo} alt="" className="w-full h-full object-cover" /> : <MessageSquare className="w-5 h-5 text-neutral-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{c.user.first_name || c.user.username}</div>
                      {c.unread > 0 && <Badge className="bg-orange-500 text-white text-[10px]">{c.unread}</Badge>}
                    </div>
                    <div className="text-sm text-neutral-400 truncate">
                      {c.last_from_me && <span className="text-neutral-500">Tu: </span>}
                      {c.last_message}
                    </div>
                  </div>
                  <div className="text-[10px] mono text-neutral-500 shrink-0">{timeAgo(c.last_at)}</div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
