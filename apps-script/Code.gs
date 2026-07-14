/**
 * ============================================================================
 * Donasi MuslimSolo.id — Google Apps Script Backend
 * ============================================================================
 * Web App ini menjadi jembatan antara website statis dan Google Spreadsheet.
 *
 * CARA DEPLOY:
 * 1. Buat Google Spreadsheet dengan sheet: campaigns, donations, payment, admin
 *    (lihat README.md untuk struktur kolom).
 * 2. Extensions > Apps Script, tempel kode ini.
 * 3. Project Settings > Script Properties, tambahkan:
 *      WRITE_TOKEN   = (string acak rahasia, samakan dengan config.js frontend)
 *      SPREADSHEET_ID= (id spreadsheet, opsional jika skrip terikat ke sheet)
 *      PROOF_FOLDER_ID = (opsional, id folder Drive untuk bukti transfer)
 *      ADMIN_EMAIL   = (opsional, email penerima notifikasi donasi baru)
 * 4. Jalankan fungsi setupAdmin() sekali dari editor untuk membuat akun admin
 *    (ubah username & password di dalam fungsi terlebih dahulu).
 * 5. Deploy > New deployment > Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 *    Salin URL /exec ke API_URL di assets/js/config.js.
 * ============================================================================
 */

var SHEET = { CAMPAIGNS: "campaigns", DONATIONS: "donations", PAYMENT: "payment", ADMIN: "admin", LPJ: "lpj" };
var SESSION_TTL = 21600; // 6 jam (maksimum CacheService) — memenuhi syarat "<= 12 jam".
var PUBLIC_CACHE_TTL = 300; // 5 menit.
var RATE_LIMIT = { max: 5, windowSec: 60 };
var MAX_PROOF_BYTES = 5 * 1024 * 1024;
var ALLOWED_MIME = ["image/jpeg", "image/png"];
var MAX_BANNER_BYTES = 5 * 1024 * 1024;
var ALLOWED_BANNER_MIME = ["image/jpeg", "image/png", "image/webp"];

/* ----------------------------- Entry points ----------------------------- */

function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) || "";
    switch (action) {
      case "campaigns": return ok(getActiveCampaigns());
      case "campaign":  return handleGetCampaign(e.parameter.id);
      case "payment":   return ok(getPaymentInfo());
      case "lpj":       return ok(getLpjPublic());
      case "lpjItem":   return handleGetLpjItem(e.parameter.id);
      default:          return fail("Aksi tidak dikenal.", "BAD_ACTION");
    }
  } catch (err) {
    return fail(err.message || String(err), "SERVER_ERROR");
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || "{}");
    var action = body.action || "";

    // Validasi Write_Token untuk semua operasi tulis (Requirement 5.1).
    if (body.writeToken !== scriptProp("WRITE_TOKEN")) {
      return fail("Token tidak valid.", "FORBIDDEN");
    }

    switch (action) {
      case "donate":    return handleDonate(body);
      case "login":     return handleLogin(body);
      case "adminData": return handleAdminData(body);
      case "verify":    return handleVerifyReject(body, "VERIFIED");
      case "reject":    return handleVerifyReject(body, "REJECTED");
      case "listCampaignsAdmin": return handleListCampaignsAdmin(body);
      case "addCampaign":    return handleAddCampaign(body);
      case "updateCampaign": return handleUpdateCampaign(body);
      case "deleteCampaign": return handleDeleteCampaign(body);
      case "listAdmins":       return handleListAdmins(body);
      case "addAdmin":         return handleAddAdmin(body);
      case "setAdminPassword": return handleSetAdminPassword(body);
      case "deleteAdmin":      return handleDeleteAdmin(body);
      case "listLpjAdmin": return handleListLpjAdmin(body);
      case "addLpj":       return handleAddLpj(body);
      case "updateLpj":    return handleUpdateLpj(body);
      case "deleteLpj":    return handleDeleteLpj(body);
      default:          return fail("Aksi tidak dikenal.", "BAD_ACTION");
    }
  } catch (err) {
    return fail(err.message || String(err), "SERVER_ERROR");
  }
}

/* ------------------------------ Public reads ----------------------------- */

/**
 * Daftar lengkap campaign (sudah dihitung ulang) dengan cache.
 * Dipakai bersama oleh daftar publik dan detail agar tidak menghitung ulang
 * serta menulis balik ke sheet pada setiap permintaan (sumber utama lambat).
 */
function getAllCampaignsCached() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("public_campaigns_all");
  if (cached) return JSON.parse(cached);

  var campaigns = refreshCampaignTotals(); // hitung ulang + perbarui status
  try {
    cache.put("public_campaigns_all", JSON.stringify(campaigns), PUBLIC_CACHE_TTL);
  } catch (e) { /* data > 100KB: lewati cache, tetap kembalikan hasil */ }
  return campaigns;
}

function getActiveCampaigns() {
  // Kembalikan ACTIVE dan COMPLETED agar halaman publik bisa
  // menampilkan donasi yang sudah terpenuhi dengan label "Donasi Terpenuhi".
  // Hanya status CLOSED yang disembunyikan dari publik.
  return getAllCampaignsCached().filter(function (c) {
    var s = String(c.status).toUpperCase();
    return s === "ACTIVE" || s === "COMPLETED";
  });
}

function handleGetCampaign(id) {
  if (!id) return fail("Campaign tidak ditemukan.", "NOT_FOUND");
  var found = getAllCampaignsCached().filter(function (c) { return String(c.id) === String(id); })[0];
  if (!found) return fail("Campaign tidak ditemukan.", "NOT_FOUND");
  return ok(found);
}

/** Bersihkan seluruh cache baca publik saat data berubah. */
function clearPublicCache() {
  try {
    CacheService.getScriptCache().removeAll(["public_campaigns", "public_campaigns_all", "public_lpj"]);
  } catch (e) { /* abaikan */ }
}

function getPaymentInfo() {
  var rows = readSheet(SHEET.PAYMENT);
  return rows[0] || {};
}

/* ------------------------------- Donation -------------------------------- */

function handleDonate(body) {
  // Rate limit per client (Requirement 5.2). clientId dari frontend (localStorage).
  var clientId = body.clientId || "anon";
  var cache = CacheService.getScriptCache();
  var key = "rl_" + clientId;
  var count = parseInt(cache.get(key) || "0", 10);
  if (count >= RATE_LIMIT.max) {
    return fail("Terlalu banyak pengiriman. Coba lagi sebentar.", "RATE_LIMIT");
  }

  // Validasi field (Requirement 4.7).
  var name = String(body.name || "").trim();
  var amount = Math.floor(Number(body.amount));
  var method = String(body.payment_method || "");
  if (!name) return fail("Nama wajib diisi.", "VALIDATION");
  if (!(amount >= 1)) return fail("Nominal minimal Rp1.", "VALIDATION");
  if (["Transfer", "QRIS"].indexOf(method) === -1) return fail("Metode pembayaran tidak valid.", "VALIDATION");
  if (!body.proof_base64) return fail("Bukti pembayaran wajib diupload.", "VALIDATION");

  // Validasi campaign & status (Requirement 9.4).
  var campaign = readSheet(SHEET.CAMPAIGNS).filter(function (c) {
    return String(c.id) === String(body.campaign_id);
  })[0];
  if (!campaign) return fail("Campaign tidak ditemukan.", "NOT_FOUND");
  var status = computeCampaignStatus(campaign);
  if (status !== "ACTIVE") return fail("Campaign ini sudah tidak menerima donasi.", "CLOSED");

  // Validasi & simpan bukti ke Drive (Requirement 4.8).
  var mime = String(body.proof_mime || "");
  if (ALLOWED_MIME.indexOf(mime) === -1) return fail("Bukti harus JPG atau PNG.", "VALIDATION");
  var bytes = Utilities.base64Decode(body.proof_base64);
  if (bytes.length > MAX_PROOF_BYTES) return fail("Ukuran bukti maksimal 5 MB.", "VALIDATION");
  var proofUrl = saveProof(bytes, mime, name);

  // Catat donasi dengan status PENDING (Requirement 4.4, 4.5).
  var sheet = getSheet(SHEET.DONATIONS);
  var id = "DON-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  var createdAt = new Date();
  appendByHeader(sheet, {
    id: id,
    campaign_id: body.campaign_id,
    name: name,
    amount: amount,
    payment_method: method,
    proof_image: proofUrl,
    status: "PENDING",
    created_at: createdAt,
    note: String(body.note || "").trim(),
  });

  // Rate-limit counter.
  cache.put(key, String(count + 1), RATE_LIMIT.windowSec);

  // Notifikasi admin (Requirement 12), tidak menggagalkan donasi bila error.
  notifyAdmin(name, amount, campaign.title);

  return ok({ id: id });
}

function saveProof(bytes, mime, donorName) {
  var ext = mime === "image/png" ? "png" : "jpg";
  var blob = Utilities.newBlob(bytes, mime, "bukti-" + sanitize(donorName) + "-" + Date.now() + "." + ext);
  var folderId = scriptProp("PROOF_FOLDER_ID");
  var folder = folderId ? DriveApp.getFolderById(folderId) : getOrCreateFolder("Donasi MuslimSolo - Bukti");
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://lh3.googleusercontent.com/d/" + file.getId() + "=w1600";
}

/* --------------------------------- Admin --------------------------------- */

function handleLogin(body) {
  var username = String(body.username || "").trim();
  var password = String(body.password || "");
  var admins = readSheet(SHEET.ADMIN);
  var admin = admins.filter(function (a) {
    return String(a.username).toLowerCase() === username.toLowerCase();
  })[0];

  // Pesan error generik agar tidak membocorkan field mana yang salah (Requirement 6.4).
  var generic = function () { return fail("Username atau password salah.", "AUTH"); };
  if (!admin) return generic();

  var stored = String(admin.password || "");
  var parts = stored.split(":");
  if (parts.length !== 2) return generic();
  var salt = parts[0], hash = parts[1];
  if (hashPassword(password, salt) !== hash) return generic();

  var session = Utilities.getUuid();
  CacheService.getScriptCache().put("sess_" + session, username, SESSION_TTL);
  return ok({ session: session });
}

function requireSession(body) {
  var session = body.session || "";
  var user = session ? CacheService.getScriptCache().get("sess_" + session) : null;
  if (!user) throw withCode("Sesi berakhir, silakan login ulang.", "AUTH");
  return user;
}

function handleAdminData(body) {
  requireSession(body);
  var campaigns = refreshCampaignTotals();
  var donations = readSheet(SHEET.DONATIONS);
  var titleById = {};
  campaigns.forEach(function (c) { titleById[String(c.id)] = c.title; });

  var verified = donations.filter(function (d) { return up(d.status) === "VERIFIED"; });
  var pending = donations
    .filter(function (d) { return up(d.status) === "PENDING"; })
    .map(function (d) {
      d.campaign_title = titleById[String(d.campaign_id)] || "";
      return d;
    })
    .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });

  var verifiedAmount = verified.reduce(function (s, d) { return s + (Number(d.amount) || 0); }, 0);

  return ok({
    stats: {
      activeCampaigns: campaigns.filter(function (c) { return up(c.status) === "ACTIVE"; }).length,
      verifiedAmount: verifiedAmount,
      verifiedCount: verified.length,
      pendingCount: pending.length,
    },
    pending: pending,
  });
}

function handleVerifyReject(body, newStatus) {
  requireSession(body);
  var id = body.id;
  if (!id) return fail("ID donasi tidak ada.", "VALIDATION");

  var sheet = getSheet(SHEET.DONATIONS);
  var headers = getHeaders(sheet);
  var idCol = headers.indexOf("id");
  var statusCol = headers.indexOf("status");
  var campaignCol = headers.indexOf("campaign_id");
  var values = sheet.getDataRange().getValues();

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      var current = up(values[r][statusCol]);
      // Hanya boleh aksi pada donasi PENDING (Requirement 8.6).
      if (current !== "PENDING") return fail("Donasi ini sudah diproses.", "CONFLICT");
      sheet.getRange(r + 1, statusCol + 1).setValue(newStatus);

      // Recompute total campaign terdampak & invalidasi cache (Requirement 8.5, 10.2).
      refreshCampaignTotals();
      clearPublicCache();
      return ok({ id: id, status: newStatus, campaign_id: values[r][campaignCol] });
    }
  }
  return fail("Donasi tidak ditemukan.", "NOT_FOUND");
}

/* ----------------------- Campaign management (admin) --------------------- */

var CAMPAIGN_FIELDS = ["title", "description", "target_amount", "deadline", "status", "image", "fund_usage"];

function handleListCampaignsAdmin(body) {
  requireSession(body);
  return ok(refreshCampaignTotals());
}

function validateCampaignPayload(c) {
  if (!c || !String(c.title || "").trim()) return "Judul wajib diisi.";
  if (!(Math.floor(Number(c.target_amount)) >= 1)) return "Target dana minimal Rp1.";
  var status = up(c.status);
  if (["ACTIVE", "COMPLETED", "CLOSED"].indexOf(status) === -1) return "Status tidak valid.";
  return null;
}

function handleAddCampaign(body) {
  requireSession(body);
  var c = body.campaign || {};
  var errMsg = validateCampaignPayload(c);
  if (errMsg) return fail(errMsg, "VALIDATION");

  // Simpan gambar banner yang diupload (opsional) ke Drive.
  var imageUrl = String(c.image || "").trim();
  if (c.image_base64) {
    var savedAdd = saveBanner(c, String(c.title || "banner"));
    if (savedAdd.error) return fail(savedAdd.error, "VALIDATION");
    imageUrl = savedAdd.url;
  }

  var sheet = getSheet(SHEET.CAMPAIGNS);
  var headers = getHeaders(sheet);
  var values = sheet.getDataRange().getValues();
  var idCol = headers.indexOf("id");

  // id = max numeric id + 1.
  var maxId = 0;
  for (var r = 1; r < values.length; r++) {
    var n = parseInt(values[r][idCol], 10);
    if (!isNaN(n)) maxId = Math.max(maxId, n);
  }
  var newId = String(maxId + 1);

  var data = {
    id: newId,
    title: String(c.title).trim(),
    slug: slugify(c.title),
    description: String(c.description || "").trim(),
    target_amount: Math.floor(Number(c.target_amount)),
    current_amount: 0,
    deadline: c.deadline || "",
    status: up(c.status),
    image: imageUrl,
    fund_usage: String(c.fund_usage || "").trim(),
  };
  appendByHeader(sheet, data);
  clearPublicCache();
  return ok({ id: newId });
}

function handleUpdateCampaign(body) {
  requireSession(body);
  var c = body.campaign || {};
  if (!c.id) return fail("ID program tidak ada.", "VALIDATION");
  var errMsg = validateCampaignPayload(c);
  if (errMsg) return fail(errMsg, "VALIDATION");

  // Bila ada gambar banner baru, simpan ke Drive dan pakai URL hasilnya.
  var imageUrl = String(c.image || "").trim();
  if (c.image_base64) {
    var savedUpd = saveBanner(c, String(c.title || "banner"));
    if (savedUpd.error) return fail(savedUpd.error, "VALIDATION");
    imageUrl = savedUpd.url;
  }

  var sheet = getSheet(SHEET.CAMPAIGNS);
  var headers = getHeaders(sheet);
  var values = sheet.getDataRange().getValues();
  var idCol = headers.indexOf("id");

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(c.id)) {
      setCell(sheet, headers, r, "title", String(c.title).trim());
      setCell(sheet, headers, r, "description", String(c.description || "").trim());
      setCell(sheet, headers, r, "target_amount", Math.floor(Number(c.target_amount)));
      setCell(sheet, headers, r, "deadline", c.deadline || "");
      setCell(sheet, headers, r, "status", up(c.status));
      setCell(sheet, headers, r, "image", imageUrl);
      setCell(sheet, headers, r, "fund_usage", String(c.fund_usage || "").trim());
      clearPublicCache();
      return ok({ id: c.id });
    }
  }
  return fail("Program tidak ditemukan.", "NOT_FOUND");
}

/** Validasi & simpan gambar banner ke Drive. Mengembalikan {url} atau {error}. */
function saveBanner(c, title) {
  var mime = String(c.image_mime || "");
  if (ALLOWED_BANNER_MIME.indexOf(mime) === -1) return { error: "Gambar banner harus JPG, PNG, atau WEBP." };
  var bytes = Utilities.base64Decode(c.image_base64);
  if (bytes.length > MAX_BANNER_BYTES) return { error: "Ukuran gambar banner maksimal 5 MB." };

  var ext = mime === "image/png" ? "png" : (mime === "image/webp" ? "webp" : "jpg");
  var blob = Utilities.newBlob(bytes, mime, "banner-" + sanitize(title) + "-" + Date.now() + "." + ext);
  var folderId = scriptProp("BANNER_FOLDER_ID");
  var folder = folderId ? DriveApp.getFolderById(folderId) : getOrCreateFolder("Donasi MuslimSolo - Banner");
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: "https://lh3.googleusercontent.com/d/" + file.getId() + "=w1600" };
}

function handleDeleteCampaign(body) {
  requireSession(body);
  if (!body.id) return fail("ID program tidak ada.", "VALIDATION");
  var sheet = getSheet(SHEET.CAMPAIGNS);
  var headers = getHeaders(sheet);
  var idCol = headers.indexOf("id");
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(body.id)) {
      sheet.deleteRow(r + 1);
      clearPublicCache();
      return ok({ id: body.id });
    }
  }
  return fail("Program tidak ditemukan.", "NOT_FOUND");
}

/* ------------------------- Admin management (admin) ---------------------- */

function handleListAdmins(body) {
  requireSession(body);
  var admins = readSheet(SHEET.ADMIN).map(function (a) { return { username: a.username }; });
  return ok(admins);
}

function handleAddAdmin(body) {
  requireSession(body);
  var username = String(body.username || "").trim();
  var password = String(body.password || "");
  if (!username) return fail("Username wajib diisi.", "VALIDATION");
  if (password.length < 6) return fail("Password minimal 6 karakter.", "VALIDATION");

  var sheet = getSheet(SHEET.ADMIN);
  var existing = readSheet(SHEET.ADMIN);
  if (existing.some(function (a) { return String(a.username).toLowerCase() === username.toLowerCase(); })) {
    return fail("Username sudah dipakai.", "CONFLICT");
  }
  appendByHeader(sheet, { username: username, password: makePasswordHash(password) });
  return ok({ username: username });
}

function handleSetAdminPassword(body) {
  requireSession(body);
  var username = String(body.username || "").trim();
  var password = String(body.password || "");
  if (password.length < 6) return fail("Password minimal 6 karakter.", "VALIDATION");

  var sheet = getSheet(SHEET.ADMIN);
  var headers = getHeaders(sheet);
  var userCol = headers.indexOf("username");
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][userCol]).toLowerCase() === username.toLowerCase()) {
      setCell(sheet, headers, r, "password", makePasswordHash(password));
      return ok({ username: username });
    }
  }
  return fail("Admin tidak ditemukan.", "NOT_FOUND");
}

function handleDeleteAdmin(body) {
  requireSession(body);
  var username = String(body.username || "").trim();
  var sheet = getSheet(SHEET.ADMIN);
  var headers = getHeaders(sheet);
  var userCol = headers.indexOf("username");
  var values = sheet.getDataRange().getValues();

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][userCol]).trim()) rows.push(r);
  }
  if (rows.length <= 1) return fail("Tidak dapat menghapus admin terakhir.", "CONFLICT");

  for (var i = 0; i < rows.length; i++) {
    if (String(values[rows[i]][userCol]).toLowerCase() === username.toLowerCase()) {
      sheet.deleteRow(rows[i] + 1);
      return ok({ username: username });
    }
  }
  return fail("Admin tidak ditemukan.", "NOT_FOUND");
}

/* ----------------------- LPJ Pengadaan (laporan) ------------------------- */

/** Daftar LPJ untuk publik & admin, diurutkan dari yang terbaru (dengan cache). */
function getLpjPublic() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("public_lpj");
  if (cached) return JSON.parse(cached);

  var rows = readSheet(SHEET.LPJ);
  rows.sort(function (a, b) {
    return new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0);
  });
  try {
    cache.put("public_lpj", JSON.stringify(rows), PUBLIC_CACHE_TTL);
  } catch (e) { /* data > 100KB: lewati cache */ }
  return rows;
}

function handleListLpjAdmin(body) {
  requireSession(body);
  return ok(getLpjPublic());
}

function handleGetLpjItem(id) {
  if (!id) return fail("LPJ tidak ditemukan.", "NOT_FOUND");
  var found = getLpjPublic().filter(function (l) { return String(l.id) === String(id); })[0];
  if (!found) return fail("LPJ tidak ditemukan.", "NOT_FOUND");
  return ok(found);
}

function validateLpjPayload(l) {
  if (!l || !String(l.title || "").trim()) return "Judul pengadaan wajib diisi.";
  if (!(Math.floor(Number(l.amount)) >= 0)) return "Nominal dana tidak valid.";
  return null;
}

function handleAddLpj(body) {
  requireSession(body);
  var l = body.lpj || {};
  var errMsg = validateLpjPayload(l);
  if (errMsg) return fail(errMsg, "VALIDATION");

  var imageUrl = String(l.image || "").trim();
  if (l.image_base64) {
    var saved = saveBanner(l, String(l.title || "lpj"));
    if (saved.error) return fail(saved.error, "VALIDATION");
    imageUrl = saved.url;
  }

  var sheet = getSheet(SHEET.LPJ);
  var headers = getHeaders(sheet);
  var values = sheet.getDataRange().getValues();
  var idCol = headers.indexOf("id");
  var maxId = 0;
  for (var r = 1; r < values.length; r++) {
    var n = parseInt(values[r][idCol], 10);
    if (!isNaN(n)) maxId = Math.max(maxId, n);
  }
  var newId = String(maxId + 1);

  appendByHeader(sheet, {
    id: newId,
    title: String(l.title).trim(),
    campaign_id: l.campaign_id || "",
    date: l.date || "",
    amount: Math.floor(Number(l.amount)) || 0,
    description: String(l.description || "").trim(),
    image: imageUrl,
    created_at: new Date(),
  });
  clearPublicCache();
  return ok({ id: newId });
}

function handleUpdateLpj(body) {
  requireSession(body);
  var l = body.lpj || {};
  if (!l.id) return fail("ID LPJ tidak ada.", "VALIDATION");
  var errMsg = validateLpjPayload(l);
  if (errMsg) return fail(errMsg, "VALIDATION");

  var imageUrl = String(l.image || "").trim();
  if (l.image_base64) {
    var saved = saveBanner(l, String(l.title || "lpj"));
    if (saved.error) return fail(saved.error, "VALIDATION");
    imageUrl = saved.url;
  }

  var sheet = getSheet(SHEET.LPJ);
  var headers = getHeaders(sheet);
  var values = sheet.getDataRange().getValues();
  var idCol = headers.indexOf("id");
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(l.id)) {
      setCell(sheet, headers, r, "title", String(l.title).trim());
      setCell(sheet, headers, r, "campaign_id", l.campaign_id || "");
      setCell(sheet, headers, r, "date", l.date || "");
      setCell(sheet, headers, r, "amount", Math.floor(Number(l.amount)) || 0);
      setCell(sheet, headers, r, "description", String(l.description || "").trim());
      setCell(sheet, headers, r, "image", imageUrl);
      clearPublicCache();
      return ok({ id: l.id });
    }
  }
  return fail("LPJ tidak ditemukan.", "NOT_FOUND");
}

function handleDeleteLpj(body) {
  requireSession(body);
  if (!body.id) return fail("ID LPJ tidak ada.", "VALIDATION");
  var sheet = getSheet(SHEET.LPJ);
  var headers = getHeaders(sheet);
  var idCol = headers.indexOf("id");
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(body.id)) {
      sheet.deleteRow(r + 1);
      clearPublicCache();
      return ok({ id: body.id });
    }
  }
  return fail("LPJ tidak ditemukan.", "NOT_FOUND");
}

/* --------------------- Campaign totals & status logic -------------------- */

/**
 * Hitung ulang Collected_Amount tiap campaign dari donasi VERIFIED,
 * perbarui status (COMPLETED/CLOSED), dan tulis balik ke sheet campaigns.
 * Mengembalikan array campaign terbaru.
 */
function refreshCampaignTotals() {
  var sheet = getSheet(SHEET.CAMPAIGNS);
  var headers = getHeaders(sheet);
  var values = sheet.getDataRange().getValues();
  var donations = readSheet(SHEET.DONATIONS);

  var verifiedByCampaign = {};
  donations.forEach(function (d) {
    if (up(d.status) === "VERIFIED") {
      var k = String(d.campaign_id);
      verifiedByCampaign[k] = (verifiedByCampaign[k] || 0) + (Number(d.amount) || 0);
    }
  });

  var idCol = headers.indexOf("id");
  var currentCol = headers.indexOf("current_amount");
  var statusCol = headers.indexOf("status");
  var result = [];

  for (var r = 1; r < values.length; r++) {
    var obj = rowToObject(headers, values[r]);
    if (!obj.id) continue;
    var collected = verifiedByCampaign[String(obj.id)] || 0;
    obj.current_amount = collected;
    obj.status = computeCampaignStatus(obj);

    // Tulis balik bila berubah.
    if (Number(values[r][currentCol]) !== collected) {
      sheet.getRange(r + 1, currentCol + 1).setValue(collected);
    }
    if (up(values[r][statusCol]) !== obj.status) {
      sheet.getRange(r + 1, statusCol + 1).setValue(obj.status);
    }
    result.push(obj);
  }
  return result;
}

/** Tentukan status campaign berdasarkan target & deadline (Requirement 9). */
function computeCampaignStatus(c) {
  var status = up(c.status);
  if (status === "CLOSED") return "CLOSED";
  var collected = Number(c.current_amount) || 0;
  var target = Number(c.target_amount) || 0;
  if (target > 0 && collected >= target) return "COMPLETED";
  if (c.deadline) {
    var dl = new Date(c.deadline);
    if (!isNaN(dl.getTime()) && new Date() > endOfDay(dl) && status === "ACTIVE") return "CLOSED";
  }
  return status || "ACTIVE";
}

/* ------------------------------ Notifications ---------------------------- */

function notifyAdmin(name, amount, campaignTitle) {
  try {
    var email = scriptProp("ADMIN_EMAIL");
    if (!email) return;
    MailApp.sendEmail(
      email,
      "Donasi baru menunggu verifikasi",
      "Donatur: " + name + "\nNominal: Rp" + Number(amount).toLocaleString("id-ID") +
        "\nCampaign: " + (campaignTitle || "-") + "\n\nVerifikasi di Admin Console."
    );
  } catch (err) {
    // Requirement 12.2: kegagalan notifikasi tidak menggagalkan donasi.
    console.error("Notifikasi gagal: " + err);
  }
}

/* ------------------------------- Utilities ------------------------------- */

function getSpreadsheet() {
  var id = scriptProp("SPREADSHEET_ID");
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  var sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("Sheet '" + name + "' tidak ditemukan.");
  return sheet;
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) {
    return String(h).trim();
  });
}

function readSheet(name) {
  var sheet = getSheet(name);
  if (sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var obj = rowToObject(headers, values[r]);
    if (Object.keys(obj).some(function (k) { return obj[k] !== "" && obj[k] != null; })) out.push(obj);
  }
  return out;
}

function rowToObject(headers, row) {
  var obj = {};
  headers.forEach(function (h, i) {
    if (!h) return;
    var v = row[i];
    if (v instanceof Date) v = v.toISOString();
    obj[h] = v;
  });
  return obj;
}

/** Tambah baris baru sesuai urutan header (Requirement 5.4: abaikan field asing). */
function appendByHeader(sheet, data) {
  var headers = getHeaders(sheet);
  var row = headers.map(function (h) { return data.hasOwnProperty(h) ? data[h] : ""; });
  sheet.appendRow(row);
}

function getOrCreateFolder(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function hashPassword(password, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + password, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}

/** Buat string tersimpan "salt:hash" untuk password baru. */
function makePasswordHash(password) {
  var salt = Utilities.getUuid().replace(/-/g, "");
  return salt + ":" + hashPassword(password, salt);
}

/** Set satu sel berdasarkan nama kolom header (r = indeks baris berbasis 0 dari getValues). */
function setCell(sheet, headers, r, header, value) {
  var col = headers.indexOf(header);
  if (col === -1) return;
  sheet.getRange(r + 1, col + 1).setValue(value);
}

/** Ubah judul menjadi slug URL-friendly. */
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function scriptProp(key) { return PropertiesService.getScriptProperties().getProperty(key); }
function up(s) { return String(s == null ? "" : s).toUpperCase(); }
function sanitize(s) { return String(s).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) || "donatur"; }
function endOfDay(d) { var x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function withCode(msg, code) { var e = new Error(msg); e.code = code; return e; }

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail(message, code) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message, code: code || "ERROR" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* --------------------------- One-time admin setup ------------------------ */

/**
 * Jalankan SEKALI dari editor untuk membuat/memperbarui akun admin.
 * Ubah username & password di bawah, jalankan, lalu HAPUS kembali nilainya.
 */
function setupAdmin() {
  var username = "admin";          // <-- ganti
  var password = "ubah-password-ini"; // <-- ganti

  var sheet = getSheet(SHEET.ADMIN);
  var salt = Utilities.getUuid().replace(/-/g, "");
  var stored = salt + ":" + hashPassword(password, salt);

  var headers = getHeaders(sheet);
  var userCol = headers.indexOf("username");
  var passCol = headers.indexOf("password");
  var values = sheet.getDataRange().getValues();

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][userCol]).toLowerCase() === username.toLowerCase()) {
      sheet.getRange(r + 1, passCol + 1).setValue(stored);
      Logger.log("Password admin '" + username + "' diperbarui.");
      return;
    }
  }
  var row = headers.map(function (h) {
    if (h === "username") return username;
    if (h === "password") return stored;
    return "";
  });
  sheet.appendRow(row);
  Logger.log("Admin '" + username + "' dibuat.");
}
