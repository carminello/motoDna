'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import Logo from '@/components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Richiesta non riuscita.');
      setMessage(data.message || 'Se l’indirizzo è associato a un account, riceverai un link via email.');
    } catch (err) {
      setError(err.message || 'Si è verificato un errore.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-5">
      <Card className="w-full max-w-md bg-neutral-950 border-white/10 p-7 rounded-2xl">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <Logo size={40} />
          <span className="font-bold text-lg">MotoDNA</span>
        </Link>
        <h1 className="text-2xl font-bold">Recupera la password</h1>
        <p className="text-sm text-neutral-400 mt-2 mb-6">Inserisci l’email del tuo account. Se è registrato, ti invieremo un link valido 30 minuti.</p>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Email</Label><Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" /></div>
          {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500">{loading ? 'Invio in corso…' : 'Invia link di recupero'}</Button>
        </form>
        <p className="mt-6 text-sm text-center"><Link href="/" className="text-orange-400 hover:text-orange-300">Torna al login</Link></p>
      </Card>
    </main>
  );
}
