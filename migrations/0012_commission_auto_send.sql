-- 洗码方案自动派发功能增强
-- 新增自动派发相关字段到 commission_schemes 表

-- 添加自动派发开关
ALTER TABLE commission_schemes ADD COLUMN auto_send TINYINT DEFAULT 0;
-- 添加自动派发类型: 1=自动到账 2=手动领取
ALTER TABLE commission_schemes ADD COLUMN send_type TINYINT DEFAULT 1;
-- 添加周期内最大领取次数
ALTER TABLE commission_schemes ADD COLUMN max_claims_per_cycle INTEGER DEFAULT 1;
-- 添加VIP等级限制 (JSON数组)
ALTER TABLE commission_schemes ADD COLUMN vip_levels TEXT;
-- 添加适用代理限制 (JSON数组)
ALTER TABLE commission_schemes ADD COLUMN applicable_agents TEXT;
-- 添加描述
ALTER TABLE commission_schemes ADD COLUMN description TEXT;

-- 洗码记录表添加领取状态相关字段
ALTER TABLE commission_records ADD COLUMN claim_status TINYINT DEFAULT 0;
-- claim_status: 0=待领取 1=已领取 2=已过期 3=自动到账
ALTER TABLE commission_records ADD COLUMN claimed_at DATETIME;
ALTER TABLE commission_records ADD COLUMN expires_at DATETIME;

-- 创建待领取洗码汇总视图（用于前端展示）
-- 这是一个逻辑说明，SQLite不支持此语法，我们在应用层实现
-- CREATE VIEW IF NOT EXISTS v_pending_commissions AS
-- SELECT 
--     user_id,
--     SUM(commission_amount) as total_pending,
--     COUNT(*) as pending_count,
--     MIN(expires_at) as earliest_expiry
-- FROM commission_records 
-- WHERE claim_status = 0 
-- GROUP BY user_id;

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_commission_records_claim ON commission_records(user_id, claim_status);
CREATE INDEX IF NOT EXISTS idx_commission_records_expires ON commission_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_commission_schemes_auto ON commission_schemes(auto_send, status);
