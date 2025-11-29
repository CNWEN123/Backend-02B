-- IP白名单表 V2.1.10
-- 用于管理系统访问的IP白名单

CREATE TABLE IF NOT EXISTS ip_whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    ip_type TEXT DEFAULT 'single' CHECK(ip_type IN ('single', 'range', 'cidr')),
    description TEXT,
    admin_id INTEGER,
    admin_username TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    UNIQUE(ip_address)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip ON ip_whitelist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_status ON ip_whitelist(status);

-- 插入默认白名单
INSERT OR IGNORE INTO ip_whitelist (ip_address, ip_type, description, admin_username, status) VALUES 
    ('127.0.0.1', 'single', '本地回环地址', 'system', 1),
    ('0.0.0.0', 'single', '允许所有IP(开发模式)', 'system', 1);
