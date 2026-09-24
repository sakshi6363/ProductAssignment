// Token + public user info in localStorage (frontend-only assignment). Passwords are never stored.
window.Auth = (function () {
  const T = 'pad.token', USR = 'pad.user';
  const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  return {
    token: () => safe(() => localStorage.getItem(T), null),
    user: () => safe(() => JSON.parse(localStorage.getItem(USR)), null),
    save(token, user) { safe(() => { localStorage.setItem(T, token); localStorage.setItem(USR, JSON.stringify(user)); }); },
    clear() { safe(() => { localStorage.removeItem(T); localStorage.removeItem(USR); }); },
  };
})();
