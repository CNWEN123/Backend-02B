# 真人荷官视讯后台管理系统 V2.1

## 项目概览
- **名称**: Live Dealer Admin System (真人荷官视讯后台管理系统)
- **版本**: V2.1
- **目标**: 为真人荷官视讯平台提供全方位的中央后台控制枢纽
- **技术栈**: Hono + TypeScript + TailwindCSS + Cloudflare D1 + Chart.js

## 在线预览
- **开发环境**: https://3000-i9mzigr2smruxfa8tgrk9-2e77fc33.sandbox.novita.ai
- **登录账号**: admin / 123456
- **验证码**: 输入页面显示的4位验证码
- **版本**: V2.1.10

## 🔒 安全特性 (V2.1.1)

### 认证与授权
- **JWT Token认证**: 使用HMAC-SHA256签名的安全令牌
- **Token有效期**: 8小时自动过期
- **API中间件保护**: 所有敏感API强制认证
- **RBAC权限控制**: 基于角色的访问控制

### 密码安全
- **SHA-256哈希**: 密码使用加密哈希存储
- **二次密码验证**: 敏感操作需要二次密码确认
- **时序安全比较**: 防止时序攻击

### 输入验证
- **参数校验**: 所有用户输入进行严格验证
- **分页限制**: 防止超大分页导致的性能问题
- **ID验证**: 数字ID范围检查
- **SQL注入防护**: LIKE查询参数转义特殊字符

### 前端安全
- **XSS防护**: 用户输入HTML转义
- **属性转义**: 动态属性安全处理
- **类型强制**: 数字参数类型转换

### 审计追踪
- **完整审计日志**: 记录所有敏感操作
- **真实操作员信息**: 日志包含实际执行者
- **IP地址记录**: 追踪操作来源

### CORS安全
- **域名白名单**: 限制跨域请求来源
- **凭证控制**: 严格的credentials策略

## 核心功能模块 (11大模块)

### 1.0 仪表盘 (Dashboard)
- KPI核心指标卡片 (总营收、总玩家、今日存款、今日投注)
- 公司资金池状态实时监控
- 7天游戏营收趋势图表
- 7天活跃玩家趋势图表
- 快捷操作入口

### 2.0 玩家控端 (Player Management)
- 玩家列表查询与筛选
- 玩家在线监控
- 玩家状态管理 (冻结/解冻)
- 玩家详情与流水查询
- 玩家LTV统计分析

### 3.0 层级控端 (Agent & Hierarchy)
- 代理列表管理
- 多级代理树形结构展示 (股东 > 总代 > 代理)
- 佣金模型配置
- 占成比例设置

### 4.0 财务控端 (Finance & Accounting)
- 账户明细全流水查询
- 存款申请审核
- 取款申请审核 (含流水检测)
- 人工调账功能

### 5.0 注单控端 (Betting Records)
- 注单列表查询
- 多游戏类型筛选 (百家乐/龙虎/轮盘/骰宝/牛牛)
- 注单详情与回放

### 6.0 红利与洗码 (Bonus & Commission) ⭐V2.1升级
- 洗码方案配置 (多套方案模板)
- 差异化游戏返水比例
- 洗码记录审核
- 自动/人工发放

### 7.0 风险控端 (Risk Management)
- 实时风控预警监控
- 风险等级分类 (高/中/低)
- 套利监控与处理
- 限红组配置

### 8.0 报表中心 (Reports Center)
- 每日结算报表
- 盈亏排行榜 (盈利榜/亏损榜 TOP 50)
- 多维度数据导出

### 9.0 内容控端 (CMS)
- 公告管理 (跑马灯/弹窗/轮播图)
- 多语言支持
- 定时发布功能

### 10.0 系统控端 (System Settings)
- 管理员账号管理
- RBAC角色权限
- 2FA双因素认证
- 操作日志审计

### 11.0 现场运营控端 (Studio Management) ⭐V2.1新增
- 荷官档案库管理
- 桌台配置管理
- 智能排班系统 (甘特图可视化)

## 数据架构

### 核心数据表
| 表名 | 说明 |
|------|------|
| admin_users | 管理员账号 |
| admin_roles | 角色权限 |
| agents | 代理层级 |
| users | 玩家用户 |
| transactions | 交易流水 |
| bets | 注单记录 |
| commission_schemes | 洗码方案 |
| commission_records | 洗码记录 |
| risk_rules | 风控规则 |
| risk_alerts | 风控预警 |
| dealers | 荷官档案 |
| game_tables | 桌台配置 |
| dealer_shifts | 排班记录 |
| announcements | 公告内容 |
| audit_logs | 操作日志 |

### 存储服务
- **Cloudflare D1**: SQLite关系型数据库，用于所有业务数据存储

## API接口规范

### 认证模块
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/auth/login | POST | 管理员登录 |
| /api/v1/auth/me | GET | 获取当前用户信息 |

### 仪表盘
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/dashboard/stats | GET | 获取核心统计数据 |
| /api/v1/dashboard/trends | GET | 获取7天趋势数据 |

### 玩家管理
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/players | GET | 玩家列表 |
| /api/v1/players/:id | GET | 玩家详情 |
| /api/v1/players/:id/status | PUT | 更新玩家状态 |
| /api/v1/players/online | GET | 在线玩家 |

### 代理管理
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/agents | GET | 代理列表 |
| /api/v1/agents/tree | GET | 代理树形结构 |

### 财务管理
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/finance/transactions | GET | 交易流水 |
| /api/v1/finance/deposits | GET | 待审核存款 |
| /api/v1/finance/withdrawals | GET | 待审核提款 |
| /api/v1/finance/transactions/:id/audit | POST | 审核交易 |

### 注单管理
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/bets | GET | 注单列表 |

### 洗码管理
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/commission/schemes | GET | 洗码方案列表 |
| /api/v1/commission/records | GET | 洗码记录列表 |

### 风控管理
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/risk/alerts | GET | 风控预警列表 |

### 报表中心
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/reports/settlement | GET | 结算报表 |
| /api/v1/reports/ranking | GET | 盈亏排行榜 |

### 现场运营
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/dealers | GET | 荷官列表 |
| /api/v1/tables | GET | 桌台列表 |
| /api/v1/shifts | GET | 排班数据 |

### 系统管理
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/v1/admin/users | GET | 管理员列表 |
| /api/v1/admin/roles | GET | 角色列表 |
| /api/v1/admin/audit-logs | GET | 操作日志 |
| /api/v1/announcements | GET | 公告列表 |

## 用户指南

### 登录系统
1. 访问系统登录页面
2. 输入用户名和密码
3. 输入页面显示的图形验证码
4. 点击"登录"按钮

### 导航说明
- 左侧边栏为主导航菜单，点击展开子菜单
- 顶栏显示当前位置和快捷操作按钮
- 右上角显示当前用户信息和退出按钮

### 权限说明
系统采用RBAC角色权限控制：
- **超级管理员**: 拥有所有权限
- **财务总监**: 财务审核与报表
- **风控专员**: 风险监控与处理
- **客服主管**: 玩家服务
- **运营人员**: 内容与公告管理
- **现场主管**: 荷官与排班管理

## 部署配置

### 开发环境
```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 初始化数据库
npm run db:migrate:local
npm run db:seed

# 启动开发服务器
pm2 start ecosystem.config.cjs
```

### 生产部署 (Cloudflare Pages)
```bash
# 构建并部署
npm run deploy

# 创建生产数据库
npx wrangler d1 create live-dealer-db

# 应用迁移到生产环境
npm run db:migrate:prod
```

## 项目结构
```
webapp/
├── src/
│   └── index.tsx          # Hono主应用 (API + 页面路由)
├── public/
│   └── static/
│       └── app.js         # 前端JavaScript逻辑
├── migrations/
│   └── 0001_initial_schema.sql  # 数据库迁移
├── seed.sql               # 初始化测试数据
├── ecosystem.config.cjs   # PM2配置
├── wrangler.jsonc         # Cloudflare配置
├── package.json
└── README.md
```

## 版本更新日志

### V2.1.10 (当前版本) 🆕
完成10项新增功能设置:
1. ✅ **流水稽核设置** - 完整CRUD (新增/编辑/删除规则)
2. ✅ **风控规则设置** - 完整CRUD (新增/编辑/删除/启用禁用)
3. ✅ **存款申请审批** - 单笔/批量通过/拒绝
4. ✅ **取款申请审批** - 单笔/批量通过/拒绝 + 流水检测
5. ✅ **代理管理** - 新增代理设置 (层级/占成/佣金配置)
6. ✅ **洗码方案配置** - 完整CRUD (各游戏返水比例配置)
7. ✅ **报表查询功能** - 结算报表/游戏报表/代理业绩查询
8. ✅ **角色权限** - 完整CRUD + 权限分配功能
9. ✅ **新增荷官/桌台设置** - 完整CRUD前端功能
10. ✅ **系统控制** - 2FA绑定设置页面

新增API:
- GET /api/v1/dealers/:dealer_id (荷官详情)
- GET /api/v1/tables/:table_id (桌台详情)
- GET /api/v1/commission/schemes/:scheme_id (洗码方案详情)
- GET /api/v1/admin/roles/:role_id (角色详情)

### V2.1.9
- 收款方式管理功能完善
- 安全加固 (输入验证/SQL参数化/XSS防护)
- 12模块API全部通过测试

### V2.1 (基础版本)
- ⭐ 新增: 现场运营控端 (荷官档案、桌台管理、智能排班)
- ⭐ 升级: 洗码系统从"计算"升级为"策略配置"
- 优化: 支持多套洗码方案模板
- 优化: 差异化游戏返水比例配置
- 优化: 自动/人工审核分流机制

### V2.0 (基础版本)
- 10大核心功能模块
- 玩家/代理/财务/注单管理
- 风控预警系统
- 报表中心

## 技术支持

本系统基于以下技术构建：
- **后端框架**: Hono (轻量级高性能)
- **数据库**: Cloudflare D1 (边缘SQLite)
- **前端样式**: TailwindCSS
- **图表库**: Chart.js
- **图标库**: Font Awesome 6
- **运行环境**: Cloudflare Workers (边缘计算)

---
**版本**: V2.1.10  
**更新日期**: 2025-11-29  
**开发团队**: 运营与产品联合团队

## GitHub 仓库
- https://github.com/CNWEN123/Backend-02B
- https://github.com/CNWEN123/Live-dealer-video-backstage-02
