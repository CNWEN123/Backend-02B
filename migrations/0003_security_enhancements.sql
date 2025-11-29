-- V2.1.1 安全增强
-- 真人荷官视讯后台管理系统

-- =====================
-- 0. 管理员安全字段扩展
-- =====================

ALTER TABLE admin_users ADD COLUMN secondary_password VARCHAR(64);
ALTER TABLE admin_users ADD COLUMN password_changed_at DATETIME;
ALTER TABLE admin_users ADD COLUMN login_fail_count INTEGER DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN locked_until DATETIME;

-- 更新默认管理员密码为SHA-256哈希
UPDATE admin_users SET 
    password_hash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    secondary_password = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
WHERE password_hash LIKE '$2a$%' OR password_hash = '123456';

-- =====================
-- 1. 安全审计增强
-- =====================

-- 添加索引优化审计日志查询
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation_type ON audit_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- =====================
-- 2. 会话管理表
-- =====================

CREATE TABLE IF NOT EXISTS admin_sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    token_hash VARCHAR(64) NOT NULL, -- Token的SHA-256哈希
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME, -- 如果被撤销
    FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- =====================
-- 3. 操作限流表
-- =====================

CREATE TABLE IF NOT EXISTS rate_limits (
    limit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier VARCHAR(100) NOT NULL, -- IP或用户ID
    action_type VARCHAR(50) NOT NULL, -- 操作类型
    request_count INTEGER DEFAULT 1,
    window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(identifier, action_type)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- =====================
-- 4. 安全配置表
-- =====================

CREATE TABLE IF NOT EXISTS security_config (
    config_key VARCHAR(50) PRIMARY KEY,
    config_value TEXT NOT NULL,
    description VARCHAR(200),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认安全配置
INSERT OR IGNORE INTO security_config (config_key, config_value, description) VALUES
('max_login_attempts', '5', '最大登录失败次数'),
('lockout_duration_minutes', '30', '账号锁定时长(分钟)'),
('session_timeout_hours', '8', '会话超时时长(小时)'),
('password_min_length', '8', '密码最小长度'),
('require_2fa_for_sensitive', '0', '敏感操作是否需要2FA'),
('ip_whitelist_enabled', '0', 'IP白名单是否启用');
