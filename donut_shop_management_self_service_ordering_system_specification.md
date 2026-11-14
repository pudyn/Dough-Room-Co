# DONUT SHOP MANAGEMENT & SELF-SERVICE ORDERING SYSTEM

- **Dokumen:** Product Requirement Document, Technical Specification, Database Design, API Specification & Development Plan
- **Versi:** 1.0
- **Status:** Proposed — Development Baseline
- **Tanggal:** 14 November 2026

---

## 1. EXECUTIVE SUMMARY

### 1.1 Project Overview
**Donut Shop Management & Self-Service Ordering System** merupakan aplikasi terintegrasi untuk mengelola operasional toko donat rumahan yang menggunakan model penjualan:

- **Ready Stock:** Produk tersedia dan dapat dibeli langsung.
- **Pre-Order (PO):** Customer memesan produk sebelum jadwal produksi.
- **QR Self-Service:** Customer melakukan pemesanan sendiri melalui QR Code.
- **POS:** Transaksi yang dilakukan oleh admin atau kasir.

Sistem memiliki satu backend terpusat dengan beberapa antarmuka:
- Admin Dashboard
- Point of Sale (POS)
- Customer Ordering Website
- Kitchen / Order Management Display

Semua transaksi masuk ke sistem yang sama sehingga stok, pembayaran, pesanan, dan laporan dapat dikelola secara terintegrasi.

### 1.2 Business Objectives
Tujuan pembangunan:
- Digitalisasi transaksi penjualan.
- Mempermudah customer melakukan pemesanan.
- Mengurangi pencatatan pesanan secara manual.
- Mengelola pesanan PO dan ready stock.
- Mempermudah perencanaan produksi.
- Memantau omzet dan keuntungan.
- Mengelola stok produk dan bahan baku.
- Menyediakan laporan operasional.

### 1.3 Target Users

| Role | Tanggung Jawab |
| :--- | :--- |
| **Owner** | Mengelola keseluruhan bisnis |
| **Admin** | Mengelola produk, pesanan, dan operasional |
| **Cashier** | Melayani transaksi POS |
| **Kitchen Staff** | Menyiapkan dan memperbarui status pesanan |
| **Customer** | Melakukan pemesanan dan pembayaran |

---

## 2. PRODUCT REQUIREMENT DOCUMENT (PRD)

### 2.1 Product Scope
Sistem dibagi menjadi enam modul utama.

#### A. Dashboard
**Fitur:**
- Total penjualan hari ini.
- Total transaksi.
- Total omzet.
- Total pesanan PO.
- Pesanan menunggu pembayaran.
- Pesanan sedang diproses.
- Pesanan siap diambil.
- Produk terlaris.
- Grafik penjualan.
- Ringkasan stok.
- Dashboard harus menyediakan filter tanggal.

#### B. Product Management
**Admin dapat:**
- Menambahkan produk.
- Mengubah produk.
- Menghapus atau menonaktifkan produk.
- Mengunggah foto produk.
- Mengatur kategori.
- Mengatur harga.
- Mengatur stok.
- Mengatur status tersedia atau habis.
- Membuat paket bundling.

**Contoh kategori:**
- Donat Reguler
- Donat Premium
- Mini Donut
- Paket Hampers
- Minuman

**Setiap produk memiliki:**
- SKU
- Nama produk
- Deskripsi
- Foto
- Kategori
- Harga jual
- Harga modal
- Status aktif
- Mode penjualan
- Pengaturan stok

**Mode penjualan produk:**
- `Ready Stock`
- `Pre-Order`
- `Both`

#### C. POS (Point of Sale)
POS digunakan untuk transaksi langsung.

**Fitur:**
- Pencarian produk.
- Pemilihan produk.
- Pengaturan kuantitas.
- Keranjang belanja.
- Diskon.
- Perhitungan subtotal.
- Perhitungan total.
- Pemilihan metode pembayaran.
- Penyelesaian transaksi.
- Cetak atau kirim struk.
- Riwayat transaksi.
- Pembatalan dengan otorisasi.

**Metode pembayaran:**
- Cash
- QRIS
- Bank Transfer
- Pay at Counter

*Catatan: POS harus mendukung transaksi tanpa customer terdaftar.*

#### D. Customer Self-Service Ordering
Customer tidak perlu menginstal aplikasi. Customer membuka website menggunakan browser HP setelah memindai QR Code.

**Fitur:**
- Melihat katalog.
- Melihat foto dan harga.
- Melihat ketersediaan produk.
- Memilih produk.
- Menentukan kuantitas.
- Menambahkan ke keranjang.
- Checkout.
- Memilih jenis pesanan.
- Memilih jadwal pengambilan.
- Mengisi identitas.
- Memilih metode pembayaran.
- Melihat status pesanan.
- Mendapatkan nomor pesanan.

**Jenis pemesanan:**
- **Order Now** — Pembelian produk ready stock.
- **Pre-Order** — Pemesanan untuk tanggal produksi/pengambilan berikutnya.

**Customer ordering mendukung dua jalur:**
1. **QR toko:** Customer datang ke toko, scan QR, melakukan pemesanan dan mengambil pesanan di toko.
2. **QR katalog / kemasan:** Customer scan QR dari katalog atau kemasan untuk membuka halaman pemesanan online.

> **Catatan:** QR pemesanan adalah QR menuju halaman toko. QR pembayaran QRIS merupakan QR berbeda yang dibuat saat proses checkout melalui payment gateway.

#### E. Pre-Order Management
Admin dapat membuka periode PO.

**Contoh Parameter:**

| Parameter | Nilai |
| :--- | :--- |
| **Nama** | PO Donat Minggu 1 |
| **Mulai** | Senin |
| **Tutup** | Rabu |
| **Produksi** | Kamis |
| **Pengambilan** | Jumat |
| **Status** | Open |

**Fitur:**
- Membuka periode PO.
- Menutup periode PO.
- Mengatur jadwal produksi.
- Mengatur jadwal pengambilan.
- Mengatur batas pesanan.
- Mengatur kuota produk.
- Melihat daftar pesanan.
- Melihat total kebutuhan produk.
- Rekap kebutuhan produksi.
- Mengubah status pesanan.

**Ketentuan:**
- PO tidak dapat dipesan setelah waktu penutupan.
- Kuota tidak boleh terlampaui.
- Pesanan yang belum dibayar mengikuti kebijakan pembayaran yang ditentukan admin.
- Pesanan yang sudah dibayar masuk ke rekap produksi.
- Pembatalan harus tercatat.

#### F. Kitchen / Production Management
Kitchen Display digunakan untuk memantau pesanan yang harus disiapkan.

**Status:**
- `New`
- `Confirmed`
- `Preparing`
- `Ready`
- `Completed`

**Fitur:**
- Daftar pesanan baru.
- Daftar pesanan aktif.
- Detail item pesanan.
- Update status produksi.
- Update status pengambilan.
- Filter tanggal.
- Rekap kebutuhan produksi.

---

## 3. BUSINESS PROCESS

### 3.1 Ready Stock Flow
1. Admin membuat produk.
2. Admin memasukkan stok.
3. Customer melakukan pemesanan atau datang langsung.
4. Sistem memeriksa ketersediaan stok.
5. Customer memilih produk.
6. Customer melakukan checkout.
7. Customer memilih pembayaran.
8. Sistem memproses pembayaran.
9. Pesanan dikonfirmasi.
10. Stok dikurangi atau direservasi sesuai kebijakan.
11. Pesanan disiapkan.
12. Customer mengambil pesanan.
13. Transaksi selesai.

### 3.2 Pre-Order Flow
1. Admin membuat periode PO.
2. Admin menetapkan tanggal penutupan.
3. Admin menetapkan jadwal produksi dan pengambilan.
4. Customer memilih produk PO.
5. Customer mengisi data pemesanan.
6. Sistem memeriksa kuota.
7. Customer melakukan pembayaran.
8. Pesanan masuk ke rekap produksi setelah dikonfirmasi.
9. Admin melakukan produksi.
10. Pesanan ditandai `Ready`.
11. Customer mengambil pesanan.
12. Pesanan `Completed`.

### 3.3 POS Flow
1. Kasir membuka POS.
2. Memilih produk.
3. Memasukkan kuantitas.
4. Sistem menghitung total.
5. Kasir memilih metode pembayaran.
6. Pembayaran dicatat.
7. Sistem membuat transaksi.
8. Sistem memperbarui stok.
9. Struk dibuat.
10. Transaksi selesai.

### 3.4 QR Self-Service Flow
1. Customer memindai QR Code.
2. Customer membuka halaman toko.
3. Customer memilih mode Ready Stock atau PO.
4. Customer memilih produk.
5. Customer menambahkan produk ke keranjang.
6. Customer checkout.
7. Customer memasukkan nama dan nomor WhatsApp.
8. Customer menentukan jadwal pengambilan.
9. Customer memilih pembayaran.
10. Sistem membuat pesanan.
11. Sistem menampilkan instruksi pembayaran.
12. Sistem memperbarui status pembayaran.
13. Admin menerima pesanan.
14. Kitchen menyiapkan pesanan.
15. Customer mengambil pesanan.

---

## 4. PAYMENT REQUIREMENT

Sistem menggunakan payment abstraction agar tidak bergantung pada satu payment gateway.

### 4.1 Supported Payment Methods

| Metode | Penggunaan |
| :--- | :--- |
| **Cash** | POS dan pembayaran di toko |
| **QRIS Gateway** | Online dan POS |
| **Manual Transfer** | Online dan POS |
| **Pay at Counter** | Customer QR ordering |

### 4.2 QRIS Payment
**Alur:**
1. Customer checkout.
2. Backend membuat order.
3. Backend meminta QRIS dinamis ke payment gateway.
4. Gateway mengembalikan QR pembayaran.
5. Customer melakukan pembayaran.
6. Gateway mengirim webhook.
7. Backend memvalidasi webhook.
8. Payment ditandai `Paid`.
9. Order dikonfirmasi.

**Ketentuan:**
- QRIS dibuat per transaksi.
- QRIS mempunyai expiration time.
- Webhook harus diverifikasi.
- Nominal harus cocok dengan tagihan.
- Callback harus idempotent.
- Status pembayaran tidak boleh berubah dari `Paid` menjadi `Pending`.
- Jangan mengandalkan redirect browser sebagai bukti pembayaran.

### 4.3 Manual Transfer
**Customer:**
- Mendapatkan informasi rekening.
- Melakukan transfer.
- Mengunggah bukti transfer.

**Admin:**
- Memeriksa bukti.
- Memverifikasi nominal.
- Menyetujui atau menolak pembayaran.

**Status:**
- `Pending Verification`
- `Verified`
- `Rejected`

### 4.4 Cash
- Cash dapat dilakukan melalui POS atau saat customer mengambil pesanan.
- Pembayaran cash harus dicatat oleh kasir/admin.

### 4.5 Payment Configuration & Bank Account Baseline
Konfigurasi awal pembayaran dan rekening tujuan transfer toko:

| Parameter | Nilai |
| :--- | :--- |
| **Bank** | BCA |
| **Nomor Rekening** | `5255422011` |
| **Nama Pemilik Rekening** | Ahmad Pardan Mahpudin |
| **WhatsApp Toko** | `6281240521795` |
| **Batas Pembayaran** | 60 menit |
| **Metode Aktif Awal** | Manual Transfer BCA |
| **QRIS Midtrans** | Belum aktif (`disabled`) |

> **Catatan Operasional:** Data rekening sebaiknya disimpan dalam tabel `payment_bank_accounts` di database agar dapat dikelola secara dinamis melalui Admin Dashboard, bukan di-*hardcode* di dalam *source code*.

**Contoh Konfigurasi Environment (`config.yaml` / `.env`):**
```yaml
payment:
  default_method: BANK_TRANSFER
  expiry_minutes: 60
  bank_transfer:
    enabled: true
    bank_name: BCA
    account_number: "5255422011"
    account_holder: "Ahmad Pardan Mahpudin"
  whatsapp:
    enabled: true
    phone: "6281240521795"
  midtrans:
    enabled: false
    payment_method: QRIS
```

---

## 5. TECHNICAL SPECIFICATION

### 5.1 Architecture Decision
**Arsitektur:** Modular Monolith.

**Alasan:**
- Cocok untuk bisnis single outlet.
- Deployment sederhana.
- Biaya infrastruktur rendah.
- Konsistensi transaksi database lebih mudah.
- Domain tetap terpisah.
- Bisa dikembangkan menjadi service terpisah jika skala bisnis meningkat.

### 5.2 Technology Stack

| Layer | Teknologi |
| :--- | :--- |
| **Frontend** | Next.js |
| **Language** | TypeScript |
| **UI** | Tailwind CSS |
| **Backend** | Golang |
| **HTTP Framework** | Fiber |
| **Database** | PostgreSQL |
| **Database Access** | sqlc atau GORM |
| **Authentication** | JWT + Refresh Token |
| **Realtime** | Server-Sent Events (SSE) |
| **QR Generation** | QR Code Library |
| **Image Storage** | S3-compatible storage |
| **Deployment** | Docker |
| **Reverse Proxy** | Nginx / Traefik |
| **API Documentation** | OpenAPI |
| **Testing** | Go Test + Playwright |

### 5.3 Application Modules

**Backend Structure:**
```text
backend/
├── cmd/
│   └── api/
├── internal/
│   ├── auth/
│   ├── users/
│   ├── products/
│   ├── categories/
│   ├── customers/
│   ├── inventory/
│   ├── orders/
│   ├── preorder/
│   ├── payments/
│   ├── pos/
│   ├── production/
│   ├── qr/
│   ├── reports/
│   ├── notifications/
│   ├── audit/
│   └── shared/
├── migrations/
├── pkg/
├── configs/
└── tests/
```

**Frontend Structure:**
```text
frontend/
├── app/
│   ├── admin/
│   ├── pos/
│   ├── kitchen/
│   ├── menu/
│   ├── checkout/
│   ├── order/
│   └── api/
├── components/
├── features/
│   ├── dashboard/
│   ├── products/
│   ├── orders/
│   ├── preorder/
│   ├── payments/
│   └── inventory/
├── lib/
├── hooks/
└── types/
```

### 5.4 Backend Design Principles
- Handler tidak boleh berisi business logic.
- Setiap domain memiliki service sendiri.
- Database access dipisahkan menggunakan repository/query layer.
- Semua nominal menggunakan integer dalam satuan rupiah.
- Semua waktu disimpan dalam `UTC` dan ditampilkan menggunakan `Asia/Jakarta`.
- Semua operasi pembayaran menggunakan idempotency.
- Semua perubahan status penting masuk audit log.
- Semua operasi stok menggunakan database transaction.
- Order dan payment memiliki lifecycle terpisah.
- API memiliki versioning `/api/v1`.

### 5.5 Authentication & Authorization
**Role:**
- Owner
- Admin
- Cashier
- Kitchen

*Catatan: Customer ordering tidak membutuhkan akun. Customer menggunakan nomor order dan token akses acak untuk melihat pesanan.*

**Permission Matrix:**

| Modul | Owner | Admin | Cashier | Kitchen |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard** | Yes | Yes | Limited | No |
| **Products** | Yes | Yes | Read | No |
| **Orders** | Yes | Yes | Yes | Read |
| **Payments** | Yes | Yes | Yes | No |
| **Inventory** | Yes | Yes | Limited | No |
| **Production** | Yes | Yes | No | Yes |
| **Reports** | Yes | Yes | Limited | No |
| **User Management** | Yes | Limited | No | No |

---

## 6. DATABASE DESIGN

Database menggunakan **PostgreSQL**.

### 6.1 Database Domains

#### Users
**`users`**
- `id` UUID PK
- `name` VARCHAR
- `email` VARCHAR UNIQUE
- `password_hash` TEXT
- `is_active` BOOLEAN
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**`roles`**
- `id` UUID PK
- `name` VARCHAR UNIQUE

**`user_roles`**
- `user_id` UUID FK
- `role_id` UUID FK

#### Product
**`categories`**
- `id` UUID PK
- `name` VARCHAR
- `description` TEXT
- `is_active` BOOLEAN

**`products`**
- `id` UUID PK
- `category_id` UUID FK
- `sku` VARCHAR UNIQUE
- `name` VARCHAR
- `description` TEXT
- `image_url` TEXT
- `selling_price` BIGINT
- `cost_price` BIGINT
- `stock_tracking` BOOLEAN
- `stock_quantity` INTEGER
- `low_stock_threshold` INTEGER
- `is_active` BOOLEAN
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**`product_sales_modes`**
- `product_id` UUID FK
- `mode` VARCHAR *(Nilai: `READY_STOCK`, `PREORDER`)*

#### Customer
**`customers`**
- `id` UUID PK
- `name` VARCHAR
- `phone` VARCHAR
- `email` VARCHAR NULL
- `created_at` TIMESTAMPTZ

#### Orders
**`orders`**
- `id` UUID PK
- `order_number` VARCHAR UNIQUE
- `customer_id` UUID FK NULL
- `source` VARCHAR *(Nilai: `POS`, `QR_STORE`, `QR_CATALOG`, `ADMIN`)*
- `order_type` VARCHAR *(Nilai: `READY_STOCK`, `PREORDER`)*
- `preorder_period_id` UUID FK NULL
- `customer_name` VARCHAR
- `customer_phone` VARCHAR
- `pickup_date` DATE
- `pickup_time` TIME NULL
- `subtotal` BIGINT
- `discount_amount` BIGINT
- `total_amount` BIGINT
- `order_status` VARCHAR
- `payment_status` VARCHAR
- `notes` TEXT
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**`order_items`**
- `id` UUID PK
- `order_id` UUID FK
- `product_id` UUID FK
- `product_name` VARCHAR
- `sku` VARCHAR
- `quantity` INTEGER
- `unit_price` BIGINT
- `subtotal` BIGINT
- `created_at` TIMESTAMPTZ
*(Nama dan harga produk disimpan sebagai snapshot untuk menjaga histori transaksi.)*

**`order_status_histories`**
- `id` UUID PK
- `order_id` UUID FK
- `old_status` VARCHAR
- `new_status` VARCHAR
- `changed_by` UUID FK NULL
- `notes` TEXT
- `created_at` TIMESTAMPTZ

#### Preorder
**`preorder_periods`**
- `id` UUID PK
- `name` VARCHAR
- `description` TEXT
- `start_at` TIMESTAMPTZ
- `close_at` TIMESTAMPTZ
- `production_date` DATE
- `pickup_start_at` TIMESTAMPTZ
- `pickup_end_at` TIMESTAMPTZ
- `status` VARCHAR
- `created_at` TIMESTAMPTZ

**`preorder_product_quotas`**
- `id` UUID PK
- `preorder_period_id` UUID FK
- `product_id` UUID FK
- `quota` INTEGER
- `reserved_quantity` INTEGER
- `confirmed_quantity` INTEGER

#### Payments
**`payment_bank_accounts`**
- `id` UUID PK
- `bank_name` VARCHAR
- `account_number` VARCHAR
- `account_holder` VARCHAR
- `is_active` BOOLEAN
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**`payments`**
- `id` UUID PK
- `order_id` UUID FK
- `payment_number` VARCHAR UNIQUE
- `method` VARCHAR
- `provider` VARCHAR NULL
- `provider_reference` VARCHAR NULL
- `bank_account_id` UUID FK NULL
- `amount` BIGINT
- `status` VARCHAR
- `expires_at` TIMESTAMPTZ NULL
- `paid_at` TIMESTAMPTZ NULL
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**`payment_events`**
- `id` UUID PK
- `payment_id` UUID FK
- `event_type` VARCHAR
- `provider_event_id` VARCHAR NULL
- `payload` JSONB
- `processed_at` TIMESTAMPTZ NULL
- `created_at` TIMESTAMPTZ

#### Inventory
**`stock_movements`**
- `id` UUID PK
- `product_id` UUID FK
- `movement_type` VARCHAR *(Nilai: `INITIAL`, `PURCHASE`, `SALE`, `RESERVATION`, `RELEASE`, `ADJUSTMENT`, `WASTE`, `RETURN`)*
- `quantity` INTEGER
- `reference_type` VARCHAR
- `reference_id` UUID
- `notes` TEXT
- `created_by` UUID FK NULL
- `created_at` TIMESTAMPTZ

#### POS
**`cash_registers`**
- `id` UUID PK
- `name` VARCHAR
- `opening_balance` BIGINT
- `closing_balance` BIGINT NULL
- `opened_by` UUID FK
- `closed_by` UUID FK NULL
- `opened_at` TIMESTAMPTZ
- `closed_at` TIMESTAMPTZ NULL
- `status` VARCHAR

**`cash_transactions`**
- `id` UUID PK
- `cash_register_id` UUID FK
- `transaction_type` VARCHAR
- `amount` BIGINT
- `reference_id` UUID NULL
- `notes` TEXT
- `created_by` UUID FK
- `created_at` TIMESTAMPTZ

#### QR
**`qr_codes`**
- `id` UUID PK
- `name` VARCHAR
- `code` VARCHAR UNIQUE
- `target_type` VARCHAR *(Nilai: `STORE`, `CATALOG`)*
- `is_active` BOOLEAN
- `created_at` TIMESTAMPTZ

#### Production
**`production_batches`**
- `id` UUID PK
- `batch_number` VARCHAR UNIQUE
- `production_date` DATE
- `status` VARCHAR
- `notes` TEXT
- `created_at` TIMESTAMPTZ

**`production_items`**
- `id` UUID PK
- `production_batch_id` UUID FK
- `product_id` UUID FK
- `planned_quantity` INTEGER
- `produced_quantity` INTEGER
- `notes` TEXT

#### Audit
**`audit_logs`**
- `id` UUID PK
- `user_id` UUID FK NULL
- `action` VARCHAR
- `entity_type` VARCHAR
- `entity_id` UUID
- `old_data` JSONB
- `new_data` JSONB
- `ip_address` INET NULL
- `created_at` TIMESTAMPTZ

### 6.2 Database Constraints
Wajib diterapkan:
- Semua primary key menggunakan `UUID`.
- Harga dan nominal menggunakan `BIGINT`.
- Quantity harus lebih besar dari nol untuk item transaksi.
- Total order tidak boleh negatif.
- Payment amount tidak boleh negatif.
- Order number harus unique.
- SKU harus unique.
- Provider event ID memiliki unique constraint ketika tersedia.
- Stok tidak boleh negatif jika stock tracking aktif.
- Kuota PO tidak boleh terlampaui.
- Foreign key histori transaksi tidak dihapus secara cascading.
- Soft delete digunakan untuk produk dan data master yang sudah memiliki histori transaksi.

### 6.3 Inventory Strategy
Gunakan pendekatan **stock ledger**. Stok tidak hanya diubah secara langsung, tetapi semua perubahan harus dicatat ke `stock_movements`.

**Rumus:**
$$\text{Available Stock} = \text{Physical Stock} - \text{Reserved Stock}$$

**Contoh:**
- Stok fisik: $50$ donat.
- Reservasi: $10$ donat.
- Stok tersedia: $40$ donat.

**Alur Stok untuk Pesanan QR:**
- Saat checkout, sistem melakukan reservasi (`RESERVATION`).
- Jika pembayaran berhasil, reservasi dikonfirmasi menjadi penjualan (`SALE`).
- Jika pembayaran expired atau pesanan dibatalkan, reservasi dilepas (`RELEASE`).
- Semua perubahan dilakukan secara atomik menggunakan database transaction.
- Untuk PO, kuota produk dipisahkan dari stok ready stock.

---

## 7. API SPECIFICATION

- **Base URL:** `/api/v1`

**Success Response Format:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

**Error Response Format:**
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR"
  }
}
```

### 7.1 Authentication API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `POST` | `/auth/login` | Login |
| `POST` | `/auth/refresh` | Refresh token |
| `POST` | `/auth/logout` | Logout |
| `GET` | `/auth/me` | Informasi user |

### 7.2 Dashboard API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/dashboard/summary` | Ringkasan dashboard |
| `GET` | `/dashboard/sales` | Grafik penjualan |
| `GET` | `/dashboard/top-products` | Produk terlaris |
| `GET` | `/dashboard/orders` | Ringkasan order |

### 7.3 Product API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/products` | List produk |
| `POST` | `/products` | Buat produk |
| `GET` | `/products/{id}` | Detail produk |
| `PUT` | `/products/{id}` | Update produk |
| `DELETE` | `/products/{id}` | Nonaktifkan produk |
| `GET` | `/categories` | List kategori |
| `POST` | `/categories` | Buat kategori |
| `PUT` | `/categories/{id}` | Update kategori |

### 7.4 Customer Ordering API (Public Endpoint)

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/public/store` | Informasi toko & rekening pembayaran aktif |
| `GET` | `/public/menu` | Katalog produk |
| `GET` | `/public/menu/{id}` | Detail produk |
| `GET` | `/public/qr/{code}` | Resolusi QR |
| `POST` | `/public/orders` | Buat pesanan |
| `GET` | `/public/orders/{token}` | Detail pesanan |
| `POST` | `/public/orders/{token}/cancel` | Ajukan pembatalan |

> **Security Note:** Customer token harus berupa token acak yang tidak dapat ditebak. Jangan menggunakan UUID order sebagai satu-satunya autentikasi untuk membaca data customer.

### 7.5 Order API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/orders` | List pesanan |
| `POST` | `/orders` | Buat pesanan dari admin |
| `GET` | `/orders/{id}` | Detail pesanan |
| `PATCH` | `/orders/{id}/status` | Update status |
| `POST` | `/orders/{id}/cancel` | Batalkan pesanan |
| `GET` | `/orders/{id}/history` | Riwayat status |

**Query Filter:** `status`, `payment_status`, `source`, `order_type`, `date_from`, `date_to`

### 7.6 Preorder API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/preorders` | List periode PO |
| `POST` | `/preorders` | Buat periode |
| `GET` | `/preorders/{id}` | Detail periode |
| `PUT` | `/preorders/{id}` | Update periode |
| `POST` | `/preorders/{id}/open` | Buka PO |
| `POST` | `/preorders/{id}/close` | Tutup PO |
| `GET` | `/preorders/{id}/orders` | Pesanan PO |
| `GET` | `/preorders/{id}/production-summary` | Rekap produksi |
| `PUT` | `/preorders/{id}/quotas` | Update kuota |

### 7.7 Payment API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `POST` | `/orders/{id}/payments` | Buat pembayaran |
| `GET` | `/payments/{id}` | Detail pembayaran |
| `POST` | `/payments/{id}/proof` | Upload bukti transfer |
| `POST` | `/payments/{id}/verify` | Verifikasi manual |
| `POST` | `/payments/{id}/reject` | Tolak pembayaran |
| `POST` | `/webhooks/payments/{provider}` | Callback gateway |

> **Catatan:** Webhook harus memvalidasi signature dan nominal pembayaran.

### 7.8 POS API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/pos/products` | Produk untuk POS |
| `POST` | `/pos/orders` | Buat transaksi POS |
| `POST` | `/pos/orders/{id}/pay` | Proses pembayaran |
| `GET` | `/pos/transactions` | Riwayat transaksi |
| `POST` | `/pos/registers/open` | Buka kas |
| `POST` | `/pos/registers/close` | Tutup kas |
| `GET` | `/pos/registers/current` | Kas aktif |

### 7.9 Inventory API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/inventory/products` | Daftar stok |
| `GET` | `/inventory/movements` | Histori stok |
| `POST` | `/inventory/adjustments` | Penyesuaian stok |
| `POST` | `/inventory/restocks` | Penambahan stok |
| `GET` | `/inventory/low-stock` | Stok minimum |

### 7.10 Production API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/production/batches` | List batch |
| `POST` | `/production/batches` | Buat batch |
| `GET` | `/production/batches/{id}` | Detail batch |
| `PUT` | `/production/batches/{id}` | Update batch |
| `GET` | `/production/queue` | Antrean kitchen |
| `PATCH` | `/production/orders/{id}/status` | Update status produksi |

### 7.11 Reporting API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/reports/sales` | Laporan penjualan |
| `GET` | `/reports/products` | Performa produk |
| `GET` | `/reports/payments` | Laporan pembayaran |
| `GET` | `/reports/preorders` | Laporan PO |
| `GET` | `/reports/inventory` | Laporan stok |
| `GET` | `/reports/cashier` | Laporan kasir |

---

## 8. API BUSINESS RULES

### 8.1 Order Creation
Order harus dibuat melalui service yang sama, baik dari POS maupun customer ordering.

**Order creation harus:**
1. Memvalidasi produk.
2. Memvalidasi harga dari database.
3. Menghitung subtotal di backend.
4. Memvalidasi ketersediaan stok atau kuota.
5. Membuat order.
6. Membuat order items dengan snapshot harga.
7. Membuat payment jika diperlukan (dengan batas waktu pembayaran default 60 menit untuk transfer/online).
8. Membuat reservasi jika produk menggunakan stock tracking.

> **Penting:** Jangan pernah mempercayai harga atau total yang dikirim frontend.

### 8.2 Order Status
Status yang direkomendasikan:
- `PENDING_PAYMENT`
- `CONFIRMED`
- `PREPARING`
- `READY`
- `COMPLETED`
- `CANCELLED`
- `EXPIRED`

Transisi harus divalidasi backend. Contoh:
`PENDING_PAYMENT` $\rightarrow$ `CONFIRMED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`

Pembatalan hanya boleh dilakukan sesuai aturan dan status pesanan.

### 8.3 Payment Status
Status pembayaran:
- `UNPAID`
- `PENDING`
- `PAID`
- `FAILED`
- `EXPIRED`
- `REFUNDED`
- `PARTIALLY_PAID`

*Status pembayaran dan status pesanan tidak boleh dicampur.*

### 8.4 Idempotency
Endpoint pembuatan order dan pembayaran harus mendukung `Idempotency-Key`.

**Tujuan:**
- Mencegah order ganda.
- Mencegah pembayaran ganda.
- Mengatasi retry jaringan.
- Menghindari transaksi ganda ketika customer menekan tombol checkout berkali-kali.

### 8.5 Concurrency
Pengecekan stok dan kuota harus menggunakan locking atau conditional update di database.
Contoh: Jika stok hanya 1 dan dua customer melakukan checkout bersamaan, hanya satu transaksi yang boleh mendapatkan reservasi.

---

## 9. SECURITY REQUIREMENTS

- Password menggunakan Argon2id atau bcrypt.
- HTTPS wajib.
- JWT memiliki masa berlaku terbatas.
- Refresh token disimpan secara aman.
- RBAC untuk endpoint admin.
- Rate limiting untuk public API.
- Validasi upload bukti transfer.
- Pembatasan ukuran file.
- Webhook signature validation.
- Idempotency pada transaksi.
- Audit log untuk perubahan penting.
- Secrets tidak boleh disimpan dalam repository.
- Database tidak boleh diekspos ke internet.
- Customer token harus random dan sulit ditebak.
- Admin memiliki kontrol untuk pembatalan dan refund.
- Payment webhook tidak boleh mengubah transaksi tanpa validasi.

---

## 10. NON-FUNCTIONAL REQUIREMENTS

| Area | Requirement |
| :--- | :--- |
| **Availability** | Target awal $99.5\%$ |
| **Performance** | API normal P95 di bawah $500\text{ ms}$, tidak termasuk provider eksternal |
| **Security** | HTTPS, RBAC, input validation |
| **Backup** | Backup database harian |
| **Recovery** | Restore harus diuji |
| **Browser** | Chrome, Safari, Firefox modern |
| **Mobile** | Responsive untuk Android dan iOS |
| **Logging** | Structured logging |
| **Monitoring** | Health check dan error monitoring |
| **Maintainability** | Modular architecture |
| **Data Integrity** | Transactional database operation |

---

## 11. DEVELOPMENT PLAN

**Estimasi awal:** 8 minggu untuk MVP sampai versi operasional awal, dengan asumsi satu developer full-stack atau tim kecil, kebutuhan desain dan integrasi tersedia, serta payment gateway sudah dipilih.

### Sprint 0 — Foundation (Durasi: 3–4 hari)
- **Tasks:** Finalisasi requirement, Setup Git repository, Setup Go backend, Setup Next.js frontend, Setup PostgreSQL, Setup Docker Compose, Setup migration, Setup CI, Setup OpenAPI, Setup development environment.
- **Deliverable:** Backend berjalan, Frontend berjalan, Database terkoneksi, CI dasar berjalan.

### Sprint 1 — Master Data & Authentication (Durasi: 1 minggu)
- **Tasks:** Login, User management, RBAC, Product management, Category management, Image upload, Customer management, Bank account settings.
- **Deliverable:** Admin dapat mengelola master data.

### Sprint 2 — POS & Order Management (Durasi: 1 minggu)
- **Tasks:** POS interface, Product search, Cart, Checkout, Order creation, Cash payment, Transfer manual (BCA), Receipt, Order history, Stock movement.
- **Deliverable:** Toko dapat melakukan transaksi langsung.

### Sprint 3 — Customer QR Ordering (Durasi: 1 minggu)
- **Tasks:** Public menu, QR generator, QR resolver, Customer cart, Customer checkout, Customer order token, Order tracking, Konfirmasi pembayaran via WhatsApp (`6281240521795`), Mobile responsive UI.
- **Deliverable:** Customer dapat memesan melalui QR.

### Sprint 4 — Payment Integration (Durasi: 1 minggu)
- **Tasks:** Payment abstraction, QRIS dynamic payment (Midtrans), Webhook handler, Signature verification, Payment expiration (60 menit), Manual transfer verification, Payment reconciliation, Idempotency.
- **Deliverable:** Pembayaran online terintegrasi.

### Sprint 5 — Preorder Management (Durasi: 1 minggu)
- **Tasks:** PO period, PO schedule, Product quota, PO checkout, Pickup schedule, Production summary, PO reporting.
- **Deliverable:** Sistem dapat mengelola PO.

### Sprint 6 — Production & Reporting (Durasi: 1 minggu)
- **Tasks:** Kitchen display, Order status management, Production batches, Sales dashboard, Sales reports, Payment reports, Stock reports.
- **Deliverable:** Operasional produksi dan pelaporan tersedia.

### Sprint 7 — Testing & Go Live (Durasi: 1 minggu)
- **Tasks:** Unit testing, Integration testing, Payment testing, Concurrency testing, POS testing, QR testing, Mobile testing, Security review, Backup and restore test, User acceptance testing, Production deployment.
- **Deliverable:** MVP siap digunakan di toko.

---

## 12. ACCEPTANCE CRITERIA

Sistem dianggap siap digunakan apabila:

- **Product:** Admin dapat membuat dan mengubah produk; harga dan ketersediaan produk benar; produk dapat dinonaktifkan tanpa menghilangkan histori.
- **POS:** Kasir dapat melakukan transaksi; pembayaran cash tercatat; stok diperbarui; struk dapat dibuat; histori transaksi tersedia.
- **QR Ordering:** QR dapat dipindai; menu dapat dibuka tanpa login; customer dapat membuat pesanan; customer menerima nomor pesanan; admin menerima pesanan baru; customer dapat melihat status pesanan.
- **Payment:** Transfer manual ke rekening BCA (`5255422011` a.n. Ahmad Pardan Mahpudin) dapat diverifikasi; batas waktu 60 menit berjalan otomatis; QRIS dapat dibuat & webhook tervalidasi saat diaktifkan; pembayaran gagal tidak mengonfirmasi order; cash tercatat dengan benar.
- **Pre-Order:** Admin dapat membuka periode PO; customer dapat memesan selama periode terbuka; kuota tidak dapat terlampaui; rekap produksi sesuai pesanan yang dikonfirmasi.
- **Inventory:** Stok dapat ditambahkan; stok berkurang melalui transaksi; pembatalan melepaskan reservasi; histori pergerakan stok tersedia.

---

## 13. MVP PRIORITY

Agar tidak terlalu besar di awal, prioritas implementasi dibagi menjadi:

### P0 — Wajib untuk Go Live
- Authentication
- Product management
- POS
- Ready stock
- QR ordering
- Cash payment
- Manual transfer (BCA)
- Order management
- Basic inventory
- Basic dashboard

### P1 — Setelah MVP Stabil
- QRIS gateway (Midtrans)
- Preorder management
- PO quota
- Production summary
- Kitchen display
- Customer order tracking

### P2 — Pengembangan Berikutnya
- WhatsApp notifications otomatis
- Recipe / Bill of Materials
- Ingredient inventory
- Automatic production planning
- Customer loyalty
- Promo and voucher
- Advanced analytics
- Multi-outlet

> **Catatan:** QRIS merupakan bagian penting dari kebutuhan pembayaran awal. P1 hanya menjadi urutan implementasi jika integrasi provider Midtrans belum siap saat MVP pertama diuji.

---

## 14. DEPLOYMENT ARCHITECTURE

```text
                 INTERNET
                    |
                 HTTPS
                    |
             Reverse Proxy
                    |
          +---------+---------+
          |                   |
      Next.js UI          Go REST API
          |                   |
          |              PostgreSQL
          |                   |
          +-------------------+
                    |
             Payment Gateway
                    |
               Webhooks
```

- **Docker Compose Services:** `frontend`, `backend`, `postgres`, `reverse-proxy`
- **Storage:** PostgreSQL volume, Product image storage, Payment proof storage, Application logs.
- **Backup:** Daily PostgreSQL backup, Backup file storage, Retention policy, Restore testing.
- **Environment:** Development, Staging, Production.

---

## 15. IMPORTANT ARCHITECTURAL DECISIONS

Keputusan berikut harus dipertahankan selama development:
1. Satu backend menjadi sumber kebenaran semua transaksi.
2. POS dan QR menggunakan order service yang sama.
3. Ready stock dan PO menggunakan mekanisme inventory yang berbeda.
4. Payment memiliki lifecycle terpisah dari order.
5. Semua nominal disimpan dalam `BIGINT` rupiah.
6. Stok menggunakan stock ledger.
7. PO menggunakan kuota terpisah.
8. Harga produk pada histori transaksi tidak mengikuti perubahan harga master.
9. Semua pembayaran gateway menggunakan webhook yang tervalidasi.
10. Semua perubahan penting memiliki audit trail.
11. Public customer ordering tidak membutuhkan registrasi akun.
12. Struktur data menggunakan `UUID` agar ekspansi multi-outlet tetap memungkinkan.
13. Implementasi awal hanya satu outlet dan tidak membutuhkan kompleksitas tenant management.
14. QR pemesanan dipisahkan dari QR pembayaran.
15. Order yang belum dibayar tidak boleh otomatis masuk ke angka penjualan aktual.
16. Informasi rekening bank disimpan di database (`payment_bank_accounts`) agar fleksibel saat ada perubahan.

---

## 16. OUT OF SCOPE MVP

Fitur berikut belum masuk ruang lingkup MVP:
- Multi-outlet management
- Franchise management
- Mobile native application
- Accounting general ledger
- Payroll
- Supplier procurement automation
- Advanced CRM
- Loyalty points
- Automated recipe costing
- AI demand forecasting

---

## 17. FINAL RECOMMENDATION

Bangun aplikasi dengan pendekatan **modular monolith** menggunakan:
- **Next.js** untuk seluruh frontend.
- **Golang Fiber** untuk backend API.
- **PostgreSQL** untuk database.
- **Docker Compose** untuk deployment.
- **Payment gateway abstraction** untuk integrasi Manual Transfer BCA (fase awal) dan QRIS Midtrans.

Prioritas paling penting adalah menyelesaikan alur transaksi dari ujung ke ujung:
> **Admin membuat produk $\rightarrow$ Customer scan QR $\rightarrow$ Customer memilih donat $\rightarrow$ Checkout $\rightarrow$ Pembayaran (Transfer BCA 60 menit) $\rightarrow$ Order masuk POS $\rightarrow$ Produk disiapkan $\rightarrow$ Customer mengambil pesanan $\rightarrow$ Laporan penjualan diperbarui.**

Setelah alur tersebut stabil, implementasikan PO, kuota produksi, inventory bahan baku, dan fitur lanjutan. Dokumen ini menjadi baseline awal pengembangan **Donut Shop Management & Self-Service Ordering System**.