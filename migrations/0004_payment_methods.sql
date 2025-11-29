-- 收款方式管理表
-- V2.1.8 版本新增

-- =====================
-- 收款方式配置
-- =====================

-- 收款方式表
CREATE TABLE IF NOT EXISTS payment_methods (
    method_id INTEGER PRIMARY KEY AUTOINCREMENT,
    method_name VARCHAR(50) NOT NULL,              -- 收款方式名称（如：USDT-TRC20、银行卡、支付宝）
    method_type VARCHAR(20) NOT NULL,              -- 类型：crypto/bank/ewallet/other
    currency VARCHAR(20) DEFAULT 'CNY',            -- 币种：CNY/USDT/BTC/ETH等
    
    -- 收款账户信息
    account_name VARCHAR(100),                     -- 收款人姓名/钱包标识
    account_number VARCHAR(200),                   -- 账号/钱包地址
    bank_name VARCHAR(100),                        -- 银行名称（银行卡类型时使用）
    bank_branch VARCHAR(200),                      -- 开户行支行
    qr_code_url VARCHAR(500),                      -- 收款二维码图片URL
    
    -- 限额配置
    min_amount DECIMAL(18,4) DEFAULT 0,            -- 单笔最小金额
    max_amount DECIMAL(18,4) DEFAULT 1000000,      -- 单笔最大金额
    daily_limit DECIMAL(18,4) DEFAULT 0,           -- 每日限额（0=无限制）
    
    -- 费率配置
    fee_type TINYINT DEFAULT 0,                    -- 0=无手续费 1=固定费用 2=百分比
    fee_amount DECIMAL(10,4) DEFAULT 0,            -- 固定费用金额 或 百分比费率
    
    -- 状态与排序
    status TINYINT DEFAULT 1,                      -- 0=禁用 1=启用
    sort_order INTEGER DEFAULT 0,                  -- 排序（越小越靠前）
    
    -- 适用范围
    applicable_agents TEXT,                        -- 适用代理ID列表（JSON数组，空=全部适用）
    applicable_vip_levels TEXT,                    -- 适用VIP等级（JSON数组，空=全部适用）
    
    -- 备注与时间
    remark TEXT,                                   -- 备注说明
    created_by INTEGER,                            -- 创建人ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(method_type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_status ON payment_methods(status);
CREATE INDEX IF NOT EXISTS idx_payment_methods_currency ON payment_methods(currency);

-- 插入默认收款方式
INSERT OR IGNORE INTO payment_methods (method_name, method_type, currency, account_name, account_number, min_amount, max_amount, status, sort_order, remark)
VALUES 
    ('USDT-TRC20', 'crypto', 'USDT', 'TRC20钱包', 'TRC20WalletAddressHere', 100, 1000000, 1, 1, 'USDT TRC20网络收款'),
    ('USDT-ERC20', 'crypto', 'USDT', 'ERC20钱包', 'ERC20WalletAddressHere', 100, 500000, 1, 2, 'USDT ERC20网络收款'),
    ('银行卡转账', 'bank', 'CNY', '张三', '6222021234567890123', 100, 500000, 1, 3, '工商银行收款账户'),
    ('支付宝', 'ewallet', 'CNY', '收款支付宝', 'alipay@example.com', 50, 50000, 1, 4, '支付宝快捷收款'),
    ('微信支付', 'ewallet', 'CNY', '收款微信', 'wxpay_account', 50, 50000, 0, 5, '微信支付收款（暂停）');
