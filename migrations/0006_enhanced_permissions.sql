-- 增强权限表 V2.1.13
-- 细化到每个大功能栏目下的小功能权限

-- 删除旧权限数据
DELETE FROM permissions;

-- 重置自增ID
DELETE FROM sqlite_sequence WHERE name='permissions';

-- ==================== 一级菜单权限 (大功能模块) ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(1, 'menu:dashboard', '仪表盘', 'menu', '一级菜单'),
(2, 'menu:hierarchy', '层级管理', 'menu', '一级菜单'),
(3, 'menu:finance', '财务管理', 'menu', '一级菜单'),
(4, 'menu:bet', '注单管理', 'menu', '一级菜单'),
(5, 'menu:commission', '洗码管理', 'menu', '一级菜单'),
(6, 'menu:risk', '风控管理', 'menu', '一级菜单'),
(7, 'menu:report', '报表中心', 'menu', '一级菜单'),
(8, 'menu:content', '内容管理', 'menu', '一级菜单'),
(9, 'menu:system', '系统控制', 'menu', '一级菜单'),
(10, 'menu:studio', '现场运营', 'menu', '一级菜单');

-- ==================== 仪表盘细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(101, 'dashboard:view', '查看仪表盘', 'dashboard', '仪表盘-基本'),
(102, 'dashboard:stats', '查看统计数据', 'dashboard', '仪表盘-统计'),
(103, 'dashboard:realtime', '查看实时数据', 'dashboard', '仪表盘-实时');

-- ==================== 层级管理-玩家管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(201, 'player:list', '查看玩家列表', 'player', '玩家管理'),
(202, 'player:detail', '查看玩家详情', 'player', '玩家管理'),
(203, 'player:create', '新增玩家', 'player', '玩家管理'),
(204, 'player:edit', '编辑玩家', 'player', '玩家管理'),
(205, 'player:freeze', '冻结/解冻玩家', 'player', '玩家管理'),
(206, 'player:kick', '踢线玩家', 'player', '玩家管理'),
(207, 'player:transfer', '转移玩家', 'player', '玩家管理'),
(208, 'player:balance', '查看玩家余额', 'player', '玩家管理'),
(209, 'player:bet_history', '查看投注历史', 'player', '玩家管理');

-- ==================== 层级管理-代理管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(211, 'agent:list', '查看代理列表', 'agent', '代理管理'),
(212, 'agent:detail', '查看代理详情', 'agent', '代理管理'),
(213, 'agent:create', '新增代理', 'agent', '代理管理'),
(214, 'agent:edit', '编辑代理', 'agent', '代理管理'),
(215, 'agent:delete', '删除代理', 'agent', '代理管理'),
(216, 'agent:settlement', '代理结算', 'agent', '代理管理'),
(217, 'agent:report', '代理报表', 'agent', '代理管理');

-- ==================== 财务管理-交易记录细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(301, 'finance:transaction:list', '查看交易记录', 'finance_transaction', '交易记录'),
(302, 'finance:transaction:detail', '查看交易详情', 'finance_transaction', '交易记录'),
(303, 'finance:transaction:export', '导出交易记录', 'finance_transaction', '交易记录');

-- ==================== 财务管理-存款管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(311, 'finance:deposit:list', '查看存款列表', 'finance_deposit', '存款管理'),
(312, 'finance:deposit:audit', '审核存款申请', 'finance_deposit', '存款管理'),
(313, 'finance:deposit:manual', '人工存款', 'finance_deposit', '存款管理'),
(314, 'finance:deposit:supplement', '存款补单', 'finance_deposit', '存款管理');

-- ==================== 财务管理-取款管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(321, 'finance:withdraw:list', '查看取款列表', 'finance_withdraw', '取款管理'),
(322, 'finance:withdraw:audit', '审核取款申请', 'finance_withdraw', '取款管理'),
(323, 'finance:withdraw:manual', '人工取款', 'finance_withdraw', '取款管理');

-- ==================== 财务管理-流水稽核细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(331, 'finance:turnover:list', '查看稽核规则', 'finance_turnover', '流水稽核'),
(332, 'finance:turnover:create', '新增稽核规则', 'finance_turnover', '流水稽核'),
(333, 'finance:turnover:edit', '编辑稽核规则', 'finance_turnover', '流水稽核'),
(334, 'finance:turnover:delete', '删除稽核规则', 'finance_turnover', '流水稽核'),
(335, 'finance:turnover:audit', '玩家流水稽核', 'finance_turnover', '流水稽核');

-- ==================== 注单管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(401, 'bet:list', '查看注单列表', 'bet', '注单管理'),
(402, 'bet:detail', '查看注单详情', 'bet', '注单管理'),
(403, 'bet:void', '废除注单', 'bet', '注单管理'),
(404, 'bet:realtime', '实时注单监控', 'bet', '注单管理'),
(405, 'bet:export', '导出注单', 'bet', '注单管理');

-- ==================== 洗码管理-洗码方案细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(501, 'commission:scheme:list', '查看方案列表', 'commission_scheme', '洗码方案'),
(502, 'commission:scheme:create', '新增洗码方案', 'commission_scheme', '洗码方案'),
(503, 'commission:scheme:edit', '编辑洗码方案', 'commission_scheme', '洗码方案'),
(504, 'commission:scheme:delete', '删除洗码方案', 'commission_scheme', '洗码方案'),
(505, 'commission:scheme:bind', '绑定洗码方案', 'commission_scheme', '洗码方案');

-- ==================== 洗码管理-洗码记录细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(511, 'commission:record:list', '查看洗码记录', 'commission_record', '洗码记录'),
(512, 'commission:record:audit', '审核洗码', 'commission_record', '洗码记录'),
(513, 'commission:record:export', '导出洗码记录', 'commission_record', '洗码记录');

-- ==================== 风控管理-风控规则细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(601, 'risk:rule:list', '查看规则列表', 'risk_rule', '风控规则'),
(602, 'risk:rule:create', '新增风控规则', 'risk_rule', '风控规则'),
(603, 'risk:rule:edit', '编辑风控规则', 'risk_rule', '风控规则'),
(604, 'risk:rule:delete', '删除风控规则', 'risk_rule', '风控规则');

-- ==================== 风控管理-风控告警细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(611, 'risk:alert:list', '查看告警列表', 'risk_alert', '风控告警'),
(612, 'risk:alert:handle', '处理告警', 'risk_alert', '风控告警');

-- ==================== 风控管理-限红设置细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(621, 'risk:limit:list', '查看限红组', 'risk_limit', '限红设置'),
(622, 'risk:limit:create', '新增限红组', 'risk_limit', '限红设置'),
(623, 'risk:limit:edit', '编辑限红组', 'risk_limit', '限红设置'),
(624, 'risk:limit:delete', '删除限红组', 'risk_limit', '限红设置');

-- ==================== 报表中心细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(701, 'report:game', '游戏报表', 'report', '报表中心'),
(702, 'report:player', '玩家报表', 'report', '报表中心'),
(703, 'report:agent', '代理报表', 'report', '报表中心'),
(704, 'report:finance', '财务报表', 'report', '报表中心'),
(705, 'report:export', '导出报表', 'report', '报表中心');

-- ==================== 内容管理-公告管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(801, 'content:announcement:list', '查看公告', 'content_announcement', '公告管理'),
(802, 'content:announcement:create', '发布公告', 'content_announcement', '公告管理'),
(803, 'content:announcement:edit', '编辑公告', 'content_announcement', '公告管理'),
(804, 'content:announcement:delete', '删除公告', 'content_announcement', '公告管理');

-- ==================== 系统控制-账号管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(901, 'system:admin:list', '查看管理员列表', 'system_admin', '账号管理'),
(902, 'system:admin:create', '新增管理员', 'system_admin', '账号管理'),
(903, 'system:admin:edit', '编辑管理员', 'system_admin', '账号管理'),
(904, 'system:admin:delete', '删除管理员', 'system_admin', '账号管理'),
(905, 'system:admin:password', '重置密码', 'system_admin', '账号管理'),
(906, 'system:admin:ip', '设置IP白名单', 'system_admin', '账号管理');

-- ==================== 系统控制-角色权限细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(911, 'system:role:list', '查看角色列表', 'system_role', '角色权限'),
(912, 'system:role:create', '新增角色', 'system_role', '角色权限'),
(913, 'system:role:edit', '编辑角色', 'system_role', '角色权限'),
(914, 'system:role:delete', '删除角色', 'system_role', '角色权限'),
(915, 'system:role:permission', '分配权限', 'system_role', '角色权限');

-- ==================== 系统控制-2FA设置细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(921, 'system:2fa:view', '查看2FA状态', 'system_2fa', '2FA设置'),
(922, 'system:2fa:setup', '设置2FA', 'system_2fa', '2FA设置'),
(923, 'system:2fa:disable', '禁用2FA', 'system_2fa', '2FA设置');

-- ==================== 系统控制-IP白名单细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(931, 'system:whitelist:list', '查看白名单', 'system_whitelist', 'IP白名单'),
(932, 'system:whitelist:create', '添加白名单', 'system_whitelist', 'IP白名单'),
(933, 'system:whitelist:edit', '编辑白名单', 'system_whitelist', 'IP白名单'),
(934, 'system:whitelist:delete', '删除白名单', 'system_whitelist', 'IP白名单');

-- ==================== 系统控制-日志管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(941, 'system:log:operation', '查看操作日志', 'system_log', '日志管理'),
(942, 'system:log:login', '查看登录日志', 'system_log', '日志管理');

-- ==================== 现场运营-荷官管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(1001, 'studio:dealer:list', '查看荷官列表', 'studio_dealer', '荷官管理'),
(1002, 'studio:dealer:create', '新增荷官', 'studio_dealer', '荷官管理'),
(1003, 'studio:dealer:edit', '编辑荷官', 'studio_dealer', '荷官管理'),
(1004, 'studio:dealer:delete', '删除荷官', 'studio_dealer', '荷官管理');

-- ==================== 现场运营-桌台管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(1011, 'studio:table:list', '查看桌台列表', 'studio_table', '桌台管理'),
(1012, 'studio:table:create', '新增桌台', 'studio_table', '桌台管理'),
(1013, 'studio:table:edit', '编辑桌台', 'studio_table', '桌台管理'),
(1014, 'studio:table:delete', '删除桌台', 'studio_table', '桌台管理');

-- ==================== 现场运营-排班管理细分权限 ====================
INSERT INTO permissions (permission_id, permission_code, permission_name, module, description) VALUES
(1021, 'studio:shift:list', '查看排班', 'studio_shift', '排班管理'),
(1022, 'studio:shift:create', '新增排班', 'studio_shift', '排班管理'),
(1023, 'studio:shift:edit', '编辑排班', 'studio_shift', '排班管理'),
(1024, 'studio:shift:delete', '删除排班', 'studio_shift', '排班管理');

-- 更新超级管理员角色权限(所有权限)
UPDATE admin_roles SET permissions = '1,2,3,4,5,6,7,8,9,10,101,102,103,201,202,203,204,205,206,207,208,209,211,212,213,214,215,216,217,301,302,303,311,312,313,314,321,322,323,331,332,333,334,335,401,402,403,404,405,501,502,503,504,505,511,512,513,601,602,603,604,611,612,621,622,623,624,701,702,703,704,705,801,802,803,804,901,902,903,904,905,906,911,912,913,914,915,921,922,923,931,932,933,934,941,942,1001,1002,1003,1004,1011,1012,1013,1014,1021,1022,1023,1024' WHERE role_id = 1;

-- 更新财务主管角色权限
UPDATE admin_roles SET permissions = '1,3,101,102,301,302,303,311,312,313,314,321,322,323,331,335,511,512,513,701,704,705' WHERE role_id = 2;

-- 更新风控专员角色权限
UPDATE admin_roles SET permissions = '1,6,101,102,601,602,603,604,611,612,621,622,623,624,401,402,404' WHERE role_id = 3;
