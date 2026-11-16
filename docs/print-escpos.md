# Panduan Print Struk ESC/POS — Web POS + Printer Bluetooth 80mm (Windows)

Konfigurasi target: **MP-80mm**, koneksi **Bluetooth**, perangkat **Windows**, aplikasi **Web POS** (browser).

## 1. Gambaran Arsitektur

```
┌─────────────────┐   HTTP localhost    ┌──────────────────┐   RAW ESC/POS   ┌──────────────────┐
│  Web POS         │ ──────────────────▶ │  printer-agent    │ ──────────────▶ │  Windows Spooler  │
│  (Chrome/Edge)   │  POST /print        │  (Go, port 17123) │  datatype RAW   │  → Printer BT     │
└─────────────────┘                     └──────────────────┘                 └──────────────────┘
        │
        └─ fallback: dialog cetak browser (window.print, CSS 80mm) — tanpa software tambahan
```

Web app **tidak bisa** langsung mengirim byte ESC/POS ke printer Bluetooth yang di-pair sebagai
printer Windows. Ada dua jalan yang disediakan di repo ini:

| Strategi | Cara kerja | Pro | Kontra |
|---|---|---|---|
| **A. Print Agent (disarankan)** | Aplikasi kecil Go jalan di Windows, Web POS kirim byte ESC/POS base64 via `localhost:17123`, agent kirim RAW ke spooler | Cepat (langsung print, tanpa dialog), kontrol penuh ESC/POS (cut, QR, drawer), autoreconnect spooler | Perlu install agent sekali di tiap PC kasir |
| **B. Fallback Browser** | Web POS buka struk HTML dan panggil `window.print()` dengan CSS `@page size: 80mm` | Tanpa install apa pun | Muncul dialog print tiap transaksi, tergantung driver |

Keduanya sudah diimplementasi dan otomatis: **coba agent dulu → kalau gagal, fallback browser**.

## 2. Pairing Printer Bluetooth di Windows

1. Nyalakan printer MP-80, aktifkan mode Bluetooth.
2. Windows → **Settings → Bluetooth & devices → Add device → Bluetooth** → pilih printer
   (nama biasanya seperti `MP-80`, `POS-80`, atau serial BT).
3. Setelah terpair, Windows akan membuat printer. Kalau driver spesifik tidak ada:
   - **Devices and Printers → Add Printer → "The printer that I want isn't listed" → Add a local printer** (port virtual Bluetooth SPP, mis. `COMx` atau `BTxxx`) → driver: **Generic / Text Only**.
4. Klik kanan printer → **Printer properties → Print Test Page** untuk memastikan koneksi hidup.
5. **Set sebagai default printer** kalau mau agent pakai otomatis (atau kirim nama printer
   eksplisit di request `/print`).

> Catatan: sebagian printer BT lama memakai Bluetooth **klasik (SPP/COM)** — tidak bisa diakses
> langsung dari browser. Karena itu jalur agent (via spooler) adalah yang paling andal.
> Web Bluetooth hanya bekerja untuk printer **BLE** dan tidak dipakai di implementasi ini.

## 3. Build & Jalankan Print Agent

Agent ada di `printer-agent/` (Go, hanya Windows untuk fungsi cetak).

```powershell
# Di PC Windows (butuh Go 1.22+, atau build cross-platform dari WSL/CI)
cd printer-agent
build.bat          # hasilnya printer-agent.exe

# Jalankan (boleh otomatis start: taruh shortcut di folder shell:startup)
.\printer-agent.exe
```

- Agent listen di `http://127.0.0.1:17123` — **hanya localhost**, tidak terekspos LAN.
- Cek hidup: buka `http://127.0.0.1:17123/status` → daftar printer + printer default.
- Test manual cetak:
  ```powershell
  $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("HELLO`n`n`n`n"))
  Invoke-RestMethod -Method Post -Uri http://127.0.0.1:17123/print `
    -ContentType "application/json" `
    -Body (@{data=$b64; printer="MP-80"} | ConvertTo-Json)
  ```
  (ganti `printer="MP-80"` dengan nama persis printer di Windows, atau hapus field itu
  untuk memakai printer default.)

## 4. API Agent

| Endpoint | Body | Respons |
|---|---|---|
| `GET /status` | — | `{ok, printer, printers[]}` |
| `POST /print` | `{"data": "<base64>", "printer": "<opsional>"}` | `{ok, printer, bytes}` |

## 4a. Print dari HP (kasir memakai ponsel)

Urutan strategi cetak di frontend: **agent → Web Bluetooth → dialog browser**.

**Opsi A — Agent di PC kasir, HP akses via WiFi (paling andal):**

1. Di PC kasir, jalankan agent dengan bind LAN:
   ```powershell
   $env:PRINTER_AGENT_BIND="0.0.0.0:17123"; .\printer-agent.exe
   ```
2. Izinkan port 17123 di Windows Firewall (inbound rule untuk printer-agent.exe).
3. Cari IP PC (mis. `192.168.1.10`), lalu di HP (browser POS) set sekali:
   ```js
   localStorage.setItem("printer_agent_url", "http://192.168.1.10:17123");
   ```
4. Printer BT tetap ter-pair ke PC; semua cetakan HP lewat PC.

> Catatan: POS di HP mengakses Web POS yang di-host; `fetch` ke `http://IP-PC` butuh
> konteks aman/allowlist mixed-content kalau situs HTTPS. Aman jika POS diakses
> via HTTP di jaringan lokal, atau jalankan agent via `localhost` perangkat
> (opsi B). Atau tambahkan Host yang di-allow di browser HP
> (chrome://flags tidak perlu untuk fetch http dari halaman https — gunakan HTTPS
> di agent bila perlu: taruh reverse proxy TLS lokal).

**Opsi B — Web Bluetooth langsung dari HP (Chrome Android, printer BLE):**

1. Printer MP-80 harus memakai **Bluetooth Low Energy** (bukan SPP klasik).
   Umumnya muncul di Chrome saat `requestDevice` dengan service `0000ff00`,
   `000018f0`, UART Microchip `49535343...`, atau Nordic `6e400001...`
   — keempatnya sudah di-filter otomatis di `printer.ts`.
2. Saat cetak pertama, Chrome meminta izin pilih perangkat → pilih printer.
   Pilihan berikutnya otomatis (daftar `getDevices()`).
3. Batas: hanya Chrome/Edge berbasis Chromium; iOS Safari tidak mendukung
   Web Bluetooth; iOS memakai Web Bluetooth shim pihak ketiga (tidak disertakan).

**Opsi C — Dialog print HP:** struk 80mm dibuka di dialog cetak Android;
pilih printer via **Default Print Service**/app vendor. Koneksi BT printer ke HP
harus didukung oleh app printer tersebut (di luar kendali web app).

## 5. Integrasi di Web POS (sudah terpasang)

- `frontend/lib/escpos.ts` — builder ESC/POS: init, align, bold, double-size, kolom kiri-kanan,
  QR code, feed, partial cut, open cash drawer, dan template **struk kasir** +
  **tiket dapur** (`buildReceiptBytes`, `buildKitchenTicketBytes`).
- `frontend/lib/printer.ts` — `printReceipt(data)`: kirim ke agent → fallback
  `window.print()` (CSS `@page size: 80mm auto`).
- `frontend/app/pos/page.tsx` — setelah checkout sukses, struk otomatis dicetak
  (toast konfirmasi; kalau fallback browser, dialog print terbuka).

URL agent bisa dioverride per mesin (misal agent jalan di port lain):

```js
localStorage.setItem("printer_agent_url", "http://127.0.0.1:17123");
```

## 6. Cheat Sheet ESC/POS (80mm)

| Fungsi | Byte | Keterangan |
|---|---|---|
| Init | `1B 40` | Reset semua mode |
| Align | `1B 61 n` | n: 0 kiri, 1 tengah, 2 kanan |
| Bold | `1B 45 n` | n: 0/1 |
| Ukuran | `1D 21 n` | `00` normal, `11` 2× tinggi & lebar |
| Feed | `1B 64 n` | maju n baris |
| Cut (partial) | `1D 56 42 00` | potong kertas |
| Cash drawer | `1B 70 00 19 FA` | buka laci kasir (jika terhubung RJ11) |
| QR | `1D 28 6B ...` | simpan lalu cetak (lihat `EscPosBuilder.qr`) |

Lebar karakter: printer 80mm umumnya **48 karakter** per baris (font A 12×24, head 576 dot)
— konstanta `WIDTH` di `escpos.ts`. Kalau struk melipat/ketergantungan model, sesuaikan 42–48.

## 7. Troubleshooting

| Gejala | Solusi |
|---|---|
| "dialog print muncul terus" | Agent tidak jalan / belum build — cek `http://127.0.0.1:17123/status` |
| `/status` hidup tapi print gagal | Nama printer salah (kasus sensitif) — pakai nama dari daftar `printers[]` |
| Struk kosong / karakter aneh | Driver bukan RAW — pastikan driver **Generic / Text Only** atau driver vendor yang mendukung ESC/POS |
| Koneksi BT putus-putus | Matikan power saving BT pada printer; jauhkan dari Wi-Fi 2.4GHz; restart spooler: `net stop spooler && net start spooler` |
| Barcode/QR tidak muncul | Sebagian clone tidak support `GS ( k` — ganti QR jadi teks atau pakai `ESC *` bitmap |
| Kertas 58mm dipakai di printer 80mm | Set `WIDTH` sesuai (32 karakter) dan cek lebar kertas fisik |

## 8. Catatan Keamanan

- Agent default bind `127.0.0.1` — tidak bisa dipanggil dari jaringan. Kalau mode
  HP (`PRINTER_AGENT_BIND=0.0.0.0:17123`) diaktifkan, siapa pun di LAN yang sama
  bisa mencetak ke printer tersebut — pertimbangkan firewall berbasis IP.
- CORS dibuka `*` karena agent hanya terjangkau dari browser lokal yang sama.
- Tidak ada data sensitif dalam request: hanya byte struk hasil render frontend.
