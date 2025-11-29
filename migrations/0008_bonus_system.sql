-- 红利派送系统
-- 红利类型：存款红利、首存红利、活动红利、返水红利、人工红利等

-- 红利记录表
CREATE TABLE IF NOT EXISTS bonus_records (
    bonus_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username VARCHAR(50) NOT NULL,
    bonus_type VARCHAR(30) NOT NULL,  -- deposit_bonus/first_deposit/activity/rebate/manual
    bonus_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    turnover_rule_id INTEGER,  -- 关联流水稽核规则
    turnover_multiplier DECIMAL(5,2) DEFAULT 1,  -- 流水倍数
    required_turnover DECIMAL(15,2) DEFAULT 0,  -- 需要完成的流水
    completed_turnover DECIMAL(15,2) DEFAULT 0,  -- 已完成的流水
    turnover_status INTEGER DEFAULT 0,  -- 0未达标 1已达标
    audit_status INTEGER DEFAULT 0,  -- 0待审核 1已通过 2已拒绝 3已取消
    remark TEXT,
    admin_id INTEGER,
    admin_username VARCHAR(50),
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,  -- 红利过期时间
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (turnover_rule_id) REFERENCES turnover_rules(rule_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_bonus_user ON bonus_records(user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_type ON bonus_records(bonus_type);
CREATE INDEX IF NOT EXISTS idx_bonus_status ON bonus_records(audit_status);
CREATE INDEX IF NOT EXISTS idx_bonus_turnover ON bonus_records(turnover_status);

-- 红利配置表
CREATE TABLE IF NOT EXISTS bonus_configs (
    config_id INTEGER PRIMARY KEY AUTOINCREMENT,
    bonus_type VARCHAR(30) UNIQUE NOT NULL,
    bonus_name VARCHAR(50) NOT NULL,
    description TEXT,
    min_deposit DECIMAL(15,2) DEFAULT 0,  -- 最低存款要求
    max_bonus DECIMAL(15,2) DEFAULT 0,  -- 最高红利上限
    bonus_percentage DECIMAL(5,2) DEFAULT 0,  -- 红利比例(%)
    turnover_rule_id INTEGER,  -- 默认关联的流水规则
    valid_days INTEGER DEFAULT 30,  -- 有效天数
    status INTEGER DEFAULT 1,  -- 0禁用 1启用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认红利配置
INSERT OR IGNORE INTO bonus_configs (bonus_type, bonus_name, description, min_deposit, max_bonus, bonus_percentage, valid_days, status) VALUES
('first_deposit', '首存红利', '新会员首次存款赠送红利', 100, 5000, 100, 30, 1),
('deposit_bonus', '存款红利', '存款赠送红利', 500, 2000, 20, 7, 1),
('activity', '活动红利', '活动奖励红利', 0, 10000, 0, 14, 1),
('rebate', '返水红利', '投注返水红利', 0, 50000, 0, 3, 1),
('manual', '人工红利', '人工派送红利', 0, 100000, 0, 30, 1);

-- 添加红利相关权限
INSERT OR IGNORE INTO permissions (permission_code, permission_name, module, description) VALUES
('bonus:list', '查看红利列表', 'bonus', '红利管理'),
('bonus:create', '派送红利', 'bonus', '红利管理'),
('bonus:audit', '审核红利', 'bonus', '红利管理'),
('bonus:cancel', '取消红利', 'bonus', '红利管理'),
('bonus:config', '红利配置', 'bonus', '红利管理');

-- 更新超级管理员权限
UPDATE admin_roles SET permissions = permissions || ',bonus:list,bonus:create,bonus:audit,bonus:cancel,bonus:config' WHERE role_id = 1;
