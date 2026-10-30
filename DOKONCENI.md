# Nasazení Laura

- Rozpočet 0 Kč: Render Free + Supabase Free.
- Veřejný web https://laurasalonweb.onrender.com, administrace /admin.
- Původní statický web po aktualizaci přesměruje návštěvníka na novou adresu.
- Implementované vzdálené ukládání, ochrana proti kolizím, soukromé fotky, živá osa a změny SSE.
- Nové ovládání s animovaným odleskem a odezvou na dotyk. Respektuje omezení pohybu.
- Administraci lze přidat na plochu telefonu jako PWA. Offline stránka neslibuje uložení rezervací bez internetu.
- Automatické e-maily nejsou připojené. Laura potvrzuje zákazníkům návštěvu osobně.
- Heslo je v ADMIN_PASSWORD v nastavení služby Render; tajné hodnoty nejsou v repozitáři.
- Integrační test vzdáleného úložiště ověřil rezervace, souběžné kolize, aktualizace, mazání a obrázky. Testovací záznamy byly odstraněny.
- Zbývá ověření posledního nasazení a vizuální kontrola v prohlížeči. Kontakty a skutečné fotografie doplní Laura.
