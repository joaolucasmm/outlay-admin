-- Demo data, loaded only with the `demo` profile. Same ids and values as the web mock
-- (apps/web/src/mocks/fixtures/seed.ts), so links and tests work against either backend.
-- Fictional companies only. POST /demo/reset runs this script again.

DELETE FROM audit_events;
DELETE FROM tenants;

INSERT INTO tenants (id, name, name_key, country, currency, status, created_at, updated_at) VALUES
  ('tnt_bluefin',    'Bluefin Logistics',         'bluefin logistics',         'BR', 'BRL', 'active',        '2026-02-03 14:12:00.000', '2026-02-04 09:30:00.000'),
  ('tnt_cedarpine',  'Cedar & Pine Studio',       'cedar & pine studio',       'US', 'USD', 'active',        '2026-03-11 16:40:00.000', '2026-03-12 10:05:00.000'),
  ('tnt_harbor',     'Harbor Health Group',       'harbor health group',       'US', 'USD', 'suspended',     '2026-01-20 08:00:00.000', '2026-10-02 13:22:00.000'),
  ('tnt_kestrel',    'Kestrel Robotics',          'kestrel robotics',          'DE', 'EUR', 'active',        '2026-04-08 07:45:00.000', '2026-04-09 11:00:00.000'),
  ('tnt_tidewater',  'Tidewater Foods',           'tidewater foods',           'PT', 'EUR', 'provisioning',  '2026-11-10 15:30:00.000', '2026-11-10 15:30:00.000'),
  ('tnt_quarrylane', 'Quarry Lane Architects',    'quarry lane architects',    'GB', 'GBP', 'deprovisioned', '2025-09-01 10:00:00.000', '2026-06-30 17:00:00.000'),
  ('tnt_saffron',    'Saffron Table Restaurants', 'saffron table restaurants', 'BR', 'BRL', 'active',        '2026-05-19 12:10:00.000', '2026-05-20 08:55:00.000'),
  ('tnt_orbital',    'Orbital Freight',           'orbital freight',           'MX', 'MXN', 'suspended',     '2026-02-27 09:20:00.000', '2026-11-01 18:45:00.000');

INSERT INTO audit_events (id, tenant_id, actor_id, actor_role, action, entity, entity_id, before_state, after_state, at) VALUES
  ('aud_seed_1', 'tnt_quarrylane', 'per_operator', 'support_operator', 'tenant.suspended', 'tenant', 'tnt_quarrylane',
    '{"status": "active"}', '{"status": "suspended", "reason": "Contract ended"}', '2026-06-01 09:00:00.000'),
  ('aud_seed_2', 'tnt_quarrylane', 'per_operator', 'support_operator', 'tenant.deprovisioned', 'tenant', 'tnt_quarrylane',
    '{"status": "suspended"}', '{"status": "deprovisioned"}', '2026-06-30 17:00:00.000'),
  ('aud_seed_3', 'tnt_harbor', 'per_operator', 'support_operator', 'tenant.suspended', 'tenant', 'tnt_harbor',
    '{"status": "active"}', '{"status": "suspended", "reason": "Billing dispute"}', '2026-10-02 13:22:00.000'),
  ('aud_seed_4', 'tnt_orbital', 'per_operator', 'support_operator', 'tenant.suspended', 'tenant', 'tnt_orbital',
    '{"status": "active"}', '{"status": "suspended", "reason": "Requested by customer"}', '2026-11-01 18:45:00.000'),
  ('aud_seed_5', 'tnt_bluefin', 'per_operator', 'support_operator', 'tenant.created', 'tenant', 'tnt_bluefin',
    NULL, '{"name": "Bluefin Logistics", "country": "BR", "currency": "BRL", "status": "provisioning"}', '2026-02-03 14:12:00.000'),
  ('aud_seed_6', 'tnt_bluefin', 'per_operator', 'support_operator', 'tenant.activated', 'tenant', 'tnt_bluefin',
    '{"status": "provisioning"}', '{"status": "active"}', '2026-02-04 09:30:00.000'),
  ('aud_seed_7', 'tnt_bluefin', 'per_admin_tnt_bluefin', 'program_admin', 'category.updated', 'category', 'cat_bluefin_software',
    '{"active": true}', '{"active": false}', '2026-03-10 11:00:00.000'),
  ('aud_seed_8', 'tnt_bluefin', 'per_admin_tnt_bluefin', 'program_admin', 'policy.updated', 'policy', 'tnt_bluefin',
    '{"cat_bluefin_meals:manager": {"limitMinor": 35000, "receiptRequiredAboveMinor": 12500, "approvalLevels": 0}, "cat_bluefin_client_ent:manager": {"limitMinor": 250000, "receiptRequiredAboveMinor": 0, "approvalLevels": 2}}',
    '{"cat_bluefin_meals:manager": {"limitMinor": 40000, "receiptRequiredAboveMinor": 12500, "approvalLevels": 0}, "cat_bluefin_client_ent:manager": null}',
    '2026-03-15 16:20:00.000');
