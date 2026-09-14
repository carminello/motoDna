'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function ImageUploader({ onUploaded, accept = 'image/*', label = 'Carica immagine', currentUrl = null, visibility = 'public' }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(currentUrl);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('File troppo grande (max 10MB)');
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append('file', file);
      if (visibility === 'private') form.append('visibility', 'private');
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload fallito');
      setPreview(data.url);
      onUploaded(data);
      toast.success('Caricato');
    } catch (e) {
      toast.error(e.message);
      setPreview(currentUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
      {preview ? (
        <div className="relative group">
          <img src={preview} alt="preview" className="w-full h-40 object-cover rounded-lg border border-white/10" />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center text-sm font-medium">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sostituisci'}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="w-full h-40 border-2 border-dashed border-white/15 hover:border-orange-500/50 rounded-lg flex flex-col items-center justify-center text-neutral-400 hover:text-orange-400 transition">
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Upload className="w-6 h-6 mb-2" /><span className="text-sm">{label}</span><span className="text-xs text-neutral-600 mt-1">JPG, PNG, WebP - max 10MB</span></>}
        </button>
      )}
    </div>
  );
}
