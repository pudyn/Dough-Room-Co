# Donut Shop Management & Self-Service Ordering System

POS + Self-Service ordering system for a donut shop. Customers can scan a QR code, browse the menu, and place orders directly. Staff manage orders, inventory, and payments via a web dashboard.

## Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.23, Fiber v2, sqlx, PostgreSQL 16 |
| Frontend | Next.js 15.1, React 19, TypeScript, Tailwind CSS |
| Auth | JWT (15m) + Refresh Token (30d), bcrypt, RBAC |
| Infra | Docker Compose, Nginx reverse proxy |

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env
# Edit .env — set strong POSTGRES_PASSWORD and JWT_SECRET

# 2. Start all services
docker compose up -d

# 3. Wait for postgres, then run migrations (auto-run on backend startup)
# Default admin: admin@donutshop.com / admin123
# Change the password immediately after first login!
```

Access:
- **Admin Dashboard**: http://localhost/admin
- **POS**: http://localhost/pos
- **Kitchen Display**: http://localhost/kitchen
- **Customer Menu**: http://localhost/menu

## Deploy ke Server (Production)

Untuk server/VM dengan **PostgreSQL jalan langsung di server** (bukan di dalam Docker), pakai `docker-compose.prod.yml` — Docker hanya menjalankan frontend + backend. File `docker-compose.yml` tetap khusus untuk lokal.

**1. Di server** (butuh Docker + Docker Compose plugin):

```bash
git clone https://github.com/pudyn/Dough-Room-Co.git
cd Dough-Room-Co

cp .env.production.example .env.production
nano .env.production     # isi DB_PASSWORD, JWT_SECRET (acak, min 32 char), FRONTEND_URL

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

**2. Izinkan Docker terhubung ke PostgreSQL server** (sekali saja):

- `postgresql.conf` → `listen_addresses = '*'(atau tambahkan IP bridge Docker)
- `pg_hba.conf` → tambahkan: `host donutshop donutshop 172.16.0.0/12 scram-sha-256`
- Reload: `sudo systemctl reload postgresql`
- Pastikan port 5432 **tidak** dibuka ke internet (firewall)

**3. Domain & HTTPS:**

- Default `WEB_PORT=8081` → arahkan reverse proxy nginx/Certbot server Anda ke `127.0.0.1:8081`
  (port 80/443 tetap dipakai nginx server, contoh blok nginx ada di `nginx/server-domain.conf.example`)
- Kalau server **tidak** punya nginx sendiri: set `WEB_PORT=80` supaya frontend langsung tampil di domain

**Update versi baru:**

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Development

### Backend (Go)

```bash
cd backend
go mod tidy
go run ./cmd/api/main.go
```

Requires `DATABASE_URL` and `JWT_SECRET` env vars (see `.env.example`).

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1` in `frontend/.env.local`.

### Database Migrations

Migrations are SQL files in `backend/migrations/`. They run automatically when the backend starts (via the `migrate` command in the Dockerfile entrypoint). To run manually:

```bash
# Using psql
psql $DATABASE_URL -f backend/migrations/000001_init_schema.up.sql
psql $DATABASE_URL -f backend/migrations/000002_seed_admin.up.sql
```

## Architecture

```
nginx (:80)
  ├── /api/v1/*      → backend:8080  (Go Fiber)
  ├── /webhooks/*    → backend:8080
  └── /*             → frontend:3000 (Next.js)
```

### User Roles

| Role | Access |
|---|---|
| OWNER | Full access |
| ADMIN | All except user management |
| CASHIER | POS, orders, dashboard |
| KITCHEN | Kitchen display only |

### Order Flow

1. **Ready Stock** (QR/POS): Customer orders → stock reserved → payment → confirmed → preparing → ready → completed
2. **Pre-Order**: Open period → customer orders → period closes → production → pickup
3. **POS**: Immediate confirm + payment, no pending state

### Payment Methods

- **Cash** (POS only)
- **Bank Transfer** (BCA): Manual verification with proof upload. 60-minute expiry.
- **Pay at Counter**: Confirm order first, pay when picking up
- **QRIS/Midtrans**: Disabled by default, configure `MIDTRANS_*` env vars to enable

## Project Structure

```
pos-application/
├── backend/
│   ├── cmd/api/main.go          # Entry point, routes
│   ├── configs/                 # Config loading
│   ├── internal/
│   │   ├── auth/                # Login, JWT, refresh tokens
│   │   ├── users/               # User CRUD
│   │   ├── products/            # Product catalog
│   │   ├── categories/          # Product categories
│   │   ├── orders/              # Order creation & management
│   │   ├── payments/            # Payment processing
│   │   ├── inventory/           # Stock adjustments
│   │   ├── pos/                 # POS-specific endpoints
│   │   ├── preorder/            # Pre-order periods
│   │   ├── production/          # Kitchen queue
│   │   ├── reports/             # Sales reports
│   │   ├── dashboard/           # Dashboard summary
│   │   ├── qr/                  # QR code management
│   │   ├── customers/           # Customer list
│   │   ├── middleware/          # Auth, rate limit
│   │   └── shared/              # Response helpers, pagination
│   ├── migrations/              # SQL migration files
│   └── pkg/                     # DB connection
├── frontend/
│   ├── app/
│   │   ├── admin/               # Admin dashboard pages
│   │   ├── pos/                 # POS terminal
│   │   ├── kitchen/             # Kitchen display
│   │   ├── menu/                # Customer self-service menu
│   │   ├── checkout/            # Customer checkout
│   │   └── order/[token]/       # Order tracking
│   ├── components/
│   ├── hooks/                   # useAuth, useCart
│   ├── lib/                     # API client, formatters
│   └── types/                   # TypeScript types
├── nginx/nginx.conf
├── docker-compose.yml
└── .env.example
```

## Store Information

- **WhatsApp**: 6281240521795
- **Bank**: BCA `5255422011` a.n. Ahmad Pardan Mahpudin
