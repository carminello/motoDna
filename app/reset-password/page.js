'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import Logo from '@/components/Logo';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossibile aggiornare la password.');
      setMessage(data.message || 'Password aggiornata.');
      setPassword('');
      setConfirmPassword('');
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
        <h1 className="text-2xl font-bold">Scegli una nuova password</h1>
        <p className="text-sm text-neutral-400 mt-2 mb-6">La password deve contenere almeno 8 caratteri.</p>
        {!token ? (
          <p className="text-sm text-red-400">Il link non è valido. Richiedi un nuovo link di recupero.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Nuova password</Label><Input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <div><Label>Conferma password</Label><Input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
            {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500">{loading ? 'Aggiornamento…' : 'Aggiorna password'}</Button>
          </form>
        )}
        {message && <p className="mt-5 text-sm"><Link href="/" className="text-orange-400 hover:text-orange-300">Vai al login</Link></p>}
        {!message && <p className="mt-6 text-sm text-center"><Link href="/forgot-password" className="text-orange-400 hover:text-orange-300">Richiedi un nuovo link</Link></p>}
      </Card>
    </main>
  );
}
