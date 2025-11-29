-- V2.1 功能增强 - 新增表和字段
-- 真人荷官视讯后台管理系统

-- =====================
-- 1. 用户扩展字段
-- =====================

-- 添加缺失的用户字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_level TINYINT DEFAULT 0; -- 风险等级 0=普通 1=低风险 2=中风险 3=高风险
ALTER TABLE users ADD COLUMN IF NOT EXISTS bet_limit_group_id INTEGER; -- 限红组ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0; -- 登录次数
ALTER TABLE users ADD COLUMN IF NOT EXISTS bet_count INTEGER DEFAULT 0; -- 投注次数
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_deposit_at DATETIME; -- 首充时间
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_bet_at DATETIME; -- 最后投注时间
ALTER TABLE users ADD COLUMN IF NOT EXISTS remark TEXT; -- 备注

-- =====================
-- 2. 限红组配置表
-- =====================

CREATE TABLE IF NOT EXISTS bet_limit_groups (
    group_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(200),
    -- 百家乐限红
    baccarat_min DECIMAL(18,2) DEFAULT 10,
    baccarat_max DECIMAL(18,2) DEFAULT 100000,
    baccarat_tie_max DECIMAL(18,2) DEFAULT 10000,
    baccarat_pair_max DECIMAL(18,2) DEFAULT 10000,
    -- 龙虎限红
    dragon_tiger_min DECIMAL(18,2) DEFAULT 10,
    dragon_tiger_max DECIMAL(18,2) DEFAULT 100000,
    -- 轮盘限红
    roulette_min DECIMAL(18,2) DEFAULT 10,
    roulette_max DECIMAL(18,2) DEFAULT 50000,
    -- 骰宝限红
    sicbo_min DECIMAL(18,2) DEFAULT 10,
    sicbo_max DECIMAL(18,2) DEFAULT 50000,
    sicbo_triple_max DECIMAL(18,2) DEFAULT 5000,
    -- 牛牛限红
    niuniu_min DECIMAL(18,2) DEFAULT 10,
    niuniu_max DECIMAL(18,2) DEFAULT 50000,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- 3. 玩家层级转移日志
-- =====================

CREATE TABLE IF NOT EXISTS player_transfer_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    from_agent_id INTEGER,
    to_agent_id INTEGER NOT NULL,
    reason VARCHAR(200),
    operator_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (from_agent_id) REFERENCES agents(agent_id),
    FOREIGN KEY (to_agent_id) REFERENCES agents(agent_id)
);

-- =====================
-- 4. 洗码方案绑定记录
-- =====================

CREATE TABLE IF NOT EXISTS commission_scheme_bindings (
    binding_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scheme_id INTEGER NOT NULL,
    binding_type TINYINT DEFAULT 1, -- 1=默认继承 2=手动覆盖
    effective_from DATE NOT NULL,
    effective_to DATE, -- NULL表示永久
    operator_id INTEGER,
    remark VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (scheme_id) REFERENCES commission_schemes(scheme_id)
);

-- =====================
-- 5. IP关联分析表
-- =====================

CREATE TABLE IF NOT EXISTS ip_analysis (
    analysis_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address VARCHAR(45) NOT NULL,
    user_count INTEGER DEFAULT 0,
    user_ids TEXT, -- JSON数组
    device_fingerprints TEXT, -- JSON数组
    first_seen DATETIME,
    last_seen DATETIME,
    risk_score INTEGER DEFAULT 0, -- 0-100
    is_flagged TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_analysis_ip ON ip_analysis(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_analysis_risk ON ip_analysis(risk_score);

-- =====================
-- 6. 用户登录日志
-- =====================

CREATE TABLE IF NOT EXISTS user_login_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    login_ip VARCHAR(45),
    ip_location VARCHAR(100),
    device_type VARCHAR(50),
    device_fingerprint VARCHAR(255),
    user_agent TEXT,
    login_status TINYINT DEFAULT 1, -- 1=成功 0=失败
    fail_reason VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_login_logs_user_id ON user_login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_ip ON user_login_logs(login_ip);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_created ON user_login_logs(created_at);

-- =====================
-- 7. 存款补单表
-- =====================

CREATE TABLE IF NOT EXISTS deposit_supplements (
    supplement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_order_no VARCHAR(64), -- 原订单号(可选)
    user_id INTEGER NOT NULL,
    amount DECIMAL(18,4) NOT NULL,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100), -- 支付凭证号
    supplement_reason VARCHAR(200) NOT NULL,
    attachment_url VARCHAR(500), -- 凭证图片
    audit_status TINYINT DEFAULT 0, -- 0=待审核 1=通过 2=拒绝
    auditor_id INTEGER,
    audit_remark TEXT,
    audit_at DATETIME,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- =====================
-- 8. 流水稽核配置表
-- =====================

CREATE TABLE IF NOT EXISTS turnover_rules (
    rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name VARCHAR(100) NOT NULL,
    trigger_type TINYINT NOT NULL, -- 1=存款 2=红利 3=洗码
    multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00, -- 流水倍数
    games_included TEXT, -- JSON数组,参与计算的游戏类型
    valid_days INTEGER DEFAULT 30, -- 有效天数
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- 9. 用户流水稽核记录
-- =====================

CREATE TABLE IF NOT EXISTS turnover_audits (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    rule_id INTEGER NOT NULL,
    trigger_transaction_id INTEGER, -- 触发的交易ID
    required_turnover DECIMAL(18,4) NOT NULL, -- 需要流水
    current_turnover DECIMAL(18,4) DEFAULT 0, -- 当前流水
    is_completed TINYINT DEFAULT 0,
    expire_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (rule_id) REFERENCES turnover_rules(rule_id)
);

-- =====================
-- 10. 特殊注单监控表(三宝等高赔注单)
-- =====================

CREATE TABLE IF NOT EXISTS special_bet_alerts (
    alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
    bet_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 三宝/围骰/对子等
    bet_amount DECIMAL(18,4) NOT NULL,
    potential_win DECIMAL(18,4), -- 潜在赢额
    odds DECIMAL(10,4),
    handle_status TINYINT DEFAULT 0, -- 0=待处理 1=已处理
    handler_id INTEGER,
    handle_remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bet_id) REFERENCES bets(bet_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- =====================
-- 11. 开奖结果扩展
-- =====================

ALTER TABLE game_results ADD COLUMN IF NOT EXISTS banker_point TINYINT; -- 庄家点数
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS player_point TINYINT; -- 闲家点数
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS cards_detail TEXT; -- 牌型详情JSON
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS is_pair TINYINT DEFAULT 0; -- 是否对子
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS is_natural TINYINT DEFAULT 0; -- 是否天牌

-- =====================
-- 12. 代理结算记录
-- =====================

CREATE TABLE IF NOT EXISTS agent_settlements (
    settlement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    settlement_period VARCHAR(20) NOT NULL, -- 202411 格式
    downline_count INTEGER DEFAULT 0,
    total_bet DECIMAL(18,4) DEFAULT 0,
    total_valid_bet DECIMAL(18,4) DEFAULT 0,
    total_win_loss DECIMAL(18,4) DEFAULT 0,
    company_profit DECIMAL(18,4) DEFAULT 0,
    commission_amount DECIMAL(18,4) DEFAULT 0,
    share_amount DECIMAL(18,4) DEFAULT 0,
    net_settlement DECIMAL(18,4) DEFAULT 0, -- 最终结算金额
    status TINYINT DEFAULT 0, -- 0=待结算 1=已结算 2=已发放
    settled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

-- =====================
-- 13. 游戏报表汇总
-- =====================

CREATE TABLE IF NOT EXISTS game_reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date DATE NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    table_count INTEGER DEFAULT 0,
    bet_count INTEGER DEFAULT 0,
    player_count INTEGER DEFAULT 0,
    total_bet DECIMAL(18,4) DEFAULT 0,
    total_valid_bet DECIMAL(18,4) DEFAULT 0,
    total_win_loss DECIMAL(18,4) DEFAULT 0,
    company_profit DECIMAL(18,4) DEFAULT 0,
    commission_paid DECIMAL(18,4) DEFAULT 0,
    net_profit DECIMAL(18,4) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_date, game_type)
);

-- =====================
-- 14. 盈亏日报
-- =====================

CREATE TABLE IF NOT EXISTS daily_reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date DATE NOT NULL UNIQUE,
    -- 玩家数据
    new_players INTEGER DEFAULT 0,
    active_players INTEGER DEFAULT 0,
    betting_players INTEGER DEFAULT 0,
    -- 存提数据
    deposit_count INTEGER DEFAULT 0,
    deposit_amount DECIMAL(18,4) DEFAULT 0,
    withdraw_count INTEGER DEFAULT 0,
    withdraw_amount DECIMAL(18,4) DEFAULT 0,
    -- 投注数据
    bet_count INTEGER DEFAULT 0,
    bet_amount DECIMAL(18,4) DEFAULT 0,
    valid_bet_amount DECIMAL(18,4) DEFAULT 0,
    -- 盈亏数据
    player_win_loss DECIMAL(18,4) DEFAULT 0,
    company_profit DECIMAL(18,4) DEFAULT 0,
    commission_paid DECIMAL(18,4) DEFAULT 0,
    bonus_paid DECIMAL(18,4) DEFAULT 0,
    net_profit DECIMAL(18,4) DEFAULT 0,
    -- 风控数据
    risk_alerts INTEGER DEFAULT 0,
    blocked_bets INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- 15. 角色权限细化
-- =====================

CREATE TABLE IF NOT EXISTS permissions (
    permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    permission_code VARCHAR(50) NOT NULL UNIQUE,
    permission_name VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入权限定义
INSERT OR IGNORE INTO permissions (permission_code, permission_name, module) VALUES
-- 仪表盘
('dashboard:view', '查看仪表盘', 'dashboard'),
-- 玩家管理
('player:read', '查看玩家', 'player'),
('player:write', '编辑玩家', 'player'),
('player:freeze', '冻结玩家', 'player'),
('player:kick', '踢线玩家', 'player'),
('player:transfer', '转移玩家', 'player'),
-- 代理管理
('agent:read', '查看代理', 'agent'),
('agent:write', '编辑代理', 'agent'),
('agent:create', '创建代理', 'agent'),
-- 财务管理
('finance:read', '查看财务', 'finance'),
('finance:audit', '审核财务', 'finance'),
('finance:manual', '人工调账', 'finance'),
('finance:supplement', '存款补单', 'finance'),
-- 注单管理
('bet:read', '查看注单', 'bet'),
('bet:void', '废除注单', 'bet'),
-- 洗码管理
('commission:read', '查看洗码', 'commission'),
('commission:write', '编辑洗码方案', 'commission'),
('commission:audit', '审核洗码', 'commission'),
('commission:bind', '绑定洗码方案', 'commission'),
-- 风控管理
('risk:read', '查看风控', 'risk'),
('risk:handle', '处理风控', 'risk'),
('risk:config', '配置风控规则', 'risk'),
-- 报表管理
('report:read', '查看报表', 'report'),
('report:export', '导出报表', 'report'),
-- 现场运营
('studio:read', '查看现场', 'studio'),
('studio:write', '编辑现场', 'studio'),
('studio:schedule', '排班管理', 'studio'),
-- 系统管理
('admin:read', '查看管理员', 'admin'),
('admin:write', '编辑管理员', 'admin'),
('admin:audit', '查看审计日志', 'admin'),
('system:config', '系统配置', 'system');

-- =====================
-- 16. 插入默认限红组
-- =====================

INSERT OR IGNORE INTO bet_limit_groups (group_id, group_name, description) VALUES
(1, '普通玩家', '默认限红组'),
(2, 'VIP玩家', 'VIP专属限红'),
(3, '高风险玩家', '限制投注额度');

-- =====================
-- 17. 插入默认流水规则
-- =====================

INSERT OR IGNORE INTO turnover_rules (rule_id, rule_name, trigger_type, multiplier, games_included, valid_days) VALUES
(1, '存款流水要求', 1, 1.00, '["百家乐","龙虎","轮盘","骰宝","牛牛"]', 30),
(2, '红利流水要求', 2, 3.00, '["百家乐","龙虎","轮盘","骰宝","牛牛"]', 7),
(3, '洗码流水要求', 3, 0.00, '["百家乐","龙虎","轮盘","骰宝","牛牛"]', 30);

-- =====================
-- 索引优化
-- =====================

CREATE INDEX IF NOT EXISTS idx_deposit_supplements_user ON deposit_supplements(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_supplements_status ON deposit_supplements(audit_status);
CREATE INDEX IF NOT EXISTS idx_turnover_audits_user ON turnover_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_special_bet_alerts_user ON special_bet_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_settlements_agent ON agent_settlements(agent_id);
CREATE INDEX IF NOT EXISTS idx_game_reports_date ON game_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);
