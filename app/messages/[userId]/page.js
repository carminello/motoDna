'use client';
import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Send, User } from 'lucide-react';
import Logo from '@/components/Logo';
import { ChatSkeleton } from '@/components/skeletons';

function timeStamp(date) {
  return new Date(date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage({ params }) {
  const { userId } = use(params);
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [other, setOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const load = async () => {
    const res = await fetch(`/api/messages/${userId}`);
    if (res.status === 401) return router.push('/');
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setOther(data.other);
    setMessages(data.messages || []);
  };

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setMe(d.user));
    load();
    const interval = setInterval(load, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/messages/${userId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages([...messages, data.message]);
      setText('');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  if (!other) return <ChatSkeleton />;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-white/5 sticky top-0 bg-black/70 backdrop-blur z-40 shrink-0">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/messages"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden">
            {other.profile_photo ? <img src={other.profile_photo} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-neutral-500" />}
          </div>
          <div className="flex-1">
            <div className="font-bold leading-none">{other.first_name || other.username}</div>
            <div className="text-xs mono text-neutral-500">@{other.username}</div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-sm">Nessun messaggio ancora. Rompi il ghiaccio!</div>
          ) : (
            messages.map(m => {
              const mine = m.from_user_id === me?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white' : 'bg-neutral-900 border border-white/10 text-neutral-100'}`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    <div className={`text-[10px] mono mt-1 ${mine ? 'text-white/70' : 'text-neutral-500'}`}>{timeStamp(m.created_at)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t border-white/5 bg-black/70 backdrop-blur shrink-0">
        <form onSubmit={send} className="max-w-3xl mx-auto px-5 py-3 flex gap-2 items-end">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi un messaggio..." rows={1} maxLength={2000} className="resize-none min-h-[44px] max-h-32" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} />
          <Button type="submit" disabled={busy || !text.trim()} className="bg-orange-600 hover:bg-orange-500 h-11 shrink-0"><Send className="w-4 h-4" /></Button>
        </form>
      </div>
    </div>
  );
}
