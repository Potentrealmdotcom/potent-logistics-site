// Minimal Supabase client (auth + table queries) with the same call shapes the app uses from @supabase/supabase-js.
// It exists so the site builds with no package download. To use the official library instead, run
//   npm install @supabase/supabase-js
// and change the import in supabase.js to:  import { createClient } from '@supabase/supabase-js'

export function createClient(url, anonKey, opts) {
  const storageKey = (opts && opts.auth && opts.auth.storageKey) || 'sb-auth';
  const listeners = [];
  let session = null;
  let loaded = false;

  const ls = {
    get: () => { try { return window.localStorage.getItem(storageKey); } catch (e) { return null; } },
    set: (v) => { try { window.localStorage.setItem(storageKey, v); } catch (e) {} },
    del: () => { try { window.localStorage.removeItem(storageKey); } catch (e) {} },
  };
  const emit = (event) => listeners.slice().forEach(cb => { try { cb(event, session); } catch (e) {} });
  const setSession = (s, event) => {
    session = s;
    if (s) ls.set(JSON.stringify(s)); else ls.del();
    emit(event);
  };
  const load = () => {
    if (loaded) return;
    loaded = true;
    try { const raw = ls.get(); if (raw) session = JSON.parse(raw); } catch (e) { session = null; }
  };
  const authFetch = async (path, body, method) => {
    const r = await fetch(url + '/auth/v1' + path, {
      method: method || 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json', ...(session && path === '/user' ? { Authorization: 'Bearer ' + session.access_token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
    if (!r.ok) return { data: null, error: { message: (data && (data.msg || data.error_description || data.message || data.error)) || 'Request failed', status: r.status } };
    return { data, error: null };
  };
  const toSession = (d) => d && d.access_token ? {
    access_token: d.access_token, refresh_token: d.refresh_token, user: d.user,
    expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
  } : null;
  const freshSession = async () => {
    load();
    if (!session) return null;
    if (session.expires_at && session.expires_at - 30 < Date.now() / 1000 && session.refresh_token) {
      const { data, error } = await authFetch('/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      if (error || !toSession(data)) { setSession(null, 'SIGNED_OUT'); return null; }
      setSession(toSession(data), 'TOKEN_REFRESHED');
    }
    return session;
  };

  const auth = {
    async signUp({ email, password, options }) {
      const { data, error } = await authFetch('/signup', { email, password, data: (options && options.data) || {} });
      if (error) return { data: { user: null, session: null }, error };
      const s = toSession(data);
      if (s) setSession(s, 'SIGNED_IN');
      return { data: { user: (s && s.user) || data.user || data, session: s }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const { data, error } = await authFetch('/token?grant_type=password', { email, password });
      const s = toSession(data);
      if (error || !s) return { data: { user: null, session: null }, error: error || { message: 'Sign in failed' } };
      setSession(s, 'SIGNED_IN');
      return { data: { user: s.user, session: s }, error: null };
    },
    async signOut() {
      load();
      if (session) { try { await fetch(url + '/auth/v1/logout', { method: 'POST', headers: { apikey: anonKey, Authorization: 'Bearer ' + session.access_token } }); } catch (e) {} }
      setSession(null, 'SIGNED_OUT');
      return { error: null };
    },
    async getSession() { const s = await freshSession(); return { data: { session: s }, error: null }; },
    async getUser() {
      const s = await freshSession();
      if (!s) return { data: { user: null }, error: null };
      const { data, error } = await authFetch('/user', null, 'GET');
      return error ? { data: { user: null }, error } : { data: { user: data }, error: null };
    },
    onAuthStateChange(cb) {
      listeners.push(cb);
      freshSession().then(s => { try { cb('INITIAL_SESSION', s); } catch (e) {} });
      return { data: { subscription: { unsubscribe: () => { const i = listeners.indexOf(cb); if (i > -1) listeners.splice(i, 1); } } } };
    },
  };

  function from(table) {
    const q = { method: 'GET', filters: [], orders: [], select: '*', body: null, prefer: [], single: false, onConflict: null, wantRows: false };
    const run = async () => {
      const s = await freshSession();
      const params = [];
      if (q.method === 'GET' || q.wantRows) params.push('select=' + encodeURIComponent(q.select));
      q.filters.forEach(f => params.push(encodeURIComponent(f[0]) + '=eq.' + encodeURIComponent(f[1])));
      if (q.orders.length) params.push('order=' + q.orders.join(','));
      if (q.onConflict) params.push('on_conflict=' + encodeURIComponent(q.onConflict));
      const headers = { apikey: anonKey, Authorization: 'Bearer ' + (s ? s.access_token : anonKey), 'Content-Type': 'application/json' };
      const prefer = q.prefer.slice();
      if (q.method !== 'GET') prefer.push(q.wantRows ? 'return=representation' : 'return=minimal');
      if (prefer.length) headers.Prefer = prefer.join(',');
      if (q.single) headers.Accept = 'application/vnd.pgrst.object+json';
      const r = await fetch(url + '/rest/v1/' + table + (params.length ? '?' + params.join('&') : ''), { method: q.method, headers, body: q.body ? JSON.stringify(q.body) : undefined });
      const text = await r.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
      if (!r.ok) return { data: null, error: { message: (data && (data.message || data.error)) || 'Request failed', status: r.status } };
      return { data, error: null };
    };
    const api = {
      select(cols) { if (q.method !== 'GET') q.wantRows = true; q.select = cols || '*'; return api; },
      insert(row) { q.method = 'POST'; q.body = row; return api; },
      upsert(row, o) { q.method = 'POST'; q.body = row; q.prefer.push('resolution=merge-duplicates'); if (o && o.onConflict) q.onConflict = o.onConflict; return api; },
      update(vals) { q.method = 'PATCH'; q.body = vals; return api; },
      delete() { q.method = 'DELETE'; return api; },
      eq(col, val) { q.filters.push([col, val]); return api; },
      order(col, o) { q.orders.push(col + '.' + (o && o.ascending === false ? 'desc' : 'asc')); return api; },
      single() { q.single = true; q.wantRows = q.method !== 'GET'; return api; },
      then(res, rej) { return run().then(res, rej); },
    };
    return api;
  }

  return { auth, from };
}
