// DummyJSON fakes writes, so creates/edits/deletes are kept in sessionStorage and overlaid on API data.
window.Store = (function () {
  const KEY = 'pad.changes', LOCAL_START = 100000;
  const blank = () => ({ created: [], edited: {}, deleted: [] });
  const read = () => { try { return Object.assign(blank(), JSON.parse(sessionStorage.getItem(KEY))); } catch (e) { return blank(); } };
  const write = (c) => { try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* session-only feature */ } };
  const isLocal = (id) => id >= LOCAL_START;
  return {
    isLocal,
    isDeleted: (id) => read().deleted.includes(id),
    getCreated: (id) => read().created.find((p) => p.id === id),
    addCreated(data) {
      const c = read();
      const id = Math.max(LOCAL_START - 1, ...c.created.map((p) => p.id)) + 1;
      const p = Object.assign({}, data, { id });
      c.created.unshift(p); write(c); return p;
    },
    saveEdit(id, patch) {
      const c = read();
      if (isLocal(id)) c.created = c.created.map((p) => (p.id === id ? Object.assign({}, p, patch) : p));
      else c.edited[id] = Object.assign({}, c.edited[id], patch);
      write(c);
    },
    markDeleted(id) {
      const c = read();
      if (isLocal(id)) c.created = c.created.filter((p) => p.id !== id);
      else if (!c.deleted.includes(id)) c.deleted.push(id);
      write(c);
    },
    applyToProduct: (p) => Object.assign({}, p, read().edited[p.id]),
    // Created products are only injected into the unfiltered first page (see README).
    applyToList(list, unfiltered, page) {
      const c = read();
      let products = list.products.filter((p) => !c.deleted.includes(p.id)).map((p) => Object.assign({}, p, c.edited[p.id]));
      let total = list.total;
      if (unfiltered) {
        total = Math.max(0, total - c.deleted.length + c.created.length);
        if (page === 1) products = c.created.concat(products);
      }
      return { products, total };
    },
  };
})();
