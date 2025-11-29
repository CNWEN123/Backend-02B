-- 报表查询与导出权限 V2.1.14
-- 为所有报表页面增加时间查询和导出权限

-- 新增报表相关细分权限
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
-- 仪表盘数据查询导出
(104, 'dashboard:query', '数据时间查询', 'dashboard', '仪表盘'),
(105, 'dashboard:export', '数据导出', 'dashboard', '仪表盘'),

-- 结算报表
(706, 'report:settlement:view', '查看结算报表', 'report_settlement', '结算报表'),
(707, 'report:settlement:query', '结算报表查询', 'report_settlement', '结算报表'),
(708, 'report:settlement:export', '结算报表导出', 'report_settlement', '结算报表'),

-- 盈亏排行
(709, 'report:ranking:view', '查看盈亏排行', 'report_ranking', '盈亏排行'),
(710, 'report:ranking:query', '盈亏排行查询', 'report_ranking', '盈亏排行'),
(711, 'report:ranking:export', '盈亏排行导出', 'report_ranking', '盈亏排行'),

-- 游戏报表
(712, 'report:game:view', '查看游戏报表', 'report_game', '游戏报表'),
(713, 'report:game:query', '游戏报表查询', 'report_game', '游戏报表'),
(714, 'report:game:export', '游戏报表导出', 'report_game', '游戏报表'),

-- 盈亏日报
(715, 'report:daily:view', '查看盈亏日报', 'report_daily', '盈亏日报'),
(716, 'report:daily:query', '盈亏日报查询', 'report_daily', '盈亏日报'),
(717, 'report:daily:export', '盈亏日报导出', 'report_daily', '盈亏日报'),

-- 代理业绩
(718, 'report:agent:view', '查看代理业绩', 'report_agent', '代理业绩'),
(719, 'report:agent:query', '代理业绩查询', 'report_agent', '代理业绩'),
(720, 'report:agent:export', '代理业绩导出', 'report_agent', '代理业绩'),

-- 玩家统计
(210, 'player:stats:view', '查看玩家统计', 'player_stats', '玩家统计'),
(218, 'player:stats:query', '玩家统计查询', 'player_stats', '玩家统计'),
(219, 'player:stats:export', '玩家统计导出', 'player_stats', '玩家统计');

-- 删除旧的简单报表权限
DELETE FROM permissions WHERE permission_id IN (701, 702, 703, 704, 705);

-- 更新超级管理员角色权限(添加新权限)
UPDATE admin_roles SET permissions = permissions || ',104,105,210,218,219,706,707,708,709,710,711,712,713,714,715,716,717,718,719,720' WHERE role_id = 1;

-- 更新财务主管角色权限(添加报表查询导出)
UPDATE admin_roles SET permissions = permissions || ',706,707,708,715,716,717' WHERE role_id = 2;
