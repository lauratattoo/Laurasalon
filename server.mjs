import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorage, storageScope } from './storage.mjs';
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
fs.mkdirSync(dir, {
  recursive: true
});
const db = createStorage(path.join(dir, 'salon.sqlite'));
await db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY, value TEXT); CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY, value TEXT); CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY, mime TEXT, bytes BLOB, public INTEGER); CREATE TABLE IF NOT EXISTS mail(id TEXT PRIMARY KEY, payload TEXT, state TEXT, attempts INTEGER DEFAULT 0, error TEXT);');
const defaults = {
  appearance: {
    accent: 'rose',
    motion: true
  },
  title: 'Salon tattoo Laura',
  tagline: 'Malý detail.\nVelký příběh.',
  intro: 'Tetování, které je tvoje. Od prvního nápadu až po poslední linku — společně najdeme podobu tvého příběhu.',
  about: 'Prostor pro tvoje nápady',
  aboutText: 'Jsem Laura. Máš v hlavě motiv, vzpomínku nebo zatím jen pocit? Pošli mi svou představu a společně probereme návrh, umístění i termín.',
  email: 'Tattoolaura@seznam.cz',
  phone: '',
  address: '',
  instagram: '',
  hours: {
    1: ['08:00', '20:00'],
    2: ['08:00', '20:00'],
    3: ['08:00', '20:00'],
    4: ['08:00', '20:00'],
    5: ['08:00', '20:00'],
    6: null,
    0: null
  },
  duration: 120,
  privacy: 'Kontaktní údaje a přiložený návrh používáme pro vyřízení tvé poptávky a domluvu termínu.',
  gallery: [{
    id: 'one',
    title: 'Fleur-de-lis',
    type: 'Dotwork',
    image: '/assets/tattoos.png',
    position: '0% 0%',
    sheet: true,
    visualization: true
  }, {
    id: 'two',
    title: 'Síla v lince',
    type: 'Linework',
    image: '/assets/tattoos.png',
    position: '100% 0%',
    sheet: true,
    visualization: true
  }, {
    id: 'three',
    title: 'Osobní podpis',
    type: 'Lettering',
    image: '/assets/tattoos.png',
    position: '0% 100%',
    sheet: true,
    visualization: true
  }, {
    id: 'four',
    title: 'Ve stínu',
    type: 'Dotwork',
    image: '/assets/tattoos.png',
    position: '100% 100%',
    sheet: true,
    visualization: true
  }]
};
if (!(await db.prepare('SELECT id FROM settings').get())) await db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify(defaults));
const settings = async () => ({
  ...defaults,
  ...JSON.parse((await db.prepare('SELECT value FROM settings WHERE id=1').get()).value)
});
const bookings = async () => (await db.prepare('SELECT value FROM bookings').all()).map(x => JSON.parse(x.value));
const put = async b => await db.prepare('INSERT OR REPLACE INTO bookings VALUES(?,?)').run(b.id, JSON.stringify(b));
const live = process.env.APP_MODE === 'live';
const emailEnabled = live && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.SALON_EMAIL);
const subscribers = new Set();
function notifySubscribers() {
  for (const stream of subscribers) {
    if (stream.writableLength > 65536) {
      stream.destroy();
      subscribers.delete(stream);
    } else stream.write('event: change\ndata: {}\n\n');
  }
}
const secret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) throw new Error('Nastavte ADMIN_PASSWORD (alespoň 12 znaků). Viz .env.example.');
if (live && (!process.env.SESSION_SECRET || secret.length < 32 || (!process.env.STORAGE_URL && process.env.PERSISTENT_STORAGE !== 'true'))) throw new Error('Live režim vyžaduje SESSION_SECRET a PERSISTENT_STORAGE=true.');
const today = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Prague',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());
const clock = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
}).format(new Date());
const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const validTime = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
function validDate(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
}
function fail(message, status = 400) {
  throw Object.assign(new Error(message), {
    status
  });
}
async function interval(b, publicRequest = false) {
  if (!validDate(b.date) || !validTime(b.start) || !validTime(b.end) || b.start >= b.end) fail('Zkontroluj datum a čas od–do.');
  if (publicRequest) {
    if (b.date < today() || b.date > new Date(Date.now() + 366 * 864e5).toISOString().slice(0, 10) || b.date === today() && b.start <= clock().slice(0, 5)) fail('Vyber budoucí termín, nejvýše rok dopředu.');
    const h = (await settings()).hours[new Date(b.date + 'T12:00:00Z').getUTCDay()];
    if (!h || b.start < h[0] || b.end > h[1]) fail('Termín je mimo otevírací dobu.');
  }
}
const overlap = (a, b) => a.date === b.date && a.start < b.end && a.end > b.start;
async function conflicts(b) {
  return (await bookings()).some(x => x.id !== b.id && ['confirmed', 'blocked'].includes(x.status) && overlap(x, b));
}
const sign = s => createHmac('sha256', secret).update(s).digest('hex');
function auth(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('salon_session='))?.slice(14);
  if (!raw) return false;
  const [exp, nonce, sig] = raw.split('.');
  const expected = sign(exp + '.' + nonce);
  return Number(exp) > Date.now() && typeof sig === 'string' && /^[a-f0-9]{64}$/.test(sig) && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
const rates = new Map();
function limit(req, key, max) {
  const ip = (process.env.RENDER ? req.headers['x-forwarded-for']?.split(',').pop()?.trim() : req.socket.remoteAddress) || 'local';
  const k = key + ip;
  const now = Date.now();
  const r = rates.get(k);
  if (!r || r.until < now) rates.set(k, {
    until: now + 15 * 60e3,
    n: 1
  });else if (++r.n > max) fail('Příliš mnoho pokusů. Zkus to za 15 minut.', 429);
  if (rates.size > 10000) for (const [k, v] of rates) if (v.until < now) rates.delete(k);
}
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail('Požadován JSON.', 415);
  let chunks = [],
    size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 8 * 1024 * 1024) fail('Soubor je příliš velký.', 413);
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    fail('Neplatná data.');
  }
}
async function upload(data, isPublic = false) {
  if (!data) return null;
  const m = typeof data === 'string' && data.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) fail('Použij JPG, PNG nebo WebP.');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 12) fail('Obrázek musí mít nejvýše 5 MB.');
  const kind = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'image/jpeg' : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png' : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : '';
  if (kind !== m[1]) fail('Neplatný obrázek.');
  const id = randomUUID();
  await db.prepare('INSERT INTO uploads VALUES(?,?,?,?)').run(id, kind, bytes, isPublic ? 1 : 0);
  return '/media/' + id;
}
async function queue(id, to, subject, text) {
  await db.prepare('INSERT OR IGNORE INTO mail(id,payload,state) VALUES(?,?,?)').run(id, JSON.stringify({
    from: process.env.EMAIL_FROM || '',
    to: [to],
    subject,
    text
  }), !live ? 'demo' : emailEnabled ? 'pending' : 'disabled');
}
let mailing = false;
async function sendMail() {
  if (!emailEnabled || mailing) return;
  mailing = true;
  try {
    const rows = await db.prepare("SELECT * FROM mail WHERE state='pending' AND attempts<6 LIMIT 5").all();
    for (const r of rows) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json',
            'Idempotency-Key': r.id
          },
          body: r.payload,
          signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) throw new Error('E-mailová služba: ' + res.status);
        await db.prepare("UPDATE mail SET state='sent',error=NULL WHERE id=?").run(r.id);
      } catch (e) {
        await db.prepare('UPDATE mail SET attempts=attempts+1,error=? WHERE id=?').run(e.message, r.id);
      }
    }
  } finally {
    mailing = false;
  }
}
const clean = (v, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : '';
function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}
const server = http.createServer((req, res) => storageScope.run({ pending: null }, async () => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost'),
      p = url.pathname;
    const admin = auth(req);
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && ['/api/admin/bookings', '/api/admin/settings', '/api/admin/gallery'].includes(p)) res.once('finish', () => {
      if (res.statusCode < 300) notifySubscribers();
    });
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) {
      const allowed = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).host : req.headers.host;
      if (new URL(req.headers.origin).host !== allowed) fail('Neplatný původ požadavku.', 403);
    }
    if (p === '/api/events' && req.method === 'GET') {
      if (subscribers.size >= 500) fail('Zkus připojení za chvíli.', 503);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write('retry: 3000\nevent: ready\ndata: {}\n\n');
      subscribers.add(res);
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
      res.once('close', () => {
        clearInterval(heartbeat);
        subscribers.delete(res);
      });
      return;
    }
    if (p === '/api/health') { await settings(); return json(res, {
      ok: true
    }); }
    if (p === '/api/public' && req.method === 'GET') return json(res, {
      settings: await settings(),
      mode: live ? 'live' : 'demo',
      emailEnabled,
      today: today(),
      clock: clock(),
      serverTime: Date.now(),
      busy: (await bookings()).filter(b => ['confirmed', 'blocked'].includes(b.status)).map(({
        date,
        start,
        end
      }) => ({
        date,
        start,
        end
      }))
    });
    if (p === '/api/login' && req.method === 'POST') {
      limit(req, 'login', 10);
      const b = await body(req);
      const hash = v => createHmac('sha256', secret).update(String(v)).digest();
      if (!timingSafeEqual(hash(b.password), hash(password))) fail('Nesprávné heslo.', 401);
      const token = Date.now() + 8 * 3600e3 + '.' + randomBytes(24).toString('hex');
      res.setHeader('Set-Cookie', 'salon_session=' + token + '.' + sign(token) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800' + (process.env.RENDER || process.env.NODE_ENV === 'production' ? '; Secure' : ''));
      return json(res, {
        ok: true
      });
    }
    if (p === '/api/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', 'salon_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      return json(res, {
        ok: true
      });
    }
    if (p === '/api/bookings' && req.method === 'POST') {
      limit(req, 'booking', 12);
      const b = await body(req);
      if (b.website) fail('Neplatný formulář.');
      await interval(b, true);
      const s = await settings();
      if (minutes(b.end) - minutes(b.start) !== Number(s.duration)) fail('Změnila se délka rezervace. Obnov stránku.');
      if (await conflicts(b)) fail('Tento termín už je obsazený. Vyber jiný.', 409);
      if (!clean(b.firstName, 80) || !clean(b.lastName, 80) || !/^\S+@\S+\.\S+$/.test(clean(b.email, 200)) || !b.consent) fail('Vyplň jméno, příjmení, e-mail a souhlas.');
      const item = {
        id: randomUUID(),
        date: b.date,
        start: b.start,
        end: b.end,
        firstName: clean(b.firstName, 80),
        lastName: clean(b.lastName, 80),
        email: clean(b.email, 200),
        note: clean(b.note, 3000),
        status: 'pending',
        created: new Date().toISOString(),
        image: await upload(b.image)
      };
      await db.exec('BEGIN');
      try {
        await put(item);
        await queue(item.id + '-new', process.env.SALON_EMAIL || s.email, 'Nová poptávka — ' + s.title, `${item.firstName} ${item.lastName}\n${item.date} ${item.start}–${item.end}\n${item.email}\n${item.note}\nNávrh a potvrzení najdete v administraci: ${process.env.PUBLIC_URL || ''}/admin`);
        await db.exec('COMMIT');
      } catch (e) {
        await db.exec('ROLLBACK');
        throw e;
      }
      void sendMail();
      return json(res, {
        ok: true,
        demo: !live,
        emailEnabled
      }, 201);
    }
    if (p.startsWith('/api/admin')) {
      if (!admin) fail('Přihlas se do administrace.', 401);
      if (p === '/api/admin' && req.method === 'GET') {
        return json(res, {
          settings: await settings(),
          bookings: await bookings(),
          mode: live ? 'live' : 'demo',
          emailEnabled,
          mail: await db.prepare('SELECT id,state,attempts,error FROM mail ORDER BY rowid DESC LIMIT 100').all()
        });
      }
      if (p === '/api/admin/settings' && req.method === 'PUT') {
        const b = await body(req),
          s = await settings();
        for (const k of ['title', 'tagline', 'intro', 'about', 'aboutText', 'email', 'phone', 'address', 'instagram', 'privacy']) s[k] = clean(b[k], k === 'privacy' ? 4000 : 1000);
        if (!s.title) fail('Název salonu nesmí být prázdný.');
        if (s.instagram && !/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.\/-]*$/.test(s.instagram)) fail('Vlož HTTPS odkaz na Instagram.');
        if (![30, 60, 90, 120, 150, 180, 240].includes(Number(b.duration))) fail('Neplatná délka rezervace.');
        s.duration = Number(b.duration);
        if (b.appearance) {
          if (!['rose', 'gold', 'sage'].includes(b.appearance.accent) || typeof b.appearance.motion !== 'boolean') fail('Neplatné nastavení vzhledu.');
          s.appearance = {
            accent: b.appearance.accent,
            motion: b.appearance.motion
          };
        }
        for (let i = 0; i < 7; i++) {
          const h = b.hours?.[i];
          if (h !== null && (!Array.isArray(h) || !validTime(h[0]) || !validTime(h[1]) || h[0] >= h[1])) fail('Zkontroluj otevírací dobu.');
        }
        s.hours = b.hours;
        await db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(s));
        return json(res, {
          ok: true
        });
      }
      if (p === '/api/admin/gallery' && req.method === 'POST') {
        const b = await body(req),
          s = await settings();
        if (s.gallery.length >= 24) fail('Galerie může mít nejvýše 24 obrázků.');
        s.gallery.push({
          id: randomUUID(),
          image: await upload(b.image, true),
          title: clean(b.title, 80) || 'Nové tetování',
          type: clean(b.type, 40),
          visualization: !!b.visualization
        });
        if (!s.gallery.at(-1).image) fail('Vyber obrázek.');
        await db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(s));
        return json(res, {
          ok: true
        });
      }
      if (p === '/api/admin/gallery' && req.method === 'PUT') {
        const b = await body(req),
          s = await settings(),
          i = s.gallery.findIndex(x => x.id === b.id);
        if (i < 0) fail('Obrázek nenalezen.', 404);
        if (b.action === 'delete') {
          const [old] = s.gallery.splice(i, 1);
          if (old.image.startsWith('/media/')) await db.prepare('DELETE FROM uploads WHERE id=?').run(old.image.slice(7));
        } else if (b.action === 'up' && i > 0) {
          [s.gallery[i - 1], s.gallery[i]] = [s.gallery[i], s.gallery[i - 1]];
        } else if (b.action === 'edit') {
          Object.assign(s.gallery[i], {
            title: clean(b.title, 80),
            type: clean(b.type, 40),
            visualization: !!b.visualization
          });
        }
        await db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(s));
        return json(res, {
          ok: true
        });
      }
      if (p === '/api/admin/bookings' && req.method === 'POST') {
        const b = await body(req);
        await interval(b);
        if (await conflicts(b)) fail('Čas se překrývá s jinou zakázkou.', 409);
        await put({
          id: randomUUID(),
          date: b.date,
          start: b.start,
          end: b.end,
          firstName: clean(b.firstName, 80),
          lastName: clean(b.lastName, 80),
          email: clean(b.email, 200),
          note: clean(b.note, 3000),
          status: b.status === 'blocked' ? 'blocked' : 'confirmed',
          created: new Date().toISOString()
        });
        return json(res, {
          ok: true
        });
      }
      if (p === '/api/admin/bookings' && req.method === 'PUT') {
        const b = await body(req),
          old = (await bookings()).find(x => x.id === b.id);
        if (!old) fail('Zakázka nenalezena.', 404);
        if (!['confirmed', 'pending', 'discussion', 'cancelled', 'blocked'].includes(b.status)) fail('Neplatný stav.');
        const updated = {
          ...old,
          status: b.status,
          date: b.date,
          start: b.start,
          end: b.end,
          note: clean(b.note, 3000)
        };
        await interval(updated);
        if (['confirmed', 'blocked'].includes(updated.status) && (await conflicts(updated))) fail('Termín se překrývá s jinou zakázkou.', 409);
        const changed = old.status !== updated.status || old.date !== updated.date || old.start !== updated.start || old.end !== updated.end;
        await db.exec('BEGIN');
        try {
          await put(updated);
          if (changed && updated.email && ['confirmed', 'cancelled'].includes(updated.status)) {
            await queue(randomUUID(), updated.email, updated.status === 'confirmed' ? 'Tvůj termín je potvrzený — ' + (await settings()).title : 'Změna rezervace — ' + (await settings()).title, updated.status === 'confirmed' ? `Ahoj ${old.firstName},\ntvůj termín ${updated.date} od ${updated.start} do ${updated.end} je potvrzený.\nTěším se na tebe!\nLaura` : `Ahoj ${old.firstName},\nrezervace ${old.date} v ${old.start} byla zrušena. Pro jiný termín se prosím ozvi.\nLaura`);
          }
          await db.exec('COMMIT');
        } catch (e) {
          await db.exec('ROLLBACK');
          throw e;
        }
        void sendMail();
        return json(res, {
          ok: true,
          demo: !live,
          emailEnabled
        });
      }
      if (p === '/api/admin/bookings' && req.method === 'DELETE') {
        const b = await body(req),
          item = (await bookings()).find(x => x.id === b.id);
        if (!item) fail('Nenalezeno.', 404);
        if (item.image) await db.prepare('DELETE FROM uploads WHERE id=?').run(item.image.slice(7));
        await db.prepare('DELETE FROM bookings WHERE id=?').run(item.id);
        if (item.email) await db.prepare('DELETE FROM mail WHERE payload LIKE ?').run('%' + item.email + '%');
        return json(res, {
          ok: true
        });
      }
      if (p === '/api/admin/mail/retry' && req.method === 'POST') {
        await db.prepare("UPDATE mail SET attempts=0 WHERE state='pending'").run();
        void sendMail();
        return json(res, {
          ok: true
        });
      }
      if (p === '/api/admin/export' && req.method === 'GET') {
        res.setHeader('Content-Disposition', 'attachment; filename="salon-data.json"');
        return json(res, {
          settings: await settings(),
          bookings: await bookings(),
          exported: new Date().toISOString()
        });
      }
    }
    if (p.startsWith('/media/') && req.method === 'GET') {
      const row = await db.prepare('SELECT * FROM uploads WHERE id=?').get(p.slice(7));
      if (!row || !row.public && !admin) fail('Nenalezeno.', 404);
      res.writeHead(200, {
        'Content-Type': row.mime,
        'Cache-Control': row.public ? 'public, max-age=3600' : 'private, no-store'
      });
      return res.end(row.bytes);
    }
    if (p.startsWith('/api/')) fail('Nenalezeno.', 404);
    if (!['GET', 'HEAD'].includes(req.method)) fail('Metoda není povolena.', 405);
    const target = path.resolve(ROOT, 'public', '.' + (p === '/' ? '/index.html' : p === '/admin' ? '/admin.html' : p));
    if (!target.startsWith(path.join(ROOT, 'public') + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) fail('Stránka nenalezena.', 404);
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json'
    };
    res.writeHead(200, {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).pipe(res);
  } catch (e) {
    json(res, {
      error: e.status ? e.message : 'Nastala chyba serveru. Zkus to znovu.'
    }, e.status || 500);
    if (!e.status) console.error(e.message);
  }
}));
server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Salon tattoo Laura ready; mode=' + (live ? 'live' : 'demo')));
setInterval(sendMail, 60000).unref();
void sendMail();
