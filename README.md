# Product Admin Dashboard (HTML + CSS + JavaScript)

Vanilla version: no build step, no npm. Axios is loaded from a CDN (`cdnjs.cloudflare.com`), so an internet connection is needed.

## Run
Open `index.html` in a browser, or serve the folder (recommended): `npx serve .` or VS Code "Live Server". Deploys as-is to Netlify/Vercel/GitHub Pages.
Login: `emilys` / `emilyspass` (DummyJSON only accepts its own demo users; the login page has a "Fill demo credentials" button).
To test the search race condition, open `index.html?delay=2000` (adds DummyJSON's `delay` param to every API call).

## Files
```
index.html        page shell + script tags
css/styles.css    responsive styles (sidebar collapses under 768px, table becomes cards)
js/utils.js       escaping, URL query parse/build (sanitizing), debounce
js/auth.js        token/user storage (localStorage; no password stored)
js/store.js       session overlay for DummyJSON's fake writes
js/api.js         the only file that uses Axios: shared instance, token interceptor, central errors, all endpoints
js/ui.js          toast, confirm dialog (native <dialog>), empty/error/skeleton blocks
js/views.js       login, shell, list, details, add/edit form
js/main.js        hash router + auth guard
```

## How it works
- **Routing:** hash routes (`#/login`, `#/products?...`, `#/products/12`, `#/products/12/edit`, `#/products/new`). Not logged in -> `#/login`. A 401 clears the token and logs out.
- **URL state:** `q`, `category`, `sort`, `order`, `page`, `limit` live in the hash query, e.g. `#/products?q=phone&category=smartphones&sort=price&order=asc&page=2&limit=20`. `U.parseQuery` sanitizes it: `?page=abc`, `?page=-5`, `?limit=999`, `?sort=unknown`, `?order=random` fall back to defaults; out-of-range pages are clamped.
- **Pagination:** `limit` + `skip`, sizes 10/20/50, "Showing 21–40 of 194". Only the current page is fetched.
- **Search:** debounced 400 ms, uses `/products/search`, resets to page 1.
- **Race conditions:** each list load aborts the previous request with an `AbortController`; a response that is aborted or not the newest is ignored.
- **Search + category:** search only -> search endpoint; category only -> category endpoint; both -> search endpoint (`limit=0`), filter by category and paginate in the browser. Sorting is server-side (`sortBy`/`order`).
- **Writes:** DummyJSON does not persist. The real POST/PUT/DELETE is sent, then the change is stored in `sessionStorage` and overlaid on API data for the session. Created items get IDs >= 100000 and skip the server for edit/delete.
- **Duplicate submits:** login, add, edit and delete use a `busy` flag plus a disabled button.
- **Errors:** Axios errors become readable messages centrally in `api.js`; retry buttons on list/detail.
- **Accessibility:** labels, focus styles, native modal dialog (focus trap + Esc), alt text, text-based errors ("Error: ...").

## Known limitations
- Locally created products only show on the unfiltered first page (making it one item longer); totals for filtered views are approximate after local deletes.
- Search box is in the list toolbar, not the global header.
- Token in localStorage.
- Not run or tested by the AI that wrote it (no network in its environment) - please test using the checklist in your assignment.

## AI Assistance
AI generated the initial code. Make sure you can explain every file, especially `api.js`, `loadList()` in `views.js` (abort logic), `utils.js` and `store.js`.
