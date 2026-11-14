-- ==============================================
-- BERSIHKAN DATA TRANSAKSI
-- Produk, kategori, user, QR, promo tetap aman
-- ==============================================

BEGIN;

-- 1. Hapus promo usages (tergantung orders)
TRUNCATE TABLE promo_usages CASCADE;

-- 2. Hapus cash transactions & registers
TRUNCATE TABLE cash_transactions CASCADE;
TRUNCATE TABLE cash_registers CASCADE;

-- 3. Hapus payments (tergantung orders)
TRUNCATE TABLE payments CASCADE;

-- 4. Hapus order items (tergantung orders)
TRUNCATE TABLE order_items CASCADE;

-- 5. Hapus orders
TRUNCATE TABLE orders CASCADE;

-- 6. Hapus stock movements (history stok)
TRUNCATE TABLE stock_movements CASCADE;

-- 7. Reset stok produk ke 0 (opsional, uncomment jika mau)
-- UPDATE products SET stock_quantity = 0, reserved_quantity = 0;

-- 8. Reset usage_count di promo codes
UPDATE promo_codes SET usage_count = 0;

-- 9. Hapus customers (opsional, uncomment jika mau)
-- TRUNCATE TABLE customers CASCADE;

COMMIT;

SELECT 'Done! Data transaksi sudah dibersihkan.' AS result;
