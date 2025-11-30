-- 快速初始化SQL - 创建基本测试数据
-- 包含：管理员、角色、代理（带邀请码和专属域名）

-- 1. 创建管理员角色
INSERT OR IGNORE INTO admin_roles (role_id, role_name, description, permissions, created_at) VALUES 
(1, '超级管理员', '拥有所有权限', '["*"]', datetime('now'));

-- 2. 创建管理员账号 (密码: admin123, hash: $2b$10$...)
-- 注意：这里使用明文密码的hash值
INSERT OR IGNORE INTO admin_users (admin_id, username, password_hash, real_name, role_id, status, created_at) VALUES 
(1, 'admin', '$2b$10$rZ5cL8F3vC9xP8wQ2nH7LOKqM6vN7Y8tR4wF3dT6xK9pM5sL7nC3e', '系统管理员', 1, 1, datetime('now'));

-- 3. 创建洗码方案
INSERT OR IGNORE INTO commission_schemes (scheme_id, scheme_name, scheme_type, game_type, rate, min_bet, max_bet, applicable_agents, vip_levels, status, created_at) VALUES 
(1, '默认方案', 'fixed', 'baccarat', 0.5, 10, 100000, '[]', '[1,2,3,4,5]', 1, datetime('now')),
(2, 'VIP方案', 'fixed', 'baccarat', 0.8, 100, 500000, '[]', '[4,5]', 1, datetime('now'));

-- 4. 创建测试代理（带邀请码和专属域名）
-- 股东
INSERT OR IGNORE INTO agents (
    agent_id, agent_username, password_hash, nickname, parent_agent_id, level, 
    share_ratio, commission_ratio, currency, default_commission_scheme_id, 
    status, balance, invite_code, invite_url, custom_domain, custom_domain_status,
    created_at, updated_at
) VALUES 
(1, 'shareholder001', '$2b$10$rZ5cL8F3vC9xP8wQ2nH7LOKqM6vN7Y8tR4wF3dT6xK9pM5sL7nC3e', '测试股东', NULL, 1, 
 50.00, 10.00, 'CNY', 1, 
 1, 100000.00, 'SH001ABC', 'https://demo.example.com/register?ref=SH001ABC', 'shareholder.demo.com', 1,
 datetime('now'), datetime('now'));

-- 总代
INSERT OR IGNORE INTO agents (
    agent_id, agent_username, password_hash, nickname, parent_agent_id, level,
    share_ratio, commission_ratio, currency, default_commission_scheme_id,
    status, balance, invite_code, invite_url, custom_domain, custom_domain_status,
    created_at, updated_at
) VALUES 
(2, 'agent001', '$2b$10$rZ5cL8F3vC9xP8wQ2nH7LOKqM6vN7Y8tR4wF3dT6xK9pM5sL7nC3e', '测试总代', 1, 2,
 30.00, 8.00, 'CNY', 1,
 1, 50000.00, 'AG001XYZ', 'https://demo.example.com/register?ref=AG001XYZ', 'agent001.demo.com', 0,
 datetime('now'), datetime('now'));

-- 代理
INSERT OR IGNORE INTO agents (
    agent_id, agent_username, password_hash, nickname, parent_agent_id, level,
    share_ratio, commission_ratio, currency, default_commission_scheme_id,
    status, balance, invite_code, invite_url, custom_domain, custom_domain_status,
    created_at, updated_at
) VALUES 
(3, 'subagent001', '$2b$10$rZ5cL8F3vC9xP8wQ2nH7LOKqM6vN7Y8tR4wF3dT6xK9pM5sL7nC3e', '测试代理', 2, 3,
 15.00, 5.00, 'CNY', 1,
 1, 20000.00, 'SA001DEF', NULL, 'subagent.demo.com', 0,
 datetime('now'), datetime('now'));

-- 5. 创建测试玩家
INSERT OR IGNORE INTO users (
    user_id, username, password_hash, nickname, agent_id, vip_level,
    balance, total_deposit, total_withdrawal, total_bet, total_win,
    status, created_at, updated_at
) VALUES 
(1, 'player001', '$2b$10$rZ5cL8F3vC9xP8wQ2nH7LOKqM6vN7Y8tR4wF3dT6xK9pM5sL7nC3e', '测试玩家1', 3, 2,
 5000.00, 10000.00, 3000.00, 50000.00, 48000.00,
 1, datetime('now'), datetime('now')),
(2, 'player002', '$2b$10$rZ5cL8F3vC9xP8wQ2nH7LOKqM6vN7Y8tR4wF3dT6xK9pM5sL7nC3e', '测试玩家2', 3, 1,
 3000.00, 5000.00, 1000.00, 20000.00, 19500.00,
 1, datetime('now'), datetime('now'));

-- 6. 创建一些测试交易记录
INSERT OR IGNORE INTO transactions (
    user_id, type, amount, balance_before, balance_after, status, remark, created_at
) VALUES 
(1, 'deposit', 5000.00, 0, 5000.00, 1, '测试充值', datetime('now', '-5 days')),
(1, 'deposit', 5000.00, 5000.00, 10000.00, 1, '测试充值', datetime('now', '-3 days')),
(1, 'withdrawal', 3000.00, 10000.00, 7000.00, 1, '测试提现', datetime('now', '-1 day'));

-- 7. 创建测试游戏结果
INSERT OR IGNORE INTO game_results (
    game_type, game_id, shoe_number, round_number, banker_cards, player_cards,
    result, created_at
) VALUES 
('baccarat', 'BAC001', 1, 1, '♠K,♥5', '♦8,♣2', 'player', datetime('now', '-2 hours')),
('baccarat', 'BAC001', 1, 2, '♥9,♦6', '♠7,♣8', 'banker', datetime('now', '-1 hour'));

-- 8. 创建测试注单
INSERT OR IGNORE INTO bets (
    user_id, game_type, game_id, shoe_number, round_number, bet_type, bet_amount,
    payout_amount, result, status, created_at
) VALUES 
(1, 'baccarat', 'BAC001', 1, 1, 'player', 100.00, 200.00, 'win', 'settled', datetime('now', '-2 hours')),
(1, 'baccarat', 'BAC001', 1, 2, 'banker', 200.00, 0, 'lose', 'settled', datetime('now', '-1 hour')),
(2, 'baccarat', 'BAC001', 1, 1, 'banker', 50.00, 0, 'lose', 'settled', datetime('now', '-2 hours'));
