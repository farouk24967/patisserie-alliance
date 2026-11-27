(function () {
  const $ = id => document.getElementById(id);
  const S = window.SITE || {};
  const el = (tag, props, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let lang = read('alliance_langue', 'fr'); if (!TEXTES[lang]) lang = 'fr';
  let products = null, cat = '', mode = 'ici', type = 'macommande';
  let cart = read('alliance_liste', {});
  const t = k => TEXTES[lang][k];
  const unit = u => ({ 'la pièce': t('piece'), 'le kg': t('kg'), 'la boîte': t('boite'), 'la part': t('part') })[u] || u || '';
  const money = n => n.toLocaleString('fr-FR') + ' DA';

  const all = () => (products || []).filter(p => p.visible);
  const priceOf = p => p.prix != null ? money(Number(p.prix)) + ' ' + unit(p.unite) : t('prixMag');
  const btn = (cls, text, onclick, label) => { const b = el('button', { type: 'button', className: cls, textContent: text, onclick }); if (label) b.setAttribute('aria-label', label); return b; };

  // Apparition au défilement
  const watcher = 'IntersectionObserver' in window && new IntersectionObserver(list => list.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); watcher.unobserve(x.target); } }), { threshold: .08 });
  const reveal = e => { if (watcher) { e.classList.add('reveal'); watcher.observe(e); } };

  function menu() {
    const list = all(), cats = [...new Set(list.map(p => p.categorie).filter(Boolean))];
    if (!cats.includes(cat)) cat = '';
    $('chips').replaceChildren(...['', ...cats].map(c => {
      const b = btn('', c || t('tout'), () => { cat = c; menu(); });
      b.setAttribute('aria-pressed', c === cat); return b;
    }));
    const q = $('q').value.trim().toLowerCase();
    const shown = list.filter(p => (!cat || p.categorie === cat) && [p.nom, p.categorie, p.description].join(' ').toLowerCase().includes(q));
    const groups = [...new Set(shown.map(p => p.categorie || ''))];
    $('grid').replaceChildren(...groups.map(g => {
      const items = shown.filter(p => (p.categorie || '') === g);
      const banner = el('div', { className: 'banner' }, el('div', {}, el('h3', { textContent: g || t('carte') })), el('span', { className: 'count', textContent: items.length }));
      const photo = items.find(p => p.photo_url);
      if (photo) banner.append(el('img', { src: photo.photo_url, alt: '' }));
      const rows = el('div', { className: 'rows' }, ...items.map(p => {
        const open = btn('open', '', () => sheet(p));
        if (p.photo_url) open.append(el('img', { src: p.photo_url, alt: '', loading: 'lazy' }));
        const text = el('span', { className: 'txt' }, el('b', { textContent: p.nom, dir: 'auto' }), el('em', { textContent: p.disponible ? priceOf(p) : t('epuise') }));
        if (p.description) text.append(el('small', { textContent: p.description, dir: 'auto' }));
        open.append(text);
        const add = btn('round', '+', ev => { qty(p.id, 1); fly(ev.currentTarget); }, t('ajouter') + ' ' + p.nom);
        add.disabled = !p.disponible;
        const row = el('article', { className: 'item' }, open, add); reveal(row); return row;
      }));
      reveal(banner);
      return el('div', {}, banner, rows);
    }));
    $('vide').hidden = products === null || shown.length > 0;
  }

  // Fiche produit
  let chosen = null, howMany = 1;
  function drawSheet() {
    $('fqte').textContent = howMany;
    $('fadd').textContent = chosen.disponible ? t('panier') + (chosen.prix != null ? ' · ' + money(chosen.prix * howMany) : '') : t('epuise');
    $('fadd').disabled = $('fplus').disabled = $('fmoins').disabled = !chosen.disponible;
  }
  function sheet(p) {
    chosen = p; howMany = 1;
    $('fimg').hidden = !p.photo_url; if (p.photo_url) $('fimg').src = p.photo_url;
    $('fimg').alt = $('fnom').textContent = p.nom;
    $('fdesc').textContent = p.description || '';
    $('fingr').textContent = p.ingredients ? t('ingr') + ' : ' + p.ingredients : '';
    $('fprix').textContent = priceOf(p);
    drawSheet(); $('fiche').showModal();
  }
  function fly(from) {
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const a = from.getBoundingClientRect(), dot = el('span', { className: 'dot' });
    document.body.append(dot);
    dot.animate([{ transform: `translate(${a.x}px,${a.y}px) scale(1)` }, { transform: `translate(${innerWidth / 2}px,${innerHeight - 50}px) scale(.4)` }], { duration: 650, easing: 'cubic-bezier(.5,-.3,.7,1)' }).onfinish = () => {
      dot.remove(); $('cartbar').classList.remove('bump'); void $('cartbar').offsetWidth; $('cartbar').classList.add('bump');
    };
  }

  // Panier
  const lines = () => all().filter(p => p.disponible && cart[p.id] > 0).map(p => ({ p, n: cart[p.id] }));
  function qty(id, d) { cart[id] = Math.max(0, Math.min(99, (cart[id] || 0) + d)); if (!cart[id]) delete cart[id]; keep('alliance_liste', cart); basket(); }
  function totalText(l) {
    const sum = l.reduce((s, x) => s + (x.p.prix != null ? x.p.prix * x.n : 0), 0);
    const unknown = l.some(x => x.p.prix == null);
    return unknown ? (sum ? money(sum) + ' + ' : '') + t('prixMag') : money(sum);
  }
  const lineTotal = x => x.p.prix != null ? money(x.p.prix * x.n) : t('prixMag');
  function cartRow(x) {
    const r = el('div', { className: 'line' });
    if (x.p.photo_url) r.append(el('img', { src: x.p.photo_url, alt: '' }));
    const step = el('div', { className: 'stepper' },
      btn('', x.n === 1 ? '🗑' : '−', () => qty(x.p.id, -1), t('retirer')), el('b', { textContent: x.n }), btn('', '+', () => qty(x.p.id, 1), t('ajouter')));
    r.append(el('div', {}, el('b', { textContent: x.p.nom }), el('small', { textContent: priceOf(x.p) })), el('div', { className: 'end' }, el('b', { textContent: lineTotal(x) }), step));
    return r;
  }
  function basket() {
    const l = lines(), n = l.reduce((s, x) => s + x.n, 0);
    $('cartbar').hidden = !n; document.body.classList.toggle('hascart', !!n);
    $('cartbar').replaceChildren(el('span', { className: 'bag' }, '🛍️', el('i', { textContent: n })),
      el('span', { className: 'mid' }, el('b', { textContent: t('commande') }), el('small', { textContent: t('voirP') })), el('span', { textContent: totalText(l) }));
    $('lines').replaceChildren(...l.map(cartRow));
    $('total').textContent = totalText(l);
    if (!n && $('cart').open) $('cart').close();
  }
  function choices(box, keys, active, pick, icons) {
    $(box).replaceChildren(...keys.map(k => {
      const b = btn('', (icons ? icons[k] + ' ' : '') + t(k), () => { pick(k); choices(box, keys, k, pick, icons); });
      b.setAttribute('aria-pressed', k === active); return b;
    }));
  }
  const OCC = { macommande: '🛍️', anniv: '🎂', fiancailles: '💍', mariage: '💐', autre: '✨' };
  const drawModes = () => { choices('mode', ['ici', 'emporter'], mode, k => { mode = k; drawModes(); }); $('tablebox').hidden = mode !== 'ici'; $('nombox').classList.toggle('full', mode !== 'ici'); };

  // Réservation envoyée sur WhatsApp
  let tab = 'formulaire', people = 0;
  function message() {
    if (tab === 'libre') return $('rlibre').value.trim();
    const date = $('rdate').value.split('-').reverse().join('/');
    const info = [[t('date'), date], [t('heure'), $('rheure').value], [t('personnes'), people || ''], [t('prenom').replace(/ \(.*\)/, ''), $('rnom').value.trim()], [t('details'), $('rdet').value.trim()]];
    return [t('bonjour'), t('souhaite') + ' : ' + t(type), ...info.filter(x => x[1]).map(x => x[0] + ' : ' + x[1]), t('merci')].join('\n');
  }
  function preview() {
    const m = message();
    $('rnb').textContent = people || '–'; $('rmsg').textContent = m;
    if (m) $('rsend').href = 'https://wa.me/' + S.WHATSAPP + '?text=' + encodeURIComponent(m); else $('rsend').removeAttribute('href');
    $('rsend').setAttribute('aria-disabled', !m);
  }
  function drawTabs() {
    choices('rtabs', ['formulaire', 'libre'], tab, k => { tab = k; drawTabs(); });
    $('formulaire').hidden = tab !== 'formulaire'; $('libre').hidden = tab !== 'libre'; preview();
  }
  const drawTypes = () => choices('types', Object.keys(OCC), type, k => { type = k; preview(); }, OCC);
  const reserve = k => { if (k) type = k; tab = 'formulaire'; drawTypes(); drawTabs(); $('resa').showModal(); };

  // Écran à montrer au serveur
  function showTicket() {
    const l = lines(); if (!l.length) return;
    const table = mode === 'ici' && $('ctable').value;
    $('ttitre').textContent = t(mode) + (table ? ' · ' + t('table') + ' ' + table : '');
    $('tlines').replaceChildren(...l.map(x => el('div', { className: 'tline' }, el('i', { textContent: x.n + '×' }), el('b', { textContent: x.p.nom, dir: 'auto' }), el('span', { textContent: lineTotal(x) }))));
    $('ttotal').textContent = totalText(l);
    $('tmsg').textContent = [$('cnom').value.trim(), $('cnote').value.trim()].filter(Boolean).join('\n');
    $('theure').textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' });
    $('cart').close(); $('ticket').showModal();
  }

  // Ouvert / fermé, calculé à l'heure d'Algérie
  function status() {
    if (!S.HORAIRES) return;
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Algiers' }));
    const now = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const open = (S.HORAIRES[d.getDay()] || []).some(([a, b]) => now >= a && now < b);
    $('etat').hidden = false; $('etat').classList.toggle('ouvert', open);
    $('etat').textContent = (open ? '🟢 ' + t('ouvert') : '🔴 ' + t('ferme'));
  }

  function links() {
    const tel = '+213' + S.TELEPHONE.replace(/\s/g, '').replace(/^0/, '');
    $('appel').href = 'tel:' + tel;
    const list = [
      ['📞', t('appeler'), S.TELEPHONE, 'tel:' + tel],
      ['📍', t('trouver'), t('adresse'), 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent("Rue Larbi Ben M'hidi Beni Saf")],
      ['💬', 'WhatsApp', S.TELEPHONE, S.WHATSAPP && 'https://wa.me/' + S.WHATSAPP],
      ['📘', 'Facebook', t('suivre'), S.FACEBOOK], ['📸', 'Instagram', t('suivre'), S.INSTAGRAM],
      ['🎵', 'TikTok', t('suivre'), S.TIKTOK], ['⭐', t('avis'), 'Google', S.AVIS_GOOGLE],
      ['✉️', t('email'), S.EMAIL, S.EMAIL && 'mailto:' + S.EMAIL]
    ].filter(x => x[3]);
    $('links').replaceChildren(...list.map(([icon, title, sub, href]) => {
      const a = el('a', { className: 'link', href }, el('i', { textContent: icon }), el('div', {}, el('b', { textContent: title }), el('small', { textContent: sub, dir: sub === S.TELEPHONE ? 'ltr' : 'auto', style: sub === S.TELEPHONE && lang === 'ar' ? 'text-align:right' : '' })), el('span', { textContent: lang === 'ar' ? '‹' : '›' }));
      if (href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
      return a;
    }));
  }

  function translate() {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-t]').forEach(e => e.textContent = t(e.dataset.t));
    document.querySelectorAll('[data-p]').forEach(e => { e.placeholder = t(e.dataset.p); e.setAttribute('aria-label', t(e.dataset.p)); });
    document.querySelectorAll('.x').forEach(e => e.setAttribute('aria-label', t('fermer')));
    [...$('langs').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.l === lang));
    $('occ').replaceChildren(...Object.keys(OCC).filter(k => k !== 'macommande').map(k => el('button', { type: 'button', onclick: () => reserve(k) }, el('span', { textContent: OCC[k] }), t(k))));
    $('rlibre').placeholder = t('libre'); $('rlibre').setAttribute('aria-label', t('libre'));
    drawModes(); drawTypes(); drawTabs(); links(); status(); menu(); basket(); sticky();
    const tel = $('appel').href; $('rcall').href = tel;
    $('wafloat').hidden = !S.WHATSAPP; $('wafloat').href = 'https://wa.me/' + S.WHATSAPP;
    document.querySelectorAll('[data-resa]').forEach(b => b.hidden = !S.WHATSAPP);
  }
  const sticky = () => document.documentElement.style.setProperty('--top', document.querySelector('.top').offsetHeight + 'px');

  $('langs').onclick = e => { if (e.target.dataset.l) { lang = e.target.dataset.l; cat = ''; keep('alliance_langue', lang); translate(); } };
  $('q').oninput = menu;
  $('cartbar').onclick = () => $('cart').showModal();
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('vider').onclick = () => { cart = {}; keep('alliance_liste', cart); basket(); };
  $('montrer').onclick = showTicket;
  $('retour').onclick = () => { $('ticket').close(); $('cart').showModal(); };
  $('fplus').onclick = () => { howMany = Math.min(99, howMany + 1); drawSheet(); };
  $('fmoins').onclick = () => { howMany = Math.max(1, howMany - 1); drawSheet(); };
  $('fadd').onclick = () => { qty(chosen.id, howMany); fly($('fadd')); $('fiche').close(); };
  $('rplus').onclick = () => { people = Math.min(2000, people + 1); preview(); };
  $('rmoins').onclick = () => { people = Math.max(0, people - 1); preview(); };
  $('resa').addEventListener('input', preview);
  document.querySelectorAll('[data-resa]').forEach(b => b.onclick = () => reserve());
  document.querySelectorAll('.w h2, .maison img, #occ, #links').forEach(reveal);
  $('rdate').min = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' });
  window.addEventListener('resize', sticky);
  setInterval(status, 60000);
  translate();
  // Les changements faits dans le tableau de bord apparaissent sans recharger
  const refresh = () => Store.list().then(l => { products = l; menu(); basket(); }).catch(e => { console.error(e); if (products === null) { products = []; menu(); } });
  window.addEventListener('storage', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh();
})();
