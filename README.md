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

## Render

`render.yaml` vytváří **novou** Node Web Service `laurasalon-server`, plán Starter, s persistentním diskem o velikosti 1 GB. Instance i disk jsou placené prostředky Renderu. Konfigurace používá kořen repozitáře, `npm ci --omit=dev` a `npm start`. `ADMIN_PASSWORD` a `SESSION_SECRET` generuje Render; heslo pro Lauru je dostupné vlastníkovi účtu v Environment této nové služby.

Původní Static Site se nepřevádí pouhou úpravou env proměnných. Neodstraňuj ji před ověřením nové služby. Po nasazení a ověření nové URL lze z původního statického webu nastavit přesměrování na novou službu. Původní adresa `tattoowebside.onrender.com` není automaticky přenesena na novou službu.

`render.production.yaml` obsahuje stejnou konfiguraci pro ruční použití. Nasazuj jen jeden z těchto souborů, nevytvářej dvě služby.

## Rezervace a e-maily

`APP_MODE=live` vyžaduje trvalé úložiště (`PERSISTENT_STORAGE=true`, `DATA_DIR=/var/data`) a stabilní `SESSION_SECRET`. Samotné nastavení proměnné nepřipojuje disk; ten musí skutečně existovat.

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
