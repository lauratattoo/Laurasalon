# Stav projektu — rozpočet 0 Kč

- Opravy rozhraní, animace, živé změny rezervací a 12 úspěšných testů jsou v repozitáři.
- Původní služba srv-dbgub6ks728c73cd12og je Static Site. Sama neumí spustit rezervace.
- Žádná nová placená služba ani disk nebyly vytvořeny.
- Placené soubory render.yaml a render.production.yaml jsou odstraněné podle nového rozpočtu uživatele.
- Navržená bezplatná architektura: Render Free + Supabase Free. Vyžaduje připojení Supabase a úpravu současného SQLite ukládání. Tato migrace ještě není implementovaná.
- Po připojení Supabase ověřit bezplatný tarif, vytvořit databázové schéma a úložiště obrázků, upravit server, otestovat soukromí i kolize a nasadit výhradně bezplatnou službu.
- Potom ověřit veřejný web, administraci a uložení dat po restartu, připravit přesměrování původní adresy.
