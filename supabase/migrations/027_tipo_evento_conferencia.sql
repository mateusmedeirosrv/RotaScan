-- RotaScan v2.0 — novo tipo de evento CONFERENCIA.
-- Fica em arquivo próprio: o Postgres só permite USAR um valor novo de enum
-- depois que o ALTER TYPE foi commitado (scripts/migrate.mjs roda cada
-- arquivo numa transação implícita). Idempotente.

ALTER TYPE tipo_evento ADD VALUE IF NOT EXISTS 'CONFERENCIA';
