/* Klien API untuk berkomunikasi dengan Google Apps Script Web App. */
(function () {
  const cfg = window.APP_CONFIG || {};

  function isConfigured() {
    return cfg.API_URL && cfg.API_URL.indexOf("GANTI_") !== 0;
  }

  /** Mode demo aktif bila API belum dikonfigurasi atau ?demo=1. */
  function isDemo() {
    var forced = false;
    try {
      var q = new URLSearchParams(window.location.search).get("demo");
      if (q === "1") sessionStorage.setItem("ms_demo", "1");      // aktifkan & ingat
      else if (q === "0") sessionStorage.removeItem("ms_demo");   // matikan paksa
      forced = sessionStorage.getItem("ms_demo") === "1";         // tetap aktif antar-halaman
    } catch (e) {
      forced = new URLSearchParams(window.location.search).get("demo") === "1";
    }
    return forced || !isConfigured();
  }

  /* ----------------------------- Demo backend ---------------------------- */
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function computeCollected(campaignId) {
    const ds = (window.SAMPLE_DATA && window.SAMPLE_DATA.donations) || [];
    return ds.filter(function (d) {
      return String(d.campaign_id) === String(campaignId) && d.status === "VERIFIED";
    }).reduce(function (s, d) { return s + (Number(d.amount) || 0); }, 0);
  }

  async function demo(action, payload) {
    await delay(350); // simulasikan latensi jaringan
    const S = window.SAMPLE_DATA || { campaigns: [], donations: [], payment: {} };
    payload = payload || {};
    switch (action) {
      case "campaigns":
        return S.campaigns.filter(function (c) { return String(c.status).toUpperCase() === "ACTIVE"; });
      case "campaign": {
        const c = S.campaigns.filter(function (x) { return String(x.id) === String(payload.id); })[0];
        if (!c) { const e = new Error("Campaign tidak ditemukan."); e.code = "NOT_FOUND"; throw e; }
        return c;
      }
      case "payment":
        return S.payment;
      case "donate":
        return { id: "DON-DEMO-" + Date.now() };
      case "login":
        if (payload.username === "admin" && payload.password === "demo") return { session: "demo-session" };
        { const e = new Error("Mode demo: gunakan username \"admin\" dan password \"demo\"."); e.code = "AUTH"; throw e; }
      case "adminData": {
        const pending = (S.donations || []).filter(function (d) { return d.status === "PENDING"; })
          .map(function (d) {
            const c = S.campaigns.filter(function (x) { return String(x.id) === String(d.campaign_id); })[0];
            return Object.assign({}, d, { campaign_title: c ? c.title : "" });
          });
        const verified = (S.donations || []).filter(function (d) { return d.status === "VERIFIED"; });
        return {
          stats: {
            activeCampaigns: S.campaigns.filter(function (c) { return c.status === "ACTIVE"; }).length,
            verifiedAmount: verified.reduce(function (s, d) { return s + (Number(d.amount) || 0); }, 0),
            verifiedCount: verified.length,
            pendingCount: pending.length,
          },
          pending: pending,
        };
      }
      case "verify":
      case "reject": {
        const d = (S.donations || []).filter(function (x) { return String(x.id) === String(payload.id); })[0];
        if (d) {
          d.status = action === "verify" ? "VERIFIED" : "REJECTED";
          const c = S.campaigns.filter(function (x) { return String(x.id) === String(d.campaign_id); })[0];
          if (c) c.current_amount = computeCollected(c.id);
        }
        return { id: payload.id, status: action === "verify" ? "VERIFIED" : "REJECTED" };
      }
      case "listCampaignsAdmin":
        return S.campaigns.slice();
      case "addCampaign": {
        const c = Object.assign({ current_amount: 0 }, payload.campaign);
        if (c.image_base64) {
          c.image = "data:" + (c.image_mime || "image/png") + ";base64," + c.image_base64;
        }
        delete c.image_base64; delete c.image_mime; delete c.image_filename;
        const maxId = S.campaigns.reduce(function (m, x) { return Math.max(m, parseInt(x.id, 10) || 0); }, 0);
        c.id = String(maxId + 1);
        S.campaigns.push(c);
        return { id: c.id };
      }
      case "updateCampaign": {
        const p = payload.campaign || {};
        const c = S.campaigns.filter(function (x) { return String(x.id) === String(p.id); })[0];
        if (!c) { const e = new Error("Program tidak ditemukan."); e.code = "NOT_FOUND"; throw e; }
        if (p.image_base64) {
          c.image = "data:" + (p.image_mime || "image/png") + ";base64," + p.image_base64;
        }
        ["title", "description", "target_amount", "deadline", "status", "image", "fund_usage"].forEach(function (k) {
          if (p[k] !== undefined) c[k] = p[k];
        });
        return { id: c.id };
      }
      case "deleteCampaign": {
        S.campaigns = S.campaigns.filter(function (x) { return String(x.id) !== String(payload.id); });
        return { id: payload.id };
      }
      case "listAdmins":
        return (S.admins || []).map(function (a) { return { username: a.username }; });
      case "addAdmin": {
        S.admins = S.admins || [];
        if (S.admins.some(function (a) { return a.username.toLowerCase() === String(payload.username).toLowerCase(); })) {
          const e = new Error("Username sudah dipakai."); e.code = "CONFLICT"; throw e;
        }
        S.admins.push({ username: payload.username });
        return { username: payload.username };
      }
      case "setAdminPassword":
        return { username: payload.username };
      case "deleteAdmin": {
        S.admins = (S.admins || []).filter(function (a) { return a.username !== payload.username; });
        return { username: payload.username };
      }
      case "lpj":
      case "listLpjAdmin": {
        const list = (S.lpj || []).slice();
        list.sort(function (a, b) {
          return new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0);
        });
        return list;
      }
      case "lpjItem": {
        const l = (S.lpj || []).filter(function (x) { return String(x.id) === String(payload.id); })[0];
        if (!l) { const e = new Error("LPJ tidak ditemukan."); e.code = "NOT_FOUND"; throw e; }
        return l;
      }
      case "addLpj": {
        S.lpj = S.lpj || [];
        const l = Object.assign({}, payload.lpj);
        if (l.image_base64) {
          l.image = "data:" + (l.image_mime || "image/png") + ";base64," + l.image_base64;
        }
        delete l.image_base64; delete l.image_mime; delete l.image_filename;
        const maxId = S.lpj.reduce(function (m, x) { return Math.max(m, parseInt(x.id, 10) || 0); }, 0);
        l.id = String(maxId + 1);
        l.created_at = new Date().toISOString();
        S.lpj.push(l);
        return { id: l.id };
      }
      case "updateLpj": {
        const p = payload.lpj || {};
        const l = (S.lpj || []).filter(function (x) { return String(x.id) === String(p.id); })[0];
        if (!l) { const e = new Error("LPJ tidak ditemukan."); e.code = "NOT_FOUND"; throw e; }
        if (p.image_base64) {
          l.image = "data:" + (p.image_mime || "image/png") + ";base64," + p.image_base64;
        }
        ["title", "campaign_id", "date", "amount", "description", "image"].forEach(function (k) {
          if (p[k] !== undefined) l[k] = p[k];
        });
        return { id: l.id };
      }
      case "deleteLpj": {
        S.lpj = (S.lpj || []).filter(function (x) { return String(x.id) !== String(payload.id); });
        return { id: payload.id };
      }
      default:
        throw new Error("Aksi tidak dikenal.");
    }
  }

  /** ID perangkat yang persisten untuk keperluan rate limiting di server. */
  function clientId() {
    try {
      var key = "ms_client_id";
      var id = localStorage.getItem(key);
      if (!id) {
        id = "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return "anon";
    }
  }

  /** GET request mentah ke server (tanpa cache). */
  async function rawGet(action, params) {
    const url = new URL(cfg.API_URL);
    url.searchParams.set("action", action);
    if (params) {
      Object.keys(params).forEach(function (k) {
        if (params[k] != null) url.searchParams.set(k, params[k]);
      });
    }
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Permintaan gagal");
    return data.data;
  }

  /* --------------------------- Cache sisi klien -------------------------- */
  // Menyimpan hasil GET di localStorage agar kunjungan berikutnya (pindah
  // halaman / buka tab baru) tampil instan tanpa menunggu server Apps Script
  // yang sering lambat karena cold start.
  var CACHE_PREFIX = "ms_cache_";
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit, konsisten dengan cache server.

  function cacheKey(action, params) {
    return CACHE_PREFIX + action + (params ? ":" + JSON.stringify(params) : "");
  }

  function readCache(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw); // { t: timestamp, d: data }
    } catch (e) {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
    } catch (e) {
      // Kuota penuh / mode privat — abaikan, cache hanya optimasi.
    }
  }

  /**
   * GET dengan strategi stale-while-revalidate:
   * 1. Bila ada data di cache, kembalikan langsung (instan).
   * 2. Selalu ambil data terbaru dari server di latar belakang.
   * 3. Bila data server berbeda dari cache, panggil onFresh(dataBaru) supaya
   *    UI bisa memperbarui dirinya tanpa membuat pengguna menunggu.
   */
  function get(action, params, onFresh) {
    if (isDemo()) return demo(action, params);

    var key = cacheKey(action, params);
    var cached = readCache(key);

    var fetchPromise = rawGet(action, params).then(function (data) {
      writeCache(key, data);
      return data;
    });

    if (cached && cached.d !== undefined) {
      // Perbarui di latar belakang; beri tahu pemanggil bila ada perubahan.
      fetchPromise
        .then(function (fresh) {
          if (typeof onFresh === "function" && JSON.stringify(fresh) !== JSON.stringify(cached.d)) {
            onFresh(fresh);
          }
        })
        .catch(function () { /* biarkan data cache tetap tampil bila server gagal */ });
      return Promise.resolve(cached.d);
    }

    return fetchPromise;
  }

  /**
   * POST request. Memakai content-type text/plain agar tidak memicu CORS
   * preflight (Apps Script tidak menangani OPTIONS). Server membaca
   * e.postData.contents sebagai JSON.
   */
  async function post(action, payload) {
    if (isDemo()) return demo(action, payload);
    const body = Object.assign({ action: action, writeToken: cfg.WRITE_TOKEN, clientId: clientId() }, payload || {});
    const res = await fetch(cfg.API_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      const err = new Error(data.error || "Permintaan gagal");
      err.code = data.code;
      throw err;
    }
    return data.data;
  }

  window.API = {
    isConfigured: isConfigured,
    isDemo: isDemo,
    // Publik (GET) — parameter onFresh opsional untuk pembaruan latar belakang.
    getCampaigns: function (onFresh) { return get("campaigns", null, onFresh); },
    getCampaign: function (id, onFresh) { return get("campaign", { id: id }, onFresh); },
    getPayment: function (onFresh) { return get("payment", null, onFresh); },
    getLpj: function (onFresh) { return get("lpj", null, onFresh); },
    getLpjItem: function (id, onFresh) { return get("lpjItem", { id: id }, onFresh); },
    // Donasi (POST)
    submitDonation: function (payload) { return post("donate", payload); },
    // Admin (POST)
    login: function (username, password) { return post("login", { username: username, password: password }); },
    getAdminData: function (session) { return post("adminData", { session: session }); },
    verifyDonation: function (session, id) { return post("verify", { session: session, id: id }); },
    rejectDonation: function (session, id) { return post("reject", { session: session, id: id }); },
    // Kelola program (campaign) — admin
    listCampaignsAdmin: function (session) { return post("listCampaignsAdmin", { session: session }); },
    addCampaign: function (session, campaign) { return post("addCampaign", { session: session, campaign: campaign }); },
    updateCampaign: function (session, campaign) { return post("updateCampaign", { session: session, campaign: campaign }); },
    deleteCampaign: function (session, id) { return post("deleteCampaign", { session: session, id: id }); },
    // Kelola akun admin
    listAdmins: function (session) { return post("listAdmins", { session: session }); },
    addAdmin: function (session, username, password) { return post("addAdmin", { session: session, username: username, password: password }); },
    setAdminPassword: function (session, username, password) { return post("setAdminPassword", { session: session, username: username, password: password }); },
    deleteAdmin: function (session, username) { return post("deleteAdmin", { session: session, username: username }); },
    // Kelola LPJ Pengadaan
    listLpjAdmin: function (session) { return post("listLpjAdmin", { session: session }); },
    addLpj: function (session, lpj) { return post("addLpj", { session: session, lpj: lpj }); },
    updateLpj: function (session, lpj) { return post("updateLpj", { session: session, lpj: lpj }); },
    deleteLpj: function (session, id) { return post("deleteLpj", { session: session, id: id }); },
  };
})();
