# Recupero password MotoDNA tramite Telegram

## Variabili d'ambiente su Vercel

Aggiungere le seguenti variabili in **Project → Settings → Environment Variables**:

- `TELEGRAM_BOT_TOKEN`: token del bot ottenuto da BotFather. Solo server-side, senza prefisso `NEXT_PUBLIC_`.
- `TELEGRAM_WEBHOOK_SECRET`: stringa casuale lunga e difficile da indovinare, usata per verificare le chiamate webhook.
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`: username pubblico del bot, senza `@`, per esempio `MotoDNABot`.
- `NEXT_PUBLIC_APP_URL`: URL HTTPS pubblico di MotoDNA su Vercel, senza slash finale. È consigliato impostarlo esplicitamente.

L'invio email usa la configurazione Gmail API già presente: `GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.

Dopo aver impostato le variabili, eseguire un nuovo deploy su Vercel.

## Registrare il webhook Telegram

Dopo il deploy, registrare il webhook una sola volta usando l'URL HTTPS del progetto e gli stessi valori delle variabili. Non inserire mai il token del bot nel codice sorgente, nei commit o nei messaggi condivisi.

Esempio da eseguire in un terminale, sostituendo i segnaposto localmente:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<DOMINIO-VERCEL>/api/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

Telegram accetta come `secret_token` lettere, numeri, trattini e underscore; usare una stringa casuale compatibile. La risposta deve contenere `"ok": true`.

Per controllare la configurazione:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

## Flusso

1. L'utente apre il bot e preme **Recupera password**.
2. Il bot raccoglie l'email e crea una richiesta in attesa, senza rivelare se l'account esiste.
3. Un amministratore approva o rifiuta la richiesta nella Console Admin.
4. Se l'account esiste e l'email viene inviata correttamente, il link monouso arriva solo alla email registrata ed è valido 30 minuti.
5. La pagina `/reset-password` aggiorna la password senza cancellare l'account o i dati associati.

Il webhook usa l'header segreto Telegram e il token di reset non viene mai inviato su Telegram.
