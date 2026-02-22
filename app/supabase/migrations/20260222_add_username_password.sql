-- 支持账号密码登录：phone 改为可空，新增 username + password_hash
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 确保至少有一种登录方式
ALTER TABLE users ADD CONSTRAINT users_has_login_method
  CHECK (phone IS NOT NULL OR username IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
