// Helpers: HTML escaping, URL query parsing/building, debounce.
window.U = (function () {
  const PAGE_SIZES = [10, 20, 50];
  const SORTS = ['title', 'price', 'rating'];
  const DEFAULT_LIMIT = 10;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Number(n).toFixed(2);
  const pretty = (s) => String(s).replace(/-/g, ' ');

  // Turns untrusted URL params into a safe query object (bad values -> defaults).
  function parseQuery(str) {
    const sp = new URLSearchParams(str);
    const page = parseInt(sp.get('page'), 10);
    const limit = parseInt(sp.get('limit'), 10);
    const sort = sp.get('sort');
    return {
      q: (sp.get('q') || '').trim().slice(0, 100),
      category: (sp.get('category') || '').trim().slice(0, 60),
      sort: SORTS.includes(sort) ? sort : '',
      order: sp.get('order') === 'desc' ? 'desc' : 'asc',
      page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1,
      limit: PAGE_SIZES.includes(limit) ? limit : DEFAULT_LIMIT,
    };
  }
  function buildQuery(q) {
    const p = new URLSearchParams();
    if (q.q) p.set('q', q.q);
    if (q.category) p.set('category', q.category);
    if (q.sort) { p.set('sort', q.sort); p.set('order', q.order); }
    if (q.page > 1) p.set('page', q.page);
    if (q.limit !== DEFAULT_LIMIT) p.set('limit', q.limit);
    const s = p.toString();
    return s ? '?' + s : '';
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  return { PAGE_SIZES, esc, money, pretty, parseQuery, buildQuery, debounce };
})();
