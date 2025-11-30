-- 真人荷官视讯后台管理系统 数据库架构
-- V2.1 版本

-- =====================
-- 管理员与权限
-- =====================

-- 角色表
CREATE TABLE IF NOT EXISTS admin_roles (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    permissions TEXT NOT NULL DEFAULT '[]', -- JSON数组
    description VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 管理员表
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    role_id INTEGER NOT NULL,
    status TINYINT DEFAULT 1, -- 0=禁用 1=正常 2=锁定
    two_fa_secret VARCHAR(64),
    two_fa_enabled TINYINT DEFAULT 0,
    ip_whitelist TEXT, -- JSON数组
    last_login_ip VARCHAR(45),
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES admin_roles(role_id)
);

-- =====================
-- 代理层级体系
-- =====================

-- 代理表
CREATE TABLE IF NOT EXISTS agents (
    agent_id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    parent_agent_id INTEGER, -- NULL表示顶级
    level TINYINT DEFAULT 1, -- 1=股东 2=总代 3=代理
    share_ratio DECIMAL(5,2) DEFAULT 0, -- 占成比例
    commission_ratio DECIMAL(5,2) DEFAULT 0, -- 佣金比例
    currency VARCHAR(10) DEFAULT 'CNY',
    default_commission_scheme_id INTEGER,
    status TINYINT DEFAULT 1, -- 0=禁用 1=正常 2=锁定
    balance DECIMAL(18,4) DEFAULT 0,
    contact_phone VARCHAR(20),
    ip_whitelist TEXT,
    -- 分享链接字段
    invite_code VARCHAR(20) UNIQUE, -- 邀请码，用于生成分享链接
    invite_url VARCHAR(500), -- 完整分享链接
    -- 专属域名字段
    custom_domain VARCHAR(255), -- 专属域名
    custom_domain_status TINYINT DEFAULT 0, -- 0=未验证 1=已验证 2=验证失败
    custom_domain_verified_at DATETIME, -- 域名验证时间
    remark TEXT,
    last_login_ip VARCHAR(45),
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_agent_id) REFERENCES agents(agent_id)
);

-- =====================
-- 玩家管理
-- =====================

-- 玩家表
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    agent_id INTEGER NOT NULL,
    balance DECIMAL(18,4) DEFAULT 0,
    frozen_balance DECIMAL(18,4) DEFAULT 0,
    status TINYINT DEFAULT 1, -- 0=正常 1=冻结 2=锁定
    vip_level TINYINT DEFAULT 0,
    commission_scheme_id INTEGER, -- 特殊洗码方案
    real_name VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    bank_name VARCHAR(50),
    bank_account VARCHAR(50),
    device_fingerprint VARCHAR(255),
    register_ip VARCHAR(45),
    last_login_ip VARCHAR(45),
    last_login_at DATETIME,
    ltv DECIMAL(18,2) DEFAULT 0, -- 生命周期价值
    total_deposit DECIMAL(18,2) DEFAULT 0,
    total_withdraw DECIMAL(18,2) DEFAULT 0,
    total_bet DECIMAL(18,2) DEFAULT 0,
    total_win_loss DECIMAL(18,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

-- =====================
-- 财务管理
-- =====================

-- 交易流水表
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(64) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    transaction_type TINYINT NOT NULL, -- 1=存款 2=取款 3=投注 4=派彩 5=红利 6=洗码 7=人工调整
    amount DECIMAL(18,4) NOT NULL,
    balance_before DECIMAL(18,4) NOT NULL,
    balance_after DECIMAL(18,4) NOT NULL,
    audit_status TINYINT DEFAULT 0, -- 0=待审核 1=通过 2=拒绝 3=锁定
    auditor_id INTEGER,
    audit_remark TEXT,
    audit_at DATETIME,
    related_order_id VARCHAR(64),
    payment_method VARCHAR(50),
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- =====================
-- 注单管理
-- =====================

-- 注单表
CREATE TABLE IF NOT EXISTS bets (
    bet_id INTEGER PRIMARY KEY AUTOINCREMENT,
    bet_no VARCHAR(64) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    game_round_id VARCHAR(64) NOT NULL,
    game_type VARCHAR(50) NOT NULL, -- 百家乐/龙虎/轮盘/骰宝/牛牛
    table_code VARCHAR(20),
    bet_detail TEXT NOT NULL, -- JSON
    bet_amount DECIMAL(18,4) NOT NULL,
    valid_bet_amount DECIMAL(18,4) NOT NULL,
    odds DECIMAL(10,4) DEFAULT 1,
    win_loss_amount DECIMAL(18,4) DEFAULT 0,
    bet_status TINYINT DEFAULT 0, -- 0=未结算 1=已结算 2=已取消 3=废单
    settle_at DATETIME,
    bet_ip VARCHAR(45),
    ip_location VARCHAR(100),
    device_type VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 开奖结果表
CREATE TABLE IF NOT EXISTS game_results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_round_id VARCHAR(64) NOT NULL UNIQUE,
    game_type VARCHAR(50) NOT NULL,
    table_code VARCHAR(20),
    result_detail TEXT NOT NULL, -- JSON
    video_url VARCHAR(500),
    dealer_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- 洗码系统
-- =====================

-- 洗码方案表
CREATE TABLE IF NOT EXISTS commission_schemes (
    scheme_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_name VARCHAR(100) NOT NULL UNIQUE,
    settlement_cycle TINYINT DEFAULT 1, -- 1=日结 2=周结 3=实时
    min_valid_bet DECIMAL(18,2) DEFAULT 0, -- 最低有效投注
    daily_max_amount DECIMAL(18,2), -- 单日上限
    baccarat_rate DECIMAL(6,4) DEFAULT 0.008, -- 百家乐返水
    dragon_tiger_rate DECIMAL(6,4) DEFAULT 0.008,
    roulette_rate DECIMAL(6,4) DEFAULT 0.005,
    sicbo_rate DECIMAL(6,4) DEFAULT 0.005,
    niuniu_rate DECIMAL(6,4) DEFAULT 0.007,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 洗码发放记录表
CREATE TABLE IF NOT EXISTS commission_records (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scheme_id INTEGER NOT NULL,
    settlement_date DATE NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    valid_bet_amount DECIMAL(18,4) NOT NULL,
    commission_rate DECIMAL(6,4) NOT NULL,
    commission_amount DECIMAL(18,4) NOT NULL,
    audit_status TINYINT DEFAULT 0, -- 0=待审核 1=已通过 2=已拒绝
    auditor_id INTEGER,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (scheme_id) REFERENCES commission_schemes(scheme_id)
);

-- =====================
-- 风控管理
-- =====================

-- 风控规则表
CREATE TABLE IF NOT EXISTS risk_rules (
    rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 大额预警/套利监控/异常IP等
    rule_condition TEXT NOT NULL, -- JSON条件
    rule_action VARCHAR(50) NOT NULL, -- 预警/限红/冻结
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 风控预警记录表
CREATE TABLE IF NOT EXISTS risk_alerts (
    alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    rule_id INTEGER NOT NULL,
    bet_id INTEGER,
    alert_type VARCHAR(50) NOT NULL,
    alert_detail TEXT,
    risk_level TINYINT DEFAULT 1, -- 1=低 2=中 3=高
    handle_status TINYINT DEFAULT 0, -- 0=待处理 1=已处理 2=忽略
    handler_id INTEGER,
    handle_remark TEXT,
    handle_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (rule_id) REFERENCES risk_rules(rule_id)
);

-- =====================
-- 现场运营
-- =====================

-- 荷官档案表
CREATE TABLE IF NOT EXISTS dealers (
    dealer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id VARCHAR(20) NOT NULL UNIQUE,
    stage_name_cn VARCHAR(50) NOT NULL,
    stage_name_en VARCHAR(50),
    avatar_url VARCHAR(500),
    photo_url VARCHAR(500),
    gender TINYINT DEFAULT 0, -- 0=女 1=男
    status TINYINT DEFAULT 1, -- 0=离职 1=在职 2=休假
    hire_date DATE,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 桌台配置表
CREATE TABLE IF NOT EXISTS game_tables (
    table_id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_code VARCHAR(20) NOT NULL UNIQUE,
    table_name VARCHAR(50),
    game_type VARCHAR(50) NOT NULL,
    primary_stream_url VARCHAR(500),
    backup_stream_url VARCHAR(500),
    min_bet DECIMAL(18,2) DEFAULT 10,
    max_bet DECIMAL(18,2) DEFAULT 100000,
    status TINYINT DEFAULT 1, -- 0=维护 1=正常 2=关闭
    current_dealer_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_dealer_id) REFERENCES dealers(dealer_id)
);

-- 排班表
CREATE TABLE IF NOT EXISTS dealer_shifts (
    shift_id INTEGER PRIMARY KEY AUTOINCREMENT,
    dealer_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TINYINT DEFAULT 1, -- 0=取消 1=正常 2=完成
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dealer_id) REFERENCES dealers(dealer_id),
    FOREIGN KEY (table_id) REFERENCES game_tables(table_id)
);

-- =====================
-- 内容管理
-- =====================

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
    announcement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    type TINYINT DEFAULT 1, -- 1=跑马灯 2=弹窗 3=轮播图
    image_url VARCHAR(500),
    link_url VARCHAR(500),
    language VARCHAR(10) DEFAULT 'zh-CN',
    priority INTEGER DEFAULT 0,
    target_level VARCHAR(50), -- ALL/VIP/普通
    status TINYINT DEFAULT 0, -- 0=草稿 1=已发布 2=定时发布
    publish_at DATETIME,
    expire_at DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- 操作日志
-- =====================

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    admin_username VARCHAR(50),
    operation_type VARCHAR(50) NOT NULL,
    target_table VARCHAR(50),
    target_id VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id)
);

-- =====================
-- 索引优化
-- =====================

CREATE INDEX IF NOT EXISTS idx_users_agent_id ON users(agent_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(audit_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_game_type ON bets(game_type);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(bet_status);
CREATE INDEX IF NOT EXISTS idx_bets_created_at ON bets(created_at);

CREATE INDEX IF NOT EXISTS idx_commission_records_user_id ON commission_records(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_date ON commission_records(settlement_date);

CREATE INDEX IF NOT EXISTS idx_risk_alerts_user_id ON risk_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_status ON risk_alerts(handle_status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
