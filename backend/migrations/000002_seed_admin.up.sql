-- Seed admin user (password: admin123 — change immediately after first login)
-- bcrypt hash of "admin123" with cost 12
INSERT INTO users (id, name, email, password_hash, is_active)
VALUES (
  gen_random_uuid(),
  'Admin',
  'admin@donutshop.com',
  '$2a$12$wRHL/xoCpoKrmSr0BtVCLOjhO5sNzzk5u6h6Hz/oqwtjhcmLIuoTy',
  true
) ON CONFLICT (email) DO NOTHING;

-- Assign OWNER role to admin
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'admin@donutshop.com' AND r.name = 'OWNER'
ON CONFLICT DO NOTHING;
