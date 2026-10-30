(() => {
  if(location.hostname==='tattoowebside.onrender.com'){location.replace('https://laurasalonweb.onrender.com'+location.pathname+location.search+location.hash);return;}
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('still');
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest('button, .button, .secondary');
    if (!button || button.disabled || reduced() || button.matches('.gallery-item,.inline-link')) return;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'press-wave'; ripple.setAttribute('aria-hidden','true');
    ripple.style.left = `${event.clientX - rect.left}px`; ripple.style.top = `${event.clientY - rect.top}px`;
    button.append(ripple); setTimeout(() => ripple.remove(), 750);
  });
  const button = document.querySelector('#install-app');
  if (!button) return;
  let invitation;
  const banner = document.querySelector('#install-banner');
  const help = document.querySelector('#install-help');
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  banner.hidden = !!standalone();
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); invitation = event; });
  window.addEventListener('appinstalled', () => { banner.hidden = true; invitation = null; });
  button.addEventListener('click', async () => {
    if (invitation) { await invitation.prompt(); await invitation.userChoice; invitation = null; return; }
    help.hidden = false;
    help.textContent = /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'Otevři tuto administraci v Safari. Klepni na Sdílet a zvol Přidat na plochu. Aplikace potřebuje internet pro ukládání rezervací.' : 'V nabídce prohlížeče zvol Nainstalovat aplikaci nebo Přidat na plochu. Aplikace potřebuje internet pro ukládání rezervací.';
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {
  if(location.hostname==='tattoowebside.onrender.com'){location.replace('https://laurasalonweb.onrender.com'+location.pathname+location.search+location.hash);return;} help.hidden=false; help.textContent='Instalace teď není dostupná. Administraci můžeš dál používat v prohlížeči.'; });
})();
