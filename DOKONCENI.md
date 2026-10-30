# Stav přípravy a nasazení

Zdrojový repozitář: https://github.com/lauratattoo/Laurasalon
Původní Static Site: https://tattoowebside.onrender.com
Render ID: srv-dbgub6ks728c73cd12og

## Ověřený problém původní služby

30. 10. 2026 veřejné HTML, app.js a style.css odpovídaly dříve dodanému ZIPu. `/api/public` i `/api/health` vracely HTTP 404. Uživatel potvrdil typ Static Site. Proto nefunguje kalendář a přihlášení, přestože soubory aplikace už jsou nahrané.

## Připravená oprava

V tomto balíčku je upravený vzhled a animace, funkční server, okamžité přenášení změn, testy rozhraní a konfigurace Node Web Service s trvalým diskem. Podrobnosti jsou v README.md. Žádná služba nebyla tímto balíčkem automaticky vytvořena ani smazána.

## Zbývající nasazení

1. Autorizovat zápis do repozitáře a přístup do Renderu. V prostředí přípravy dosavadní přihlášení ke GitHubu neprošlo; Render účet nebyl připojený.
2. Nahrát a ověřit změny v repozitáři.
3. Vytvořit novou Web Service z render.yaml (placený Starter a persistentní disk). Stávající Static Site zatím ponechat.
4. Ověřit `/api/health`, `/api/public`, přihlášení a uložení zkušební rezervace na nové URL. Zkušební záznam poté odstranit.
5. Ověřit v prohlížeči desktop i mobil: animace, stav bez spojení a změnu rezervace ve druhém okně.
6. Po ověření nastavit přesměrování původní Static Site na skutečnou URL nové služby. Přesný postup podle dostupných nastavení Renderu.
7. Laura si v Environment nové služby vyzvedne vygenerované ADMIN_PASSWORD a v /admin nastaví kontakty, obsah, vlastní fotografie a vzhled.

Automatické e-maily nejsou podmínkou fungování rezervací. Pokud je chcete, je nutná ověřená odesílací doména a připojení e-mailové služby; detaily v README.md.
