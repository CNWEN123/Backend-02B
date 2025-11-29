-- 转账手续费设置表
CREATE TABLE IF NOT EXISTS transfer_fee_settings (
    fee_id INTEGER PRIMARY KEY AUTOINCREMENT,
    fee_name VARCHAR(50) NOT NULL,                   -- 规则名称
    fee_type VARCHAR(20) NOT NULL DEFAULT 'percent', -- 手续费类型: percent=百分比, fixed=固定金额
    fee_value DECIMAL(10,4) NOT NULL DEFAULT 0,      -- 手续费值 (百分比时为0.01=1%, 固定时为金额)
    min_fee DECIMAL(15,2) DEFAULT 0,                 -- 最低手续费
    max_fee DECIMAL(15,2) DEFAULT 0,                 -- 最高手续费 (0=不限)
    min_amount DECIMAL(15,2) DEFAULT 0,              -- 最低转账金额
    max_amount DECIMAL(15,2) DEFAULT 0,              -- 最高转账金额 (0=不限)
    transfer_type VARCHAR(20) DEFAULT 'all',         -- 适用类型: all=全部, member=会员互转, agent=代理下发
    vip_level INTEGER DEFAULT 0,                     -- 适用VIP等级 (0=全部等级)
    daily_free_count INTEGER DEFAULT 0,              -- 每日免费次数 (0=无免费)
    status TINYINT DEFAULT 1,                        -- 状态: 0=禁用, 1=启用
    priority INTEGER DEFAULT 0,                      -- 优先级 (数值越大优先级越高)
    description VARCHAR(200),                        -- 规则描述
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_fee_status ON transfer_fee_settings(status);
CREATE INDEX IF NOT EXISTS idx_fee_type ON transfer_fee_settings(transfer_type);
CREATE INDEX IF NOT EXISTS idx_fee_priority ON transfer_fee_settings(priority DESC);

-- 添加权限
INSERT OR IGNORE INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(724, 'report:transfer:fee:view', '查看手续费设置', 'report_transfer', '转账记录'),
(725, 'report:transfer:fee:edit', '编辑手续费设置', 'report_transfer', '转账记录');

-- 插入默认手续费规则
INSERT OR IGNORE INTO transfer_fee_settings (fee_name, fee_type, fee_value, min_fee, max_fee, min_amount, max_amount, transfer_type, vip_level, daily_free_count, status, priority, description) VALUES
('默认手续费', 'percent', 0.01, 1, 100, 10, 0, 'all', 0, 3, 1, 0, '默认1%手续费，最低1元，最高100元，每日前3次免费'),
('VIP免手续费', 'percent', 0, 0, 0, 0, 0, 'all', 3, 0, 1, 10, 'VIP3及以上免手续费'),
('大额转账优惠', 'percent', 0.005, 5, 50, 10000, 0, 'member', 0, 0, 1, 5, '万元以上转账0.5%手续费'),
('代理下发免费', 'fixed', 0, 0, 0, 0, 0, 'agent', 0, 0, 1, 20, '代理下发不收取手续费');
