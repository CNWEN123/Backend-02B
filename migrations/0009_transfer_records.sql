-- 会员转账记录表
CREATE TABLE IF NOT EXISTS transfer_records (
    transfer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) UNIQUE NOT NULL,           -- 转账订单号
    from_user_id INTEGER NOT NULL,                   -- 转出会员ID
    from_username VARCHAR(50) NOT NULL,              -- 转出会员账号
    to_user_id INTEGER NOT NULL,                     -- 转入会员ID
    to_username VARCHAR(50) NOT NULL,                -- 转入会员账号
    amount DECIMAL(15,2) NOT NULL,                   -- 转账金额
    fee DECIMAL(15,2) DEFAULT 0,                     -- 手续费
    actual_amount DECIMAL(15,2) NOT NULL,            -- 实际到账金额
    from_balance_before DECIMAL(15,2),               -- 转出方转账前余额
    from_balance_after DECIMAL(15,2),                -- 转出方转账后余额
    to_balance_before DECIMAL(15,2),                 -- 转入方转账前余额
    to_balance_after DECIMAL(15,2),                  -- 转入方转账后余额
    transfer_type VARCHAR(20) DEFAULT 'member',      -- 转账类型: member=会员互转, agent=代理下发
    status TINYINT DEFAULT 1,                        -- 状态: 0=失败, 1=成功, 2=处理中
    remark VARCHAR(200),                             -- 备注
    ip_address VARCHAR(45),                          -- 操作IP
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_transfer_from_user ON transfer_records(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_to_user ON transfer_records(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_created ON transfer_records(created_at);
CREATE INDEX IF NOT EXISTS idx_transfer_type ON transfer_records(transfer_type);
CREATE INDEX IF NOT EXISTS idx_transfer_order ON transfer_records(order_no);

-- 添加转账记录权限
INSERT OR IGNORE INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(721, 'report:transfer:view', '查看转账记录', 'report_transfer', '转账记录'),
(722, 'report:transfer:query', '转账记录查询', 'report_transfer', '转账记录'),
(723, 'report:transfer:export', '转账记录导出', 'report_transfer', '转账记录');

-- 插入一些示例转账数据
INSERT OR IGNORE INTO transfer_records (order_no, from_user_id, from_username, to_user_id, to_username, amount, fee, actual_amount, from_balance_before, from_balance_after, to_balance_before, to_balance_after, transfer_type, status, remark, ip_address, created_at) VALUES
('TRF20241129001', 1, 'player001', 2, 'player002', 1000.00, 0, 1000.00, 5000.00, 4000.00, 2000.00, 3000.00, 'member', 1, '好友转账', '192.168.1.100', datetime('now', '-2 hours')),
('TRF20241129002', 3, 'player003', 1, 'player001', 500.00, 5.00, 495.00, 3000.00, 2500.00, 4000.00, 4495.00, 'member', 1, NULL, '192.168.1.101', datetime('now', '-1 hours')),
('TRF20241129003', 2, 'player002', 4, 'player004', 2000.00, 0, 2000.00, 3000.00, 1000.00, 1500.00, 3500.00, 'member', 1, '还款', '192.168.1.102', datetime('now', '-30 minutes')),
('TRF20241128001', 1, 'player001', 3, 'player003', 800.00, 0, 800.00, 5800.00, 5000.00, 2200.00, 3000.00, 'member', 1, NULL, '192.168.1.100', datetime('now', '-1 day')),
('TRF20241128002', 5, 'agent001', 2, 'player002', 5000.00, 0, 5000.00, 50000.00, 45000.00, 0, 5000.00, 'agent', 1, '代理下发', '192.168.1.200', datetime('now', '-1 day', '+2 hours'));
