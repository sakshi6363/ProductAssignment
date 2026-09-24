// Screens. They only call Api.* / UI.* / U.* - never Axios directly.
window.Views = (function () {
  const { esc, money, pretty } = U;
  const view = () => document.getElementById('view');
  const app = () => document.getElementById('app');
  const spin = '<span class="spinner"></span>';
  let navToken = 0;   // guards against a slow screen finishing after the user navigated away
  let listCtrl = null; // AbortController of the newest product-list request

  let catPromise = null;
  const categories = () => catPromise || (catPromise = Api.getCategories().catch(() => { catPromise = null; return []; }));
  const current = () => U.parseQuery(location.hash.split('?')[1] || '');
  const go = (hash, replace) => { if (replace) { history.replaceState(null, '', hash); window.dispatchEvent(new Event('hashchange')); } else location.hash = hash; };
  const isId = (s) => /^\d+$/.test(s) && Number(s) > 0;

  /* ---------- shell ---------- */
  function ensureShell() {
    if (view()) return;
    const u = Auth.user() || {};
    app().innerHTML = `<div class="shell">
      <aside class="sidebar" id="sidebar"><div class="brand">Product Admin</div>
        <nav class="nav" aria-label="Main"><a href="#/products" data-nav="/products">Products</a><a href="#/products/new" data-nav="/products/new">Add product</a>
        <button type="button" class="logout" data-logout>Logout</button></nav></aside>
      <div class="main-col"><header class="topbar">
        <button type="button" class="btn menu-btn" id="menu" aria-label="Open menu" aria-expanded="false" aria-controls="sidebar">☰</button>
        <span class="muted">${esc((u.firstName || '') + ' ' + (u.lastName || ''))}</span>
        <button type="button" class="btn" data-logout>Logout</button></header>
      <main id="view"></main></div></div>`;
    const sb = document.getElementById('sidebar'), menu = document.getElementById('menu');
    const setOpen = (o) => { sb.classList.toggle('open', o); menu.setAttribute('aria-expanded', String(o)); };
    menu.onclick = () => setOpen(!sb.classList.contains('open'));
    sb.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    app().addEventListener('click', (e) => { if (e.target.closest('[data-logout]')) { Auth.clear(); location.hash = '#/login'; } });
  }
  function setNav(path) {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === '/products' ? path === '/products' || /^\/products\/\d+/.test(path) : path === a.dataset.nav;
      on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });
  }

  /* ---------- login ---------- */
  function login() {
    app().innerHTML = `<div class="login"><form class="card" novalidate><h1>Sign in</h1>
      <p class="alert" role="alert" hidden id="lerr"></p>
      <div><label for="username">Username</label><input class="input" id="username" autocomplete="username"></div>
      <div><label for="password">Password</label><input class="input" id="password" type="password" autocomplete="current-password"></div>
      <button class="btn primary" type="submit" id="lbtn">Sign in</button>
      <button class="btn" type="button" id="demo">Fill demo credentials</button>
      <p class="muted" style="margin:0;text-align:center;font-size:13px">Demo account: emilys / emilyspass</p></form></div>`;
    const f = app().querySelector('form'), err = document.getElementById('lerr'), btn = document.getElementById('lbtn');
    let busy = false;
    document.getElementById('demo').onclick = () => { document.getElementById('username').value = 'emilys'; document.getElementById('password').value = 'emilyspass'; document.getElementById('lbtn').focus(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      const u = document.getElementById('username'), p = document.getElementById('password');
      const fail = (m) => { err.textContent = 'Error: ' + m; err.hidden = false; };
      if (!u.value.trim() || !p.value) return fail('Enter both username and password.');
      busy = true; btn.disabled = true; btn.innerHTML = spin + ' Signing in…'; err.hidden = true;
      try { const r = await Api.login(u.value.trim(), p.value); Auth.save(r.token, r.user); location.hash = '#/products'; }
      catch (x) { fail(x.status === 400 || x.status === 401 ? 'Invalid username or password. This API only accepts its own demo users, e.g. emilys / emilyspass.' : x.message); p.value = ''; p.focus(); } // username stays filled
      finally { busy = false; btn.disabled = false; btn.textContent = 'Sign in'; }
    };
  }

  /* ---------- product list ---------- */
  const actions = (p) => `<div class="actions"><a class="icon-btn" href="#/products/${p.id}" aria-label="View ${esc(p.title)}">View</a>
    <a class="icon-btn" href="#/products/${p.id}/edit" aria-label="Edit ${esc(p.title)}">Edit</a>
    <button type="button" class="icon-btn del" data-del="${p.id}" aria-label="Delete ${esc(p.title)}">Delete</button></div>`;
  const img = (p, cls) => `<img class="${cls}" src="${esc(p.thumbnail)}" alt="${esc(p.title)}" loading="lazy">`;

  function rowsHTML(ps) {
    return `<div class="card table-wrap"><table><caption class="sr">Products</caption><thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Rating</th><th scope="col">Stock</th><th scope="col">Actions</th></tr></thead><tbody>` +
      ps.map((p) => `<tr><td><div class="prod">${img(p, 'thumb')}<span>${esc(p.title)}</span></div></td><td style="text-transform:capitalize">${esc(pretty(p.category))}</td><td>${money(p.price)}</td><td>★ ${Number(p.rating).toFixed(1)}</td><td>${p.stock === 0 ? 'Out of stock' : esc(p.stock)}</td><td>${actions(p)}</td></tr>`).join('') +
      `</tbody></table></div><ul class="cards">` +
      ps.map((p) => `<li class="card"><div class="row">${img(p, 'thumb')}<div><strong>${esc(p.title)}</strong><div class="muted" style="text-transform:capitalize">${esc(pretty(p.category))}</div><div>${money(p.price)} · ★ ${Number(p.rating).toFixed(1)} · Stock ${esc(p.stock)}</div></div></div>${actions(p)}</li>`).join('') + `</ul>`;
  }
  function pagerHTML(q, total) {
    const pages = Math.max(1, Math.ceil(total / q.limit));
    const s = total ? (q.page - 1) * q.limit + 1 : 0, e = Math.min(q.page * q.limit, total);
    return `<p class="muted" style="margin:0" aria-live="polite">Showing ${s}–${e} of ${total}</p><div class="ctrls">
      <label>Per page <select class="input" id="limit" style="width:auto">${U.PAGE_SIZES.map((n) => `<option value="${n}"${n === q.limit ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <button type="button" class="btn" data-page="${q.page - 1}"${q.page <= 1 ? ' disabled' : ''}>Previous</button>
      <span class="muted">Page ${q.page} of ${pages}</span>
      <button type="button" class="btn" data-page="${q.page + 1}"${q.page >= pages ? ' disabled' : ''}>Next</button></div>`;
  }

  function list() {
    if (!document.getElementById('list-root')) {
      view().innerHTML = `<div id="list-root"><div class="page-head"><h1>Products</h1><a class="btn primary" href="#/products/new">Add product</a></div>
        <div class="card toolbar"><div class="search"><label class="sr" for="search">Search products</label><input class="input" id="search" type="search" placeholder="Search products…"></div>
        <div><label class="sr" for="category">Category</label><select class="input" id="category"><option value="">All categories</option></select></div>
        <div><label class="sr" for="sort">Sort by</label><select class="input" id="sort"><option value="">Sort: default</option><option value="title">Sort: Title</option><option value="price">Sort: Price</option><option value="rating">Sort: Rating</option></select></div>
        <div><label class="sr" for="order">Sort order</label><select class="input" id="order"><option value="asc">Ascending</option><option value="desc">Descending</option></select></div></div>
        <div id="results" aria-live="polite"></div><div class="pager" id="pager"></div></div>`;
      bindList();
    }
    loadList();
  }

  function update(patch) {
    const q = Object.assign(current(), patch);
    if (!('page' in patch)) q.page = 1;
    go('#/products' + U.buildQuery(q), true);
  }

  function bindList() {
    const $ = (id) => document.getElementById(id);
    // Debounce: wait until typing pauses before touching the URL / API.
    $('search').addEventListener('input', U.debounce((e) => update({ q: e.target.value.trim() }), 400));
    $('category').onchange = (e) => update({ category: e.target.value });
    $('sort').onchange = (e) => update({ sort: e.target.value });
    $('order').onchange = (e) => update({ order: e.target.value });
    $('pager').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b && !b.disabled) update({ page: Number(b.dataset.page) }); });
    $('pager').addEventListener('change', (e) => { if (e.target.id === 'limit') update({ limit: Number(e.target.value) }); });
    $('results').addEventListener('click', (e) => {
      if (e.target.closest('[data-retry]')) loadList();
      if (e.target.closest('[data-clear]')) { $('search').value = ''; go('#/products', true); }
      const del = e.target.closest('[data-del]');
      if (del) {
        const id = Number(del.dataset.del), p = (window.__lastProducts || []).find((x) => x.id === id);
        UI.confirmDialog({ title: 'Delete product', message: 'Are you sure you want to delete this product' + (p ? ' ("' + p.title + '")' : '') + '?', confirmLabel: 'Delete',
          onConfirm: async () => { await Api.deleteProduct(id); UI.toast('Product deleted.'); loadList(); } });
      }
    });
    categories().then((cs) => {
      const sel = $('category'); if (!sel) return;
      sel.innerHTML = '<option value="">All categories</option>' + cs.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');
      sel.value = current().category;
    });
  }

  async function loadList() {
    const $ = (id) => document.getElementById(id);
    const q = current();
    if (document.activeElement !== $('search')) $('search').value = q.q; // don't fight the user's typing
    $('category').value = q.category; $('sort').value = q.sort; $('order').value = q.order; $('order').disabled = !q.sort;

    // Race-condition protection: abort the previous request; ignore anything that isn't the newest.
    if (listCtrl) listCtrl.abort();
    const mine = (listCtrl = new AbortController());
    const box = $('results');
    if (!window.__lastProducts) box.innerHTML = UI.skeletons(6); else box.style.opacity = '.6';
    box.setAttribute('aria-busy', 'true');
    try {
      const data = await Api.getProducts(q, mine.signal);
      if (mine.signal.aborted) return;
      const pages = Math.max(1, Math.ceil(data.total / q.limit));
      if (q.page > pages) return update({ page: pages }); // ?page=999 -> clamp
      window.__lastProducts = data.products;
      box.innerHTML = data.products.length ? rowsHTML(data.products)
        : q.q ? UI.empty('No products match your search.', '<button type="button" class="btn" data-clear>Clear search</button>')
        : q.category ? UI.empty('No products found in this category.', '<button type="button" class="btn" data-clear>Clear filters</button>')
        : UI.empty('No products found.', '<a class="btn primary" href="#/products/new">Add product</a>');
      $('pager').innerHTML = data.total ? pagerHTML(q, data.total) : '';
    } catch (e) {
      if (axios.isCancel(e) || mine.signal.aborted) return;
      box.innerHTML = UI.errorBlock('Something went wrong while loading products. Please try again.'); $('pager').innerHTML = '';
    } finally {
      if (listCtrl === mine) { box.style.opacity = ''; box.setAttribute('aria-busy', 'false'); }
    }
  }

  /* ---------- details ---------- */
  const notFound = () => UI.empty('Product not found', '<a class="btn primary" href="#/products">Back to products</a>');

  async function detail(idStr) {
    const my = ++navToken; window.__lastProducts = null;
    if (!isId(idStr)) { view().innerHTML = notFound(); return; }
    const id = Number(idStr);
    view().innerHTML = UI.skeletons(4);
    try {
      const p = await Api.getProduct(id);
      if (my !== navToken) return;
      const disc = p.discountPercentage ? p.price * (1 - p.discountPercentage / 100) : null;
      const d = p.dimensions ? `${p.dimensions.width} × ${p.dimensions.height} × ${p.dimensions.depth}` : null;
      const facts = [['Category', p.category && pretty(p.category)], ['Brand', p.brand], ['SKU', p.sku], ['Stock', p.stock], ['Availability', p.availabilityStatus], ['Dimensions', d], ['Weight', p.weight], ['Warranty', p.warrantyInformation], ['Shipping', p.shippingInformation], ['Returns', p.returnPolicy]]
        .filter((f) => f[1] !== undefined && f[1] !== null && f[1] !== '');
      view().innerHTML = `<div class="page-head"><a class="btn" href="#/products">← Back</a><div class="actions"><a class="btn" href="#/products/${id}/edit">Edit</a><button type="button" class="btn danger" id="del">Delete</button></div></div>
        <div class="card detail">${img({ thumbnail: p.thumbnail, title: p.title }, 'hero')}<div><h1>${esc(p.title)}</h1><p class="muted">${esc(p.description)}</p>
        <p><strong style="font-size:1.6rem">${money(disc || p.price)}</strong>${disc ? ` <s class="muted">${money(p.price)}</s> <span style="color:#166534">${esc(p.discountPercentage)}% off</span>` : ''}</p>
        <p>★ ${Number(p.rating).toFixed(1)} / 5</p><dl>${facts.map((f) => `<dt>${f[0]}</dt><dd>${esc(f[1])}</dd>`).join('')}</dl></div></div>
        ${p.reviews && p.reviews.length ? `<section class="card" style="padding:20px;margin-top:16px" aria-labelledby="rv"><h2 id="rv" style="margin-top:0">Reviews</h2>${p.reviews.map((r) => `<p><strong>${esc(r.reviewerName)}</strong> · ★ ${esc(r.rating)}<br><span class="muted">${esc(r.comment)}</span></p>`).join('')}</section>` : ''}`;
      document.getElementById('del').onclick = () => UI.confirmDialog({ title: 'Delete product', message: 'Are you sure you want to delete this product?', confirmLabel: 'Delete',
        onConfirm: async () => { await Api.deleteProduct(id); UI.toast('Product deleted.'); location.hash = '#/products'; } });
    } catch (e) {
      if (my !== navToken) return;
      if (e.status === 404) view().innerHTML = notFound();
      else { view().innerHTML = UI.errorBlock(e.message); view().querySelector('[data-retry]').onclick = () => detail(idStr); }
    }
  }

  /* ---------- add / edit form ---------- */
  const FIELDS = ['title', 'description', 'price', 'category', 'brand', 'stock', 'rating', 'thumbnail'];

  // Single validation function used by both add and edit.
  function validate(v) {
    const e = {};
    if (!v.title.trim()) e.title = 'Title is required';
    if (!v.description.trim()) e.description = 'Description is required';
    const price = Number(v.price); if (v.price.trim() === '' || !isFinite(price) || price <= 0) e.price = 'Price must be a positive number';
    const stock = Number(v.stock); if (v.stock.trim() === '' || !Number.isInteger(stock) || stock < 0) e.stock = 'Stock must be a whole number, 0 or more';
    const rating = Number(v.rating); if (v.rating.trim() === '' || !isFinite(rating) || rating < 0 || rating > 5) e.rating = 'Rating must be between 0 and 5';
    if (!v.category) e.category = 'Category is required';
    if (v.thumbnail.trim() && !/^https?:\/\/\S+$/i.test(v.thumbnail.trim())) e.thumbnail = 'Enter a valid URL (https://…)';
    return e;
  }

  async function form(o) {
    view().innerHTML = UI.skeletons(4);
    const my = navToken;
    const cats = await categories();
    if (my !== navToken) return;
    const v = Object.assign({ title: '', description: '', price: '', category: '', brand: '', stock: '0', rating: '0', thumbnail: '' }, o.values);
    const opts = cats.slice(); if (v.category && !opts.some((c) => c.slug === v.category)) opts.push({ slug: v.category, name: v.category });
    const F = (id, label, ctl) => `<div><label for="${id}">${label}</label>${ctl}<p class="err" id="e-${id}" hidden></p></div>`;
    const inp = (id, type, extra) => `<input class="input" id="${id}" name="${id}" type="${type || 'text'}" value="${esc(v[id])}" aria-describedby="e-${id}" ${extra || ''}>`;
    view().innerHTML = `<div class="page-head"><h1>${esc(o.title)}</h1></div><form class="card form" novalidate>
      <p class="alert" role="alert" hidden id="ferr"></p>
      ${F('title', 'Title', inp('title'))}
      ${F('description', 'Description', `<textarea class="input" id="description" name="description" rows="4" aria-describedby="e-description">${esc(v.description)}</textarea>`)}
      <div class="two">${F('price', 'Price ($)', inp('price', 'number', 'step="0.01"'))}${F('stock', 'Stock', inp('stock', 'number', 'step="1"'))}
      ${F('category', 'Category', `<select class="input" id="category" name="category" aria-describedby="e-category"><option value="">Select a category</option>${opts.map((c) => `<option value="${esc(c.slug)}"${c.slug === v.category ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}
      ${F('brand', 'Brand (optional)', inp('brand'))}${F('rating', 'Rating (0–5)', inp('rating', 'number', 'step="0.1"'))}${F('thumbnail', 'Image URL (optional)', inp('thumbnail', 'url'))}</div>
      <div class="foot"><a class="btn" href="${o.backHash}">Cancel</a><button class="btn primary" type="submit" id="save">${esc(o.submitLabel)}</button></div></form>`;
    const f = view().querySelector('form'), save = document.getElementById('save'), ferr = document.getElementById('ferr');
    let busy = false;
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      if (busy) return; // ignore rapid repeat clicks
      const vals = {}; FIELDS.forEach((k) => { vals[k] = f.elements[k].value; });
      const errs = validate(vals);
      FIELDS.forEach((k) => {
        const el = f.elements[k], p = document.getElementById('e-' + k);
        p.hidden = !errs[k]; p.textContent = errs[k] ? 'Error: ' + errs[k] : '';
        errs[k] ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid');
      });
      const first = FIELDS.find((k) => errs[k]);
      if (first) { f.elements[first].focus(); return; }
      busy = true; save.disabled = true; save.innerHTML = spin + ' Saving…'; ferr.hidden = true;
      const payload = { title: vals.title.trim(), description: vals.description.trim(), price: Number(vals.price), category: vals.category, brand: vals.brand.trim(), stock: Number(vals.stock), rating: Number(vals.rating), thumbnail: vals.thumbnail.trim() };
      try { await o.onSubmit(payload); }
      catch (e) { ferr.textContent = 'Error: ' + e.message; ferr.hidden = false; busy = false; save.disabled = false; save.textContent = o.submitLabel; }
    };
  }

  function newProduct() {
    navToken++; window.__lastProducts = null;
    form({ title: 'Add product', submitLabel: 'Create product', backHash: '#/products',
      onSubmit: async (payload) => { const p = await Api.createProduct(payload); UI.toast('Product created.'); location.hash = '#/products/' + p.id; } });
  }

  async function edit(idStr) {
    const my = ++navToken; window.__lastProducts = null;
    if (!isId(idStr)) { view().innerHTML = notFound(); return; }
    const id = Number(idStr);
    view().innerHTML = UI.skeletons(4);
    try {
      const p = await Api.getProduct(id);
      if (my !== navToken) return;
      form({ title: 'Edit product', submitLabel: 'Save changes', backHash: '#/products/' + id,
        values: { title: p.title, description: p.description, price: String(p.price), category: p.category, brand: p.brand || '', stock: String(p.stock), rating: String(p.rating), thumbnail: p.thumbnail || '' },
        onSubmit: async (payload) => { await Api.updateProduct(id, payload); UI.toast('Product updated.'); location.hash = '#/products/' + id; } });
    } catch (e) {
      if (my !== navToken) return;
      if (e.status === 404) view().innerHTML = notFound();
      else { view().innerHTML = UI.errorBlock(e.message); view().querySelector('[data-retry]').onclick = () => edit(idStr); }
    }
  }

  return { login, ensureShell, setNav, list, detail, newProduct, edit };
})();
