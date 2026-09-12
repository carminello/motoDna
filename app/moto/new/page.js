'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Cpu } from 'lucide-react';

export default function NewMoto() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ brand: '', model: '', version: '', year: '', engine_cc: '', engine_type: '', color: '', current_mileage: '', main_photo: '', description: '' });

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/motorcycles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Moto creata: ${data.moto.public_id}`);
      router.push(`/moto/${data.moto.id}`);
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/5 sticky top-0 bg-black/70 backdrop-blur z-40">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex items-center gap-2"><Cpu className="w-5 h-5 text-orange-400" /><span className="font-bold">Nuova moto</span></div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-5 py-8">
        <h1 className="text-3xl font-bold mb-2">Registra una nuova moto</h1>
        <p className="text-neutral-400 mb-6">Verrà generato automaticamente un identificativo MotoDNA univoco.</p>
        <Card className="metallic p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Marca *</Label><Input required value={f.brand} onChange={set('brand')} placeholder="Honda" /></div>
              <div><Label>Modello *</Label><Input required value={f.model} onChange={set('model')} placeholder="VF400F" /></div>
              <div><Label>Versione</Label><Input value={f.version} onChange={set('version')} placeholder="Interceptor" /></div>
              <div><Label>Anno</Label><Input type="number" value={f.year} onChange={set('year')} placeholder="1984" /></div>
              <div><Label>Cilindrata (cc)</Label><Input type="number" value={f.engine_cc} onChange={set('engine_cc')} placeholder="399" /></div>
              <div><Label>Tipo motore</Label><Input value={f.engine_type} onChange={set('engine_type')} placeholder="V4 4-tempi" /></div>
              <div><Label>Colore</Label><Input value={f.color} onChange={set('color')} placeholder="Rosso / Bianco" /></div>
              <div><Label>Chilometraggio</Label><Input type="number" value={f.current_mileage} onChange={set('current_mileage')} placeholder="15420" /></div>
            </div>
            <div><Label>URL foto principale</Label><Input value={f.main_photo} onChange={set('main_photo')} placeholder="https://..." /></div>
            <div><Label>Descrizione</Label><Textarea value={f.description} onChange={set('description')} rows={4} /></div>
            <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500">{loading ? 'Creazione...' : 'Crea moto + genera MotoDNA'}</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
