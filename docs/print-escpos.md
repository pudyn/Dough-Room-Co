# Panduan Print Struk ESC/POS — Web POS + Printer Thermal Bluetooth (Windows)

Konfigurasi yang sudah berjalan:
- **Printer**: RPP02N (58/80mm thermal, Bluetooth SPP klasik)
- **Koneksi**: Bluetooth → Windows Spooler → COM7
- **Print queue**: "POS-80C" (driver POS-80C, port COM7)
- **OS**: Windows 11
- **Bluetooth adapter**: RZ616 Bluetooth(R) Adapter
- **Aplikasi**: Web POS (browser) via Docker (`localhost:80`)

## 1. Gambaran Arsitektur

```
┌─────────────────┐   HTTP localhost    ┌──────────────────┐   RAW ESC/POS   ┌──────────────────┐
│  Web POS         │ ──────────────────▶ │  printer-agent    │ ──────────────▶ │  Windows Spooler  │
│  (Chrome/Edge)   │  POST /print        │  (Go, port 17123) │  datatype RAW   │  → RPP02N (BT)    │
└─────────────────┘                     └──────────────────┘                 └──────────────────┘
        │                                                                     port: COM7
        └─ fallback: dialog cetak browser (window.print, CSS 80mm) — tanpa software tambahan
```

Web app **tidak bisa** langsung mengirim byte ESC/POS ke printer Bluetooth yang di-pair sebagai
printer Windows. Ada dua jalan yang disediakan di repo ini:

| Strategi | Cara kerja | Pro | Kontra |
|---|---|---|---|
| **A. Print Agent (disarankan)** | Aplikasi Go jalan di Windows, Web POS kirim byte ESC/POS base64 via `localhost:17123`, agent kirim RAW ke spooler | Cepat (langsung print, tanpa dialog), kontrol penuh ESC/POS (cut, QR, drawer) | Perlu jalankan agent di PC kasir |
| **B. Fallback Browser** | Web POS buka struk HTML dan panggil `window.print()` dengan CSS `@page size: 80mm` | Tanpa install apa pun | Muncul dialog print tiap transaksi, tergantung driver |

Keduanya sudah diimplementasi dan otomatis: **coba agent dulu → kalau gagal, fallback browser**.

## 2. Setup Printer RPP02N via Bluetooth

### 2a. Pairing Bluetooth

1. Nyalakan printer RPP02N, pastikan LED Bluetooth berkedip (mode discoverable).
   Kalau tidak berkedip, **tahan tombol power 3–5 detik** sampai LED mulai kedip.
2. Windows → **Settings → Bluetooth & devices → Add device → Bluetooth**.
3. Pilih **RPP02N** dari daftar (akan muncul sebagai "RPP02N" atau nama serupa).
4. Setelah paired, Windows otomatis membuat **Bluetooth Serial Port (COM port)**.

### 2b. Cek COM Port yang Terbentuk

Jalankan di PowerShell:

```powershell
# Cari COM port milik RPP02N
Get-PnpDevice | Where-Object {
    $_.InstanceId -like "*86677A028577*"  # BT address RPP02N
} | Select-Object Status, Class, FriendlyName
```

Contoh output:

```
Status Class     FriendlyName
------ -----     ------------
OK     Ports     Standard Serial over Bluetooth link (COM7)   ← ini yang dipakai
OK     Bluetooth RPP02N
```

> **Penting**: COM port bisa berubah kalau printer di-unpair lalu pair ulang.
> Selalu cek ulang setelah re-pairing.

### 2c. Buat Print Queue Windows

```powershell
# Tambah printer dengan driver POS-80C pada COM port yang benar
Add-Printer -Name "POS-80C" -DriverName "POS-80C" -PortName "COM7:"
```

Kalau driver POS-80C tidak ada, pakai **Generic / Text Only**:

```powershell
Add-Printer -Name "POS-80C" -DriverName "Generic / Text Only" -PortName "COM7:"
```

Verifikasi:

```powershell
Get-Printer -Name "POS-80C" | Select-Object Name, DriverName, PortName, PrinterStatus
# Harus: Name=POS-80C, PortName=COM7:, PrinterStatus=Normal
```

### 2d. Troubleshooting Pairing

| Masalah | Solusi |
|---|---|
| Printer tidak muncul saat scan BT | Reset printer: matikan, tahan tombol FEED sambil nyalakan. Pastikan jarak < 3 meter |
| Paired tapi tidak ada COM port baru | Restart Bluetooth: `Restart-Service bthserv -Force` (PowerShell Admin) |
| COM port ada tapi print tidak keluar | COM port salah — cek BT address printer dan cocokkan dengan `Get-PnpDevice` |
| Print queue status "Error, PendingDeletion" | Hapus (`Remove-Printer -Name "POS-80C"`) lalu buat ulang di COM port yang benar |
| Kertas keluar tapi kosong / tidak terbaca | Kertas terbalik — sisi cetak (garuk pakai kuku: sisi yang menghitam) harus menghadap print head (ke bawah) |

### 2e. Ganti COM Port Tanpa Hapus Printer

Kalau COM port berubah setelah re-pairing:

```powershell
# Cek COM port baru
Get-PnpDevice -Class Ports | Where-Object { $_.FriendlyName -like "*Bluetooth*" }

# Update printer ke port baru (misal pindah ke COM8)
Set-Printer -Name "POS-80C" -PortName "COM8:"

# Restart printer agent setelah ganti port
Stop-Process -Name "printer-agent" -Force -ErrorAction SilentlyContinue
Start-Process .\printer-agent.exe
```

## 3. Build & Jalankan Print Agent

Agent ada di `printer-agent/` (Go, fungsi cetak khusus Windows).

```powershell
# Build (butuh Go 1.22+)
cd printer-agent
build.bat          # hasilnya printer-agent.exe

# Jalankan
.\printer-agent.exe
```

- Agent listen di `http://127.0.0.1:17123` — **hanya localhost**, tidak terekspos LAN.
- Cek hidup: `http://127.0.0.1:17123/status` → daftar printer + printer default.

### Auto-start saat Windows boot

Taruh shortcut `printer-agent.exe` di folder startup:

```powershell
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\printer-agent.lnk")
$shortcut.TargetPath = "C:\Users\itops\Documents\work\DR\pos-application\printer-agent\printer-agent.exe"
$shortcut.WorkingDirectory = "C:\Users\itops\Documents\work\DR\pos-application\printer-agent"
$shortcut.WindowStyle = 7  # minimized
$shortcut.Save()
```

### Test manual cetak

```powershell
# Test sederhana
$b64 = [Convert]::ToBase64String([byte[]]@(
    0x1B, 0x40,                                                          # init
    0x1B, 0x61, 0x01, 0x1B, 0x45, 0x01, 0x1D, 0x21, 0x11               # center+bold+double
) + [Text.Encoding]::ASCII.GetBytes("TEST PRINT`n") + [byte[]]@(
    0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00                                  # normal
) + [Text.Encoding]::ASCII.GetBytes("RPP02N via COM7`n") + [byte[]]@(
    0x1B, 0x64, 0x04, 0x1D, 0x56, 0x42, 0x00                           # feed+cut
))

Invoke-RestMethod -Method Post -Uri http://127.0.0.1:17123/print `
    -ContentType "application/json" `
    -Body (@{data=$b64; printer="POS-80C"} | ConvertTo-Json)
```

## 4. API Agent

| Endpoint | Body | Respons |
|---|---|---|
| `GET /status` | — | `{"ok": true, "printer": "POS-80C", "printers": [...]}` |
| `POST /print` | `{"data": "<base64 ESC/POS>", "printer": "<opsional>"}` | `{"ok": true, "printer": "POS-80C", "bytes": 737}` |

- Kalau field `printer` tidak diisi, agent pakai printer default Windows.
- Response `ok: true` artinya data berhasil masuk ke spooler (bukan jaminan kertas keluar —
  cek koneksi BT kalau data terkirim tapi tidak tercetak).

## 5. Print dari HP (kasir memakai ponsel)

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

> **Catatan mixed-content**: Kalau POS diakses via HTTPS, browser akan blokir fetch ke
> `http://IP-PC:17123`. Solusi: akses POS via HTTP di jaringan lokal, atau pasang
> reverse proxy TLS di depan agent.

**Opsi B — Web Bluetooth langsung dari HP (Chrome Android, printer BLE):**

RPP02N menggunakan Bluetooth **SPP klasik** (bukan BLE), jadi **Web Bluetooth tidak bisa
dipakai** untuk printer ini. Opsi ini hanya berlaku untuk printer yang mendukung BLE.

**Opsi C — Dialog print HP:** struk 80mm dibuka di dialog cetak Android;
pilih printer via Default Print Service / app vendor.

## 6. Integrasi di Web POS (sudah terpasang)

- `frontend/lib/escpos.ts` — builder ESC/POS: init, align, bold, double-size, kolom kiri-kanan,
  QR code, feed, partial cut, open cash drawer, dan template **struk kasir** +
  **tiket dapur** (`buildReceiptBytes`, `buildKitchenTicketBytes`).
- `frontend/lib/printer.ts` — `printReceipt(data)`: kirim ke agent → fallback Web Bluetooth
  → fallback `window.print()` (CSS `@page size: 80mm auto`).
- `frontend/app/pos/page.tsx` — setelah checkout sukses, struk otomatis dicetak.
  **Nama toko dan alamat diambil dari API store settings** (`/api/v1/public/store`),
  bisa diubah di halaman admin Settings tanpa edit kode.

URL agent bisa dioverride per mesin:

```js
localStorage.setItem("printer_agent_url", "http://127.0.0.1:17123");
```

## 7. Cheat Sheet ESC/POS

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
— konstanta `WIDTH` di `escpos.ts`. RPP02N mode 58mm pakai **32 karakter**.

## 8. Troubleshooting

| Gejala | Solusi |
|---|---|
| "dialog print muncul terus" | Agent tidak jalan — cek `http://127.0.0.1:17123/status` |
| `/status` hidup tapi print gagal | Nama printer salah (case-sensitive) — pakai nama dari daftar `printers[]` di `/status` |
| Agent return `ok: true` tapi kertas tidak keluar | COM port salah — cek `Get-PnpDevice -Class Ports` dan cocokkan dengan BT address RPP02N, lalu `Set-Printer -Name "POS-80C" -PortName "COMx:"` |
| Print queue status "Error, PendingDeletion" | `Remove-Printer -Name "POS-80C"` lalu buat ulang: `Add-Printer -Name "POS-80C" -DriverName "POS-80C" -PortName "COM7:"` |
| Struk kosong / karakter aneh | Driver bukan RAW — pastikan driver **POS-80C** atau **Generic / Text Only** yang mendukung ESC/POS passthrough |
| Kertas keluar tapi tidak terbaca | Kertas terbalik — sisi cetak (garuk dengan kuku, sisi yang menghitam) harus menghadap ke bawah (ke arah print head) |
| Koneksi BT putus-putus | Matikan power saving BT; jauhkan dari Wi-Fi 2.4GHz; restart spooler: `net stop spooler; net start spooler` |
| Barcode/QR tidak muncul | Sebagian printer clone tidak support `GS ( k` — ganti QR jadi teks atau pakai `ESC *` bitmap |
| Kertas 58mm dipakai di printer 80mm | Set `WIDTH` sesuai (32 karakter untuk 58mm) dan cek lebar kertas fisik |

## 9. Catatan Keamanan

- Agent default bind `127.0.0.1` — tidak bisa dipanggil dari jaringan. Kalau mode
  HP (`PRINTER_AGENT_BIND=0.0.0.0:17123`) diaktifkan, siapa pun di LAN yang sama
  bisa mencetak ke printer tersebut — pertimbangkan firewall berbasis IP.
- CORS dibuka `*` karena agent hanya terjangkau dari browser lokal yang sama.
- Tidak ada data sensitif dalam request: hanya byte struk hasil render frontend.

## 10. Referensi Setup Aktif

| Item | Nilai |
|---|---|
| Printer fisik | RPP02N |
| Bluetooth address | `86:66:7A:02:85:77` |
| COM port | COM7 |
| Print queue name | POS-80C |
| Driver | POS-80C |
| Agent URL | `http://127.0.0.1:17123` |
| Agent binary | `printer-agent/printer-agent.exe` |
| Frontend | Docker `localhost:80` → halaman `/pos` |
| Store settings | Dinamis dari API `/api/v1/public/store` (ubah di admin Settings) |
