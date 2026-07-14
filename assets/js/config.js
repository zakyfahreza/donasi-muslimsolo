/**
 * Konfigurasi global website donasi MuslimSolo.
 *
 * PENTING:
 * - Ganti API_URL dengan URL Web App Google Apps Script kamu
 *   (Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone).
 * - WRITE_TOKEN harus sama persis dengan nilai WRITE_TOKEN di Apps Script
 *   (Project Settings > Script Properties).
 *
 * Catatan keamanan: karena ini situs statis, WRITE_TOKEN tetap bisa dilihat
 * orang dari kode sumber. Token ini hanya penghalang dasar terhadap spam.
 * Proteksi utama tetap ada di sisi server: rate limiting, validasi payload,
 * dan Session_Token untuk aksi admin.
 */
window.APP_CONFIG = {
  // Contoh: "https://script.google.com/macros/s/AKfycbx....../exec"
  API_URL: "https://script.google.com/macros/s/AKfycbx2YDrU2dTKkGSfsZf4CEg3A6i3iDvXf3ojJ7gmdsIMBpDqIA3TTyQ6DuBV_Uni1wTq/exec",

  // Harus cocok dengan Script Property "WRITE_TOKEN" di Apps Script.
  WRITE_TOKEN: "ms_9f3K2x8pQ7zL",

  // Identitas tampilan
  ORG_NAME: "MuslimSolo.id",
  LOGO_TEXT: "MuslimSolo",

  // Batas upload bukti (harus konsisten dengan validasi server).
  MAX_PROOF_SIZE_MB: 5,
  ALLOWED_PROOF_TYPES: ["image/jpeg", "image/png"],

  // Batas upload gambar banner program (konsisten dengan validasi server).
  MAX_BANNER_SIZE_MB: 5,
  ALLOWED_BANNER_TYPES: ["image/jpeg", "image/png", "image/webp"],
};
