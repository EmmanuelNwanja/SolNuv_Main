-- Allow partner portal roles on users.user_type / companies.user_type (PostgreSQL enum).

ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'recycler';
ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'financier';
