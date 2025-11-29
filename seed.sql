-- 初始化数据

-- 角色
INSERT OR IGNORE INTO admin_roles (role_id, role_name, permissions, description) VALUES 
(1, '超级管理员', '["*"]', '拥有所有权限'),
(2, '财务总监', '["finance:*", "report:read"]', '财务审核与报表'),
(3, '风控专员', '["risk:*", "player:read", "bet:read"]', '风险监控与处理'),
(4, '客服主管', '["player:read", "player:write", "transaction:read"]', '玩家服务'),
(5, '运营人员', '["content:*", "report:read"]', '内容与公告管理'),
(6, '现场主管', '["studio:*"]', '荷官与排班管理');

-- 管理员
INSERT OR IGNORE INTO admin_users (admin_id, username, password_hash, nickname, role_id, status, two_fa_enabled) VALUES 
(1, 'admin', '$2a$10$demo_hash_admin', 'Admin', 1, 1, 0),
(2, 'finance', '$2a$10$demo_hash_finance', '财务张', 2, 1, 0),
(3, 'risk01', '$2a$10$demo_hash_risk', '风控李', 3, 1, 0),
(4, 'service', '$2a$10$demo_hash_service', '客服小王', 4, 1, 0),
(5, 'ops01', '$2a$10$demo_hash_ops', '运营小陈', 5, 1, 0);

-- 代理
INSERT OR IGNORE INTO agents (agent_id, agent_username, password_hash, nickname, parent_agent_id, level, share_ratio, commission_ratio, currency, status, balance) VALUES 
(1, 'SH_01', '$2a$10$hash', '股东一号', NULL, 1, 100, 0.8, 'CNY', 1, 5000000),
(2, 'SH_02', '$2a$10$hash', '股东二号', NULL, 1, 100, 0.8, 'CNY', 1, 3000000),
(3, 'GA_North', '$2a$10$hash', '北方总代', 1, 2, 80, 0.7, 'CNY', 1, 1000000),
(4, 'GA_South', '$2a$10$hash', '南方总代', 1, 2, 80, 0.7, 'CNY', 1, 800000),
(5, 'AG_Bj_01', '$2a$10$hash', '北京代理A', 3, 3, 60, 0.6, 'CNY', 1, 200000),
(6, 'AG_Bj_02', '$2a$10$hash', '北京代理B', 3, 3, 60, 0.6, 'CNY', 1, 150000),
(7, 'AG_Sh_01', '$2a$10$hash', '上海代理A', 4, 3, 60, 0.6, 'CNY', 1, 180000);

-- 玩家
INSERT OR IGNORE INTO users (user_id, username, password_hash, nickname, agent_id, balance, status, vip_level, register_ip, total_deposit, total_withdraw, total_bet, total_win_loss, created_at) VALUES 
(1, 'vip_player_01', '$2a$10$hash', '尊贵VIP', 5, 125000.50, 1, 5, '203.0.113.1', 500000, 375000, 2500000, -25000, '2025-01-15 10:00:00'),
(2, 'test_user_02', '$2a$10$hash', '测试用户', 5, 50.00, 0, 0, '203.0.113.2', 100, 50, 500, -50, '2025-02-20 14:30:00'),
(3, 'whale_king', '$2a$10$hash', '大鲸王', 6, 500000.00, 1, 6, '203.0.113.3', 2000000, 1500000, 10000000, 50000, '2025-03-10 09:15:00'),
(4, 'new_player', '$2a$10$hash', '新手玩家', 5, 0.00, 1, 0, '203.0.113.4', 0, 0, 0, 0, '2025-11-22 16:45:00'),
(5, 'risk_acc_99', '$2a$10$hash', '风险账户', 7, 2100.00, 1, 1, '198.51.100.1', 5000, 2900, 15000, -2000, '2025-11-21 11:20:00'),
(6, 'high_roller', '$2a$10$hash', '高端玩家', 6, 88000.00, 1, 4, '192.0.2.1', 300000, 212000, 1500000, 10000, '2025-05-08 08:00:00'),
(7, 'normal_user', '$2a$10$hash', '普通会员', 7, 3500.00, 1, 1, '192.0.2.2', 10000, 6500, 50000, -500, '2025-06-15 12:00:00'),
(8, 'lucky_star', '$2a$10$hash', '幸运之星', 5, 15600.00, 1, 2, '192.0.2.3', 20000, 4400, 80000, 2000, '2025-07-20 18:30:00');

-- 洗码方案
INSERT OR IGNORE INTO commission_schemes (scheme_id, scheme_name, settlement_cycle, min_valid_bet, daily_max_amount, baccarat_rate, dragon_tiger_rate, roulette_rate, sicbo_rate, niuniu_rate, status) VALUES 
(1, '普通会员方案', 1, 1000, 10000, 0.006, 0.006, 0.004, 0.004, 0.005, 1),
(2, 'VIP专属方案', 1, 500, 50000, 0.008, 0.008, 0.006, 0.006, 0.007, 1),
(3, '至尊VIP方案', 2, 0, NULL, 0.010, 0.010, 0.008, 0.008, 0.009, 1);

-- 交易流水
INSERT OR IGNORE INTO transactions (transaction_id, order_no, user_id, transaction_type, amount, balance_before, balance_after, audit_status, remark, created_at) VALUES 
(1, 'D2025112201', 1, 1, 50000.00, 75000.50, 125000.50, 1, '在线存款', '2025-11-22 09:30:00'),
(2, 'W2025112201', 1, 2, -20000.00, 145000.50, 125000.50, 0, '申请提款', '2025-11-22 10:15:00'),
(3, 'B2025112201', 3, 3, -5000.00, 505000.00, 500000.00, 1, '百家乐投注', '2025-11-22 11:00:00'),
(4, 'P2025112201', 3, 4, 4750.00, 500000.00, 504750.00, 1, '百家乐派彩', '2025-11-22 11:01:00'),
(5, 'D2025112202', 6, 1, 30000.00, 58000.00, 88000.00, 1, '银行转账', '2025-11-22 08:00:00'),
(6, 'W2025112202', 5, 2, -1000.00, 3100.00, 2100.00, 2, '流水不足拒绝', '2025-11-22 12:00:00');

-- 注单
INSERT OR IGNORE INTO bets (bet_id, bet_no, user_id, game_round_id, game_type, table_code, bet_detail, bet_amount, valid_bet_amount, odds, win_loss_amount, bet_status, bet_ip, created_at) VALUES 
(1, 'BET2025112201', 1, 'GR202511220001', '百家乐', 'BAC-001', '{"area":"庄","amount":2000}', 2000.00, 2000.00, 0.95, 1900.00, 1, '203.0.113.1', '2025-11-22 14:30:05'),
(2, 'BET2025112202', 5, 'GR202511220002', '龙虎', 'DT-002', '{"area":"龙","amount":50000}', 50000.00, 50000.00, 1.00, 0.00, 2, '198.51.100.1', '2025-11-22 14:31:12'),
(3, 'BET2025112203', 4, 'GR202511220003', '轮盘', 'ROU-001', '{"area":"红","amount":100}', 100.00, 100.00, 1.00, -100.00, 1, '203.0.113.4', '2025-11-22 14:32:45'),
(4, 'BET2025112204', 3, 'GR202511220004', '牛牛', 'NN-001', '{"area":"闲2","amount":5000}', 5000.00, 5000.00, 1.50, 0.00, 0, '203.0.113.3', '2025-11-22 14:35:00'),
(5, 'BET2025112205', 6, 'GR202511220005', '百家乐', 'BAC-001', '{"area":"闲","amount":10000}', 10000.00, 10000.00, 1.00, 10000.00, 1, '192.0.2.1', '2025-11-22 15:00:00'),
(6, 'BET2025112206', 7, 'GR202511220006', '骰宝', 'SB-001', '{"area":"大","amount":500}', 500.00, 500.00, 1.00, -500.00, 1, '192.0.2.2', '2025-11-22 15:10:00');

-- 洗码记录
INSERT OR IGNORE INTO commission_records (record_id, user_id, scheme_id, settlement_date, game_type, valid_bet_amount, commission_rate, commission_amount, audit_status, created_at) VALUES 
(1, 1, 2, '2025-11-21', '百家乐', 2500000.00, 0.008, 20000.00, 0, '2025-11-22 04:00:00'),
(2, 1, 2, '2025-11-21', '龙虎', 100000.00, 0.008, 800.00, 0, '2025-11-22 04:00:00'),
(3, 5, 1, '2025-11-21', '轮盘', 50000.00, 0.004, 200.00, 1, '2025-11-22 04:00:00'),
(4, 3, 3, '2025-11-21', '百家乐', 800000.00, 0.010, 8000.00, 2, '2025-11-22 04:00:00'),
(5, 7, 1, '2025-11-21', '牛牛', 120000.00, 0.005, 600.00, 1, '2025-11-22 04:00:00');

-- 风控规则
INSERT OR IGNORE INTO risk_rules (rule_id, rule_name, rule_type, rule_condition, rule_action, status) VALUES 
(1, '单注超限预警', '大额预警', '{"single_bet_max": 50000}', '预警', 1),
(2, '连续获胜预警', '异常行为', '{"win_streak": 10}', '预警', 1),
(3, '同IP多账户', '套利监控', '{"same_ip_accounts": 3}', '冻结', 1),
(4, '高频投注检测', '异常行为', '{"bets_per_minute": 20}', '限红', 1);

-- 风控预警
INSERT OR IGNORE INTO risk_alerts (alert_id, user_id, rule_id, bet_id, alert_type, alert_detail, risk_level, handle_status, created_at) VALUES 
(1, 6, 1, 5, '单注超限', '单注金额10000超过普通阈值', 2, 0, '2025-11-22 15:00:00'),
(2, 5, 3, NULL, '同IP多账户', 'IP 198.51.100.1 关联3个账户', 3, 0, '2025-11-22 12:30:00'),
(3, 3, 2, NULL, '连续获胜', '连续8局获胜', 1, 1, '2025-11-22 11:30:00');

-- 荷官
INSERT OR IGNORE INTO dealers (dealer_id, staff_id, stage_name_cn, stage_name_en, gender, status, hire_date) VALUES 
(1, 'DLR001', 'Alice 陈美丽', 'Alice Chen', 0, 1, '2024-01-15'),
(2, 'DLR002', 'Bob 王强', 'Bob Wang', 1, 1, '2024-02-20'),
(3, 'DLR003', 'Cici 李娜', 'Cici Li', 0, 1, '2024-03-10'),
(4, 'DLR004', 'David 张伟', 'David Zhang', 1, 1, '2024-04-05'),
(5, 'DLR005', 'Emma 刘芳', 'Emma Liu', 0, 1, '2024-05-18'),
(6, 'DLR006', 'Frank 周杰', 'Frank Zhou', 1, 2, '2024-06-22');

-- 桌台
INSERT OR IGNORE INTO game_tables (table_id, table_code, table_name, game_type, min_bet, max_bet, status, current_dealer_id) VALUES 
(1, 'BAC-001', '百家乐A01台', '百家乐', 100, 100000, 1, 1),
(2, 'BAC-002', '百家乐A02台', '百家乐', 100, 100000, 1, 2),
(3, 'DT-001', '龙虎B01台', '龙虎', 50, 50000, 1, 3),
(4, 'DT-002', '龙虎B02台', '龙虎', 50, 50000, 1, 4),
(5, 'ROU-001', '轮盘C01台', '轮盘', 10, 20000, 1, 5),
(6, 'SB-001', '骰宝D01台', '骰宝', 10, 10000, 0, NULL),
(7, 'NN-001', '牛牛E01台', '牛牛', 50, 30000, 1, NULL);

-- 排班
INSERT OR IGNORE INTO dealer_shifts (shift_id, dealer_id, table_id, shift_date, start_time, end_time, status) VALUES 
(1, 1, 1, '2025-11-22', '08:00', '16:00', 1),
(2, 2, 1, '2025-11-22', '16:00', '24:00', 1),
(3, 3, 3, '2025-11-22', '08:00', '16:00', 1),
(4, 4, 4, '2025-11-22', '08:00', '16:00', 1),
(5, 5, 5, '2025-11-22', '10:00', '18:00', 1);

-- 公告
INSERT OR IGNORE INTO announcements (announcement_id, title, content, type, language, priority, target_level, status, publish_at) VALUES 
(1, '2025春节红利活动', '春节期间充值享100%红利！', 3, 'zh-CN', 100, 'ALL', 1, '2025-01-20 00:00:00'),
(2, '系统例行维护通知', '平台将于11月30日04:00-06:00进行系统维护', 1, 'ALL', 90, 'ALL', 1, '2025-11-28 00:00:00'),
(3, 'VIP专属存款优惠', 'VIP会员专享首存加赠20%', 2, 'zh-CN', 80, 'VIP', 1, '2025-11-25 12:00:00'),
(4, '防诈骗安全提醒', '请勿向陌生人透露您的账户信息', 1, 'zh-CN', 70, 'ALL', 1, '2025-10-01 00:00:00');

-- 操作日志
INSERT OR IGNORE INTO audit_logs (log_id, admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address, created_at) VALUES 
(1, 1, 'admin', 'LOGIN', 'admin_users', '1', '登录成功', '192.168.1.100', '2025-11-22 08:00:00'),
(2, 2, 'finance', 'APPROVE', 'transactions', 'D2025112201', '审核通过', '192.168.1.101', '2025-11-22 09:35:00'),
(3, 3, 'risk01', 'HANDLE', 'risk_alerts', '3', '标记为已处理', '192.168.1.102', '2025-11-22 11:35:00'),
(4, 1, 'admin', 'UPDATE', 'commission_schemes', '2', '修改VIP返水比例', '192.168.1.100', '2025-11-22 10:00:00');
