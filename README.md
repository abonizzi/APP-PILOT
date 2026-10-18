# AppPilot
Promemoria personale del processo di creazione delle tue web app: progetti, checklist, note, account dei servizi (credenziali cifrate), patch notes e storico versioni.
**AppPilot non esegue deploy.** Per pubblicare si apre Netlify e poi si conferma a mano in AppPilot ("confermata da te", senza verifica automatica).

## 1. Requisiti
Account Supabase, repository GitHub, sito Netlify. Node 20 (solo se vuoi lavorare in locale; su Netlify la build usa Node 20 da `netlify.toml`).

## 2. Supabase
1. Crea un progetto Supabase.
2. SQL Editor: esegui in ordine `supabase/migrations/001_init.sql`, `002_rekey_vault.sql` e `003_supabase_account_limit.sql` (limite di 2 progetti per account Supabase) e `004_project_service_config.sql` (dati per singolo progetto); in alternativa usa il file unico `apppilot-supabase-completo.sql`.
3. Authentication → Providers → Email: **disattiva "Allow new users to sign up"**. Poi Authentication → Users → "Add user" con la tua email e password (account iniziale).
4. Authentication → URL Configuration: imposta Site URL sull'indirizzo Netlify (serve al recupero password).
5. Verifica RLS: esegui `supabase/tests/rls_test.sql`. Deve terminare con `RLS OK`; qualunque eccezione "FALLITO" va risolta prima di usare l'app.

## 3. Variabili d'ambiente
Copia `.env.example` in `.env` (locale) e imposta le stesse due variabili su Netlify (Site configuration → Environment variables):
- `VITE_SUPABASE_URL` — Project URL.
- `VITE_SUPABASE_ANON_KEY` — chiave pubblica anon/publishable.
Non inserire mai la `service_role` key né altri segreti nel frontend o nel repository.

## 4. GitHub e Netlify
1. Carica il progetto su GitHub (`.env` è già nel `.gitignore`).
2. Netlify → Add new site → Import from Git → scegli il repository. Build command `npm run build`, publish directory `dist` (già in `netlify.toml`, che gestisce anche il routing SPA).
3. Imposta le due variabili d'ambiente e avvia il deploy.
La build esegue `tsc --noEmit`: un errore di tipo blocca la pubblicazione.

## 5. Archivio credenziali
Al primo uso, in un progetto → "Servizi e account", crea la **master password** (min. 12 caratteri). Cifratura nel browser: PBKDF2-SHA256 (600.000 iterazioni) + AES-256-GCM; la password e la chiave non vengono mai salvate né inviate. Nel database stanno solo il salt, un controllo cifrato e i segreti cifrati. L'archivio si blocca dopo 10 minuti, al logout o col pulsante "Blocca".
**Se perdi la master password i segreti cifrati non sono recuperabili.** Esporta un backup cifrato da Impostazioni → Account e conservalo separatamente dalla password.

## 6. Test e build
`npm install`, `npm test` (progresso, regole di pubblicazione, cifratura, URL), `npm run build`. `supabase/tests/rls_test.sql` verifica l'isolamento dei dati.

## 7. Cosa fa e cosa no
Funziona: accesso privato, dashboard con ricerca/filtri/ordinamento, progetti (crea, modifica, duplica, archivia, elimina), checklist a tre stati con progresso, note con salvataggio automatico, link, servizi e account cifrati, backup e cambio master password, impostazioni (tema, anteprima smartphone, modelli di step, test connessione), patch notes e storico versioni.
Volutamente assente: qualsiasi deploy automatico o verifica del sito pubblicato.
Limiti noti: il tema chiaro e il layout smartphone vanno controllati a occhio; i test dei componenti React non sono inclusi; il backup copre gli account, non i progetti.
