# Laura — aktualizace webu

## Co je připravené
- Administrace `/admin`: zakázky, potvrzení poptávek, blokace, úpravy, galerie, texty a otevírací doba.
- Časová osa 08:00–20:00 v Europe/Prague. Ukazatel se mění každou sekundu, data ze serveru každých 15 sekund. Ve 13:00–16:00 probíhá rezervace; v 16:00 je dokončená. Další obsazenost a otevírací doba určují dostupnost.
- Nastavení vzhledu: růže / champagne / šalvěj, vypnutí animací. Respektuje také systémové omezení pohybu.
- Jména a poznámky zákazníků nejsou ve veřejném kalendáři.

## Nasazení na existující Render
1. Zálohujte současnou databázi salon.sqlite včetně obrázků. Export JSON v administraci neobsahuje obrázky. Před restartem či změnou plánu zachraňte data z původního dočasného disku.
2. Nahrajte obsah této složky do současného GitHub repozitáře. Nepřepisujte vlastní tajné proměnné.
3. Pro skutečný provoz připojte persistentní disk `/var/data` a nastavte DATA_DIR=/var/data. Připravený `render.production.yaml` je vzor placené konfigurace; nebyl automaticky aplikován. Původní render.yaml zůstává ukázkový.
4. Nastavte ADMIN_PASSWORD (minimálně 12 znaků), SESSION_SECRET (32+ náhodných znaků), PERSISTENT_STORAGE=true a PUBLIC_URL=https://tattoowebside.onrender.com.
5. Pro e-maily nastavte RESEND_API_KEY, EMAIL_FROM z ověřené domény a SALON_EMAIL. Potom APP_MODE=live. Bez těchto hodnot ostrý režim záměrně nenastartuje.
6. Spusťte deploy a otevřete /admin. Laura nastaví skutečnou otevírací dobu, kontakty a fotografie. Stávající nastavení v databázi zůstává zachované; 8–20 je výchozí otevírací doba pouze u nové databáze.
7. Ověřte skutečné doručení e-mailu a jednu rezervaci v druhém okně. Obrázky z dodaného ZIPu jsou označené vizualizace; nahraďte je vlastními realizacemi.

## Ověření
`npm run check` a `npm test` (Node 24). Testy ověřují přihlášení, soukromí, kolize, změny stavů, persistenci a časové hranice 08:00, 13:00, 16:00, 20:00. Vizuální kontrola v prohlížeči ani skutečné e-mailové doručení v tomto prostředí neproběhly.
