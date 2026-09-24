// Hash router + auth guard. Hash routing works on any static host (Vercel/Netlify/GitHub Pages) with no rewrite rules.
(function () {
  function route() {
    const path = (location.hash.replace(/^#/, '') || '/products').split('?')[0];
    const authed = !!Auth.token() && !!Auth.user();
    if (path === '/login') { if (authed) { location.replace('#/products'); return; } Views.login(); return; }
    if (!authed) { location.replace('#/login'); return; } // protected pages -> login
    Views.ensureShell(); Views.setNav(path);
    let m;
    if (path === '/products') Views.list();
    else if (path === '/products/new') Views.newProduct();
    else if ((m = path.match(/^\/products\/([^/]+)$/))) Views.detail(m[1]);
    else if ((m = path.match(/^\/products\/([^/]+)\/edit$/))) Views.edit(m[1]);
    else location.replace('#/products');
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('auth:unauthorized', () => { Auth.clear(); location.hash = '#/login'; });
  // Broken product images fall back to a neutral placeholder.
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && !e.target.dataset.failed) {
      e.target.dataset.failed = '1';
      e.target.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#f1f5f9"/></svg>');
    }
  }, true);
  route();
})();
