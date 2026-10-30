# Salon tattoo Laura

Web salonu a chráněná administrace rezervací. Node.js 24, SQLite, HTML/CSS/JavaScript. V produkci nepotřebuje žádné npm knihovny; jsdom slouží jen k testování rozhraní.

**Toto není statický web.** Na Renderu musí běžet jako **Web Service** s `npm start`. Samotné zveřejnění adresáře `public` nezprovozní rezervace ani přihlášení.

## Funkce

- Veřejný kalendář, výběr termínu a poptávka s obrázkem.
- Živá časová osa 08:00–20:00 v časové zóně Europe/Prague, včetně změny letního času. Hodiny se synchronizují podle serveru, ukazatel se aktualizuje každou sekundu. Zapsané rezervace se přes SSE projeví ihned; záložní obnovení dat probíhá každých 15 sekund.
- Rezervace 13:00–16:00 se v 16:00 označí jako dokončená a zobrazí se volno do další rezervace nebo do zavření. Ukazatel se před 08:00 a od 20:00 skryje; přehled dne zůstává dostupný.
- `/admin`: přidávání, změna, potvrzení a rušení rezervací, blokace času, galerie, kontakty, texty, otevírací doba, délka návštěvy, barevné ladění a vypnutí pohybu.
- Zaoblená tlačítka s animovaným odleskem, pohyb šipek, jemně animovaný hlavní obrázek a pozadí. Respektuje systémové omezení pohybu.
- SQLite ukládá i obrázky. Veřejné API obsahuje jen časy rezervací, nikoli jména a poznámky.
- Ochrana přihlášení, omezení počtu požadavků, kontrola kolizí termínů a validační pravidla na serveru.
- Při výpadku spojení se nezobrazují smyšlené termíny a formulář zůstává zablokovaný do obnovení spojení.

## Lokální spuštění

Node.js 24, potom:

```sh
npm ci
cp .env.example .env
# V .env nastav vlastní ADMIN_PASSWORD a SESSION_SECRET.
npm start
```

Otevři `http://localhost:3000`; administrace je `/admin`. Ukázkový režim je viditelně označený a neposílá e-maily.

## Bezplatné nasazení

Produkční Web Service: https://laurasalonweb.onrender.com (Render Free). Supabase projekt `laurasalon` v organizaci `lauratattoo` je na Free. Nejsou vytvořené placené disky ani služby.

Server používá `STORAGE_URL` a tajný `STORAGE_SECRET` v Environment Renderu. HTTPS Edge Function ověřuje tajný serverový klíč proti jeho SHA-256 otisku a provádí pouze předem povolené parametrizované dotazy. Skutečný klíč ani Supabase service role nejsou ve veřejném klientovi. Databázové tabulky mají RLS a nemají veřejná oprávnění; přes veřejné API server zveřejňuje pouze časové intervaly.

SQL základ je v `database/schema.sql`; ve vzdálené databázi byl aplikován nástrojem migrací. Časové kolize blokuje PostgreSQL exclusion constraint. Vícekrokové zápisy rezervace a e-mailové fronty se provedou atomicky v jednom RPC volání. Obrázky jsou uložené spolu s daty v PostgreSQL jako base64 a započítávají se do databázové kvóty Free, nikoli do samostatného Storage bucketu.

Bez STORAGE_URL aplikace používá lokální SQLite pro vývoj. Lokální SQLite není bezpečné trvalé úložiště pro Render Free. Nový produkční režim musí mít STORAGE_URL a STORAGE_SECRET.

Render Free se může při nečinnosti uspávat a Supabase Free může projekt pozastavit. Automatické placené upgrady nejsou nastavené. Při dosažení bezplatných limitů je potřeba uvolnit místo nebo provoz omezit, ne automaticky přejít na placený tarif.

## Aplikace pro Lauru

Na `/admin` je instalovatelná PWA. Na iPhonu otevři administraci v Safari, zvol Sdílet → Přidat na plochu. Na podporovaném Androidu použij tlačítko Přidat aplikaci na plochu. Nejde o samostatnou aplikaci z App Storu; používá stejný chráněný web.

Service worker ukládá pouze obecnou offline stránku a ikonu. Necachuje API, rezervace, kontakty ani obrázky klientů. Při výpadku sítě nezapisuje rezervace do dočasné offline fronty.

## Rezervace a e-maily

`APP_MODE=live` vyžaduje vzdálené úložiště (`STORAGE_URL` a `STORAGE_SECRET`) a stabilní `SESSION_SECRET`. Pro alternativní placený disk je zachována kompatibilita s PERSISTENT_STORAGE=true, ale v tomto projektu se nepoužívá.

Automatické e-maily jsou volitelné. Zapnou se, pokud jsou nastavené všechny tři hodnoty `RESEND_API_KEY`, `EMAIL_FROM` z ověřené domény a `SALON_EMAIL`. Nastav také `PUBLIC_URL` na skutečnou URL nové služby, aby odkazy v e-mailech vedly do administrace.

Bez e-mailové služby se poptávky ukládají do administrace a Laura je osobně potvrzuje. Web zákazníkovi neslibuje automatický e-mail. Čekající poptávka neblokuje čas, potvrzená rezervace ano. Ručně přidaná rezervace automatický e-mail neposílá. Po dodatečném zapnutí e-mailů se staré vypnuté zprávy samy neposílají.

## Ověření

```sh
npm run check
npm test
```

Testy ověřují API, přihlášení, soukromí, kolize, persistenci, přenos změn SSE, hranice 08:00 / 13:00 / 16:00 / 20:00, načtení celého rozhraní v DOM, stav při 404 a změnu vzhledu v administraci. DOM testy nenahrazují vizuální kontrolu v prohlížeči. GitHub Actions spouští stejné kontroly při změnách.

## Data a obsah

Před změnou úložiště zálohuj celou SQLite databázi včetně WAL pomocí SQLite backup mechanismu nebo snapshotu disku. JSON export z administrace obsahuje záznamy a odkazy na obrázky, nikoli samotné obrázky. Udržuj jednu instanci služby pro tento SQLite disk.

Dodané obrázky jsou označené digitální vizualizace. Laura může v administraci vložit fotografie svých prací. Musí také doplnit skutečnou adresu, telefon a informace o provozovateli a uchování údajů; tyto údaje nelze odvodit ze zdrojů.
