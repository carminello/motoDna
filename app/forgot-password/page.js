'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { MessageCircle, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const botUrl = botUsername ? `https://t.me/${botUsername.replace(/^@/, '')}` : null;

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-5">
      <Card className="w-full max-w-md bg-neutral-950 border-white/10 p-7 rounded-2xl">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <Logo size={40} />
          <span className="font-bold text-lg">MotoDNA</span>
        </Link>
        <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-5">
          <MessageCircle className="w-6 h-6 text-sky-400" />
        </div>
        <h1 className="text-2xl font-bold">Recupera la password</h1>
        <p className="text-sm text-neutral-400 mt-2 mb-5">
          Il recupero avviene tramite il bot ufficiale MotoDNA su Telegram. La richiesta viene verificata da un amministratore e, se approvata, il link temporaneo viene inviato all’email associata all’account.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-5 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-neutral-400">Per proteggere il tuo account, non inviamo mai il link di reimpostazione direttamente su Telegram.</p>
        </div>
        {botUrl ? (
          <a href={botUrl} target="_blank" rel="noreferrer">
            <Button className="w-full bg-sky-600 hover:bg-sky-500"><MessageCircle className="w-4 h-4 mr-2" />Apri il bot Telegram</Button>
          </a>
        ) : (
          <p className="text-sm text-amber-300 border border-amber-500/20 bg-amber-500/5 rounded-lg p-3">
            Il bot non è ancora collegato a questa pagina. Contatta l’amministratore MotoDNA per ricevere il link al bot.
          </p>
        )}
        <p className="mt-6 text-sm text-center">
          <Link href="/" className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Torna al login</Link>
        </p>
      </Card>
    </main>
  );
}
