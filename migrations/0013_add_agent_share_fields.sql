-- 添加代理分享链接和专属域名字段
-- Migration: 0013_add_agent_share_fields
-- Date: 2024-11-30

-- 检查并添加 invite_code 字段
-- ALTER TABLE agents ADD COLUMN invite_code VARCHAR(20) UNIQUE;

-- 检查并添加 invite_url 字段
-- ALTER TABLE agents ADD COLUMN invite_url VARCHAR(500);

-- 检查并添加 custom_domain 字段
-- ALTER TABLE agents ADD COLUMN custom_domain VARCHAR(255);

-- 检查并添加 custom_domain_status 字段
-- ALTER TABLE agents ADD COLUMN custom_domain_status TINYINT DEFAULT 0;

-- 检查并添加 custom_domain_verified_at 字段
-- ALTER TABLE agents ADD COLUMN custom_domain_verified_at DATETIME;

-- 由于 SQLite 不支持 ADD COLUMN IF NOT EXISTS，我们需要先检查字段是否存在
-- 如果字段不存在才添加

-- 为现有代理生成邀请码（如果需要）
-- UPDATE agents SET invite_code = 
--   SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ABS(RANDOM()) % 36 + 1, 1) ||
--   SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ABS(RANDOM()) % 36 + 1, 1) ||
--   SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ABS(RANDOM()) % 36 + 1, 1) ||
--   SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ABS(RANDOM()) % 36 + 1, 1) ||
--   SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ABS(RANDOM()) % 36 + 1, 1) ||
--   SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ABS(RANDOM()) % 36 + 1, 1) ||
--   SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ABS(RANDOM()) % 36 + 1, 1) ||
--   SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ABS(RANDOM()) % 36 + 1, 1)
-- WHERE invite_code IS NULL OR invite_code = '';

-- 注意：由于字段可能已经在 0001_initial_schema.sql 中定义
-- 此迁移仅作为文档记录
-- 实际应用时需要检查表结构并只添加缺失的字段
