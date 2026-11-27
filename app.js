(function () {
  const $ = id => document.getElementById(id);
  const S = window.SITE || {};
  const el = (tag, props, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let lang = read('alliance_langue', 'fr'); if (!TEXTES[lang]) lang = 'fr';
  let products = null, cat = '', mode = 'emporter', type = 'anniv';
  let cart = read('alliance_liste', {});
  const t = k => TEXTES[lang][k];
  const unit = u => ({ 'la pièce': t('piece'), 'le kg': t('kg'), 'la boîte': t('boite'), 'la part': t('part') })[u] || u || '';
  const money = n => n.toLocaleString('fr-FR') + ' DA';

  // Exemples affichés tant qu'aucun produit n'est ajouté depuis le tableau de bord
  const examples = () => ['coco', 'praline'].map(k => ({ id: 'ex-' + k, nom: t(k), categorie: t('gateaux'), prix: null, disponible: true, photo_url: 'img/' + k + '.jpg' }));
  const all = () => products === null ? [] : products.length ? products.filter(p => p.visible) : examples();

  function menu() {
    const list = all(), cats = [...new Set(list.map(p => p.categorie).filter(Boolean))];
    if (!cats.includes(cat)) cat = '';
    $('chips').replaceChildren(...['', ...cats].map(c => {
      const b = el('button', { type: 'button', textContent: c || t('tout'), onclick: () => { cat = c; menu(); } });
      b.setAttribute('aria-pressed', c === cat); return b;
    }));
    const q = $('q').value.trim().toLowerCase();
    const shown = list.filter(p => (!cat || p.categorie === cat) && [p.nom, p.categorie, p.description].join(' ').toLowerCase().includes(q));
    $('grid').replaceChildren(...shown.map(p => {
      const body = el('div', { className: 'c' }, el('h3', { textContent: p.nom, dir: 'auto' }));
      if (p.description) body.append(el('p', { textContent: p.description, dir: 'auto' }));
      if (p.ingredients) body.append(el('p', { textContent: t('ingr') + ' : ' + p.ingredients }));
      const add = el('button', { type: 'button', className: 'round', textContent: '+', disabled: !p.disponible, onclick: () => qty(p.id, 1) });
      add.setAttribute('aria-label', t('ajouter') + ' ' + p.nom);
      const price = !p.disponible ? t('epuise') : p.prix != null ? money(Number(p.prix)) + ' ' + unit(p.unite) : t('prixMag');
      body.append(el('div', { className: 'buy' }, el('b', { textContent: price }), add));
      const card = el('article', { className: 'card' + (p.photo_url ? '' : ' nophoto') });
      if (p.photo_url) card.append(el('img', { src: p.photo_url, alt: p.nom, loading: 'lazy' }));
      card.append(body); return card;
    }));
    $('vide').hidden = products === null || shown.length > 0;
  }

  // Liste de commande
  const lines = () => all().filter(p => p.disponible && cart[p.id] > 0).map(p => ({ p, n: cart[p.id] }));
  function qty(id, d) { cart[id] = Math.max(0, Math.min(99, (cart[id] || 0) + d)); if (!cart[id]) delete cart[id]; keep('alliance_liste', cart); basket(); }
  function totalText(l) {
    const sum = l.reduce((s, x) => s + (x.p.prix != null ? x.p.prix * x.n : 0), 0);
    const unknown = l.some(x => x.p.prix == null);
    return unknown ? (sum ? money(sum) + ' + ' : '') + t('prixMag') : money(sum);
  }
  function row(x, edit) {
    const sub = x.p.prix != null ? money(Number(x.p.prix)) + ' ' + unit(x.p.unite) : t('prixMag');
    const r = el('div', { className: 'line' }, el('div', {}, el('b', { textContent: (edit ? '' : x.n + ' × ') + x.p.nom }), el('small', { textContent: sub })));
    if (edit) {
      const minus = el('button', { type: 'button', className: 'round', textContent: '−', onclick: () => qty(x.p.id, -1) });
      const plus = el('button', { type: 'button', className: 'round', textContent: '+', onclick: () => qty(x.p.id, 1) });
      minus.setAttribute('aria-label', t('retirer')); plus.setAttribute('aria-label', t('ajouter'));
      r.append(minus, el('b', { textContent: x.n }), plus);
    }
    return r;
  }
  function basket() {
    const l = lines(), n = l.reduce((s, x) => s + x.n, 0);
    $('cartbar').hidden = !n;
    $('cartbar').replaceChildren(el('span', { textContent: '🛍️ ' + t('commande') + ' (' + n + ')' }), el('span', { textContent: totalText(l) }));
    $('lines').replaceChildren(...l.map(x => row(x, true)));
    $('total').textContent = totalText(l);
    if (!n && $('cart').open) $('cart').close();
  }
  function choices(box, keys, active, pick) {
    $(box).replaceChildren(...keys.map(k => {
      const b = el('button', { type: 'button', textContent: t(k), onclick: () => { pick(k); choices(box, keys, k, pick); } });
      b.setAttribute('aria-pressed', k === active); return b;
    }));
  }
  const OCC = { anniv: '🎂', fiancailles: '💍', mariage: '💐', autre: '✨' };
  const drawModes = () => choices('mode', ['emporter', 'ici'], mode, k => mode = k);
  const drawTypes = () => choices('types', Object.keys(OCC), type, k => type = k);

  function ticket(title, rows, message) {
    $('ttitre').textContent = title; $('tlines').replaceChildren(...rows); $('tmsg').textContent = message;
    const text = [title, ...rows.map(r => r.querySelector('b').textContent), message].filter(Boolean).join('\n');
    $('wa').hidden = !S.WHATSAPP;
    if (S.WHATSAPP) $('wa').href = 'https://wa.me/' + S.WHATSAPP + '?text=' + encodeURIComponent('Pâtisserie Alliance\n' + text);
    $('ticket').showModal();
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
    $('occ').replaceChildren(...Object.keys(OCC).map(k => el('button', { type: 'button', onclick: () => { type = k; drawTypes(); $('resa').showModal(); } }, el('span', { textContent: OCC[k] }), t(k))));
    drawModes(); drawTypes(); links(); status(); menu(); basket(); sticky();
  }
  const sticky = () => document.documentElement.style.setProperty('--top', document.querySelector('.top').offsetHeight + 'px');

  $('langs').onclick = e => { if (e.target.dataset.l) { lang = e.target.dataset.l; cat = ''; keep('alliance_langue', lang); translate(); } };
  $('q').oninput = menu;
  $('cartbar').onclick = () => $('cart').showModal();
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('vider').onclick = () => { cart = {}; keep('alliance_liste', cart); basket(); };
  $('montrer').onclick = () => {
    const l = lines(), who = $('cnom').value.trim(), note = $('cnote').value.trim();
    $('cart').close();
    ticket(t(mode), l.map(x => row(x, false)), ['Total : ' + totalText(l), who, note].filter(Boolean).join('\n'));
  };
  $('rf').onsubmit = e => {
    e.preventDefault();
    const info = [[t('date'), $('rdate').value], [t('personnes'), $('rnb').value], [t('prenom'), $('rnom').value.trim()], [t('details'), $('rdet').value.trim()]];
    $('resa').close();
    ticket(t(type), [], info.filter(x => x[1]).map(x => x.join(' : ')).join('\n'));
  };
  $('rdate').min = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' });
  window.addEventListener('resize', sticky);
  setInterval(status, 60000);
  translate();
  Store.list().catch(e => { console.error(e); return []; }).then(l => { products = l; menu(); basket(); });
})();
