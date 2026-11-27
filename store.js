// Accès aux produits : Supabase si configuré, sinon mode essai (localStorage).
(function () {
  const c = window.CONFIG || {};
  const demo = !c.SUPABASE_URL && !c.SUPABASE_KEY;
  const KEY = 'alliance_produits';

  // Réduit la photo avant l'envoi (1200 px max, JPEG)
  async function compress(file, max) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * r);
      cv.height = Math.round(img.height * r);
      const x = cv.getContext('2d');
      x.fillStyle = '#fff';
      x.fillRect(0, 0, cv.width, cv.height);
      x.drawImage(img, 0, 0, cv.width, cv.height);
      return await new Promise((ok, ko) => cv.toBlob(b => b ? ok(b) : ko(new Error('Photo illisible')), 'image/jpeg', 0.82));
    } catch (e) {
      throw new Error('Photo illisible. Utilisez une image JPG ou PNG.');
    } finally { URL.revokeObjectURL(url); }
  }

  if (demo) {
    // Produits d'exemple : modifiables et supprimables depuis le tableau de bord
    const seed = () => [['praline', 'Bouchées aux éclats croquants'], ['coco', 'Boules gourmandes dorées']].map(([k, nom]) => ({ id: 'ex-' + k, nom, categorie: 'Gâteaux', prix: null, unite: 'la pièce', description: '', ingredients: '', disponible: true, visible: true, photo_url: 'img/' + k + '.jpg' }));
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { return seed(); } };
    const write = l => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { throw new Error('Mémoire du mode essai pleine ou bloquée.'); } };
    const dataUrl = b => new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); });
    window.Store = {
      demo,
      async list() { return read().reverse(); },
      async save(p, file) {
        const l = read();
        if (file) p.photo_url = await dataUrl(await compress(file, 700));
        const i = l.findIndex(x => x.id === p.id);
        if (i >= 0) l[i] = { ...l[i], ...p };
        else l.push({ ...p, id: Date.now().toString(36) + Math.random().toString(36).slice(2) });
        write(l);
      },
      async remove(p) { write(read().filter(x => x.id !== p.id)); },
      async isAdmin() { return true; },
      async login() {}, async logout() {}
    };
    return;
  }

  if (!window.supabase) {
    const fail = async () => { throw new Error('Connexion au service impossible. Vérifiez Internet.'); };
    window.Store = { demo, list: fail, save: fail, remove: fail, isAdmin: fail, login: fail, logout: fail };
    return;
  }
  const db = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_KEY);
  const check = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  const bucket = () => db.storage.from('produits');
  window.Store = {
    demo,
    async list() { return check(await db.from('produits').select('*').order('created_at', { ascending: false })); },
    async save(p, file) {
      const row = { ...p }; delete row.id; delete row.created_at;
      const old = p.photo_path;
      let path;
      if (file) {
        path = crypto.randomUUID() + '.jpg';
        check(await bucket().upload(path, await compress(file, 1200), { contentType: 'image/jpeg' }));
        row.photo_path = path;
        row.photo_url = bucket().getPublicUrl(path).data.publicUrl;
      }
      try {
        const q = p.id ? db.from('produits').update(row).eq('id', p.id) : db.from('produits').insert(row);
        if (!check(await q.select()).length) throw new Error('Enregistrement refusé.');
      } catch (e) { if (path) await bucket().remove([path]); throw e; }
      if (path && old) await bucket().remove([old]);
    },
    async remove(p) {
      if (!check(await db.from('produits').delete().eq('id', p.id).select()).length) throw new Error('Suppression refusée.');
      if (p.photo_path) await bucket().remove([p.photo_path]);
    },
    async isAdmin() {
      const s = check(await db.auth.getSession()).session;
      return !!s && check(await db.rpc('is_admin')) === true;
    },
    async login(email, password) {
      check(await db.auth.signInWithPassword({ email, password }));
      if (!await this.isAdmin()) { await db.auth.signOut(); throw new Error("Ce compte n'est pas administrateur."); }
    },
    async logout() { await db.auth.signOut(); }
  };
})();
