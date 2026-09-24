// The ONLY file that talks to the network: one shared Axios instance, central error handling.
window.Api = (function () {
  const delay = new URLSearchParams(location.search).get('delay'); // open index.html?delay=2000 to test races
  const client = axios.create({ baseURL: 'https://dummyjson.com', timeout: 15000 });

  client.interceptors.request.use((config) => {
    const token = Auth.token();
    if (token) config.headers.Authorization = 'Bearer ' + token;
    if (delay) config.params = Object.assign({}, config.params, { delay });
    return config;
  });
  client.interceptors.response.use((r) => r, (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const res = error.response;
    if (res && res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    const err = new Error(res ? (res.data && res.data.message) || 'The server could not complete the request.' : 'Network error. Please check your connection and try again.');
    err.status = res ? res.status : undefined;
    return Promise.reject(err);
  });

  async function login(username, password) {
    const { data } = await client.post('/auth/login', { username, password, expiresInMins: 60 });
    return { token: data.accessToken, user: { id: data.id, username: data.username, firstName: data.firstName, lastName: data.lastName } };
  }
  async function getProducts(q, signal) {
    // Strategy: search > category > all. Search + category: search all matches, filter by category, paginate client-side.
    const both = !!(q.q && q.category);
    const url = q.q ? '/products/search' : q.category ? '/products/category/' + encodeURIComponent(q.category) : '/products';
    const skip = (q.page - 1) * q.limit;
    const params = both ? { limit: 0, skip: 0 } : { limit: q.limit, skip };
    if (q.q) params.q = q.q;
    if (q.sort) { params.sortBy = q.sort; params.order = q.order; } // server-side sorting
    const { data } = await client.get(url, { params, signal });
    let list = { products: data.products, total: data.total };
    if (both) {
      const m = data.products.filter((p) => p.category === q.category);
      list = { products: m.slice(skip, skip + q.limit), total: m.length };
    }
    return Store.applyToList(list, !q.q && !q.category, q.page);
  }
  async function getCategories(signal) {
    const { data } = await client.get('/products/categories', { signal });
    return data.map((c) => (typeof c === 'string' ? { slug: c, name: c } : { slug: c.slug, name: c.name }));
  }
  async function getProduct(id, signal) {
    const notFound = () => Object.assign(new Error('Product not found'), { status: 404 });
    if (Store.isDeleted(id)) throw notFound();
    if (Store.isLocal(id)) { const p = Store.getCreated(id); if (!p) throw notFound(); return p; }
    const { data } = await client.get('/products/' + id, { signal });
    return Store.applyToProduct(data);
  }
  async function createProduct(input) {
    await client.post('/products/add', input); // real request; DummyJSON doesn't persist it
    return Store.addCreated(Object.assign({}, input, { images: input.thumbnail ? [input.thumbnail] : [] }));
  }
  async function updateProduct(id, input) {
    if (!Store.isLocal(id)) await client.put('/products/' + id, input); // locally created items don't exist on the server
    Store.saveEdit(id, input);
  }
  async function deleteProduct(id) {
    if (!Store.isLocal(id)) await client.delete('/products/' + id);
    Store.markDeleted(id);
  }
  return { login, getProducts, getCategories, getProduct, createProduct, updateProduct, deleteProduct };
})();
