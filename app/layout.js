import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script';

export const metadata = {
  title: 'MotoDNA - Digital Identity for Motorcycles',
  description: 'Il passaporto digitale della tua moto. Storia, manutenzione, modifiche - tutto in un unico tag NFC.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="it" className="dark">
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-screen bg-black text-neutral-100 antialiased">
        {children}
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
