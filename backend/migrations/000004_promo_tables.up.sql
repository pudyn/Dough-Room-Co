-- The promo tables were appended to 000001_init_schema.up.sql after that
-- migration had already been applied (and recorded in schema_migrations),
-- so databases in that state never got them. This migration creates the
-- missing tables. IF NOT EXISTS keeps it safe for databases that already
-- have them from a fresh 000001 run.

CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENTAGE','FIXED')),
    discount_value BIGINT NOT NULL CHECK (discount_value > 0),
    min_order BIGINT NOT NULL DEFAULT 0,
    max_discount BIGINT,
    usage_limit INT,
    usage_count INT NOT NULL DEFAULT 0,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES promo_codes(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    discount_amount BIGINT NOT NULL,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_usages_promo ON promo_usages(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_usages_order ON promo_usages(order_id);
