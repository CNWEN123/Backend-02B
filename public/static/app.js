// 真人荷官视讯后台管理系统 V2.1
// 前端交互逻辑

// ==================== 全局变量 ====================
let currentPage = 'dashboard';
let dashboardCharts = {};
const API_BASE = '/api/v1';

// ==================== 安全工具函数 ====================

// XSS防护 - HTML转义
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// 安全的HTML属性转义
function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// 安全的JSON渲染（用于调试等）
function safeJsonDisplay(obj) {
    try {
        return escapeHtml(JSON.stringify(obj, null, 2));
    } catch {
        return '[Object]';
    }
}

// 根据股东加载代理下拉选项
async function loadAgentsByShareholder(prefix) {
    const shareholderId = document.getElementById(prefix + 'Shareholder')?.value || '';
    const agentSelect = document.getElementById(prefix + 'Agent');
    if (!agentSelect) return;
    
    try {
        let url = '/reports/agents-list';
        if (shareholderId) {
            url += `?shareholder_id=${shareholderId}`;
        }
        const res = await apiRequest(url);
        const agents = res.data || [];
        
        agentSelect.innerHTML = '<option value="">全部代理</option>';
        agents.forEach(a => {
            agentSelect.innerHTML += `<option value="${a.agent_id}">${escapeHtml(a.agent_username)} (Lv.${a.level})</option>`;
        });
    } catch (e) {
        console.error('加载代理列表失败:', e);
    }
}

// ==================== 菜单配置 ====================
const menuConfig = [
    { 
        id: 'dashboard', 
        icon: 'fa-tachometer-alt', 
        title: 'DASHBOARD', 
        page: 'dashboard' 
    },
    { 
        id: 'players', 
        icon: 'fa-users', 
        title: '会员管理',
        children: [
            { id: 'players', title: '玩家讯息', page: 'players' },
            { id: 'players-online', title: '玩家在线', page: 'players-online' },
            { id: 'players-stats', title: '玩家统计', page: 'players-stats' }
        ]
    },
    { 
        id: 'agents', 
        icon: 'fa-sitemap', 
        title: '层级管理',
        children: [
            { id: 'agents', title: '代理管理', page: 'agents' },
            { id: 'agents-tree', title: '层级结构', page: 'agents-tree' }
        ]
    },
    { 
        id: 'finance', 
        icon: 'fa-wallet', 
        title: '财务管理',
        children: [
            { id: 'finance-transactions', title: '账户明细', page: 'finance-transactions' },
            { id: 'finance-deposits', title: '存款申请', page: 'finance-deposits' },
            { id: 'finance-withdrawals', title: '取款申请', page: 'finance-withdrawals' },
            { id: 'finance-turnover', title: '流水稽核', page: 'finance-turnover' },
            { id: 'finance-payment-methods', title: '收款方式', page: 'finance-payment-methods' },
            { id: 'finance-bonus', title: '红利派送', page: 'finance-bonus' },
            { id: 'finance-bonus-config', title: '红利配置', page: 'finance-bonus-config', badge: 'NEW' }
        ]
    },
    { 
        id: 'bets', 
        icon: 'fa-list-alt', 
        title: '注单管理',
        children: [
            { id: 'bets', title: '注单列表', page: 'bets' },
            { id: 'bets-realtime', title: '实时注单', page: 'bets-realtime' },
            { id: 'bets-special', title: '特殊注单', page: 'bets-special' }
        ]
    },
    { 
        id: 'commission', 
        icon: 'fa-percentage', 
        title: '洗码管理',
        badge: 'V2.1',
        children: [
            { id: 'commission-schemes', title: '洗码方案', page: 'commission-schemes' },
            { id: 'commission-records', title: '洗码记录', page: 'commission-records' }
        ]
    },
    { 
        id: 'risk', 
        icon: 'fa-shield-alt', 
        title: '风控管理',
        children: [
            { id: 'risk-alerts', title: '风控预警', page: 'risk-alerts' },
            { id: 'risk-rules', title: '风控规则', page: 'risk-rules' },
            { id: 'risk-limit-groups', title: '限红组', page: 'risk-limit-groups' }
        ]
    },
    { 
        id: 'reports', 
        icon: 'fa-chart-bar', 
        title: '报表中心',
        children: [
            { id: 'reports-bets', title: '注单明细', page: 'reports-bets', badge: 'NEW' },
            { id: 'reports-settlement', title: '结算报表', page: 'reports-settlement' },
            { id: 'reports-profit', title: '盈利分成', page: 'reports-profit', badge: 'NEW' },
            { id: 'reports-ranking', title: '盈亏排行', page: 'reports-ranking' },
            { id: 'reports-game', title: '游戏报表', page: 'reports-game' },
            { id: 'reports-daily', title: '盈亏日报', page: 'reports-daily' },
            { id: 'reports-agent', title: '代理业绩', page: 'reports-agent' },
            { id: 'reports-transfer', title: '转账记录', page: 'reports-transfer' }
        ]
    },
    { 
        id: 'cms', 
        icon: 'fa-bullhorn', 
        title: '内容管理', 
        page: 'announcements' 
    },
    { 
        id: 'system', 
        icon: 'fa-cogs', 
        title: '系统控制',
        children: [
            { id: 'system-admins', title: '账号管理', page: 'system-admins' },
            { id: 'system-roles', title: '角色权限', page: 'system-roles' },
            { id: 'system-2fa', title: '2FA设置', page: 'system-2fa' },
            { id: 'system-ip-whitelist', title: 'IP白名单', page: 'system-ip-whitelist', badge: 'NEW' },
            { id: 'system-logs', title: '操作日志', page: 'system-logs' },
            { id: 'system-login-logs', title: '登录日志', page: 'system-login-logs' }
        ]
    },
    { 
        id: 'studio', 
        icon: 'fa-video', 
        title: '现场运营',
        badge: 'NEW',
        children: [
            { id: 'studio-dealers', title: '荷官档案', page: 'studio-dealers' },
            { id: 'studio-tables', title: '桌台管理', page: 'studio-tables' },
            { id: 'studio-shifts', title: '智能排班', page: 'studio-shifts' }
        ]
    }
];

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderSidebarMenu();
    initNavigation();
    loadPage('dashboard');
    loadNotificationBadges();
});

// 渲染侧边栏菜单
function renderSidebarMenu() {
    const nav = document.getElementById('sidebarNav');
    if (!nav) return;
    
    let html = '';
    menuConfig.forEach(item => {
        if (item.children) {
            html += `
                <div class="sidebar-menu-item">
                    <a href="javascript:void(0)" onclick="toggleSubmenu(this)">
                        <i class="fas ${item.icon}"></i>
                        <span class="sidebar-text">${item.title}</span>
                        ${item.badge ? `<span class="badge badge-${item.badge === 'NEW' ? 'success' : 'info'} ml-2 text-xs">${item.badge}</span>` : ''}
                        <i class="fas fa-chevron-down sidebar-arrow ml-auto"></i>
                    </a>
                    <div class="submenu">
                        ${item.children.map(child => `
                            <a href="#${child.page}" data-page="${child.page}">${child.title}</a>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="sidebar-menu-item" data-menu="${item.id}">
                    <a href="#${item.page}" data-page="${item.page}">
                        <i class="fas ${item.icon}"></i>
                        <span class="sidebar-text">${item.title}</span>
                    </a>
                </div>
            `;
        }
    });
    
    nav.innerHTML = html;
}

// 加载通知徽章
async function loadNotificationBadges() {
    try {
        const stats = await apiRequest('/dashboard/stats');
        if (stats.success && stats.data) {
            const { pendingDeposit, pendingWithdraw, pendingAlerts } = stats.data;
            
            if (pendingDeposit > 0) {
                const badge = document.getElementById('depositBadge');
                if (badge) {
                    badge.textContent = pendingDeposit;
                    badge.classList.remove('hidden');
                }
            }
            if (pendingWithdraw > 0) {
                const badge = document.getElementById('withdrawBadge');
                if (badge) {
                    badge.textContent = pendingWithdraw;
                    badge.classList.remove('hidden');
                }
            }
            if (pendingAlerts > 0) {
                const badge = document.getElementById('alertBadge');
                if (badge) {
                    badge.textContent = pendingAlerts;
                    badge.classList.remove('hidden');
                }
            }
        }
    } catch (e) {
        console.log('Failed to load notification badges');
    }
}

// 检查认证
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('currentUser').textContent = user.nickname || user.username || 'Admin';
}

// 退出登录
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// ==================== 导航功能 ====================
function initNavigation() {
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            loadPage(page);
            
            // 更新活跃状态
            document.querySelectorAll('.sidebar-menu-item').forEach(item => {
                item.classList.remove('active');
            });
            link.closest('.sidebar-menu-item')?.classList.add('active');
        });
    });
}

function toggleSubmenu(element) {
    const submenu = element.nextElementSibling;
    const arrow = element.querySelector('.fa-chevron-down');
    
    submenu.classList.toggle('open');
    arrow?.classList.toggle('rotate-180');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

// ==================== 页面加载器 ====================
function loadPage(page) {
    currentPage = page;
    const content = document.getElementById('pageContent');
    const breadcrumb = document.getElementById('breadcrumb');
    
    // 显示加载动画
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    // 页面映射
    const pageHandlers = {
        'dashboard': { title: 'DASHBOARD', handler: renderDashboard },
        'players': { title: '玩家讯息', handler: renderPlayers },
        'players-online': { title: '玩家在线', handler: renderPlayersOnline },
        'players-stats': { title: '玩家统计', handler: renderPlayerStats },
        'agents': { title: '代理管理', handler: renderAgents },
        'agents-tree': { title: '层级结构', handler: renderAgentsTree },
        'finance-transactions': { title: '账户明细', handler: renderTransactions },
        'finance-deposits': { title: '存款申请', handler: renderDeposits },
        'finance-withdrawals': { title: '取款申请', handler: renderWithdrawals },
        'finance-turnover': { title: '流水稽核', handler: renderTurnoverRules },
        'finance-payment-methods': { title: '收款方式', handler: renderPaymentMethods },
        'finance-bonus': { title: '红利派送', handler: renderBonusRecords },
        'finance-bonus-config': { title: '红利配置', handler: renderBonusConfigs },
        'bets': { title: '注单列表', handler: renderBets },
        'bets-realtime': { title: '实时注单', handler: renderRealtimeBets },
        'bets-special': { title: '特殊注单', handler: renderSpecialBets },
        'commission-schemes': { title: '洗码方案', handler: renderCommissionSchemes },
        'commission-records': { title: '洗码记录', handler: renderCommissionRecords },
        'risk-alerts': { title: '风控预警', handler: renderRiskAlerts },
        'risk-rules': { title: '风控规则', handler: renderRiskRules },
        'risk-limit-groups': { title: '限红组', handler: renderLimitGroups },
        'reports-bets': { title: '注单明细', handler: renderBetDetails },
        'reports-settlement': { title: '结算报表', handler: renderSettlementReport },
        'reports-profit': { title: '盈利分成', handler: renderProfitSharing },
        'reports-ranking': { title: '盈亏排行', handler: renderRanking },
        'reports-game': { title: '游戏报表', handler: renderGameReport },
        'reports-daily': { title: '盈亏日报', handler: renderDailyReport },
        'reports-agent': { title: '代理业绩', handler: renderAgentPerformance },
        'reports-transfer': { title: '转账记录', handler: renderTransferRecords },
        'announcements': { title: '公告管理', handler: renderAnnouncements },
        'system-admins': { title: '账号管理', handler: renderAdmins },
        'system-roles': { title: '角色权限', handler: renderRolesEnhanced },
        'system-2fa': { title: '2FA设置', handler: render2FASettings },
        'system-ip-whitelist': { title: 'IP白名单', handler: renderIPWhitelist },
        'system-logs': { title: '操作日志', handler: renderAuditLogs },
        'system-login-logs': { title: '登录日志', handler: renderLoginLogs },
        'studio-dealers': { title: '荷官档案', handler: renderDealers },
        'studio-tables': { title: '桌台管理', handler: renderTables },
        'studio-shifts': { title: '智能排班', handler: renderShifts }
    };
    
    const pageInfo = pageHandlers[page] || pageHandlers['dashboard'];
    breadcrumb.textContent = pageInfo.title;
    
    setTimeout(() => pageInfo.handler(), 100);
}

// ==================== API 请求封装 ====================
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || '请求失败');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ==================== 仪表盘 ====================
async function renderDashboard() {
    const content = document.getElementById('pageContent');
    const { startDate, endDate } = getDefaultDateRange();
    
    try {
        const [statsRes, trendsRes] = await Promise.all([
            apiRequest('/dashboard/stats'),
            apiRequest('/dashboard/trends')
        ]);
        
        const stats = statsRes.data;
        const trends = trendsRes.data;
        currentReportData.dashboard = { stats, trends };
        
        content.innerHTML = `
            <!-- 时间查询区域 -->
            <div class="card mb-6">
                <div class="card-header flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    <h3 class="text-lg font-semibold"><i class="fas fa-tachometer-alt mr-2"></i>综合数据仪表盘</h3>
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="flex items-center gap-2">
                            <label class="text-sm opacity-80">开始:</label>
                            <input type="date" id="DashboardStartDate" value="${startDate}" class="form-input text-sm py-1 text-gray-800">
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-sm opacity-80">结束:</label>
                            <input type="date" id="DashboardEndDate" value="${endDate}" class="form-input text-sm py-1 text-gray-800">
                        </div>
                        <button onclick="queryDashboardHistory()" class="btn bg-white text-blue-600 text-sm py-1 hover:bg-blue-50"><i class="fas fa-search mr-1"></i>查询历史</button>
                        <button onclick="exportDashboard()" class="btn bg-green-500 text-white text-sm py-1 hover:bg-green-600"><i class="fas fa-file-excel mr-1"></i>导出数据</button>
                    </div>
                </div>
            </div>
            
            <!-- 核心指标卡片 -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <!-- 总营收 -->
                <div class="stat-card">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-gray-500">总营收</span>
                        <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-dollar-sign text-red-500"></i>
                        </div>
                    </div>
                    <div class="value ${stats.todayProfit >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${stats.todayProfit >= 0 ? '+' : ''}${formatMoney(stats.todayProfit)}
                    </div>
                    <div class="flex items-center mt-2 text-sm">
                        <i class="fas fa-arrow-${stats.todayProfit >= 0 ? 'up trend-up' : 'down trend-down'} mr-1"></i>
                        <span class="${stats.todayProfit >= 0 ? 'text-green-500' : 'text-red-500'}">今日盈亏</span>
                    </div>
                </div>
                
                <!-- 总玩家 -->
                <div class="stat-card">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-gray-500">总玩家</span>
                        <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-users text-orange-500"></i>
                        </div>
                    </div>
                    <div class="value text-gray-800">${stats.totalPlayers}</div>
                    <div class="flex items-center mt-2 text-sm">
                        <i class="fas fa-arrow-up trend-up mr-1"></i>
                        <span class="text-green-500">活跃会员</span>
                    </div>
                </div>
                
                <!-- 今日存款 -->
                <div class="stat-card">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-gray-500">今日存款</span>
                        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-arrow-down text-green-500"></i>
                        </div>
                    </div>
                    <div class="value text-green-600">${formatMoney(stats.todayDeposit)}</div>
                    <div class="flex items-center mt-2 text-sm text-gray-500">
                        <i class="fas fa-clock mr-1"></i>
                        实时更新
                    </div>
                </div>
                
                <!-- 今日投注 -->
                <div class="stat-card">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-gray-500">今日投注</span>
                        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-coins text-blue-500"></i>
                        </div>
                    </div>
                    <div class="value text-blue-600">${formatMoney(stats.todayBet)}</div>
                    <div class="flex items-center mt-2 text-sm text-gray-500">
                        总单量: ${stats.todayBetCount}
                    </div>
                </div>
            </div>
            
            <!-- 第二行指标 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <!-- 公司资金池 -->
                <div class="stat-card bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    <div class="flex items-center justify-between mb-2">
                        <span class="opacity-80">公司资金池</span>
                        <i class="fas fa-landmark"></i>
                    </div>
                    <div class="text-3xl font-bold">¥ ${formatNumber(stats.totalBalance)}</div>
                    <div class="mt-2 text-sm opacity-80">实时余额</div>
                </div>
                
                <!-- 待审核提款 -->
                <div class="stat-card">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-gray-500">今日提款</span>
                        <span class="badge badge-warning">${stats.pendingWithdraw} 待审核</span>
                    </div>
                    <div class="value text-orange-500">${formatMoney(stats.todayWithdraw)}</div>
                </div>
                
                <!-- 风控预警 -->
                <div class="stat-card">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-gray-500">风控预警</span>
                        <span class="badge badge-danger">${stats.pendingAlerts} 待处理</span>
                    </div>
                    <div class="value text-red-500">${stats.pendingAlerts}</div>
                    <a href="#risk-alerts" data-page="risk-alerts" onclick="loadPage('risk-alerts')" class="text-sm text-blue-500 hover:underline">查看详情 →</a>
                </div>
            </div>
            
            <!-- 图表区域 -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- 游戏营收趋势 -->
                <div class="card">
                    <div class="card-header flex items-center justify-between">
                        <span>游戏营收趋势 (7天)</span>
                        <i class="fas fa-download text-gray-400 cursor-pointer"></i>
                    </div>
                    <div class="card-body">
                        <canvas id="revenueChart" height="250"></canvas>
                    </div>
                </div>
                
                <!-- 活跃玩家趋势 -->
                <div class="card">
                    <div class="card-header flex items-center justify-between">
                        <span>活跃玩家趋势 (7天)</span>
                        <div class="flex items-center space-x-4 text-sm">
                            <span class="flex items-center"><span class="w-3 h-3 bg-red-400 rounded-full mr-1"></span>新增玩家</span>
                            <span class="flex items-center"><span class="w-3 h-3 bg-blue-400 rounded-full mr-1"></span>投注玩家</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <canvas id="playersChart" height="250"></canvas>
                    </div>
                </div>
            </div>
            
            <!-- 快捷操作 -->
            <div class="card">
                <div class="card-header">快捷操作</div>
                <div class="card-body">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button onclick="showManualAdjustment('deposit')" class="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center transition">
                            <i class="fas fa-plus-circle text-green-500 text-2xl mb-2"></i>
                            <p class="text-sm font-medium">人工存款</p>
                        </button>
                        <button onclick="showManualAdjustment('withdraw')" class="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-center transition">
                            <i class="fas fa-minus-circle text-orange-500 text-2xl mb-2"></i>
                            <p class="text-sm font-medium">人工提款</p>
                        </button>
                        <button onclick="loadPage('announcements')" class="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-center transition">
                            <i class="fas fa-bullhorn text-blue-500 text-2xl mb-2"></i>
                            <p class="text-sm font-medium">发布公告</p>
                        </button>
                        <button onclick="loadPage('risk-alerts')" class="p-4 bg-red-50 hover:bg-red-100 rounded-lg text-center transition">
                            <i class="fas fa-exclamation-triangle text-red-500 text-2xl mb-2"></i>
                            <p class="text-sm font-medium">风控预警</p>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 初始化图表
        initDashboardCharts(trends);
        
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

function initDashboardCharts(trends) {
    // 销毁旧图表
    Object.values(dashboardCharts).forEach(chart => chart?.destroy());
    
    // 营收趋势图
    const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
    if (revenueCtx) {
        const dates = trends.betting?.map(d => d.date?.slice(5) || '') || ['11-18','11-19','11-20','11-21','11-22'];
        const revenues = trends.betting?.map(d => Math.abs(d.total_win_loss) || 0) || [100000, 150000, 80000, 200000, 120000];
        
        dashboardCharts.revenue = new Chart(revenueCtx, {
            type: 'bar',
            data: {
                labels: dates,
                datasets: [{
                    label: '总投注额',
                    data: revenues,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => formatNumber(value)
                        }
                    }
                }
            }
        });
    }
    
    // 玩家趋势图
    const playersCtx = document.getElementById('playersChart')?.getContext('2d');
    if (playersCtx) {
        const dates = trends.newPlayers?.map(d => d.date?.slice(5) || '') || ['11-18','11-19','11-20','11-21','11-22'];
        const newPlayers = trends.newPlayers?.map(d => d.count || 0) || [5, 3, 4, 6, 2];
        const activePlayers = trends.betting?.map(d => d.active_players || 0) || [20, 25, 18, 30, 22];
        
        dashboardCharts.players = new Chart(playersCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: '新增玩家',
                    data: newPlayers,
                    borderColor: 'rgba(239, 68, 68, 1)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }, {
                    label: '投注玩家',
                    data: activePlayers,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
}

// 仪表盘历史数据查询
async function queryDashboardHistory() {
    const startDate = document.getElementById('DashboardStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('DashboardEndDate')?.value || getDefaultDateRange().endDate;
    
    try {
        const res = await apiRequest(`/dashboard/history?start_date=${startDate}&end_date=${endDate}`);
        const data = res.data || {};
        currentReportData.dashboardHistory = data;
        
        // 显示历史数据统计弹窗
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.id = 'dashboardHistoryModal';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto m-4">
                <div class="card-header flex items-center justify-between sticky top-0 bg-white z-10">
                    <span><i class="fas fa-history mr-2 text-blue-500"></i>历史数据查询 (${startDate} ~ ${endDate})</span>
                    <button onclick="document.getElementById('dashboardHistoryModal').remove()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="p-6">
                    <!-- 汇总统计 -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div class="bg-green-50 rounded-lg p-4 text-center">
                            <div class="text-sm text-gray-600">总存款</div>
                            <div class="text-xl font-bold text-green-600">${formatMoney(data.total_deposit || 0)}</div>
                        </div>
                        <div class="bg-orange-50 rounded-lg p-4 text-center">
                            <div class="text-sm text-gray-600">总提款</div>
                            <div class="text-xl font-bold text-orange-600">${formatMoney(data.total_withdraw || 0)}</div>
                        </div>
                        <div class="bg-blue-50 rounded-lg p-4 text-center">
                            <div class="text-sm text-gray-600">总投注</div>
                            <div class="text-xl font-bold text-blue-600">${formatMoney(data.total_bet || 0)}</div>
                        </div>
                        <div class="bg-${(data.company_profit || 0) >= 0 ? 'green' : 'red'}-50 rounded-lg p-4 text-center">
                            <div class="text-sm text-gray-600">公司盈利</div>
                            <div class="text-xl font-bold text-${(data.company_profit || 0) >= 0 ? 'green' : 'red'}-600">${formatMoney(data.company_profit || 0)}</div>
                        </div>
                    </div>
                    
                    <!-- 详细数据表格 -->
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>日期</th>
                                    <th>存款</th>
                                    <th>提款</th>
                                    <th>投注额</th>
                                    <th>有效投注</th>
                                    <th>玩家输赢</th>
                                    <th>公司盈利</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(data.daily_data || []).length === 0 ? '<tr><td colspan="7" class="text-center text-gray-500 py-4">暂无数据</td></tr>' :
                                (data.daily_data || []).map(d => `
                                    <tr>
                                        <td>${d.date}</td>
                                        <td class="text-green-600">${formatMoney(d.deposit)}</td>
                                        <td class="text-orange-600">${formatMoney(d.withdraw)}</td>
                                        <td>${formatMoney(d.total_bet)}</td>
                                        <td>${formatMoney(d.valid_bet)}</td>
                                        <td class="${parseFloat(d.player_win_loss) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(d.player_win_loss)}</td>
                                        <td class="${parseFloat(d.company_profit) >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">${formatMoney(d.company_profit)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="mt-4 flex justify-end">
                        <button onclick="exportDashboardHistory()" class="btn btn-success"><i class="fas fa-file-excel mr-1"></i>导出此数据</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
    } catch (error) {
        alert('查询失败: ' + error.message);
    }
}

// 仪表盘数据导出
function exportDashboard() {
    const data = currentReportData.dashboard || {};
    const stats = data.stats || {};
    const exportData = [{
        date: new Date().toISOString().split('T')[0],
        today_profit: stats.todayProfit || 0,
        total_players: stats.totalPlayers || 0,
        today_deposit: stats.todayDeposit || 0,
        today_withdraw: stats.todayWithdraw || 0,
        today_bet: stats.todayBet || 0,
        today_bet_count: stats.todayBetCount || 0,
        total_balance: stats.totalBalance || 0,
        pending_withdraw: stats.pendingWithdraw || 0,
        pending_alerts: stats.pendingAlerts || 0
    }];
    
    exportToExcel(exportData, [
        { key: 'date', label: '日期' },
        { key: 'today_profit', label: '今日盈亏' },
        { key: 'total_players', label: '总玩家数' },
        { key: 'today_deposit', label: '今日存款' },
        { key: 'today_withdraw', label: '今日提款' },
        { key: 'today_bet', label: '今日投注' },
        { key: 'today_bet_count', label: '今日单量' },
        { key: 'total_balance', label: '资金池余额' },
        { key: 'pending_withdraw', label: '待审核提款数' },
        { key: 'pending_alerts', label: '待处理预警数' }
    ], '仪表盘数据');
}

// 导出仪表盘历史数据
function exportDashboardHistory() {
    const data = currentReportData.dashboardHistory || {};
    const exportData = data.daily_data || [];
    
    if (exportData.length === 0) {
        alert('暂无数据可导出');
        return;
    }
    
    exportToExcel(exportData, [
        { key: 'date', label: '日期' },
        { key: 'deposit', label: '存款' },
        { key: 'withdraw', label: '提款' },
        { key: 'total_bet', label: '投注额' },
        { key: 'valid_bet', label: '有效投注' },
        { key: 'player_win_loss', label: '玩家输赢' },
        { key: 'company_profit', label: '公司盈利' }
    ], '仪表盘历史数据');
}

// ==================== 玩家管理 ====================
async function renderPlayers() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/players');
        const { list, total, page, size } = res.data;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>玩家列表</span>
                    <div class="flex items-center space-x-2">
                        <button class="btn btn-success text-sm">
                            <i class="fas fa-file-excel mr-1"></i>导出Excel
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- 搜索栏 -->
                    <div class="flex flex-wrap gap-4 mb-4">
                        <input type="text" id="searchUsername" placeholder="账号" class="px-3 py-2 border rounded-lg w-40">
                        <select id="searchStatus" class="px-3 py-2 border rounded-lg">
                            <option value="">全部状态</option>
                            <option value="1">正常</option>
                            <option value="0">冻结</option>
                            <option value="2">锁定</option>
                        </select>
                        <button onclick="searchPlayers()" class="btn btn-primary">
                            <i class="fas fa-search mr-1"></i>查询
                        </button>
                    </div>
                    
                    <!-- 数据表格 -->
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>用户ID</th>
                                    <th>账号</th>
                                    <th>昵称</th>
                                    <th>余额</th>
                                    <th>所属代理</th>
                                    <th>VIP等级</th>
                                    <th>状态</th>
                                    <th>注册时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(player => `
                                    <tr>
                                        <td>${escapeHtml(player.user_id)}</td>
                                        <td class="font-medium">${escapeHtml(player.username)}</td>
                                        <td>${escapeHtml(player.nickname) || '-'}</td>
                                        <td class="text-green-600 font-medium">¥ ${formatNumber(player.balance)}</td>
                                        <td>${escapeHtml(player.agent_username) || '-'}</td>
                                        <td><span class="badge badge-info">VIP${escapeHtml(player.vip_level)}</span></td>
                                        <td>${getStatusBadge(player.status)}</td>
                                        <td>${formatDate(player.created_at)}</td>
                                        <td>
                                            <div class="flex space-x-2">
                                                <button onclick="viewPlayer(${parseInt(player.user_id) || 0})" class="text-blue-500 hover:text-blue-700" title="详情">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                                <button onclick="togglePlayerStatus(${parseInt(player.user_id) || 0}, ${parseInt(player.status) || 0})" 
                                                        class="${player.status === 1 ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'}" 
                                                        title="${player.status === 1 ? '冻结' : '解冻'}">
                                                    <i class="fas fa-${player.status === 1 ? 'lock' : 'unlock'}"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- 分页 -->
                    <div class="flex items-center justify-between mt-4 text-sm text-gray-500">
                        <span>共 ${total} 条记录</span>
                        <div class="flex items-center space-x-2">
                            <button class="px-3 py-1 border rounded hover:bg-gray-50">上一页</button>
                            <span class="px-3 py-1 bg-blue-500 text-white rounded">${page}</span>
                            <button class="px-3 py-1 border rounded hover:bg-gray-50">下一页</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

async function renderPlayersOnline() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/players/online');
        const list = res.data.list || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>在线玩家 <span class="text-green-500">(${list.length})</span></span>
                    <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500">自动刷新: 60秒</span>
                        <button onclick="renderPlayersOnline()" class="btn btn-outline text-sm">
                            <i class="fas fa-sync-alt mr-1"></i>刷新
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>用户ID</th>
                                    <th>账号</th>
                                    <th>昵称</th>
                                    <th>余额</th>
                                    <th>当前桌台</th>
                                    <th>游戏类型</th>
                                    <th>VIP等级</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(player => `
                                    <tr>
                                        <td>${player.user_id}</td>
                                        <td class="font-medium">${escapeHtml(player.username)}</td>
                                        <td>${escapeHtml(player.nickname) || '-'}</td>
                                        <td class="text-green-600">¥ ${formatNumber(player.balance)}</td>
                                        <td><span class="badge badge-info">${escapeHtml(player.current_table)}</span></td>
                                        <td>${escapeHtml(player.game_type)}</td>
                                        <td><span class="badge badge-warning">VIP${player.vip_level}</span></td>
                                        <td>
                                            <button onclick="kickPlayer(${player.user_id}, '${escapeAttr(player.username)}')" 
                                                    class="btn btn-danger text-xs" title="踢下线">
                                                <i class="fas fa-user-slash mr-1"></i>踢线
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

async function renderPlayerStats() {
    const content = document.getElementById('pageContent');
    const { startDate, endDate } = getDefaultDateRange();
    
    // 加载股东和代理下拉选项
    let shareholderOptions = '<option value="">全部股东</option>';
    let agentOptions = '<option value="">全部代理</option>';
    try {
        const [shareholderRes, agentRes] = await Promise.all([
            apiRequest('/reports/shareholders'),
            apiRequest('/reports/agents-list')
        ]);
        (shareholderRes.data || []).forEach(s => {
            shareholderOptions += `<option value="${s.agent_id}">${escapeHtml(s.agent_username)}</option>`;
        });
        (agentRes.data || []).forEach(a => {
            agentOptions += `<option value="${a.agent_id}">${escapeHtml(a.agent_username)} (Lv.${a.level})</option>`;
        });
    } catch (e) { console.error('加载筛选选项失败:', e); }
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header bg-teal-50">
                <h3 class="text-lg font-semibold text-teal-700"><i class="fas fa-chart-pie mr-2"></i>玩家统计分析</h3>
            </div>
            <!-- 筛选条件 -->
            <div class="p-4 bg-gray-50 border-b">
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">开始日期</label>
                        <input type="date" id="PlayerStatsStartDate" value="${startDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">结束日期</label>
                        <input type="date" id="PlayerStatsEndDate" value="${endDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">玩家账号</label>
                        <input type="text" id="PlayerStatsUsername" placeholder="输入账号" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">股东</label>
                        <select id="PlayerStatsShareholder" class="form-input w-full text-sm" onchange="loadAgentsByShareholder('PlayerStats')">${shareholderOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">代理</label>
                        <select id="PlayerStatsAgent" class="form-input w-full text-sm">${agentOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">VIP等级</label>
                        <select id="PlayerStatsVip" class="form-input w-full text-sm">
                            <option value="">全部</option>
                            ${[0,1,2,3,4,5,6,7,8,9,10].map(v => `<option value="${v}">VIP${v}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="flex justify-end gap-2 mt-3">
                    <button onclick="queryPlayerStats()" class="btn btn-primary text-sm"><i class="fas fa-search mr-1"></i>查询</button>
                    <button onclick="exportPlayerStats()" class="btn bg-green-500 text-white text-sm hover:bg-green-600"><i class="fas fa-file-excel mr-1"></i>导出Excel</button>
                </div>
            </div>
            <div class="p-4" id="playerStatsContent">
                <div class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
            </div>
        </div>
    `;
    
    await queryPlayerStats();
}

async function queryPlayerStats() {
    const startDate = document.getElementById('PlayerStatsStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('PlayerStatsEndDate')?.value || getDefaultDateRange().endDate;
    const container = document.getElementById('playerStatsContent');
    
    try {
        const res = await apiRequest(`/reports/player-stats?start_date=${startDate}&end_date=${endDate}`);
        const data = res.data || {};
        currentReportData.playerStats = data;
        
        const summary = data.summary || { total_players: 0, active_players: 0, new_players: 0, total_bet: 0, total_win_loss: 0, avg_bet: 0 };
        const vipStats = data.vip_distribution || [];
        const topPlayers = data.top_players || [];
        
        container.innerHTML = `
            <!-- 统计汇总卡片 -->
            <div class="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                <div class="bg-teal-50 rounded-lg p-3 text-center">
                    <div class="text-sm text-gray-600">总玩家数</div>
                    <div class="text-xl font-bold text-teal-600">${formatNumber(summary.total_players)}</div>
                </div>
                <div class="bg-blue-50 rounded-lg p-3 text-center">
                    <div class="text-sm text-gray-600">活跃玩家</div>
                    <div class="text-xl font-bold text-blue-600">${formatNumber(summary.active_players)}</div>
                </div>
                <div class="bg-green-50 rounded-lg p-3 text-center">
                    <div class="text-sm text-gray-600">新增玩家</div>
                    <div class="text-xl font-bold text-green-600">${formatNumber(summary.new_players)}</div>
                </div>
                <div class="bg-purple-50 rounded-lg p-3 text-center">
                    <div class="text-sm text-gray-600">总投注额</div>
                    <div class="text-xl font-bold text-purple-600">${formatMoney(summary.total_bet)}</div>
                </div>
                <div class="bg-${summary.total_win_loss >= 0 ? 'green' : 'red'}-50 rounded-lg p-3 text-center">
                    <div class="text-sm text-gray-600">玩家总输赢</div>
                    <div class="text-xl font-bold text-${summary.total_win_loss >= 0 ? 'green' : 'red'}-600">${formatMoney(summary.total_win_loss)}</div>
                </div>
                <div class="bg-orange-50 rounded-lg p-3 text-center">
                    <div class="text-sm text-gray-600">人均投注</div>
                    <div class="text-xl font-bold text-orange-600">${formatMoney(summary.avg_bet)}</div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- VIP等级分布 -->
                <div class="card">
                    <div class="card-header bg-purple-50 text-purple-700">
                        <i class="fas fa-crown mr-2"></i>VIP等级分布
                    </div>
                    <div class="p-4">
                        ${vipStats.length === 0 ? '<div class="text-center text-gray-500 py-4">暂无数据</div>' : `
                        <table class="data-table">
                            <thead><tr><th>VIP等级</th><th>玩家数</th><th>占比</th><th>总投注</th></tr></thead>
                            <tbody>
                                ${vipStats.map(v => `
                                    <tr>
                                        <td><span class="badge badge-info">VIP ${v.vip_level}</span></td>
                                        <td>${formatNumber(v.player_count)}</td>
                                        <td>${v.percentage || 0}%</td>
                                        <td>${formatMoney(v.total_bet)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        `}
                    </div>
                </div>
                
                <!-- 活跃玩家排行 -->
                <div class="card">
                    <div class="card-header bg-green-50 text-green-700">
                        <i class="fas fa-fire mr-2"></i>投注活跃榜 TOP 10
                    </div>
                    <div class="p-4 max-h-[350px] overflow-y-auto">
                        ${topPlayers.length === 0 ? '<div class="text-center text-gray-500 py-4">暂无数据</div>' : 
                        topPlayers.slice(0, 10).map((p, i) => `
                            <div class="flex items-center justify-between p-2 ${i < 3 ? 'bg-green-50' : ''} rounded mb-2">
                                <div class="flex items-center">
                                    <span class="w-7 h-7 ${i < 3 ? 'bg-green-500 text-white' : 'bg-gray-200'} rounded-full flex items-center justify-center text-sm font-bold mr-3">${i + 1}</span>
                                    <div>
                                        <div class="font-medium">${escapeHtml(p.username || '')}</div>
                                        <div class="text-xs text-gray-500">VIP${p.vip_level || 0} | 注单: ${p.bet_count || 0}</div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="font-bold text-green-600">${formatMoney(p.total_bet)}</div>
                                    <div class="text-xs ${parseFloat(p.total_win_loss) >= 0 ? 'text-green-500' : 'text-red-500'}">${formatMoney(p.total_win_loss)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

function exportPlayerStats() {
    const data = currentReportData.playerStats || {};
    const exportData = data.top_players || [];
    
    if (exportData.length === 0) {
        alert('暂无数据可导出');
        return;
    }
    
    exportToExcel(exportData, [
        { key: 'username', label: '玩家账号' },
        { key: 'vip_level', label: 'VIP等级' },
        { key: 'agent_username', label: '所属代理' },
        { key: 'bet_count', label: '注单数' },
        { key: 'total_bet', label: '总投注' },
        { key: 'total_win_loss', label: '输赢' }
    ], '玩家统计');
}

// ==================== 代理管理 ====================
async function renderAgents() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/agents');
        const { list, total } = res.data;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>代理列表</span>
                    <button class="btn btn-primary text-sm">
                        <i class="fas fa-plus mr-1"></i>新增代理
                    </button>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>称</th>
                                    <th>层级</th>
                                    <th>上级</th>
                                    <th>余额</th>
                                    <th>占成</th>
                                    <th>佣金</th>
                                    <th>下级代理</th>
                                    <th>玩家数</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(agent => `
                                    <tr>
                                        <td class="font-medium">${agent.agent_username}</td>
                                        <td>${getLevelBadge(agent.level)}</td>
                                        <td>${agent.parent_username || '-'}</td>
                                        <td class="text-green-600">¥ ${formatNumber(agent.balance)}</td>
                                        <td>${agent.share_ratio}%</td>
                                        <td>${agent.commission_ratio}%</td>
                                        <td>${agent.sub_agent_count || 0}</td>
                                        <td>${agent.player_count || 0}</td>
                                        <td>${getStatusBadge(agent.status)}</td>
                                        <td>
                                            <div class="flex space-x-2">
                                                <button class="text-blue-500 hover:text-blue-700" title="编辑">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                <button class="text-green-500 hover:text-green-700" title="下级">
                                                    <i class="fas fa-users"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

async function renderAgentsTree() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/agents/tree');
        const tree = res.data;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">代理层级结构</div>
                <div class="card-body">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        ${renderTreeNode(tree)}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

function renderTreeNode(nodes, level = 0) {
    if (!nodes || !nodes.length) return '';
    
    return nodes.map(node => `
        <div class="ml-${level * 4} mb-2">
            <div class="flex items-center p-2 bg-white rounded shadow-sm">
                <i class="fas fa-${level === 0 ? 'building' : level === 1 ? 'user-tie' : 'user'} text-${level === 0 ? 'purple' : level === 1 ? 'blue' : 'green'}-500 mr-2"></i>
                <span class="font-medium">${escapeHtml(node.agent_username)}</span>
                <span class="text-gray-400 text-sm ml-2">(${escapeHtml(node.nickname) || '-'})</span>
                ${getLevelBadge(node.level)}
                <span class="text-gray-500 text-sm ml-auto">¥${formatNumber(node.balance)} | ${node.player_count || 0}人</span>
            </div>
            ${node.children?.length ? renderTreeNode(node.children, level + 1) : ''}
        </div>
    `).join('');
}

// ==================== 财务管理 ====================
async function renderTransactions() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/finance/transactions');
        const { list, total } = res.data;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>账户明细</span>
                    <button class="btn btn-success text-sm">
                        <i class="fas fa-file-excel mr-1"></i>导出
                    </button>
                </div>
                <div class="card-body">
                    <!-- 筛选 -->
                    <div class="flex flex-wrap gap-4 mb-4">
                        <input type="date" class="px-3 py-2 border rounded-lg">
                        <input type="date" class="px-3 py-2 border rounded-lg">
                        <select class="px-3 py-2 border rounded-lg">
                            <option value="">全部类型</option>
                            <option value="1">存款</option>
                            <option value="2">取款</option>
                            <option value="3">投注</option>
                            <option value="4">派彩</option>
                            <option value="5">红利</option>
                            <option value="6">洗码</option>
                        </select>
                        <button class="btn btn-primary">查询</button>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>类型</th>
                                    <th>订单号</th>
                                    <th>会员</th>
                                    <th>变化金额</th>
                                    <th>变化前</th>
                                    <th>变化后</th>
                                    <th>状态</th>
                                    <th>时间</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(tx => `
                                    <tr>
                                        <td>${getTransactionTypeBadge(tx.transaction_type)}</td>
                                        <td class="font-mono text-sm">${escapeHtml(tx.order_no)}</td>
                                        <td>${escapeHtml(tx.username)}</td>
                                        <td class="${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                                            ${tx.amount >= 0 ? '+' : ''}${formatNumber(tx.amount)}
                                        </td>
                                        <td>${formatNumber(tx.balance_before)}</td>
                                        <td>${formatNumber(tx.balance_after)}</td>
                                        <td>${getAuditStatusBadge(tx.audit_status)}</td>
                                        <td>${formatDate(tx.created_at)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

async function renderDeposits() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/finance/deposits');
        const list = res.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <span>存款申请 <span class="badge badge-warning">${list.length} 待审核</span></span>
                </div>
                <div class="card-body">
                    ${list.length ? `
                        <div class="overflow-x-auto">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>订单号</th>
                                        <th>会员</th>
                                        <th>金额</th>
                                        <th>状态</th>
                                        <th>申请时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${list.map(d => `
                                        <tr>
                                            <td class="font-mono text-sm">${d.order_no}</td>
                                            <td>${d.username}</td>
                                            <td class="text-green-600 font-medium">+${formatNumber(d.amount)}</td>
                                            <td>${getAuditStatusBadge(d.audit_status)}</td>
                                            <td>${formatDate(d.created_at)}</td>
                                            <td>
                                                <button onclick="auditTransaction(${d.transaction_id}, 'approve')" class="btn btn-success text-xs mr-1">通过</button>
                                                <button onclick="auditTransaction(${d.transaction_id}, 'reject')" class="btn btn-danger text-xs">拒绝</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<div class="text-center text-gray-500 py-10">暂无待审核存款</div>'}
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

async function renderWithdrawals() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/finance/withdrawals');
        const list = res.data || [];
        
        // 统计流水未达标数量
        const failedFlowCount = list.filter(w => !w.flow_check).length;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>
                        <i class="fas fa-money-bill-wave mr-2 text-green-500"></i>取款申请 
                        <span class="badge badge-danger ml-2">${list.length} 待审核</span>
                        ${failedFlowCount > 0 ? `<span class="badge badge-warning ml-1">${failedFlowCount} 流水未达标</span>` : ''}
                    </span>
                    <div class="text-sm text-gray-500">
                        <i class="fas fa-info-circle mr-1"></i>红利派送需完成流水稽核后才能提现
                    </div>
                </div>
                <div class="card-body">
                    ${list.length ? `
                        <div class="overflow-x-auto">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>订单号</th>
                                        <th>会员</th>
                                        <th>金额</th>
                                        <th>流水稽核</th>
                                        <th>状态</th>
                                        <th>申请时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${list.map(w => {
                                        // 构建流水检测详细信息
                                        const flowDetails = [];
                                        if (w.basic_flow_check === false) flowDetails.push('基础流水未达标');
                                        if (w.bonus_flow_check === false) flowDetails.push(`红利流水未达标(${w.pending_bonus_count}笔)`);
                                        const flowTooltip = flowDetails.length ? flowDetails.join(', ') : '全部达标';
                                        
                                        return `
                                            <tr class="${w.flow_check ? '' : 'bg-yellow-50'}">
                                                <td class="font-mono text-sm">${escapeHtml(w.order_no || '')}</td>
                                                <td>
                                                    <div class="font-medium">${escapeHtml(w.username || '')}</div>
                                                    <div class="text-xs text-gray-500">${escapeHtml(w.nickname || '')}</div>
                                                </td>
                                                <td class="text-red-600 font-medium">${formatMoney(w.amount)}</td>
                                                <td>
                                                    ${w.flow_check ? 
                                                        '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>已达标</span>' : 
                                                        `<span class="badge badge-danger cursor-help" title="${flowTooltip}"><i class="fas fa-times mr-1"></i>未达标</span>`
                                                    }
                                                    ${w.pending_bonus_count > 0 ? `
                                                        <div class="text-xs text-orange-600 mt-1">
                                                            <i class="fas fa-gift mr-1"></i>${w.pending_bonus_count}笔红利待完成
                                                            ${w.pending_bonus_turnover > 0 ? `<br>差${formatMoney(w.pending_bonus_turnover)}流水` : ''}
                                                        </div>
                                                    ` : ''}
                                                </td>
                                                <td>${getAuditStatusBadge(w.audit_status)}</td>
                                                <td>${formatDate(w.created_at)}</td>
                                                <td>
                                                    <div class="flex space-x-1">
                                                        <button onclick="viewWithdrawalDetail(${w.transaction_id}, ${w.user_id})" class="btn btn-outline text-xs" title="查看详情">
                                                            <i class="fas fa-eye"></i>
                                                        </button>
                                                        <button onclick="auditTransaction(${w.transaction_id}, 'approve')" class="btn btn-success text-xs" ${w.flow_check ? '' : 'title="警告：流水未达标"'}>
                                                            <i class="fas fa-check mr-1"></i>通过
                                                        </button>
                                                        <button onclick="auditTransaction(${w.transaction_id}, 'reject')" class="btn btn-danger text-xs">
                                                            <i class="fas fa-times mr-1"></i>拒绝
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<div class="text-center text-gray-500 py-10"><i class="fas fa-inbox mr-2 text-4xl block mb-2"></i>暂无待审核提款</div>'}
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

// 查看提款详情（含红利流水状态）
async function viewWithdrawalDetail(transactionId, userId) {
    try {
        // 获取玩家红利流水完成情况
        const bonusRes = await apiRequest(`/bonus/check-turnover/${userId}`);
        const { bonuses, summary } = bonusRes.data || { bonuses: [], summary: {} };
        
        const bonusTypeMap = {
            'first_deposit': '首存红利',
            'deposit_bonus': '存款红利', 
            'activity': '活动红利',
            'rebate': '返水红利',
            'manual': '人工红利'
        };
        
        openModal(`
            <div class="card-header">
                <i class="fas fa-eye mr-2 text-blue-500"></i>提款详情 - 流水稽核状态
            </div>
            <div class="p-6">
                <!-- 汇总信息 -->
                <div class="grid grid-cols-4 gap-4 mb-6">
                    <div class="bg-blue-50 p-4 rounded-lg text-center">
                        <div class="text-2xl font-bold text-blue-600">${formatMoney(summary.total_bonus || 0)}</div>
                        <div class="text-sm text-gray-600">累计获得红利</div>
                    </div>
                    <div class="bg-${summary.can_withdraw ? 'green' : 'red'}-50 p-4 rounded-lg text-center">
                        <div class="text-2xl font-bold text-${summary.can_withdraw ? 'green' : 'red'}-600">
                            ${summary.can_withdraw ? '可提现' : '不可提现'}
                        </div>
                        <div class="text-sm text-gray-600">提现资格</div>
                    </div>
                    <div class="bg-orange-50 p-4 rounded-lg text-center">
                        <div class="text-2xl font-bold text-orange-600">${summary.pending_count || 0}</div>
                        <div class="text-sm text-gray-600">待完成流水笔数</div>
                    </div>
                    <div class="bg-purple-50 p-4 rounded-lg text-center">
                        <div class="text-2xl font-bold text-purple-600">${formatMoney(summary.pending_turnover || 0)}</div>
                        <div class="text-sm text-gray-600">剩余流水要求</div>
                    </div>
                </div>
                
                <!-- 红利列表 -->
                <div class="border rounded-lg overflow-hidden">
                    <div class="bg-gray-50 px-4 py-2 font-medium">
                        <i class="fas fa-gift mr-2"></i>红利流水明细
                    </div>
                    ${bonuses.length ? `
                        <table class="data-table mb-0">
                            <thead>
                                <tr>
                                    <th>红利类型</th>
                                    <th>金额</th>
                                    <th>倍率</th>
                                    <th>需完成</th>
                                    <th>已完成</th>
                                    <th>进度</th>
                                    <th>状态</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bonuses.map(b => {
                                    const progress = b.required_turnover > 0 ? Math.min(100, (b.completed_turnover / b.required_turnover * 100)) : 100;
                                    return `
                                        <tr>
                                            <td>${bonusTypeMap[b.bonus_type] || b.bonus_type}</td>
                                            <td class="text-green-600">${formatMoney(b.bonus_amount)}</td>
                                            <td>${b.turnover_multiplier}倍</td>
                                            <td>${formatMoney(b.required_turnover)}</td>
                                            <td>${formatMoney(b.completed_turnover)}</td>
                                            <td>
                                                <div class="w-full bg-gray-200 rounded-full h-2">
                                                    <div class="bg-${progress >= 100 ? 'green' : 'blue'}-500 h-2 rounded-full" style="width: ${progress}%"></div>
                                                </div>
                                                <span class="text-xs text-gray-500">${progress.toFixed(1)}%</span>
                                            </td>
                                            <td>
                                                ${b.turnover_status === 1 ? 
                                                    '<span class="badge badge-success">已完成</span>' : 
                                                    '<span class="badge badge-warning">进行中</span>'
                                                }
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="p-4 text-center text-gray-500">无红利记录</div>'}
                </div>
                
                <div class="flex justify-end mt-4">
                    <button onclick="closeModal()" class="btn btn-outline">关闭</button>
                </div>
            </div>
        `);
    } catch (error) {
        alert('获取详情失败: ' + error.message);
    }
}

// ==================== 红利派送管理 ====================
async function renderBonusRecords() {
    const content = document.getElementById('pageContent');
    
    try {
        const [recordsRes, configsRes, rulesRes] = await Promise.all([
            apiRequest('/bonus/records'),
            apiRequest('/bonus/configs'),
            apiRequest('/finance/turnover-rules')
        ]);
        
        const { list, total } = recordsRes.data;
        const configs = configsRes.data || [];
        const rules = rulesRes.data || [];
        
        // 存储全局数据供弹窗使用
        window._bonusConfigs = configs;
        window._turnoverRules = rules;
        
        const bonusTypeMap = {
            'first_deposit': { label: '首存红利', color: 'green' },
            'deposit_bonus': { label: '存款红利', color: 'blue' },
            'activity': { label: '活动红利', color: 'purple' },
            'rebate': { label: '返水红利', color: 'orange' },
            'manual': { label: '人工红利', color: 'red' }
        };
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>
                        <i class="fas fa-gift mr-2 text-pink-500"></i>红利派送管理
                        <span class="badge badge-primary ml-2">${total || 0} 条</span>
                    </span>
                    <div class="flex space-x-2">
                        <button onclick="showBonusConfigs()" class="btn btn-outline text-sm">
                            <i class="fas fa-cog mr-1"></i>红利配置
                        </button>
                        <button onclick="showSendBonus()" class="btn btn-primary text-sm">
                            <i class="fas fa-paper-plane mr-1"></i>派送红利
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- 筛选 -->
                    <div class="flex flex-wrap gap-4 mb-4">
                        <input type="text" id="bonusSearchUser" placeholder="会员账号" class="px-3 py-2 border rounded-lg w-40">
                        <select id="bonusFilterType" class="px-3 py-2 border rounded-lg">
                            <option value="">全部类型</option>
                            ${Object.entries(bonusTypeMap).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                        </select>
                        <select id="bonusFilterAudit" class="px-3 py-2 border rounded-lg">
                            <option value="">全部状态</option>
                            <option value="0">待审核</option>
                            <option value="1">已通过</option>
                            <option value="2">已拒绝</option>
                            <option value="3">已取消</option>
                        </select>
                        <select id="bonusFilterTurnover" class="px-3 py-2 border rounded-lg">
                            <option value="">流水状态</option>
                            <option value="0">未达标</option>
                            <option value="1">已达标</option>
                        </select>
                        <button onclick="searchBonusRecords()" class="btn btn-primary"><i class="fas fa-search mr-1"></i>查询</button>
                    </div>
                    
                    <!-- 数据表格 -->
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>会员账号</th>
                                    <th>红利类型</th>
                                    <th>红利金额</th>
                                    <th>流水要求</th>
                                    <th>已完成流水</th>
                                    <th>流水状态</th>
                                    <th>审核状态</th>
                                    <th>派送时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${!list || list.length === 0 ? '<tr><td colspan="10" class="text-center text-gray-500 py-4">暂无红利记录</td></tr>' :
                                list.map(b => {
                                    const typeInfo = bonusTypeMap[b.bonus_type] || { label: b.bonus_type, color: 'gray' };
                                    const progress = b.required_turnover > 0 ? Math.min(100, (b.completed_turnover / b.required_turnover) * 100) : 100;
                                    return `
                                        <tr>
                                            <td>${b.bonus_id}</td>
                                            <td class="font-medium">${escapeHtml(b.username)}</td>
                                            <td><span class="badge badge-${typeInfo.color}">${typeInfo.label}</span></td>
                                            <td class="text-green-600 font-bold">+${formatMoney(b.bonus_amount)}</td>
                                            <td>${formatMoney(b.required_turnover)}</td>
                                            <td>
                                                <div class="flex items-center space-x-2">
                                                    <div class="w-20 bg-gray-200 rounded-full h-2">
                                                        <div class="bg-blue-500 h-2 rounded-full" style="width: ${progress}%"></div>
                                                    </div>
                                                    <span class="text-xs">${progress.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td>${b.turnover_status === 1 ? '<span class="badge badge-success">已达标</span>' : '<span class="badge badge-warning">未达标</span>'}</td>
                                            <td>${getBonusAuditBadge(b.audit_status)}</td>
                                            <td class="text-sm">${formatDate(b.created_at)}</td>
                                            <td>
                                                ${b.audit_status === 0 ? `
                                                    <button onclick="auditBonus(${b.bonus_id}, 'approve')" class="text-green-500 hover:text-green-700 mr-2" title="通过"><i class="fas fa-check"></i></button>
                                                    <button onclick="auditBonus(${b.bonus_id}, 'reject')" class="text-red-500 hover:text-red-700 mr-2" title="拒绝"><i class="fas fa-times"></i></button>
                                                ` : ''}
                                                <button onclick="viewBonusDetail(${b.bonus_id})" class="text-blue-500 hover:text-blue-700" title="详情"><i class="fas fa-eye"></i></button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

function getBonusAuditBadge(status) {
    switch (parseInt(status)) {
        case 0: return '<span class="badge badge-warning">待审核</span>';
        case 1: return '<span class="badge badge-success">已通过</span>';
        case 2: return '<span class="badge badge-danger">已拒绝</span>';
        case 3: return '<span class="badge badge-info">已取消</span>';
        default: return '<span class="badge badge-secondary">未知</span>';
    }
}

async function searchBonusRecords() {
    const username = document.getElementById('bonusSearchUser').value;
    const bonus_type = document.getElementById('bonusFilterType').value;
    const audit_status = document.getElementById('bonusFilterAudit').value;
    const turnover_status = document.getElementById('bonusFilterTurnover').value;
    
    let url = '/bonus/records?';
    if (username) url += `username=${encodeURIComponent(username)}&`;
    if (bonus_type) url += `bonus_type=${bonus_type}&`;
    if (audit_status !== '') url += `audit_status=${audit_status}&`;
    if (turnover_status !== '') url += `turnover_status=${turnover_status}&`;
    
    try {
        const res = await apiRequest(url);
        // 重新渲染表格...
        renderBonusRecords();
    } catch (error) {
        alert('查询失败: ' + error.message);
    }
}

function showSendBonus() {
    const rules = window._turnoverRules || [];
    
    openModal(`
        <div class="card-header"><i class="fas fa-paper-plane mr-2 text-pink-500"></i>派送红利</div>
        <div class="p-6">
            <form id="sendBonusForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">会员ID *</label>
                        <input type="number" id="bonusUserId" required class="form-input w-full" placeholder="玩家ID">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">会员账号 *</label>
                        <input type="text" id="bonusUsername" required class="form-input w-full" placeholder="玩家账号">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">红利类型 *</label>
                        <select id="bonusType" required class="form-input w-full">
                            <option value="">请选择</option>
                            <option value="first_deposit">首存红利</option>
                            <option value="deposit_bonus">存款红利</option>
                            <option value="activity">活动红利</option>
                            <option value="rebate">返水红利</option>
                            <option value="manual">人工红利</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">红利金额 *</label>
                        <input type="number" id="bonusAmount" required step="0.01" min="0.01" class="form-input w-full" placeholder="金额">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">流水稽核规则</label>
                    <select id="bonusTurnoverRule" class="form-input w-full" onchange="updateBonusTurnoverPreview()">
                        <option value="">无流水要求</option>
                        ${rules.filter(r => r.status === 1).map(r => `<option value="${r.rule_id}" data-multiplier="${r.multiplier}">${escapeHtml(r.rule_name)} (${r.multiplier}倍)</option>`).join('')}
                    </select>
                    <div id="turnoverPreview" class="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-700 hidden">
                        <i class="fas fa-info-circle mr-1"></i>需完成流水: <span id="turnoverAmount">0</span>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">备注说明</label>
                    <textarea id="bonusRemark" rows="2" class="form-input w-full" placeholder="派送原因或备注"></textarea>
                </div>
                <div class="bg-red-50 p-3 rounded-lg text-sm text-red-700">
                    <i class="fas fa-exclamation-triangle mr-1"></i>
                    <strong>重要提示：</strong>红利派送后需经审核才能到账，关联流水规则后玩家需完成流水才能申请提现。
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" onclick="closeModal()" class="btn btn-outline">取消</button>
                    <button type="submit" class="btn btn-primary">派送红利</button>
                </div>
            </form>
        </div>
    `);
    
    document.getElementById('sendBonusForm').onsubmit = async (e) => {
        e.preventDefault();
        await submitSendBonus();
    };
}

function updateBonusTurnoverPreview() {
    const ruleSelect = document.getElementById('bonusTurnoverRule');
    const amountInput = document.getElementById('bonusAmount');
    const preview = document.getElementById('turnoverPreview');
    const turnoverSpan = document.getElementById('turnoverAmount');
    
    const selectedOption = ruleSelect.options[ruleSelect.selectedIndex];
    const multiplier = parseFloat(selectedOption.dataset?.multiplier || 0);
    const amount = parseFloat(amountInput.value) || 0;
    
    if (multiplier > 0 && amount > 0) {
        turnoverSpan.textContent = formatMoney(amount * multiplier);
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
}

async function submitSendBonus() {
    const data = {
        user_id: parseInt(document.getElementById('bonusUserId').value),
        username: document.getElementById('bonusUsername').value,
        bonus_type: document.getElementById('bonusType').value,
        bonus_amount: parseFloat(document.getElementById('bonusAmount').value),
        turnover_rule_id: document.getElementById('bonusTurnoverRule').value ? parseInt(document.getElementById('bonusTurnoverRule').value) : null,
        remark: document.getElementById('bonusRemark').value || null
    };
    
    try {
        const res = await apiRequest('/bonus/records', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        if (res.success) {
            alert('红利已派送，等待审核');
            closeModal();
            renderBonusRecords();
        } else {
            alert(res.message || '派送失败');
        }
    } catch (error) {
        alert('派送失败: ' + error.message);
    }
}

async function auditBonus(bonusId, action) {
    const actionText = action === 'approve' ? '通过' : '拒绝';
    if (!confirm(`确定要${actionText}这笔红利吗？${action === 'approve' ? '通过后红利将立即发放到玩家账户。' : ''}`)) return;
    
    try {
        const res = await apiRequest(`/bonus/records/${bonusId}/audit`, {
            method: 'PUT',
            body: JSON.stringify({ action })
        });
        
        if (res.success) {
            alert(res.message || '操作成功');
            renderBonusRecords();
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

async function viewBonusDetail(bonusId) {
    try {
        const res = await apiRequest(`/bonus/records/${bonusId}`);
        const b = res.data;
        
        const bonusTypeMap = {
            'first_deposit': '首存红利',
            'deposit_bonus': '存款红利',
            'activity': '活动红利',
            'rebate': '返水红利',
            'manual': '人工红利'
        };
        
        const progress = b.required_turnover > 0 ? Math.min(100, (b.completed_turnover / b.required_turnover) * 100) : 100;
        
        openModal(`
            <div class="card-header"><i class="fas fa-gift mr-2 text-pink-500"></i>红利详情 #${b.bonus_id}</div>
            <div class="p-6">
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="bg-gray-50 p-3 rounded">
                        <div class="text-sm text-gray-500">会员账号</div>
                        <div class="font-bold">${escapeHtml(b.username)}</div>
                    </div>
                    <div class="bg-gray-50 p-3 rounded">
                        <div class="text-sm text-gray-500">红利类型</div>
                        <div class="font-bold">${bonusTypeMap[b.bonus_type] || b.bonus_type}</div>
                    </div>
                    <div class="bg-green-50 p-3 rounded">
                        <div class="text-sm text-gray-500">红利金额</div>
                        <div class="font-bold text-green-600">+${formatMoney(b.bonus_amount)}</div>
                    </div>
                    <div class="bg-blue-50 p-3 rounded">
                        <div class="text-sm text-gray-500">玩家当前余额</div>
                        <div class="font-bold text-blue-600">${formatMoney(b.user_balance || 0)}</div>
                    </div>
                </div>
                
                <div class="border rounded-lg p-4 mb-4">
                    <h4 class="font-semibold mb-3"><i class="fas fa-sync-alt mr-1 text-orange-500"></i>流水稽核</h4>
                    <div class="grid grid-cols-3 gap-4 text-center mb-3">
                        <div>
                            <div class="text-sm text-gray-500">流水倍数</div>
                            <div class="text-xl font-bold text-orange-600">${b.turnover_multiplier || 1}x</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">需要流水</div>
                            <div class="text-xl font-bold">${formatMoney(b.required_turnover)}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">已完成</div>
                            <div class="text-xl font-bold text-blue-600">${formatMoney(b.completed_turnover)}</div>
                        </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-4">
                        <div class="bg-gradient-to-r from-orange-400 to-green-500 h-4 rounded-full transition-all" style="width: ${progress}%"></div>
                    </div>
                    <div class="text-center mt-2">
                        ${b.turnover_status === 1 ? 
                            '<span class="text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i>流水已达标，可申请提现</span>' : 
                            `<span class="text-orange-600">还需完成流水: ${formatMoney(b.required_turnover - b.completed_turnover)}</span>`
                        }
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="text-gray-500">关联规则:</span> ${escapeHtml(b.turnover_rule_name || '无')}</div>
                    <div><span class="text-gray-500">审核状态:</span> ${getBonusAuditBadge(b.audit_status)}</div>
                    <div><span class="text-gray-500">派送人:</span> ${escapeHtml(b.admin_username || '-')}</div>
                    <div><span class="text-gray-500">过期时间:</span> ${b.expires_at ? formatDate(b.expires_at) : '永不过期'}</div>
                    <div class="col-span-2"><span class="text-gray-500">备注:</span> ${escapeHtml(b.remark || '无')}</div>
                    <div><span class="text-gray-500">派送时间:</span> ${formatDate(b.created_at)}</div>
                    <div><span class="text-gray-500">审核时间:</span> ${b.approved_at ? formatDate(b.approved_at) : '-'}</div>
                </div>
                
                <div class="flex justify-end mt-6">
                    <button onclick="closeModal()" class="btn btn-outline">关闭</button>
                </div>
            </div>
        `);
    } catch (error) {
        alert('获取详情失败: ' + error.message);
    }
}

// ==================== 红利配置管理页面 ====================
const bonusTypeOptions = {
    'first_deposit': { label: '首存红利', colorClass: 'bg-green-500', bgClass: 'bg-green-50', textClass: 'text-green-600', icon: 'fa-gift' },
    'deposit_bonus': { label: '存款红利', colorClass: 'bg-blue-500', bgClass: 'bg-blue-50', textClass: 'text-blue-600', icon: 'fa-coins' },
    'activity': { label: '活动红利', colorClass: 'bg-purple-500', bgClass: 'bg-purple-50', textClass: 'text-purple-600', icon: 'fa-star' },
    'rebate': { label: '返水红利', colorClass: 'bg-orange-500', bgClass: 'bg-orange-50', textClass: 'text-orange-600', icon: 'fa-undo' },
    'birthday': { label: '生日红利', colorClass: 'bg-pink-500', bgClass: 'bg-pink-50', textClass: 'text-pink-600', icon: 'fa-birthday-cake' },
    'vip_upgrade': { label: 'VIP晋级红利', colorClass: 'bg-yellow-500', bgClass: 'bg-yellow-50', textClass: 'text-yellow-600', icon: 'fa-crown' },
    'weekly': { label: '每周红利', colorClass: 'bg-cyan-500', bgClass: 'bg-cyan-50', textClass: 'text-cyan-600', icon: 'fa-calendar-week' },
    'monthly': { label: '每月红利', colorClass: 'bg-indigo-500', bgClass: 'bg-indigo-50', textClass: 'text-indigo-600', icon: 'fa-calendar-alt' },
    'manual': { label: '人工红利', colorClass: 'bg-red-500', bgClass: 'bg-red-50', textClass: 'text-red-600', icon: 'fa-hand-paper' }
};

const triggerTypeOptions = {
    'manual': { label: '手动派送', desc: '需管理员手动操作派送' },
    'deposit': { label: '存款触发', desc: '玩家存款后自动派送' },
    'register': { label: '注册触发', desc: '新玩家注册后自动派送' },
    'login': { label: '登录触发', desc: '玩家登录时自动派送' },
    'bet': { label: '投注触发', desc: '玩家投注后自动派送' },
    'vip_upgrade': { label: 'VIP晋级触发', desc: 'VIP等级提升时自动派送' }
};

async function renderBonusConfigs() {
    const content = document.getElementById('pageContent');
    
    try {
        const [configsRes, rulesRes] = await Promise.all([
            apiRequest('/bonus/configs'),
            apiRequest('/finance/turnover-rules')
        ]);
        
        const configs = configsRes.data || [];
        const rules = rulesRes.data || [];
        window._turnoverRules = rules;
        
        // 统计数据
        const activeCount = configs.filter(c => c.status === 1).length;
        const autoSendCount = configs.filter(c => c.auto_send === 1).length;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header bg-gradient-to-r from-pink-500 to-rose-600 text-white">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold"><i class="fas fa-cog mr-2"></i>红利配置管理</h3>
                        <div class="flex space-x-2">
                            <button onclick="showAddBonusConfig()" class="btn bg-white text-pink-600 hover:bg-pink-50 text-sm">
                                <i class="fas fa-plus mr-1"></i>新增配置
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 统计卡片 -->
                <div class="grid grid-cols-4 gap-4 p-4 bg-gray-50 border-b">
                    <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                        <div class="text-2xl font-bold text-blue-600">${configs.length}</div>
                        <div class="text-sm text-gray-500">总配置数</div>
                    </div>
                    <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                        <div class="text-2xl font-bold text-green-600">${activeCount}</div>
                        <div class="text-sm text-gray-500">已启用</div>
                    </div>
                    <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                        <div class="text-2xl font-bold text-purple-600">${autoSendCount}</div>
                        <div class="text-sm text-gray-500">自动派送</div>
                    </div>
                    <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                        <div class="text-2xl font-bold text-orange-600">${configs.length - activeCount}</div>
                        <div class="text-sm text-gray-500">已禁用</div>
                    </div>
                </div>
                
                <!-- 配置列表 -->
                <div class="p-4">
                    ${configs.length === 0 ? `
                        <div class="text-center py-10 text-gray-500">
                            <i class="fas fa-inbox text-4xl mb-3 block"></i>
                            <p>暂无红利配置</p>
                            <button onclick="showAddBonusConfig()" class="btn btn-primary mt-4">
                                <i class="fas fa-plus mr-1"></i>添加首个配置
                            </button>
                        </div>
                    ` : `
                    <div class="overflow-x-auto">
                        <table class="data-table w-full">
                            <thead>
                                <tr>
                                    <th class="text-left">配置名称</th>
                                    <th class="text-left">红利类型</th>
                                    <th class="text-center">红利比例</th>
                                    <th class="text-center">红利上限</th>
                                    <th class="text-center">最低存款</th>
                                    <th class="text-center">有效天数</th>
                                    <th class="text-center">流水规则</th>
                                    <th class="text-center">触发方式</th>
                                    <th class="text-center">状态</th>
                                    <th class="text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${configs.map(c => {
                                    const typeInfo = bonusTypeOptions[c.bonus_type] || { label: c.bonus_type, colorClass: 'bg-gray-500', bgClass: 'bg-gray-50', textClass: 'text-gray-600', icon: 'fa-gift' };
                                    const triggerInfo = triggerTypeOptions[c.trigger_type] || triggerTypeOptions['manual'];
                                    return `
                                        <tr class="${c.status !== 1 ? 'opacity-50' : ''}">
                                            <td>
                                                <div class="flex items-center">
                                                    <div class="w-8 h-8 rounded-full ${typeInfo.colorClass} text-white flex items-center justify-center mr-2 flex-shrink-0">
                                                        <i class="fas ${typeInfo.icon} text-xs"></i>
                                                    </div>
                                                    <div>
                                                        <div class="font-medium">${escapeHtml(c.bonus_name)}</div>
                                                        ${c.description ? `<div class="text-xs text-gray-400 truncate max-w-[150px]">${escapeHtml(c.description)}</div>` : ''}
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span class="badge ${typeInfo.bgClass} ${typeInfo.textClass}">${typeInfo.label}</span></td>
                                            <td class="text-center font-semibold text-green-600">${c.bonus_percentage}%</td>
                                            <td class="text-center">¥${formatNumber(c.max_bonus || 0)}</td>
                                            <td class="text-center">¥${formatNumber(c.min_deposit || 0)}</td>
                                            <td class="text-center">${c.valid_days || 30}天</td>
                                            <td class="text-center text-sm">${c.turnover_rule_name || '<span class="text-gray-400">-</span>'}</td>
                                            <td class="text-center">
                                                ${c.auto_send === 1 ? `<span class="badge badge-purple"><i class="fas fa-robot mr-1"></i>${triggerInfo.label}</span>` : '<span class="text-gray-400">手动</span>'}
                                            </td>
                                            <td class="text-center">
                                                <span class="badge ${c.status === 1 ? 'badge-success' : 'badge-danger'}">${c.status === 1 ? '启用' : '禁用'}</span>
                                            </td>
                                            <td class="text-center">
                                                <div class="flex items-center justify-center space-x-1">
                                                    <button onclick="toggleBonusConfigStatus(${c.config_id}, ${c.status === 1 ? 0 : 1})" class="${c.status === 1 ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'}" title="${c.status === 1 ? '禁用' : '启用'}">
                                                        <i class="fas ${c.status === 1 ? 'fa-pause' : 'fa-play'}"></i>
                                                    </button>
                                                    <button onclick="showEditBonusConfig(${c.config_id})" class="text-blue-500 hover:text-blue-700 ml-2" title="编辑">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                    <button onclick="deleteBonusConfig(${c.config_id})" class="text-red-500 hover:text-red-700 ml-2" title="删除">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    `}
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

// 显示新增红利配置弹窗
function showAddBonusConfig() {
    const rules = window._turnoverRules || [];
    
    openModal(`
        <div class="card-header bg-gradient-to-r from-pink-500 to-rose-600 text-white">
            <i class="fas fa-plus mr-2"></i>新增红利配置
        </div>
        <div class="p-6 max-h-[75vh] overflow-y-auto">
            <form id="addBonusConfigForm" class="space-y-4">
                <!-- 基本信息 -->
                <div class="bg-gray-50 rounded-lg p-4">
                    <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-info-circle mr-1"></i>基本信息</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">红利类型 *</label>
                            <select id="newBonusType" required class="form-input w-full">
                                <option value="">请选择类型</option>
                                ${Object.entries(bonusTypeOptions).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">配置名称 *</label>
                            <input type="text" id="newBonusName" required class="form-input w-full" placeholder="如: 首存100%红利">
                        </div>
                    </div>
                    <div class="mt-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">配置描述</label>
                        <textarea id="newBonusDesc" rows="2" class="form-input w-full" placeholder="红利活动说明..."></textarea>
                    </div>
                </div>
                
                <!-- 红利方案 -->
                <div class="bg-blue-50 rounded-lg p-4">
                    <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-calculator mr-1"></i>红利方案</h4>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">红利比例 (%)</label>
                            <input type="number" id="newBonusPercentage" step="0.01" min="0" max="100" value="0" class="form-input w-full" placeholder="如: 100">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">红利上限 (¥)</label>
                            <input type="number" id="newMaxBonus" step="0.01" min="0" value="0" class="form-input w-full" placeholder="0表示无上限">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">最低存款 (¥)</label>
                            <input type="number" id="newMinDeposit" step="0.01" min="0" value="0" class="form-input w-full" placeholder="触发最低金额">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 mt-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">有效天数</label>
                            <input type="number" id="newValidDays" min="1" value="30" class="form-input w-full">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">关联流水规则</label>
                            <select id="newTurnoverRule" class="form-input w-full">
                                <option value="">无流水要求</option>
                                ${rules.filter(r => r.status === 1).map(r => `<option value="${r.rule_id}">${escapeHtml(r.rule_name)} (${r.multiplier}倍)</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- 自动派送设置 -->
                <div class="bg-purple-50 rounded-lg p-4">
                    <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-robot mr-1"></i>自动派送设置</h4>
                    <div class="flex items-center mb-3">
                        <input type="checkbox" id="newAutoSend" class="mr-2" onchange="toggleAutoSendOptions()">
                        <label for="newAutoSend" class="text-sm font-medium text-gray-700">启用自动派送</label>
                    </div>
                    <div id="autoSendOptions" class="hidden">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">触发类型</label>
                                <select id="newTriggerType" class="form-input w-full">
                                    ${Object.entries(triggerTypeOptions).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                                </select>
                                <p id="triggerTypeDesc" class="text-xs text-gray-500 mt-1">${triggerTypeOptions['manual'].desc}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">触发金额 (¥)</label>
                                <input type="number" id="newTriggerAmount" step="0.01" min="0" value="0" class="form-input w-full" placeholder="0表示不限">
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 限制条件 -->
                <div class="bg-orange-50 rounded-lg p-4">
                    <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-shield-alt mr-1"></i>限制条件</h4>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">每日限领次数</label>
                            <input type="number" id="newDailyLimit" min="0" value="0" class="form-input w-full" placeholder="0表示不限">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">总共限领次数</label>
                            <input type="number" id="newTotalLimit" min="0" value="0" class="form-input w-full" placeholder="0表示不限">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">排序权重</label>
                            <input type="number" id="newSortOrder" min="0" value="0" class="form-input w-full">
                        </div>
                    </div>
                    <div class="mt-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">限定VIP等级 (逗号分隔)</label>
                        <input type="text" id="newVipLevels" class="form-input w-full" placeholder="如: 1,2,3 或留空表示全部等级">
                    </div>
                </div>
                
                <!-- 状态 -->
                <div class="flex items-center">
                    <input type="checkbox" id="newStatus" checked class="mr-2">
                    <label for="newStatus" class="text-sm font-medium text-gray-700">立即启用此配置</label>
                </div>
                
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" onclick="closeModal()" class="btn btn-outline">取消</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>保存配置</button>
                </div>
            </form>
        </div>
    `, '700px');
    
    // 绑定触发类型切换
    document.getElementById('newTriggerType').onchange = function() {
        const info = triggerTypeOptions[this.value] || triggerTypeOptions['manual'];
        document.getElementById('triggerTypeDesc').textContent = info.desc;
    };
    
    // 绑定表单提交
    document.getElementById('addBonusConfigForm').onsubmit = async (e) => {
        e.preventDefault();
        await submitNewBonusConfig();
    };
}

function toggleAutoSendOptions() {
    const checked = document.getElementById('newAutoSend')?.checked || document.getElementById('editAutoSend')?.checked;
    const optionsDiv = document.getElementById('autoSendOptions') || document.getElementById('editAutoSendOptions');
    if (optionsDiv) {
        optionsDiv.classList.toggle('hidden', !checked);
    }
}

async function submitNewBonusConfig() {
    const data = {
        bonus_type: document.getElementById('newBonusType').value,
        bonus_name: document.getElementById('newBonusName').value,
        description: document.getElementById('newBonusDesc').value,
        bonus_percentage: parseFloat(document.getElementById('newBonusPercentage').value) || 0,
        max_bonus: parseFloat(document.getElementById('newMaxBonus').value) || 0,
        min_deposit: parseFloat(document.getElementById('newMinDeposit').value) || 0,
        valid_days: parseInt(document.getElementById('newValidDays').value) || 30,
        turnover_rule_id: document.getElementById('newTurnoverRule').value ? parseInt(document.getElementById('newTurnoverRule').value) : null,
        auto_send: document.getElementById('newAutoSend').checked ? 1 : 0,
        trigger_type: document.getElementById('newTriggerType').value || 'manual',
        trigger_amount: parseFloat(document.getElementById('newTriggerAmount').value) || 0,
        daily_limit: parseInt(document.getElementById('newDailyLimit').value) || 0,
        total_limit: parseInt(document.getElementById('newTotalLimit').value) || 0,
        sort_order: parseInt(document.getElementById('newSortOrder').value) || 0,
        vip_levels: document.getElementById('newVipLevels').value,
        status: document.getElementById('newStatus').checked ? 1 : 0
    };
    
    if (!data.bonus_type || !data.bonus_name) {
        alert('请填写红利类型和名称');
        return;
    }
    
    try {
        const res = await apiRequest('/bonus/configs', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        if (res.success) {
            alert('红利配置已创建');
            closeModal();
            renderBonusConfigs();
        } else {
            alert(res.message || '创建失败');
        }
    } catch (error) {
        alert('创建失败: ' + error.message);
    }
}

// 显示编辑红利配置弹窗
async function showEditBonusConfig(configId) {
    try {
        const [configRes, rulesRes] = await Promise.all([
            apiRequest(`/bonus/configs/${configId}`),
            apiRequest('/finance/turnover-rules')
        ]);
        
        const config = configRes.data;
        const rules = rulesRes.data || [];
        
        if (!config) {
            alert('配置不存在');
            return;
        }
        
        openModal(`
            <div class="card-header bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <i class="fas fa-edit mr-2"></i>编辑红利配置
            </div>
            <div class="p-6 max-h-[75vh] overflow-y-auto">
                <form id="editBonusConfigForm" class="space-y-4">
                    <!-- 基本信息 -->
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-info-circle mr-1"></i>基本信息</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">红利类型 *</label>
                                <select id="editBonusType" required class="form-input w-full">
                                    ${Object.entries(bonusTypeOptions).map(([k, v]) => `<option value="${k}" ${config.bonus_type === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">配置名称 *</label>
                                <input type="text" id="editBonusName" required value="${escapeAttr(config.bonus_name)}" class="form-input w-full">
                            </div>
                        </div>
                        <div class="mt-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">配置描述</label>
                            <textarea id="editBonusDesc" rows="2" class="form-input w-full">${escapeHtml(config.description || '')}</textarea>
                        </div>
                    </div>
                    
                    <!-- 红利方案 -->
                    <div class="bg-blue-50 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-calculator mr-1"></i>红利方案</h4>
                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">红利比例 (%)</label>
                                <input type="number" id="editBonusPercentage" step="0.01" min="0" max="100" value="${config.bonus_percentage || 0}" class="form-input w-full">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">红利上限 (¥)</label>
                                <input type="number" id="editMaxBonus" step="0.01" min="0" value="${config.max_bonus || 0}" class="form-input w-full">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">最低存款 (¥)</label>
                                <input type="number" id="editMinDeposit" step="0.01" min="0" value="${config.min_deposit || 0}" class="form-input w-full">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mt-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">有效天数</label>
                                <input type="number" id="editValidDays" min="1" value="${config.valid_days || 30}" class="form-input w-full">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">关联流水规则</label>
                                <select id="editTurnoverRule" class="form-input w-full">
                                    <option value="">无流水要求</option>
                                    ${rules.filter(r => r.status === 1).map(r => `<option value="${r.rule_id}" ${config.turnover_rule_id === r.rule_id ? 'selected' : ''}>${escapeHtml(r.rule_name)} (${r.multiplier}倍)</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 自动派送设置 -->
                    <div class="bg-purple-50 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-robot mr-1"></i>自动派送设置</h4>
                        <div class="flex items-center mb-3">
                            <input type="checkbox" id="editAutoSend" ${config.auto_send === 1 ? 'checked' : ''} class="mr-2" onchange="toggleEditAutoSendOptions()">
                            <label for="editAutoSend" class="text-sm font-medium text-gray-700">启用自动派送</label>
                        </div>
                        <div id="editAutoSendOptions" class="${config.auto_send !== 1 ? 'hidden' : ''}">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">触发类型</label>
                                    <select id="editTriggerType" class="form-input w-full">
                                        ${Object.entries(triggerTypeOptions).map(([k, v]) => `<option value="${k}" ${config.trigger_type === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">触发金额 (¥)</label>
                                    <input type="number" id="editTriggerAmount" step="0.01" min="0" value="${config.trigger_amount || 0}" class="form-input w-full">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 限制条件 -->
                    <div class="bg-orange-50 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-shield-alt mr-1"></i>限制条件</h4>
                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">每日限领次数</label>
                                <input type="number" id="editDailyLimit" min="0" value="${config.daily_limit || 0}" class="form-input w-full">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">总共限领次数</label>
                                <input type="number" id="editTotalLimit" min="0" value="${config.total_limit || 0}" class="form-input w-full">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">排序权重</label>
                                <input type="number" id="editSortOrder" min="0" value="${config.sort_order || 0}" class="form-input w-full">
                            </div>
                        </div>
                        <div class="mt-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">限定VIP等级 (逗号分隔)</label>
                            <input type="text" id="editVipLevels" value="${config.vip_levels || ''}" class="form-input w-full">
                        </div>
                    </div>
                    
                    <!-- 状态 -->
                    <div class="flex items-center">
                        <input type="checkbox" id="editStatus" ${config.status === 1 ? 'checked' : ''} class="mr-2">
                        <label for="editStatus" class="text-sm font-medium text-gray-700">启用此配置</label>
                    </div>
                    
                    <div class="flex justify-end space-x-2 pt-4">
                        <button type="button" onclick="closeModal()" class="btn btn-outline">取消</button>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>保存修改</button>
                    </div>
                </form>
            </div>
        `, '700px');
        
        // 绑定表单提交
        document.getElementById('editBonusConfigForm').onsubmit = async (e) => {
            e.preventDefault();
            await submitEditBonusConfig(configId);
        };
    } catch (error) {
        alert('获取配置失败: ' + error.message);
    }
}

function toggleEditAutoSendOptions() {
    const checked = document.getElementById('editAutoSend')?.checked;
    const optionsDiv = document.getElementById('editAutoSendOptions');
    if (optionsDiv) {
        optionsDiv.classList.toggle('hidden', !checked);
    }
}

async function submitEditBonusConfig(configId) {
    const data = {
        bonus_type: document.getElementById('editBonusType').value,
        bonus_name: document.getElementById('editBonusName').value,
        description: document.getElementById('editBonusDesc').value,
        bonus_percentage: parseFloat(document.getElementById('editBonusPercentage').value) || 0,
        max_bonus: parseFloat(document.getElementById('editMaxBonus').value) || 0,
        min_deposit: parseFloat(document.getElementById('editMinDeposit').value) || 0,
        valid_days: parseInt(document.getElementById('editValidDays').value) || 30,
        turnover_rule_id: document.getElementById('editTurnoverRule').value ? parseInt(document.getElementById('editTurnoverRule').value) : null,
        auto_send: document.getElementById('editAutoSend').checked ? 1 : 0,
        trigger_type: document.getElementById('editTriggerType').value || 'manual',
        trigger_amount: parseFloat(document.getElementById('editTriggerAmount').value) || 0,
        daily_limit: parseInt(document.getElementById('editDailyLimit').value) || 0,
        total_limit: parseInt(document.getElementById('editTotalLimit').value) || 0,
        sort_order: parseInt(document.getElementById('editSortOrder').value) || 0,
        vip_levels: document.getElementById('editVipLevels').value,
        status: document.getElementById('editStatus').checked ? 1 : 0
    };
    
    try {
        const res = await apiRequest(`/bonus/configs/${configId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        
        if (res.success) {
            alert('配置已更新');
            closeModal();
            renderBonusConfigs();
        } else {
            alert(res.message || '更新失败');
        }
    } catch (error) {
        alert('更新失败: ' + error.message);
    }
}

async function toggleBonusConfigStatus(configId, newStatus) {
    if (!confirm(`确定要${newStatus === 1 ? '启用' : '禁用'}此红利配置吗？`)) return;
    
    try {
        const res = await apiRequest(`/bonus/configs/${configId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (res.success) {
            renderBonusConfigs();
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

async function deleteBonusConfig(configId) {
    if (!confirm('确定要删除此红利配置吗？此操作不可恢复！')) return;
    
    try {
        const res = await apiRequest(`/bonus/configs/${configId}`, {
            method: 'DELETE'
        });
        
        if (res.success) {
            alert('配置已删除');
            renderBonusConfigs();
        } else {
            alert(res.message || '删除失败');
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

// 原有的简易弹窗配置查看函数（保留兼容性）
async function showBonusConfigs() {
    // 直接跳转到红利配置页面
    handleMenuClick('finance-bonus-config');
}

async function editBonusConfig(configId) {
    try {
        const [configsRes, rulesRes] = await Promise.all([
            apiRequest('/bonus/configs'),
            apiRequest('/finance/turnover-rules')
        ]);
        
        const configs = configsRes.data || [];
        const rules = rulesRes.data || [];
        const config = configs.find(c => c.config_id === configId);
        
        if (!config) {
            alert('配置不存在');
            return;
        }
        
        openModal(`
            <div class="card-header"><i class="fas fa-edit mr-2 text-blue-500"></i>编辑红利配置</div>
            <div class="p-6">
                <form id="editBonusConfigForm" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">红利名称</label>
                            <input type="text" id="configBonusName" value="${escapeAttr(config.bonus_name)}" class="form-input w-full">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">有效天数</label>
                            <input type="number" id="configValidDays" value="${config.valid_days}" class="form-input w-full">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">最低存款</label>
                            <input type="number" id="configMinDeposit" value="${config.min_deposit}" step="0.01" class="form-input w-full">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">红利上限</label>
                            <input type="number" id="configMaxBonus" value="${config.max_bonus}" step="0.01" class="form-input w-full">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">红利比例(%)</label>
                            <input type="number" id="configPercentage" value="${config.bonus_percentage}" step="0.01" class="form-input w-full">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">关联流水规则</label>
                        <select id="configTurnoverRule" class="form-input w-full">
                            <option value="">无流水要求</option>
                            ${rules.filter(r => r.status === 1).map(r => `<option value="${r.rule_id}" ${config.turnover_rule_id === r.rule_id ? 'selected' : ''}>${escapeHtml(r.rule_name)} (${r.multiplier}倍)</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">描述说明</label>
                        <textarea id="configDescription" rows="2" class="form-input w-full">${escapeHtml(config.description || '')}</textarea>
                    </div>
                    <div class="flex items-center">
                        <input type="checkbox" id="configStatus" ${config.status === 1 ? 'checked' : ''} class="mr-2">
                        <label for="configStatus" class="text-sm">启用此红利类型</label>
                    </div>
                    <div class="flex justify-end space-x-2 pt-4">
                        <button type="button" onclick="showBonusConfigs()" class="btn btn-outline">返回</button>
                        <button type="submit" class="btn btn-primary">保存</button>
                    </div>
                </form>
            </div>
        `);
        
        document.getElementById('editBonusConfigForm').onsubmit = async (e) => {
            e.preventDefault();
            await submitBonusConfig(configId);
        };
    } catch (error) {
        alert('获取配置失败: ' + error.message);
    }
}

async function submitBonusConfig(configId) {
    const data = {
        bonus_name: document.getElementById('configBonusName').value,
        valid_days: parseInt(document.getElementById('configValidDays').value),
        min_deposit: parseFloat(document.getElementById('configMinDeposit').value),
        max_bonus: parseFloat(document.getElementById('configMaxBonus').value),
        bonus_percentage: parseFloat(document.getElementById('configPercentage').value),
        turnover_rule_id: document.getElementById('configTurnoverRule').value ? parseInt(document.getElementById('configTurnoverRule').value) : null,
        description: document.getElementById('configDescription').value,
        status: document.getElementById('configStatus').checked ? 1 : 0
    };
    
    try {
        const res = await apiRequest(`/bonus/configs/${configId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        
        if (res.success) {
            alert('配置已保存');
            showBonusConfigs();
        } else {
            alert(res.message || '保存失败');
        }
    } catch (error) {
        alert('保存失败: ' + error.message);
    }
}

// ==================== 收款方式管理 ====================
async function renderPaymentMethods() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/finance/payment-methods');
        const { list, total } = res.data;
        
        // 类型映射
        const typeMap = {
            'crypto': { label: '加密货币', color: 'purple' },
            'bank': { label: '银行卡', color: 'blue' },
            'ewallet': { label: '电子钱包', color: 'green' },
            'other': { label: '其他', color: 'gray' }
        };
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>
                        <i class="fas fa-credit-card mr-2"></i>收款方式管理
                        <span class="badge badge-primary ml-2">${total || 0} 个</span>
                    </span>
                    <div class="flex space-x-2">
                        <button onclick="showAddPaymentMethod()" class="btn btn-primary text-sm">
                            <i class="fas fa-plus mr-1"></i>添加收款方式
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- 筛选 -->
                    <div class="flex flex-wrap gap-4 mb-4">
                        <select id="filterType" onchange="filterPaymentMethods()" class="px-3 py-2 border rounded-lg">
                            <option value="">全部类型</option>
                            <option value="crypto">加密货币</option>
                            <option value="bank">银行卡</option>
                            <option value="ewallet">电子钱包</option>
                            <option value="other">其他</option>
                        </select>
                        <select id="filterCurrency" onchange="filterPaymentMethods()" class="px-3 py-2 border rounded-lg">
                            <option value="">全部币种</option>
                            <option value="USDT">USDT</option>
                            <option value="CNY">CNY</option>
                            <option value="BTC">BTC</option>
                            <option value="ETH">ETH</option>
                        </select>
                        <select id="filterStatus" onchange="filterPaymentMethods()" class="px-3 py-2 border rounded-lg">
                            <option value="">全部状态</option>
                            <option value="1">启用</option>
                            <option value="0">禁用</option>
                        </select>
                    </div>
                    
                    ${list && list.length ? `
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${list.map(pm => {
                                const type = typeMap[pm.method_type] || typeMap['other'];
                                return `
                                    <div class="border rounded-lg p-4 ${pm.status === 0 ? 'bg-gray-50 opacity-70' : 'bg-white'}">
                                        <div class="flex items-center justify-between mb-3">
                                            <div class="flex items-center">
                                                <span class="w-10 h-10 bg-${type.color}-100 rounded-lg flex items-center justify-center mr-3">
                                                    ${pm.method_type === 'crypto' ? '<i class="fab fa-bitcoin text-' + type.color + '-600 text-lg"></i>' :
                                                      pm.method_type === 'bank' ? '<i class="fas fa-university text-' + type.color + '-600 text-lg"></i>' :
                                                      pm.method_type === 'ewallet' ? '<i class="fas fa-wallet text-' + type.color + '-600 text-lg"></i>' :
                                                      '<i class="fas fa-money-bill-wave text-' + type.color + '-600 text-lg"></i>'}
                                                </span>
                                                <div>
                                                    <h4 class="font-medium">${escapeHtml(pm.method_name)}</h4>
                                                    <span class="text-xs text-gray-500">${type.label} · ${pm.currency}</span>
                                                </div>
                                            </div>
                                            <span class="badge ${pm.status === 1 ? 'badge-success' : 'badge-danger'}">
                                                ${pm.status === 1 ? '启用' : '禁用'}
                                            </span>
                                        </div>
                                        
                                        <div class="space-y-2 text-sm text-gray-600 mb-3">
                                            ${pm.account_name ? `<p><i class="fas fa-user w-5"></i>${escapeHtml(pm.account_name)}</p>` : ''}
                                            ${pm.account_number ? `<p><i class="fas fa-key w-5"></i><span class="font-mono text-xs">${escapeHtml(pm.account_number.length > 20 ? pm.account_number.substring(0, 20) + '...' : pm.account_number)}</span></p>` : ''}
                                            ${pm.bank_name ? `<p><i class="fas fa-building w-5"></i>${escapeHtml(pm.bank_name)}</p>` : ''}
                                            <p><i class="fas fa-coins w-5"></i>限额: ${formatNumber(pm.min_amount)} ~ ${formatNumber(pm.max_amount)}</p>
                                            ${pm.fee_type > 0 ? `<p><i class="fas fa-percentage w-5"></i>手续费: ${pm.fee_type === 1 ? formatNumber(pm.fee_amount) : (pm.fee_amount * 100).toFixed(2) + '%'}</p>` : ''}
                                        </div>
                                        
                                        <div class="flex justify-end gap-2 pt-3 border-t">
                                            <button onclick="editPaymentMethod(${pm.method_id})" class="btn btn-secondary text-xs">
                                                <i class="fas fa-edit mr-1"></i>编辑
                                            </button>
                                            <button onclick="togglePaymentMethodStatus(${pm.method_id}, ${pm.status === 1 ? 0 : 1})" 
                                                    class="btn ${pm.status === 1 ? 'btn-warning' : 'btn-success'} text-xs">
                                                <i class="fas fa-${pm.status === 1 ? 'ban' : 'check'} mr-1"></i>
                                                ${pm.status === 1 ? '禁用' : '启用'}
                                            </button>
                                            <button onclick="deletePaymentMethod(${pm.method_id}, '${escapeAttr(pm.method_name)}')" class="btn btn-danger text-xs">
                                                <i class="fas fa-trash mr-1"></i>删除
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `
                        <div class="text-center text-gray-500 py-10">
                            <i class="fas fa-credit-card text-4xl text-gray-300 mb-4"></i>
                            <p>暂无收款方式</p>
                            <button onclick="showAddPaymentMethod()" class="btn btn-primary mt-4">
                                <i class="fas fa-plus mr-1"></i>添加第一个收款方式
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

// 筛选收款方式
async function filterPaymentMethods() {
    const type = document.getElementById('filterType').value;
    const currency = document.getElementById('filterCurrency').value;
    const status = document.getElementById('filterStatus').value;
    
    let url = '/payment-methods?';
    if (type) url += `method_type=${type}&`;
    if (currency) url += `currency=${currency}&`;
    if (status) url += `status=${status}&`;
    
    try {
        const res = await apiRequest(url);
        // 重新渲染列表部分
        loadPage('finance-payment-methods');
    } catch (error) {
        alert('筛选失败: ' + error.message);
    }
}

// 显示添加收款方式弹窗
function showAddPaymentMethod() {
    openModal(`
        <div class="p-6" style="min-width: 500px;">
            <h3 class="text-lg font-bold mb-4">
                <i class="fas fa-plus-circle text-blue-500 mr-2"></i>添加收款方式
            </h3>
            <form id="paymentMethodForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">收款方式名称 <span class="text-red-500">*</span></label>
                        <input type="text" id="pmName" class="form-input w-full" placeholder="如：USDT-TRC20" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">类型 <span class="text-red-500">*</span></label>
                        <select id="pmType" class="form-input w-full" required onchange="onPaymentTypeChange()">
                            <option value="crypto">加密货币</option>
                            <option value="bank">银行卡</option>
                            <option value="ewallet">电子钱包</option>
                            <option value="other">其他</option>
                        </select>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">币种</label>
                        <select id="pmCurrency" class="form-input w-full">
                            <option value="USDT">USDT</option>
                            <option value="CNY">CNY (人民币)</option>
                            <option value="BTC">BTC</option>
                            <option value="ETH">ETH</option>
                            <option value="USD">USD</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">排序</label>
                        <input type="number" id="pmSort" class="form-input w-full" value="0" min="0">
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">收款人/钱包名称</label>
                    <input type="text" id="pmAccountName" class="form-input w-full" placeholder="收款人姓名或钱包标识">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">账号/钱包地址 <span class="text-red-500">*</span></label>
                    <input type="text" id="pmAccountNumber" class="form-input w-full" placeholder="银行卡号或钱包地址" required>
                </div>
                
                <div id="bankFields" class="grid grid-cols-2 gap-4" style="display: none;">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">银行名称</label>
                        <input type="text" id="pmBankName" class="form-input w-full" placeholder="如：工商银行">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">开户行支行</label>
                        <input type="text" id="pmBankBranch" class="form-input w-full" placeholder="如：北京分行">
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">收款二维码URL</label>
                    <input type="url" id="pmQrCode" class="form-input w-full" placeholder="https://...">
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最小金额</label>
                        <input type="number" id="pmMinAmount" class="form-input w-full" value="100" min="0" step="0.01">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最大金额</label>
                        <input type="number" id="pmMaxAmount" class="form-input w-full" value="1000000" min="0" step="0.01">
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">手续费类型</label>
                        <select id="pmFeeType" class="form-input w-full" onchange="onFeeTypeChange()">
                            <option value="0">无手续费</option>
                            <option value="1">固定费用</option>
                            <option value="2">百分比</option>
                        </select>
                    </div>
                    <div id="feeAmountField" style="display: none;">
                        <label class="block text-sm font-medium text-gray-700 mb-1">费用金额/比例</label>
                        <input type="number" id="pmFeeAmount" class="form-input w-full" value="0" min="0" step="0.0001">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">状态</label>
                        <select id="pmStatus" class="form-input w-full">
                            <option value="1">启用</option>
                            <option value="0">禁用</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                    <textarea id="pmRemark" class="form-input w-full" rows="2" placeholder="备注说明"></textarea>
                </div>
                
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save mr-1"></i>保存
                    </button>
                </div>
            </form>
        </div>
    `);
    
    document.getElementById('paymentMethodForm').onsubmit = async (e) => {
        e.preventDefault();
        await submitPaymentMethod();
    };
}

// 支付类型变更处理
function onPaymentTypeChange() {
    const type = document.getElementById('pmType').value;
    const bankFields = document.getElementById('bankFields');
    const currencySelect = document.getElementById('pmCurrency');
    
    if (type === 'bank') {
        bankFields.style.display = 'grid';
        currencySelect.value = 'CNY';
    } else {
        bankFields.style.display = 'none';
        if (type === 'crypto') {
            currencySelect.value = 'USDT';
        }
    }
}

// 手续费类型变更处理
function onFeeTypeChange() {
    const feeType = document.getElementById('pmFeeType').value;
    const feeAmountField = document.getElementById('feeAmountField');
    feeAmountField.style.display = feeType === '0' ? 'none' : 'block';
}

// 提交收款方式
async function submitPaymentMethod(methodId = null) {
    const data = {
        method_name: document.getElementById('pmName').value.trim(),
        method_type: document.getElementById('pmType').value,
        currency: document.getElementById('pmCurrency').value,
        account_name: document.getElementById('pmAccountName').value.trim(),
        account_number: document.getElementById('pmAccountNumber').value.trim(),
        bank_name: document.getElementById('pmBankName')?.value.trim() || '',
        bank_branch: document.getElementById('pmBankBranch')?.value.trim() || '',
        qr_url: document.getElementById('pmQrCode')?.value.trim() || '',
        min_amount: parseFloat(document.getElementById('pmMinAmount').value) || 0,
        max_amount: parseFloat(document.getElementById('pmMaxAmount').value) || 1000000,
        fee_type: parseInt(document.getElementById('pmFeeType').value),
        fee_amount: parseFloat(document.getElementById('pmFeeAmount')?.value) || 0,
        status: parseInt(document.getElementById('pmStatus').value),
        sort_order: parseInt(document.getElementById('pmSort')?.value) || 0,
        remark: document.getElementById('pmRemark')?.value.trim() || ''
    };
    
    if (!data.method_name) {
        alert('请输入收款方式名称');
        return;
    }
    if (!data.account_number) {
        alert('请输入账号或钱包地址');
        return;
    }
    
    try {
        const url = methodId ? `/payment-methods/${methodId}` : '/payment-methods';
        const method = methodId ? 'PUT' : 'POST';
        
        const res = await apiRequest(url, {
            method,
            body: JSON.stringify(data)
        });
        
        if (res.success) {
            closeModal();
            alert(methodId ? '收款方式更新成功' : '收款方式添加成功');
            loadPage('finance-payment-methods');
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

// 编辑收款方式
async function editPaymentMethod(methodId) {
    try {
        const res = await apiRequest(`/finance/payment-methods/${methodId}`);
        if (!res.success) {
            alert('获取收款方式详情失败');
            return;
        }
        
        const pm = res.data;
        showAddPaymentMethod();
        
        // 填充表单
        setTimeout(() => {
            document.getElementById('pmName').value = pm.method_name || '';
            document.getElementById('pmType').value = pm.method_type || 'crypto';
            document.getElementById('pmCurrency').value = pm.currency || 'USDT';
            document.getElementById('pmAccountName').value = pm.account_name || '';
            document.getElementById('pmAccountNumber').value = pm.account_number || '';
            document.getElementById('pmBankName').value = pm.bank_name || '';
            document.getElementById('pmBankBranch').value = pm.bank_branch || '';
            document.getElementById('pmQrCode').value = pm.qr_url || '';
            document.getElementById('pmMinAmount').value = pm.min_amount || 0;
            document.getElementById('pmMaxAmount').value = pm.max_amount || 1000000;
            document.getElementById('pmFeeType').value = pm.fee_type || 0;
            document.getElementById('pmFeeAmount').value = pm.fee_amount || 0;
            document.getElementById('pmStatus').value = pm.status;
            document.getElementById('pmSort').value = pm.sort_order || 0;
            document.getElementById('pmRemark').value = pm.remark || '';
            
            // 触发类型变更
            onPaymentTypeChange();
            onFeeTypeChange();
            
            // 修改表单标题和提交处理
            document.querySelector('#paymentMethodForm').previousElementSibling.innerHTML = 
                '<i class="fas fa-edit text-blue-500 mr-2"></i>编辑收款方式';
            document.getElementById('paymentMethodForm').onsubmit = async (e) => {
                e.preventDefault();
                await submitPaymentMethod(methodId);
            };
        }, 100);
    } catch (error) {
        alert('获取详情失败: ' + error.message);
    }
}

// 切换收款方式状态
async function togglePaymentMethodStatus(methodId, newStatus) {
    const action = newStatus === 1 ? '启用' : '禁用';
    if (!confirm(`确定要${action}此收款方式吗？`)) return;
    
    try {
        const res = await apiRequest(`/finance/payment-methods/${methodId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (res.success) {
            alert(`收款方式已${action}`);
            loadPage('finance-payment-methods');
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

// 删除收款方式
async function deletePaymentMethod(methodId, methodName) {
    if (!confirm(`确定要删除收款方式 "${methodName}" 吗？\n此操作不可恢复！`)) return;
    
    try {
        const res = await apiRequest(`/finance/payment-methods/${methodId}`, {
            method: 'DELETE'
        });
        
        if (res.success) {
            alert('收款方式已删除');
            loadPage('finance-payment-methods');
        } else {
            alert(res.message || '删除失败');
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

// ==================== 注单管理 ====================
async function renderBets() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/bets');
        const { list, total } = res.data;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>注单列表</span>
                    <div class="flex space-x-2">
                        <button class="btn btn-success text-sm"><i class="fas fa-file-excel mr-1"></i>导出</button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- 筛选 -->
                    <div class="flex flex-wrap gap-4 mb-4">
                        <input type="date" class="px-3 py-2 border rounded-lg">
                        <select class="px-3 py-2 border rounded-lg">
                            <option value="">全部游戏</option>
                            <option value="百家乐">百家乐</option>
                            <option value="龙虎">龙虎</option>
                            <option value="轮盘">轮盘</option>
                            <option value="骰宝">骰宝</option>
                            <option value="牛牛">牛牛</option>
                        </select>
                        <select class="px-3 py-2 border rounded-lg">
                            <option value="">全部状态</option>
                            <option value="0">未结算</option>
                            <option value="1">已结算</option>
                            <option value="2">已取消</option>
                            <option value="3">废单</option>
                        </select>
                        <button class="btn btn-primary">查询</button>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>注单号/时间</th>
                                    <th>玩家</th>
                                    <th>游戏/桌台</th>
                                    <th>投注内容</th>
                                    <th>投注金额</th>
                                    <th>输赢</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(bet => `
                                    <tr>
                                        <td>
                                            <div class="font-mono text-sm">${escapeHtml(bet.bet_no)}</div>
                                            <div class="text-xs text-gray-500">${formatDate(bet.created_at)}</div>
                                        </td>
                                        <td>${escapeHtml(bet.username)}</td>
                                        <td>
                                            <div>${escapeHtml(bet.game_type)}</div>
                                            <div class="text-xs text-gray-500">${escapeHtml(bet.table_code)}</div>
                                        </td>
                                        <td>${formatBetDetail(bet.bet_detail)}</td>
                                        <td class="font-medium">¥ ${formatNumber(bet.bet_amount)}</td>
                                        <td class="${bet.win_loss_amount >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                                            ${bet.win_loss_amount >= 0 ? '+' : ''}${formatNumber(bet.win_loss_amount)}
                                        </td>
                                        <td>${getBetStatusBadge(bet.bet_status)}</td>
                                        <td>
                                            <button class="text-blue-500 hover:text-blue-700" title="回放">
                                                <i class="fas fa-play-circle"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

// ==================== 洗码管理 ====================
async function renderCommissionSchemes() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/commission/schemes');
        const list = res.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>洗码方案配置 <span class="badge badge-primary">${list.length}</span></span>
                    <button onclick="showAddCommissionScheme()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增方案</button>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${list.map(scheme => `
                            <div class="border rounded-lg p-4 hover:shadow-lg transition">
                                <div class="flex items-center justify-between mb-3">
                                    <h3 class="font-bold text-lg">${escapeHtml(scheme.scheme_name)}</h3>
                                    ${scheme.status === 1 ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-danger">禁用</span>'}
                                </div>
                                <div class="space-y-2 text-sm">
                                    <div class="flex justify-between">
                                        <span class="text-gray-500">结算周期:</span>
                                        <span>${scheme.settlement_cycle === 1 ? '日结' : scheme.settlement_cycle === 2 ? '周结' : '实时'}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-500">最低投注:</span>
                                        <span>¥ ${formatNumber(scheme.min_valid_bet)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-500">单日上限:</span>
                                        <span>¥ ${scheme.daily_max_amount ? formatNumber(scheme.daily_max_amount) : '无限制'}</span>
                                    </div>
                                    <hr class="my-2">
                                    <div class="text-gray-500 mb-2">返水比例:</div>
                                    <div class="grid grid-cols-2 gap-2">
                                        <div class="bg-gray-50 p-2 rounded">
                                            <span class="text-xs text-gray-500">百家乐</span>
                                            <div class="font-bold text-blue-600">${(scheme.baccarat_rate * 100).toFixed(2)}%</div>
                                        </div>
                                        <div class="bg-gray-50 p-2 rounded">
                                            <span class="text-xs text-gray-500">龙虎</span>
                                            <div class="font-bold text-blue-600">${(scheme.dragon_tiger_rate * 100).toFixed(2)}%</div>
                                        </div>
                                        <div class="bg-gray-50 p-2 rounded">
                                            <span class="text-xs text-gray-500">轮盘</span>
                                            <div class="font-bold text-blue-600">${(scheme.roulette_rate * 100).toFixed(2)}%</div>
                                        </div>
                                        <div class="bg-gray-50 p-2 rounded">
                                            <span class="text-xs text-gray-500">牛牛</span>
                                            <div class="font-bold text-blue-600">${(scheme.niuniu_rate * 100).toFixed(2)}%</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-4 flex space-x-2">
                                    <button onclick="editCommissionScheme(${scheme.scheme_id})" class="btn btn-outline text-sm flex-1"><i class="fas fa-edit mr-1"></i>编辑</button>
                                    <button onclick="deleteCommissionScheme(${scheme.scheme_id}, '${escapeAttr(scheme.scheme_name)}')" class="btn btn-danger text-sm"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

async function renderCommissionRecords() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/commission/records');
        const { list, total } = res.data;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>洗码发放记录</span>
                    <div class="flex space-x-2">
                        <button class="btn btn-success text-sm">批量通过</button>
                        <button class="btn btn-outline text-sm">导出</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>会员账号</th>
                                    <th>方案名称</th>
                                    <th>游戏类型</th>
                                    <th>有效投注</th>
                                    <th>洗码比例</th>
                                    <th>返水金额</th>
                                    <th>结算日期</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(r => `
                                    <tr>
                                        <td>${r.username}</td>
                                        <td>${r.scheme_name}</td>
                                        <td>${r.game_type}</td>
                                        <td>¥ ${formatNumber(r.valid_bet_amount)}</td>
                                        <td>${(r.commission_rate * 100).toFixed(2)}%</td>
                                        <td class="text-green-600 font-medium">¥ ${formatNumber(r.commission_amount)}</td>
                                        <td>${r.settlement_date}</td>
                                        <td>${getAuditStatusBadge(r.audit_status)}</td>
                                        <td>
                                            ${r.audit_status === 0 ? `
                                                <button class="text-green-500 hover:text-green-700 mr-2" title="通过">
                                                    <i class="fas fa-check"></i>
                                                </button>
                                                <button class="text-red-500 hover:text-red-700" title="拒绝">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

// ==================== 风控管理 ====================
async function renderRiskAlerts() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/risk/alerts');
        const { list, total } = res.data;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>风控预警 <span class="badge badge-danger">${list.filter(a => a.handle_status === 0).length} 待处理</span></span>
                    <span class="text-sm text-gray-500">实时监控中...</span>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>时间</th>
                                    <th>会员账号</th>
                                    <th>预警类型</th>
                                    <th>风险等级</th>
                                    <th>详情</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(alert => `
                                    <tr class="${alert.risk_level === 3 ? 'bg-red-50' : alert.risk_level === 2 ? 'bg-yellow-50' : ''}">
                                        <td>${formatDate(alert.created_at)}</td>
                                        <td class="font-medium">${escapeHtml(alert.username)}</td>
                                        <td>${escapeHtml(alert.rule_name || alert.alert_type)}</td>
                                        <td>${getRiskLevelBadge(alert.risk_level)}</td>
                                        <td class="text-sm text-gray-600">${escapeHtml(alert.alert_detail) || '-'}</td>
                                        <td>${getAlertStatusBadge(alert.handle_status)}</td>
                                        <td>
                                            ${alert.handle_status === 0 ? `
                                                <button class="btn btn-danger text-xs mr-1">锁定</button>
                                                <button class="btn btn-warning text-xs mr-1">限红</button>
                                                <button class="btn btn-outline text-xs">忽略</button>
                                            ` : '<span class="text-gray-400">已处理</span>'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

// ==================== 报表中心 - 增强版 (时间查询 + 导出) ====================

// 通用报表工具函数
function getDefaultDateRange() {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 8) + '01';
    return { startDate: monthStart, endDate: today };
}

function renderDateRangeSelector(reportType, hasExport = true) {
    const { startDate, endDate } = getDefaultDateRange();
    return `
        <div class="flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600">开始:</label>
                <input type="date" id="${reportType}StartDate" value="${startDate}" class="form-input text-sm py-1">
            </div>
            <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600">结束:</label>
                <input type="date" id="${reportType}EndDate" value="${endDate}" class="form-input text-sm py-1">
            </div>
            <button onclick="query${reportType}()" class="btn btn-primary text-sm py-1"><i class="fas fa-search mr-1"></i>查询</button>
            ${hasExport ? `<button onclick="export${reportType}()" class="btn btn-success text-sm py-1"><i class="fas fa-file-excel mr-1"></i>导出Excel</button>` : ''}
        </div>
    `;
}

// 通用导出函数
function exportToExcel(data, columns, filename) {
    if (!data || data.length === 0) {
        alert('暂无数据可导出');
        return;
    }
    
    // 生成CSV内容
    const headers = columns.map(c => c.label).join(',');
    const rows = data.map(row => 
        columns.map(c => {
            let val = c.key.split('.').reduce((o, k) => o?.[k], row);
            if (c.format) val = c.format(val, row);
            // 处理特殊字符
            val = String(val ?? '').replace(/"/g, '""');
            return `"${val}"`;
        }).join(',')
    ).join('\n');
    
    const csvContent = '\uFEFF' + headers + '\n' + rows; // BOM for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
}

// 存储当前报表数据用于导出
let currentReportData = {};

// 结算报表
async function renderSettlementReport() {
    const content = document.getElementById('pageContent');
    const { startDate, endDate } = getDefaultDateRange();
    
    // 加载筛选选项
    let shareholderOptions = '<option value="">全部股东</option>';
    let agentOptions = '<option value="">全部代理</option>';
    let gameTypeOptions = '<option value="">全部游戏</option>';
    try {
        const [shareholderRes, agentRes, gameTypeRes] = await Promise.all([
            apiRequest('/reports/shareholders'),
            apiRequest('/reports/agents-list'),
            apiRequest('/reports/game-types')
        ]);
        (shareholderRes.data || []).forEach(s => {
            shareholderOptions += `<option value="${s.agent_id}">${escapeHtml(s.agent_username)}</option>`;
        });
        (agentRes.data || []).forEach(a => {
            agentOptions += `<option value="${a.agent_id}">${escapeHtml(a.agent_username)}</option>`;
        });
        (gameTypeRes.data || []).forEach(g => {
            gameTypeOptions += `<option value="${g.game_type}">${escapeHtml(g.game_type)}</option>`;
        });
    } catch (e) { console.error('加载筛选选项失败:', e); }
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header bg-blue-50">
                <h3 class="text-lg font-semibold text-blue-700"><i class="fas fa-file-invoice-dollar mr-2"></i>结算报表 - 对账与结算</h3>
            </div>
            <!-- 筛选条件 -->
            <div class="p-4 bg-gray-50 border-b">
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">开始日期</label>
                        <input type="date" id="SettlementStartDate" value="${startDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">结束日期</label>
                        <input type="date" id="SettlementEndDate" value="${endDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">统计维度</label>
                        <select id="SettlementDimension" class="form-input w-full text-sm">
                            <option value="daily">按日期</option>
                            <option value="game">按游戏</option>
                            <option value="agent">按代理</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">股东</label>
                        <select id="SettlementShareholder" class="form-input w-full text-sm" onchange="loadAgentsByShareholder('Settlement')">${shareholderOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">代理</label>
                        <select id="SettlementAgent" class="form-input w-full text-sm">${agentOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">游戏类型</label>
                        <select id="SettlementGameType" class="form-input w-full text-sm">${gameTypeOptions}</select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button onclick="querySettlement()" class="btn btn-primary text-sm flex-1"><i class="fas fa-search mr-1"></i>查询</button>
                        <button onclick="exportSettlement()" class="btn bg-green-500 text-white text-sm hover:bg-green-600"><i class="fas fa-download"></i></button>
                    </div>
                </div>
            </div>
            <div class="p-4" id="settlementContent">
                <div class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
            </div>
        </div>
    `;
    
    await querySettlement();
}

async function querySettlement() {
    const startDate = document.getElementById('SettlementStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('SettlementEndDate')?.value || getDefaultDateRange().endDate;
    const dimension = document.getElementById('SettlementDimension')?.value || 'daily';
    const shareholderId = document.getElementById('SettlementShareholder')?.value || '';
    const agentId = document.getElementById('SettlementAgent')?.value || '';
    const gameType = document.getElementById('SettlementGameType')?.value || '';
    const container = document.getElementById('settlementContent');
    
    try {
        // 获取基础结算数据
        let url = `/reports/settlement?start_date=${startDate}&end_date=${endDate}&dimension=${dimension}`;
        if (agentId) url += `&agent_id=${agentId}`;
        if (gameType) url += `&game_type=${gameType}`;
        
        // 同时获取综合报表数据（含股东/代理盈亏）
        const [res, comprehensiveRes] = await Promise.all([
            apiRequest(url),
            apiRequest(`/reports/comprehensive?start_date=${startDate}&end_date=${endDate}${shareholderId ? '&shareholder_id=' + shareholderId : ''}${agentId ? '&agent_id=' + agentId : ''}`)
        ]);
        
        const list = res.data || [];
        const summary = res.summary || {};
        const compData = comprehensiveRes.data || {};
        currentReportData.settlement = { list, summary, comprehensive: compData };
        
        // 计算佣金汇总
        const totalCommission = (compData.agents || []).reduce((sum, a) => sum + parseFloat(a.commission_earned || 0), 0);
        
        // 获取维度对应的表头
        const dimensionHeaders = {
            daily: ['日期', 'date'],
            game: ['游戏类型', 'dimension'],
            agent: ['代理', 'dimension']
        };
        
        container.innerHTML = `
            <!-- 汇总统计卡片 -->
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
                <div class="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                    <div class="text-xs text-gray-600">总注单</div>
                    <div class="text-lg font-bold text-blue-600">${formatNumber(summary.bet_count || 0)}</div>
                </div>
                <div class="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                    <div class="text-xs text-gray-600">投注人数</div>
                    <div class="text-lg font-bold text-indigo-600">${formatNumber(summary.player_count || 0)}</div>
                </div>
                <div class="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                    <div class="text-xs text-gray-600">总投注额</div>
                    <div class="text-lg font-bold text-purple-600">${formatMoney(summary.total_bet || 0)}</div>
                </div>
                <div class="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-100">
                    <div class="text-xs text-gray-600">有效投注</div>
                    <div class="text-lg font-bold text-cyan-600">${formatMoney(summary.valid_bet || 0)}</div>
                </div>
                <div class="bg-${parseFloat(summary.total_win_loss || 0) >= 0 ? 'green' : 'red'}-50 rounded-lg p-3 text-center border">
                    <div class="text-xs text-gray-600">会员输赢</div>
                    <div class="text-lg font-bold text-${parseFloat(summary.total_win_loss || 0) >= 0 ? 'green' : 'red'}-600">${formatMoney(summary.total_win_loss || 0)}</div>
                </div>
                <div class="bg-${parseFloat(summary.company_profit || 0) >= 0 ? 'green' : 'red'}-50 rounded-lg p-3 text-center border">
                    <div class="text-xs text-gray-600">公司盈利</div>
                    <div class="text-lg font-bold text-${parseFloat(summary.company_profit || 0) >= 0 ? 'green' : 'red'}-600">${formatMoney(summary.company_profit || 0)}</div>
                </div>
                <div class="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                    <div class="text-xs text-gray-600">代理佣金</div>
                    <div class="text-lg font-bold text-orange-600">${formatMoney(totalCommission)}</div>
                </div>
                <div class="bg-teal-50 rounded-lg p-3 text-center border border-teal-100">
                    <div class="text-xs text-gray-600">杀数比例</div>
                    <div class="text-lg font-bold text-teal-600">${summary.valid_bet > 0 ? ((summary.company_profit / summary.valid_bet) * 100).toFixed(2) : 0}%</div>
                </div>
            </div>
            
            <!-- 股东盈亏分布 -->
            ${(compData.shareholders || []).length > 0 ? `
            <div class="mb-4">
                <h4 class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-user-tie mr-1"></i>股东盈亏分布</h4>
                <div class="overflow-x-auto">
                    <table class="data-table text-sm">
                        <thead class="bg-gray-100">
                            <tr><th>股东</th><th>占成比</th><th>投注人数</th><th>注单数</th><th>总投注</th><th>会员输赢</th><th>公司盈利</th><th>股东分红</th><th>平台收益</th></tr>
                        </thead>
                        <tbody>
                            ${(compData.shareholders || []).map(s => `
                                <tr>
                                    <td class="font-medium">${escapeHtml(s.shareholder_name || '-')}</td>
                                    <td><span class="badge badge-info">${s.share_ratio || 0}%</span></td>
                                    <td>${formatNumber(s.player_count || 0)}</td>
                                    <td>${formatNumber(s.bet_count || 0)}</td>
                                    <td>${formatMoney(s.total_bet || 0)}</td>
                                    <td class="${parseFloat(s.player_win_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(s.player_win_loss || 0)}</td>
                                    <td class="${parseFloat(s.company_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">${formatMoney(s.company_profit || 0)}</td>
                                    <td class="text-orange-600 font-medium">${formatMoney(s.shareholder_profit || 0)}</td>
                                    <td class="text-blue-600 font-medium">${formatMoney(s.platform_profit || 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
            
            <!-- 明细数据表格 -->
            <h4 class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-table mr-1"></i>结算明细（按${dimensionHeaders[dimension][0]}）</h4>
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>${dimensionHeaders[dimension][0]}</th>
                            <th>注单数</th>
                            <th>投注人数</th>
                            <th>总投注</th>
                            <th>有效投注</th>
                            <th>会员输赢</th>
                            <th>公司盈利</th>
                            <th>杀数(%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? '<tr><td colspan="8" class="text-center text-gray-500 py-4">暂无数据</td></tr>' : 
                        list.map(r => `
                            <tr>
                                <td class="font-medium">${escapeHtml(r[dimensionHeaders[dimension][1]] || r.date || '-')}</td>
                                <td>${formatNumber(r.bet_count || 0)}</td>
                                <td>${formatNumber(r.player_count || 0)}</td>
                                <td>${formatMoney(r.total_bet || 0)}</td>
                                <td>${formatMoney(r.valid_bet || 0)}</td>
                                <td class="${parseFloat(r.total_win_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(r.total_win_loss || 0)}</td>
                                <td class="${parseFloat(r.company_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">${formatMoney(r.company_profit || 0)}</td>
                                <td>${r.valid_bet > 0 ? ((r.company_profit / r.valid_bet) * 100).toFixed(2) : 0}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

function exportSettlement() {
    exportToExcel(currentReportData.settlement, [
        { key: 'date', label: '日期' },
        { key: 'bet_count', label: '注单数' },
        { key: 'total_bet', label: '总投注' },
        { key: 'valid_bet', label: '有效投注' },
        { key: 'total_win_loss', label: '玩家盈亏' },
        { key: 'company_profit', label: '公司盈亏' },
        { key: 'kill_rate', label: '杀数(%)', format: (v, r) => r.valid_bet > 0 ? ((r.company_profit / r.valid_bet) * 100).toFixed(2) : 0 }
    ], '结算报表');
}

// 盈亏排行
async function renderRanking() {
    const content = document.getElementById('pageContent');
    const { startDate, endDate } = getDefaultDateRange();
    
    // 加载筛选选项
    let shareholderOptions = '<option value="">全部股东</option>';
    let agentOptions = '<option value="">全部代理</option>';
    try {
        const [shareholderRes, agentRes] = await Promise.all([
            apiRequest('/reports/shareholders'),
            apiRequest('/reports/agents-list')
        ]);
        (shareholderRes.data || []).forEach(s => {
            shareholderOptions += `<option value="${s.agent_id}">${escapeHtml(s.agent_username)}</option>`;
        });
        (agentRes.data || []).forEach(a => {
            agentOptions += `<option value="${a.agent_id}">${escapeHtml(a.agent_username)}</option>`;
        });
    } catch (e) { console.error('加载筛选选项失败:', e); }
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header bg-yellow-50">
                <h3 class="text-lg font-semibold text-yellow-700"><i class="fas fa-trophy mr-2"></i>盈亏排行榜</h3>
            </div>
            <!-- 筛选条件 -->
            <div class="p-4 bg-gray-50 border-b">
                <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">开始日期</label>
                        <input type="date" id="RankingStartDate" value="${startDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">结束日期</label>
                        <input type="date" id="RankingEndDate" value="${endDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">股东</label>
                        <select id="RankingShareholder" class="form-input w-full text-sm" onchange="loadAgentsByShareholder('Ranking')">${shareholderOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">代理</label>
                        <select id="RankingAgent" class="form-input w-full text-sm">${agentOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">显示数量</label>
                        <select id="RankingLimit" class="form-input w-full text-sm">
                            <option value="20">TOP 20</option>
                            <option value="50">TOP 50</option>
                            <option value="100">TOP 100</option>
                        </select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button onclick="queryRanking()" class="btn btn-primary text-sm flex-1"><i class="fas fa-search mr-1"></i>查询</button>
                        <button onclick="exportRanking()" class="btn bg-green-500 text-white text-sm hover:bg-green-600"><i class="fas fa-download"></i></button>
                    </div>
                </div>
            </div>
        </div>
        <div id="rankingContent" class="mt-4">
            <div class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
        </div>
    `;
    
    await queryRanking();
}

async function queryRanking() {
    const startDate = document.getElementById('RankingStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('RankingEndDate')?.value || getDefaultDateRange().endDate;
    const container = document.getElementById('rankingContent');
    
    try {
        const [profitRes, lossRes] = await Promise.all([
            apiRequest(`/reports/ranking?type=profit&limit=20&start_date=${startDate}&end_date=${endDate}`),
            apiRequest(`/reports/ranking?type=loss&limit=20&start_date=${startDate}&end_date=${endDate}`)
        ]);
        
        const profitList = profitRes.data || [];
        const lossList = lossRes.data || [];
        currentReportData.ranking = { profit: profitList, loss: lossList };
        
        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="card">
                    <div class="card-header bg-green-50 text-green-700 flex items-center justify-between">
                        <span><i class="fas fa-trophy mr-2"></i>盈利排行榜 TOP 20</span>
                        <button onclick="exportRankingProfit()" class="btn btn-sm bg-green-500 text-white hover:bg-green-600"><i class="fas fa-download mr-1"></i>导出</button>
                    </div>
                    <div class="p-4 max-h-[500px] overflow-y-auto">
                        ${profitList.length === 0 ? '<div class="text-center text-gray-500 py-4">暂无数据</div>' : 
                        profitList.map((p, i) => `
                            <div class="flex items-center justify-between p-2 ${i < 3 ? 'bg-green-50' : ''} rounded mb-2">
                                <div class="flex items-center">
                                    <span class="w-7 h-7 ${i < 3 ? 'bg-green-500 text-white' : 'bg-gray-200'} rounded-full flex items-center justify-center text-sm font-bold mr-3">${i + 1}</span>
                                    <div>
                                        <div class="font-medium">${escapeHtml(p.username || '')}</div>
                                        <div class="text-xs text-gray-500">VIP${p.vip_level || 0} | ${escapeHtml(p.agent_username || '-')}</div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-green-600 font-bold">+${formatMoney(Math.abs(p.total_win_loss))}</div>
                                    <div class="text-xs text-gray-500">投注: ${formatMoney(p.total_bet)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="card">
                    <div class="card-header bg-red-50 text-red-700 flex items-center justify-between">
                        <span><i class="fas fa-chart-line mr-2"></i>亏损排行榜 TOP 20</span>
                        <button onclick="exportRankingLoss()" class="btn btn-sm bg-red-500 text-white hover:bg-red-600"><i class="fas fa-download mr-1"></i>导出</button>
                    </div>
                    <div class="p-4 max-h-[500px] overflow-y-auto">
                        ${lossList.length === 0 ? '<div class="text-center text-gray-500 py-4">暂无数据</div>' : 
                        lossList.map((p, i) => `
                            <div class="flex items-center justify-between p-2 ${i < 3 ? 'bg-red-50' : ''} rounded mb-2">
                                <div class="flex items-center">
                                    <span class="w-7 h-7 ${i < 3 ? 'bg-red-500 text-white' : 'bg-gray-200'} rounded-full flex items-center justify-center text-sm font-bold mr-3">${i + 1}</span>
                                    <div>
                                        <div class="font-medium">${escapeHtml(p.username || '')}</div>
                                        <div class="text-xs text-gray-500">VIP${p.vip_level || 0} | ${escapeHtml(p.agent_username || '-')}</div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-red-600 font-bold">${formatMoney(p.total_win_loss)}</div>
                                    <div class="text-xs text-gray-500">投注: ${formatMoney(p.total_bet)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

function exportRanking() {
    const allData = [...(currentReportData.ranking?.profit || []), ...(currentReportData.ranking?.loss || [])];
    exportToExcel(allData, [
        { key: 'username', label: '会员账号' },
        { key: 'nickname', label: '昵称' },
        { key: 'vip_level', label: 'VIP等级' },
        { key: 'agent_username', label: '所属代理' },
        { key: 'total_bet', label: '总投注额' },
        { key: 'total_valid_bet', label: '有效投注' },
        { key: 'total_win_loss', label: '盈亏金额' }
    ], '盈亏排行');
}

function exportRankingProfit() {
    exportToExcel(currentReportData.ranking?.profit || [], [
        { key: 'username', label: '会员账号' },
        { key: 'nickname', label: '昵称' },
        { key: 'vip_level', label: 'VIP等级' },
        { key: 'agent_username', label: '所属代理' },
        { key: 'total_bet', label: '总投注额' },
        { key: 'total_valid_bet', label: '有效投注' },
        { key: 'total_win_loss', label: '盈利金额' }
    ], '盈利排行榜');
}

function exportRankingLoss() {
    exportToExcel(currentReportData.ranking?.loss || [], [
        { key: 'username', label: '会员账号' },
        { key: 'nickname', label: '昵称' },
        { key: 'vip_level', label: 'VIP等级' },
        { key: 'agent_username', label: '所属代理' },
        { key: 'total_bet', label: '总投注额' },
        { key: 'total_valid_bet', label: '有效投注' },
        { key: 'total_win_loss', label: '亏损金额' }
    ], '亏损排行榜');
}

// ==================== 公告管理 ====================
async function renderAnnouncements() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/announcements');
        const list = res.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>公告管理</span>
                    <button class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增公告</button>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>标题</th>
                                    <th>类型</th>
                                    <th>语言</th>
                                    <th>目标人群</th>
                                    <th>状态</th>
                                    <th>发布时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(a => `
                                    <tr>
                                        <td class="font-medium">${a.title}</td>
                                        <td>${getAnnouncementTypeBadge(a.type)}</td>
                                        <td>${a.language}</td>
                                        <td>${a.target_level}</td>
                                        <td>${a.status === 1 ? '<span class="badge badge-success">已发布</span>' : a.status === 2 ? '<span class="badge badge-warning">定时</span>' : '<span class="badge badge-info">草稿</span>'}</td>
                                        <td>${formatDate(a.publish_at)}</td>
                                        <td>
                                            <button class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>
                                            <button class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

// ==================== 系统管理 ====================
async function renderAdmins() {
    const content = document.getElementById('pageContent');
    
    try {
        const [usersRes, rolesRes] = await Promise.all([
            apiRequest('/admin/users'),
            apiRequest('/admin/roles')
        ]);
        const list = usersRes.data || [];
        const roles = rolesRes.data || [];
        
        // 获取当前登录用户信息
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span><i class="fas fa-users-cog mr-2 text-blue-500"></i>管理员账号 <span class="badge badge-primary ml-2">${list.length}</span></span>
                    <button onclick="showAddAdmin()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增管理员</button>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>账号</th>
                                    <th>昵称</th>
                                    <th>角色</th>
                                    <th>IP白名单</th>
                                    <th>2FA状态</th>
                                    <th>最后登录</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(admin => `
                                    <tr>
                                        <td class="text-gray-500">${admin.admin_id}</td>
                                        <td class="font-medium">${escapeHtml(admin.username)}</td>
                                        <td>${escapeHtml(admin.nickname) || '-'}</td>
                                        <td><span class="badge badge-info">${escapeHtml(admin.role_name || '未分配')}</span></td>
                                        <td>
                                            ${admin.ip_whitelist && admin.ip_whitelist.length > 0 
                                                ? `<span class="text-green-600 cursor-pointer" onclick="showAdminIPWhitelist(${admin.admin_id}, '${escapeAttr(admin.username)}')" title="点击管理">
                                                    <i class="fas fa-shield-alt"></i> ${admin.ip_whitelist.length}个IP
                                                   </span>`
                                                : `<span class="text-gray-400 cursor-pointer" onclick="showAdminIPWhitelist(${admin.admin_id}, '${escapeAttr(admin.username)}')" title="点击设置">
                                                    <i class="fas fa-shield-alt"></i> 未限制
                                                   </span>`
                                            }
                                        </td>
                                        <td>${admin.two_fa_enabled ? '<span class="text-green-500"><i class="fas fa-check-circle"></i> 已绑定</span>' : '<span class="text-gray-400">未绑定</span>'}</td>
                                        <td>
                                            <div class="text-sm">${escapeHtml(admin.last_login_ip) || '-'}</div>
                                            <div class="text-xs text-gray-500">${formatDate(admin.last_login_at)}</div>
                                        </td>
                                        <td>${getStatusBadge(admin.status)}</td>
                                        <td class="space-x-1">
                                            <button onclick="editAdmin(${admin.admin_id})" class="text-blue-500 hover:text-blue-700" title="编辑"><i class="fas fa-edit"></i></button>
                                            <button onclick="showAdminIPWhitelist(${admin.admin_id}, '${escapeAttr(admin.username)}')" class="text-green-500 hover:text-green-700" title="IP白名单"><i class="fas fa-shield-alt"></i></button>
                                            <button onclick="resetAdminPassword(${admin.admin_id}, '${escapeAttr(admin.username)}')" class="text-orange-500 hover:text-orange-700" title="重置密码"><i class="fas fa-key"></i></button>
                                            ${admin.admin_id !== currentUser.admin_id ? `
                                            <button onclick="toggleAdminStatus(${admin.admin_id}, ${admin.status})" class="text-${admin.status === 1 ? 'red' : 'green'}-500 hover:text-${admin.status === 1 ? 'red' : 'green'}-700" title="${admin.status === 1 ? '禁用' : '启用'}">
                                                <i class="fas fa-${admin.status === 1 ? 'ban' : 'check'}"></i>
                                            </button>` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        // 存储角色列表供后续使用
        window._adminRoles = roles;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

// 显示新增管理员弹窗
async function showAddAdmin() {
    const roles = window._adminRoles || [];
    
    showModal(`
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-plus text-blue-500 mr-2"></i>新增管理员</h3>
        <form id="addAdminForm" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">登录账号 <span class="text-red-500">*</span></label>
                    <input type="text" id="adminUsername" class="form-input w-full" placeholder="请输入登录账号" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">登录密码 <span class="text-red-500">*</span></label>
                    <input type="password" id="adminPassword" class="form-input w-full" placeholder="至少6位密码" required minlength="6">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                    <input type="text" id="adminNickname" class="form-input w-full" placeholder="请输入昵称(选填)">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">角色 <span class="text-red-500">*</span></label>
                    <select id="adminRole" class="form-input w-full" required>
                        ${roles.map(r => `<option value="${r.role_id}">${escapeHtml(r.role_name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">IP白名单 <span class="text-gray-400 text-xs">(可选，限制该账号只能从指定IP登录)</span></label>
                <div id="adminIPList" class="space-y-2 mb-2"></div>
                <button type="button" onclick="addAdminIPField()" class="text-sm text-blue-500 hover:text-blue-700"><i class="fas fa-plus mr-1"></i>添加IP地址</button>
            </div>
            <div class="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                <button type="submit" class="btn btn-primary">创建</button>
            </div>
        </form>
    `);
    
    document.getElementById('addAdminForm').onsubmit = async (e) => {
        e.preventDefault();
        await submitAdmin();
    };
}

// 添加IP输入框
function addAdminIPField(value = '') {
    const container = document.getElementById('adminIPList');
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2';
    div.innerHTML = `
        <input type="text" class="admin-ip-input form-input flex-1" value="${escapeAttr(value)}" placeholder="如: 192.168.1.100 或 10.0.0.0/24">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(div);
}

// 提交新增管理员
async function submitAdmin(adminId = null) {
    const ipInputs = document.querySelectorAll('.admin-ip-input');
    const ipList = Array.from(ipInputs).map(i => i.value.trim()).filter(v => v);
    
    const data = {
        username: document.getElementById('adminUsername')?.value.trim(),
        password: document.getElementById('adminPassword')?.value,
        nickname: document.getElementById('adminNickname')?.value.trim() || null,
        role_id: parseInt(document.getElementById('adminRole')?.value),
        ip_whitelist: ipList.length > 0 ? ipList : null
    };
    
    if (!adminId && (!data.username || !data.password)) {
        alert('请填写账号和密码'); return;
    }
    if (!adminId && data.password && data.password.length < 6) {
        alert('密码长度至少6位'); return;
    }
    
    try {
        const url = adminId ? `/admin/users/${adminId}` : '/admin/users';
        const method = adminId ? 'PUT' : 'POST';
        
        // 编辑时不传password
        if (adminId) {
            delete data.username;
            delete data.password;
        }
        
        const res = await apiRequest(url, { method, body: JSON.stringify(data) });
        if (res.success) {
            closeModal();
            alert(adminId ? '更新成功' : '创建成功');
            loadPage('system-admins');
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

// 编辑管理员
async function editAdmin(adminId) {
    try {
        const res = await apiRequest(`/admin/users/${adminId}`);
        if (!res.success) { alert('获取详情失败'); return; }
        
        const admin = res.data;
        const roles = window._adminRoles || [];
        
        showModal(`
            <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-edit text-blue-500 mr-2"></i>编辑管理员 - ${escapeHtml(admin.username)}</h3>
            <form id="editAdminForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">登录账号</label>
                        <input type="text" class="form-input w-full bg-gray-100" value="${escapeAttr(admin.username)}" disabled>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                        <input type="text" id="adminNickname" class="form-input w-full" value="${escapeAttr(admin.nickname || '')}" placeholder="请输入昵称">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">角色</label>
                        <select id="adminRole" class="form-input w-full">
                            ${roles.map(r => `<option value="${r.role_id}" ${r.role_id === admin.role_id ? 'selected' : ''}>${escapeHtml(r.role_name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">状态</label>
                        <select id="adminStatus" class="form-input w-full">
                            <option value="1" ${admin.status === 1 ? 'selected' : ''}>启用</option>
                            <option value="0" ${admin.status === 0 ? 'selected' : ''}>禁用</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">IP白名单 <span class="text-gray-400 text-xs">(限制该账号只能从指定IP登录，留空则不限制)</span></label>
                    <div id="adminIPList" class="space-y-2 mb-2"></div>
                    <button type="button" onclick="addAdminIPField()" class="text-sm text-blue-500 hover:text-blue-700"><i class="fas fa-plus mr-1"></i>添加IP地址</button>
                </div>
                <div class="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        `);
        
        // 填充现有IP白名单
        if (admin.ip_whitelist && admin.ip_whitelist.length > 0) {
            admin.ip_whitelist.forEach(ip => addAdminIPField(ip));
        }
        
        document.getElementById('editAdminForm').onsubmit = async (e) => {
            e.preventDefault();
            const ipInputs = document.querySelectorAll('.admin-ip-input');
            const ipList = Array.from(ipInputs).map(i => i.value.trim()).filter(v => v);
            
            const data = {
                nickname: document.getElementById('adminNickname').value.trim() || null,
                role_id: parseInt(document.getElementById('adminRole').value),
                status: parseInt(document.getElementById('adminStatus').value),
                ip_whitelist: ipList.length > 0 ? ipList : null
            };
            
            try {
                const res = await apiRequest(`/admin/users/${adminId}`, { method: 'PUT', body: JSON.stringify(data) });
                if (res.success) {
                    closeModal();
                    alert('更新成功');
                    loadPage('system-admins');
                } else {
                    alert(res.message || '更新失败');
                }
            } catch (error) {
                alert('更新失败: ' + error.message);
            }
        };
    } catch (error) {
        alert('获取详情失败: ' + error.message);
    }
}

// 显示管理员IP白名单管理弹窗
async function showAdminIPWhitelist(adminId, username) {
    try {
        const res = await apiRequest(`/admin/users/${adminId}`);
        if (!res.success) { alert('获取详情失败'); return; }
        
        const admin = res.data;
        const ipList = admin.ip_whitelist || [];
        
        showModal(`
            <h3 class="text-lg font-bold mb-4">
                <i class="fas fa-shield-alt text-green-500 mr-2"></i>
                IP白名单 - ${escapeHtml(username)}
            </h3>
            <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <i class="fas fa-info-circle text-yellow-600 mr-1"></i>
                <span class="text-yellow-700 text-sm">设置IP白名单后，该账号只能从指定IP登录系统。留空则不限制登录IP。</span>
            </div>
            <form id="adminIPWhitelistForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">允许登录的IP地址</label>
                    <div id="adminIPList" class="space-y-2 mb-3 max-h-60 overflow-y-auto">
                        ${ipList.length === 0 ? '<div class="text-gray-400 text-sm py-2">暂未设置IP限制</div>' : ''}
                    </div>
                    <button type="button" onclick="addAdminIPField()" class="text-sm text-blue-500 hover:text-blue-700">
                        <i class="fas fa-plus mr-1"></i>添加IP地址
                    </button>
                </div>
                <div class="text-sm text-gray-500 space-y-1">
                    <div><strong>支持格式：</strong></div>
                    <div>• 单个IP：<code class="bg-gray-100 px-1 rounded">192.168.1.100</code></div>
                    <div>• CIDR网段：<code class="bg-gray-100 px-1 rounded">10.0.0.0/24</code></div>
                </div>
                <div class="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                    <button type="submit" class="btn btn-primary">保存设置</button>
                </div>
            </form>
        `);
        
        // 填充现有IP
        if (ipList.length > 0) {
            document.getElementById('adminIPList').innerHTML = '';
            ipList.forEach(ip => addAdminIPField(ip));
        }
        
        document.getElementById('adminIPWhitelistForm').onsubmit = async (e) => {
            e.preventDefault();
            await saveAdminIPWhitelist(adminId);
        };
    } catch (error) {
        alert('获取详情失败: ' + error.message);
    }
}

// 保存管理员IP白名单
async function saveAdminIPWhitelist(adminId) {
    const ipInputs = document.querySelectorAll('.admin-ip-input');
    const ipList = Array.from(ipInputs).map(i => i.value.trim()).filter(v => v);
    
    // 验证IP格式
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    
    for (const ip of ipList) {
        if (!ipv4Regex.test(ip) && !cidrRegex.test(ip)) {
            alert(`IP地址格式无效: ${ip}`);
            return;
        }
    }
    
    try {
        const res = await apiRequest(`/admin/users/${adminId}`, {
            method: 'PUT',
            body: JSON.stringify({ ip_whitelist: ipList.length > 0 ? ipList : null })
        });
        
        if (res.success) {
            closeModal();
            alert(ipList.length > 0 ? `已设置 ${ipList.length} 个IP白名单` : 'IP限制已清除');
            loadPage('system-admins');
        } else {
            alert(res.message || '保存失败');
        }
    } catch (error) {
        alert('保存失败: ' + error.message);
    }
}

// 重置管理员密码
async function resetAdminPassword(adminId, username) {
    const newPassword = prompt(`请输入管理员 "${username}" 的新密码（至少6位）:`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
        alert('密码长度至少6位');
        return;
    }
    
    try {
        const res = await apiRequest(`/admin/users/${adminId}/password`, {
            method: 'PUT',
            body: JSON.stringify({ password: newPassword })
        });
        
        if (res.success) {
            alert('密码重置成功');
        } else {
            alert(res.message || '重置失败');
        }
    } catch (error) {
        alert('重置失败: ' + error.message);
    }
}

// 切换管理员状态
async function toggleAdminStatus(adminId, currentStatus) {
    const newStatus = currentStatus === 1 ? 0 : 1;
    const action = newStatus === 1 ? '启用' : '禁用';
    
    if (!confirm(`确定要${action}该管理员吗？`)) return;
    
    try {
        const res = await apiRequest(`/admin/users/${adminId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (res.success) {
            alert(`${action}成功`);
            loadPage('system-admins');
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

async function renderAuditLogs() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/admin/audit-logs');
        const { list, total } = res.data;
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>操作日志</span>
                    <span class="text-sm text-gray-500">共 ${total} 条记录</span>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>时间</th>
                                    <th>操作员</th>
                                    <th>操作类型</th>
                                    <th>目标表</th>
                                    <th>目标ID</th>
                                    <th>IP地址</th>
                                    <th>备注</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(log => `
                                    <tr>
                                        <td>${formatDate(log.created_at)}</td>
                                        <td class="font-medium">${log.admin_username}</td>
                                        <td><span class="badge badge-info">${log.operation_type}</span></td>
                                        <td>${log.target_table || '-'}</td>
                                        <td>${log.target_id || '-'}</td>
                                        <td class="font-mono text-sm">${log.ip_address || '-'}</td>
                                        <td class="text-sm text-gray-600">${log.new_value || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

// ==================== 现场运营 ====================
async function renderDealers() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/dealers');
        const list = res.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>荷官档案库 <span class="badge badge-primary">${list.length}</span></span>
                    <button onclick="showAddDealer()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增荷官</button>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${list.map(dealer => `
                            <div class="border rounded-lg p-4 text-center hover:shadow-lg transition">
                                <div class="w-20 h-20 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-2xl">
                                    <i class="fas fa-user"></i>
                                </div>
                                <h3 class="font-bold">${escapeHtml(dealer.stage_name_cn)}</h3>
                                <p class="text-sm text-gray-500">${escapeHtml(dealer.stage_name_en || '-')}</p>
                                <p class="text-xs text-gray-400 mt-1">工号: ${escapeHtml(dealer.staff_id)}</p>
                                <div class="mt-2">
                                    ${dealer.status === 1 ? '<span class="badge badge-success">在职</span>' : dealer.status === 2 ? '<span class="badge badge-warning">休假</span>' : '<span class="badge badge-danger">离职</span>'}
                                </div>
                                <div class="mt-3 flex justify-center space-x-2">
                                    <button onclick="editDealer(${dealer.dealer_id})" class="btn btn-outline text-xs"><i class="fas fa-edit"></i> 编辑</button>
                                    <button onclick="deleteDealer(${dealer.dealer_id}, '${escapeAttr(dealer.stage_name_cn)}')" class="btn btn-danger text-xs"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

async function renderTables() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/tables');
        const list = res.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>桌台配置 <span class="badge badge-primary">${list.length}</span></span>
                    <button onclick="showAddTable()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增桌台</button>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>桌台代码</th>
                                    <th>桌台名称</th>
                                    <th>游戏类型</th>
                                    <th>当前荷官</th>
                                    <th>投注限额</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(table => `
                                    <tr>
                                        <td class="font-medium">${escapeHtml(table.table_code)}</td>
                                        <td>${escapeHtml(table.table_name || '-')}</td>
                                        <td><span class="badge badge-info">${escapeHtml(table.game_type)}</span></td>
                                        <td>${table.dealer_name ? escapeHtml(table.dealer_name) : '<span class="text-gray-400">空缺</span>'}</td>
                                        <td>¥${formatNumber(table.min_bet)} - ¥${formatNumber(table.max_bet)}</td>
                                        <td>${table.status === 1 ? '<span class="badge badge-success">正常</span>' : table.status === 0 ? '<span class="badge badge-warning">维护</span>' : '<span class="badge badge-danger">关闭</span>'}</td>
                                        <td>
                                            <button onclick="editTable(${table.table_id})" class="text-blue-500 hover:text-blue-700 mr-2" title="编辑"><i class="fas fa-edit"></i></button>
                                            <button onclick="deleteTable(${table.table_id}, '${escapeAttr(table.table_code)}')" class="text-red-500 hover:text-red-700" title="删除"><i class="fas fa-trash"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

async function renderShifts() {
    const content = document.getElementById('pageContent');
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const [shiftsRes, dealersRes, tablesRes] = await Promise.all([
            apiRequest(`/shifts?date=${today}`),
            apiRequest('/dealers'),
            apiRequest('/tables')
        ]);
        
        const list = shiftsRes.data || [];
        const dealers = dealersRes.data?.list || [];
        const tables = tablesRes.data?.list || [];
        
        // 按桌台分组
        const tableShifts = {};
        list.forEach(shift => {
            if (!tableShifts[shift.table_code]) {
                tableShifts[shift.table_code] = {
                    table_name: shift.table_name || shift.table_code,
                    shifts: []
                };
            }
            tableShifts[shift.table_code].shifts.push(shift);
        });
        
        // 班次颜色
        const shiftColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div class="flex items-center">
                            <i class="fas fa-calendar-alt mr-2 text-purple-500"></i>
                            <span class="font-semibold">智能排班管理</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <input type="date" id="shiftDate" value="${today}" class="px-3 py-2 border rounded-lg text-sm" onchange="loadShiftsByDate()">
                            <button onclick="loadShiftsByDate()" class="btn btn-outline text-sm">
                                <i class="fas fa-sync mr-1"></i>刷新
                            </button>
                            <button onclick="showAddShift()" class="btn btn-primary text-sm">
                                <i class="fas fa-plus mr-1"></i>新增排班
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body p-0">
                    <!-- 统计信息 -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 border-b">
                        <div class="bg-white rounded-lg p-3 text-center shadow-sm">
                            <div class="text-xl font-bold text-blue-600">${Object.keys(tableShifts).length}</div>
                            <div class="text-xs text-gray-500">排班桌台</div>
                        </div>
                        <div class="bg-white rounded-lg p-3 text-center shadow-sm">
                            <div class="text-xl font-bold text-green-600">${list.length}</div>
                            <div class="text-xs text-gray-500">班次数量</div>
                        </div>
                        <div class="bg-white rounded-lg p-3 text-center shadow-sm">
                            <div class="text-xl font-bold text-purple-600">${new Set(list.map(s => s.dealer_id)).size}</div>
                            <div class="text-xs text-gray-500">值班荷官</div>
                        </div>
                        <div class="bg-white rounded-lg p-3 text-center shadow-sm">
                            <div class="text-xl font-bold text-orange-600">${tables.length}</div>
                            <div class="text-xs text-gray-500">总桌台数</div>
                        </div>
                    </div>
                    
                    <!-- 排班表格 -->
                    <div class="p-4">
                        ${Object.keys(tableShifts).length === 0 ? `
                            <div class="text-center py-10 text-gray-500">
                                <i class="fas fa-calendar-times text-4xl mb-3 block"></i>
                                <p>当日暂无排班数据</p>
                                <button onclick="showAddShift()" class="btn btn-primary mt-4">
                                    <i class="fas fa-plus mr-1"></i>添加排班
                                </button>
                            </div>
                        ` : `
                            <div class="overflow-x-auto">
                                <table class="data-table w-full">
                                    <thead>
                                        <tr>
                                            <th class="text-left" style="min-width:100px">桌台</th>
                                            <th class="text-left" style="min-width:100px">荷官</th>
                                            <th class="text-center" style="min-width:80px">班次</th>
                                            <th class="text-center" style="min-width:120px">时间段</th>
                                            <th class="text-center" style="min-width:80px">状态</th>
                                            <th class="text-center" style="min-width:100px">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${list.map((shift, idx) => `
                                            <tr>
                                                <td>
                                                    <div class="font-medium">${escapeHtml(shift.table_code || '-')}</div>
                                                    <div class="text-xs text-gray-400">${escapeHtml(shift.table_name || '')}</div>
                                                </td>
                                                <td>
                                                    <div class="flex items-center">
                                                        <div class="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 text-white flex items-center justify-center mr-2 text-xs flex-shrink-0">
                                                            ${(shift.stage_name_cn || shift.dealer_name || '?')[0]}
                                                        </div>
                                                        <div>
                                                            <div class="font-medium">${escapeHtml(shift.stage_name_cn || shift.dealer_name || '-')}</div>
                                                            <div class="text-xs text-gray-400">${escapeHtml(shift.stage_name_en || '')}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="text-center">
                                                    <span class="inline-block px-2 py-1 rounded text-xs text-white ${shiftColors[idx % shiftColors.length]}">
                                                        ${shift.shift_type || '常规'}
                                                    </span>
                                                </td>
                                                <td class="text-center">
                                                    <span class="font-mono text-sm">${shift.start_time || '00:00'}</span>
                                                    <span class="text-gray-400 mx-1">-</span>
                                                    <span class="font-mono text-sm">${shift.end_time || '00:00'}</span>
                                                </td>
                                                <td class="text-center">
                                                    <span class="badge ${shift.status === 1 ? 'badge-success' : 'badge-warning'}">
                                                        ${shift.status === 1 ? '已确认' : '待确认'}
                                                    </span>
                                                </td>
                                                <td class="text-center">
                                                    <button onclick="editShift(${shift.shift_id})" class="text-blue-500 hover:text-blue-700 mr-2" title="编辑">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                    <button onclick="deleteShift(${shift.shift_id})" class="text-red-500 hover:text-red-700" title="删除">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>
                    
                    <!-- 时间线视图 -->
                    ${Object.keys(tableShifts).length > 0 ? `
                    <div class="p-4 border-t bg-gray-50">
                        <h4 class="font-semibold text-gray-700 mb-3"><i class="fas fa-clock mr-1"></i>时间线视图</h4>
                        <div class="overflow-x-auto">
                            <div style="min-width: 800px;">
                                <!-- 时间刻度 -->
                                <div class="flex items-center border-b pb-2 mb-3">
                                    <div class="w-24 flex-shrink-0 text-sm font-medium text-gray-600">桌台</div>
                                    <div class="flex-1 flex">
                                        ${[0,2,4,6,8,10,12,14,16,18,20,22].map(h => `
                                            <div class="flex-1 text-center text-xs text-gray-400">${String(h).padStart(2,'0')}:00</div>
                                        `).join('')}
                                    </div>
                                </div>
                                <!-- 排班行 -->
                                ${Object.entries(tableShifts).map(([code, data]) => `
                                    <div class="flex items-center mb-2">
                                        <div class="w-24 flex-shrink-0">
                                            <div class="text-sm font-medium">${escapeHtml(code)}</div>
                                        </div>
                                        <div class="flex-1 relative h-8 bg-gray-200 rounded overflow-hidden">
                                            ${data.shifts.map((shift, idx) => {
                                                const startParts = (shift.start_time || '0:0').split(':');
                                                const endParts = (shift.end_time || '24:0').split(':');
                                                const startHour = parseInt(startParts[0]) + parseInt(startParts[1] || 0) / 60;
                                                let endHour = parseInt(endParts[0]) + parseInt(endParts[1] || 0) / 60;
                                                if (endHour <= startHour) endHour = 24;
                                                const left = (startHour / 24) * 100;
                                                const width = Math.max(((endHour - startHour) / 24) * 100, 2);
                                                return `
                                                    <div class="absolute top-0 h-full ${shiftColors[idx % shiftColors.length]} text-white text-xs flex items-center justify-center overflow-hidden rounded"
                                                         style="left: ${left}%; width: ${width}%;" title="${shift.stage_name_cn || ''} ${shift.start_time}-${shift.end_time}">
                                                        <span class="truncate px-1">${shift.stage_name_cn || ''}</span>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // 存储数据供弹窗使用
        window._shiftDealers = dealers;
        window._shiftTables = tables;
        
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

async function loadShiftsByDate() {
    renderShifts();
}

function showAddShift() {
    const dealers = window._shiftDealers || [];
    const tables = window._shiftTables || [];
    const today = document.getElementById('shiftDate')?.value || new Date().toISOString().split('T')[0];
    
    openModal(`
        <div class="card-header"><i class="fas fa-plus mr-2 text-green-500"></i>新增排班</div>
        <div class="p-6">
            <form id="addShiftForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
                        <input type="date" id="shiftDateInput" value="${today}" required class="form-input w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">桌台 *</label>
                        <select id="shiftTable" required class="form-input w-full">
                            <option value="">请选择桌台</option>
                            ${tables.map(t => `<option value="${t.table_id}">${escapeHtml(t.table_code)} - ${escapeHtml(t.table_name || '')}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">荷官 *</label>
                    <select id="shiftDealer" required class="form-input w-full">
                        <option value="">请选择荷官</option>
                        ${dealers.map(d => `<option value="${d.dealer_id}">${escapeHtml(d.stage_name_cn || d.real_name)} (${escapeHtml(d.stage_name_en || '')})</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">开始时间 *</label>
                        <input type="time" id="shiftStartTime" value="09:00" required class="form-input w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">结束时间 *</label>
                        <input type="time" id="shiftEndTime" value="17:00" required class="form-input w-full">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">班次类型</label>
                    <select id="shiftType" class="form-input w-full">
                        <option value="早班">早班</option>
                        <option value="中班">中班</option>
                        <option value="晚班">晚班</option>
                        <option value="全天">全天</option>
                    </select>
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" onclick="closeModal()" class="btn btn-outline">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        </div>
    `);
    
    document.getElementById('addShiftForm').onsubmit = async (e) => {
        e.preventDefault();
        await submitAddShift();
    };
}

async function submitAddShift() {
    const data = {
        shift_date: document.getElementById('shiftDateInput').value,
        table_id: parseInt(document.getElementById('shiftTable').value),
        dealer_id: parseInt(document.getElementById('shiftDealer').value),
        start_time: document.getElementById('shiftStartTime').value,
        end_time: document.getElementById('shiftEndTime').value,
        shift_type: document.getElementById('shiftType').value,
        status: 1
    };
    
    try {
        const res = await apiRequest('/shifts', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        if (res.success) {
            alert('排班已添加');
            closeModal();
            renderShifts();
        } else {
            alert(res.message || '添加失败');
        }
    } catch (error) {
        alert('添加失败: ' + error.message);
    }
}

async function editShift(shiftId) {
    alert('编辑排班功能开发中...');
}

async function deleteShift(shiftId) {
    if (!confirm('确定要删除此排班记录吗？')) return;
    
    try {
        const res = await apiRequest(`/shifts/${shiftId}`, { method: 'DELETE' });
        if (res.success) {
            alert('已删除');
            renderShifts();
        } else {
            alert(res.message || '删除失败');
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

// ==================== 辅助函数 ====================
function formatMoney(value) {
    return '¥ ' + formatNumber(value);
}

function formatNumber(value) {
    if (value === null || value === undefined) return '0';
    const num = parseFloat(value);
    if (Math.abs(num) >= 10000) {
        return (num / 10000).toFixed(2) + '万';
    }
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
}

function getStatusBadge(status) {
    switch (parseInt(status)) {
        case 1: return '<span class="badge badge-success">正常</span>';
        case 0: return '<span class="badge badge-danger">冻结</span>';
        case 2: return '<span class="badge badge-warning">锁定</span>';
        default: return '<span class="badge badge-info">未知</span>';
    }
}

function getLevelBadge(level) {
    switch (parseInt(level)) {
        case 1: return '<span class="badge badge-danger ml-2">股东</span>';
        case 2: return '<span class="badge badge-warning ml-2">总代</span>';
        case 3: return '<span class="badge badge-info ml-2">代理</span>';
        default: return '';
    }
}

function getTransactionTypeBadge(type) {
    const types = {
        1: { label: '存款', class: 'badge-success' },
        2: { label: '取款', class: 'badge-danger' },
        3: { label: '投注', class: 'badge-info' },
        4: { label: '派彩', class: 'badge-success' },
        5: { label: '红利', class: 'badge-warning' },
        6: { label: '洗码', class: 'badge-info' },
        7: { label: '调整', class: 'badge-warning' }
    };
    const t = types[type] || { label: '未知', class: 'badge-info' };
    return `<span class="badge ${t.class}">${t.label}</span>`;
}

function getAuditStatusBadge(status) {
    switch (parseInt(status)) {
        case 0: return '<span class="badge badge-warning">待审核</span>';
        case 1: return '<span class="badge badge-success">已通过</span>';
        case 2: return '<span class="badge badge-danger">已拒绝</span>';
        case 3: return '<span class="badge badge-info">已锁定</span>';
        default: return '<span class="badge badge-info">未知</span>';
    }
}

function getBetStatusBadge(status) {
    switch (parseInt(status)) {
        case 0: return '<span class="badge badge-warning">未结算</span>';
        case 1: return '<span class="badge badge-success">已结算</span>';
        case 2: return '<span class="badge badge-danger">已取消</span>';
        case 3: return '<span class="badge badge-info">废单</span>';
        default: return '<span class="badge badge-info">未知</span>';
    }
}

function getRiskLevelBadge(level) {
    switch (parseInt(level)) {
        case 1: return '<span class="badge badge-success">低</span>';
        case 2: return '<span class="badge badge-warning">中</span>';
        case 3: return '<span class="badge badge-danger">高</span>';
        default: return '<span class="badge badge-info">-</span>';
    }
}

function getAlertStatusBadge(status) {
    switch (parseInt(status)) {
        case 0: return '<span class="badge badge-danger">待处理</span>';
        case 1: return '<span class="badge badge-success">已处理</span>';
        case 2: return '<span class="badge badge-info">已忽略</span>';
        default: return '<span class="badge badge-info">未知</span>';
    }
}

function getAnnouncementTypeBadge(type) {
    switch (parseInt(type)) {
        case 1: return '<span class="badge badge-info">跑马灯</span>';
        case 2: return '<span class="badge badge-warning">弹窗</span>';
        case 3: return '<span class="badge badge-success">轮播图</span>';
        default: return '<span class="badge badge-info">其他</span>';
    }
}

function formatBetDetail(detail) {
    try {
        const d = JSON.parse(detail);
        return `${d.area} ¥${formatNumber(d.amount)}`;
    } catch {
        return detail || '-';
    }
}

// ==================== 操作函数 ====================
async function auditTransaction(id, action) {
    if (!confirm(`确定要${action === 'approve' ? '通过' : '拒绝'}此交易吗？`)) return;
    
    try {
        await apiRequest(`/finance/transactions/${id}/audit`, {
            method: 'POST',
            body: JSON.stringify({ action })
        });
        alert('操作成功');
        loadPage(currentPage);
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

async function togglePlayerStatus(userId, currentStatus) {
    const newStatus = currentStatus === 1 ? 0 : 1;
    const action = newStatus === 0 ? '冻结' : '解冻';
    
    if (!confirm(`确定要${action}此玩家吗？`)) return;
    
    try {
        await apiRequest(`/players/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        alert('操作成功');
        loadPage('players');
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

function viewPlayer(userId) {
    // TODO: 打开玩家详情弹窗
    alert('查看玩家详情: ' + userId);
}

// 人工存取款
function showManualAdjustment(type) {
    const title = type === 'deposit' ? '人工存款（上分）' : '人工提款（下分）';
    const btnClass = type === 'deposit' ? 'btn-success' : 'btn-danger';
    const icon = type === 'deposit' ? 'fa-plus-circle' : 'fa-minus-circle';
    
    openModal(`
        <div class="p-6" style="min-width: 400px;">
            <h3 class="text-lg font-bold mb-4">
                <i class="fas ${icon} mr-2 ${type === 'deposit' ? 'text-green-500' : 'text-orange-500'}"></i>
                ${title}
            </h3>
            <form id="manualAdjustForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">玩家账号/ID <span class="text-red-500">*</span></label>
                    <input type="text" id="adjustUserId" class="form-input w-full" placeholder="请输入玩家账号或ID" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">金额 <span class="text-red-500">*</span></label>
                    <input type="number" id="adjustAmount" class="form-input w-full" placeholder="请输入金额" min="0.01" step="0.01" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">备注 <span class="text-red-500">*</span></label>
                    <textarea id="adjustRemark" class="form-input w-full" rows="3" placeholder="请输入操作原因（如：活动赠送、误操作冲正等）" required></textarea>
                </div>
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                    <button type="submit" class="btn ${btnClass}">
                        <i class="fas ${icon} mr-1"></i> 确认${type === 'deposit' ? '存款' : '提款'}
                    </button>
                </div>
            </form>
        </div>
    `);
    
    // 绑定表单提交
    document.getElementById('manualAdjustForm').onsubmit = async (e) => {
        e.preventDefault();
        await submitManualAdjustment(type);
    };
}

async function submitManualAdjustment(type) {
    const userIdInput = document.getElementById('adjustUserId').value.trim();
    const amount = parseFloat(document.getElementById('adjustAmount').value);
    const remark = document.getElementById('adjustRemark').value.trim();
    
    console.log('[ManualAdjust] Input:', { userIdInput, amount, type, remark });
    
    if (!userIdInput) {
        alert('请输入玩家账号或ID');
        return;
    }
    if (!amount || amount <= 0) {
        alert('请输入有效金额');
        return;
    }
    if (!remark) {
        alert('请输入操作备注');
        return;
    }
    
    // 确认操作
    const action = type === 'deposit' ? '存款' : '提款';
    if (!confirm(`确认为玩家 ${userIdInput} 执行${action}操作？\n金额: ¥${amount.toFixed(2)}\n备注: ${remark}`)) {
        return;
    }
    
    try {
        // 如果输入的不是纯数字，先查询玩家ID
        let userId = userIdInput;
        if (!/^\d+$/.test(userIdInput)) {
            console.log('[ManualAdjust] Searching player by username:', userIdInput);
            const searchRes = await apiRequest(`/players?username=${encodeURIComponent(userIdInput)}&size=1`);
            console.log('[ManualAdjust] Search result:', searchRes);
            if (!searchRes.data?.list?.length) {
                alert('未找到该玩家账号');
                return;
            }
            userId = searchRes.data.list[0].user_id;
            console.log('[ManualAdjust] Found user_id:', userId);
        }
        
        console.log('[ManualAdjust] Submitting request:', { user_id: parseInt(userId), amount, type, remark });
        const res = await apiRequest('/finance/manual-adjustment', {
            method: 'POST',
            body: JSON.stringify({
                user_id: parseInt(userId),
                amount: amount,
                type: type,
                remark: remark
            })
        });
        
        console.log('[ManualAdjust] Response:', res);
        
        if (res.success) {
            closeModal();
            alert(`${action}成功！\n订单号: ${res.data?.order_no || ''}`);
            loadPage('dashboard');
        } else {
            alert(`${action}失败: ${res.message || '未知错误'}`);
        }
    } catch (error) {
        console.error('[ManualAdjust] Error:', error);
        alert(`操作失败: ${error.message || '网络错误'}`);
    }
}

// 踢线玩家
async function kickPlayer(userId, username) {
    const reason = prompt(`确定要将玩家 ${username} 踢下线吗？\n请输入踢线原因:`);
    if (reason === null) return; // 用户取消
    
    try {
        await apiRequest(`/players/${userId}/kick`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || '管理员操作' })
        });
        alert(`玩家 ${username} 已被踢下线`);
        loadPage('players-online');
    } catch (error) {
        alert('踢线失败: ' + error.message);
    }
}

function searchPlayers() {
    // TODO: 实现搜索
    loadPage('players');
}

// 模态框
function openModal(content) {
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = content;
    modalContent.className = 'modal-content bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full';
    document.getElementById('modal').classList.add('active');
}

// 支持自定义宽度的模态框
function showModal(content, widthClass = 'max-w-lg') {
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = content;
    modalContent.className = `modal-content bg-white rounded-xl shadow-2xl p-6 ${widthClass} w-full`;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
});

// ==================== 新增页面渲染函数 ====================

// 流水稽核规则 - 完整CRUD
async function renderTurnoverRules() {
    const content = document.getElementById('pageContent');
    try {
        const data = await apiRequest('/finance/turnover-rules');
        const rules = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <h3 class="text-lg font-semibold"><i class="fas fa-clipboard-check mr-2 text-blue-500"></i>流水稽核规则</h3>
                    <button onclick="showAddTurnoverRule()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增规则</button>
                </div>
                <div class="p-4">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>规则名称</th>
                                <th>倍数</th>
                                <th>适用游戏</th>
                                <th>有效天数</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rules.length === 0 ? '<tr><td colspan="7" class="text-center text-gray-500 py-4">暂无稽核规则</td></tr>' :
                            rules.map(r => `
                                <tr>
                                    <td>${r.rule_id}</td>
                                    <td class="font-medium">${escapeHtml(r.rule_name)}</td>
                                    <td class="font-semibold text-blue-600">${r.multiplier}x</td>
                                    <td class="text-sm">${escapeHtml(r.games_included || '全部')}</td>
                                    <td>${r.valid_days}天</td>
                                    <td>
                                        <button onclick="toggleTurnoverStatus(${r.rule_id}, ${r.status})" class="cursor-pointer">
                                            ${r.status === 1 ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-danger">禁用</span>'}
                                        </button>
                                    </td>
                                    <td>
                                        <button onclick="editTurnoverRule(${r.rule_id})" class="text-blue-500 hover:text-blue-700 mr-2" title="编辑"><i class="fas fa-edit"></i></button>
                                        <button onclick="deleteTurnoverRule(${r.rule_id}, '${escapeAttr(r.rule_name)}')" class="text-red-500 hover:text-red-700" title="删除"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

function showAddTurnoverRule() {
    openModal(`
        <div class="card-header"><i class="fas fa-plus-circle mr-2 text-blue-500"></i>新增流水稽核规则</div>
        <div class="p-6">
            <form id="turnoverRuleForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">规则名称 *</label>
                    <input type="text" id="turnoverRuleName" required class="form-input w-full" placeholder="如：普通存款流水">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">流水倍数 *</label>
                        <input type="number" id="turnoverMultiplier" required step="0.1" min="0" class="form-input w-full" placeholder="如：3">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">有效天数 *</label>
                        <input type="number" id="turnoverValidDays" required min="1" class="form-input w-full" placeholder="如：30">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">适用游戏</label>
                    <input type="text" id="turnoverGames" class="form-input w-full" placeholder="留空表示全部，多个用逗号分隔：百家乐,龙虎">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">描述说明</label>
                    <textarea id="turnoverDescription" rows="2" class="form-input w-full" placeholder="规则描述"></textarea>
                </div>
                <div class="flex items-center">
                    <input type="checkbox" id="turnoverStatus" checked class="mr-2">
                    <label for="turnoverStatus" class="text-sm">立即启用</label>
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" onclick="closeModal()" class="btn btn-outline">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        </div>
    `);
    document.getElementById('turnoverRuleForm').onsubmit = async (e) => { e.preventDefault(); await submitTurnoverRule(); };
}

async function submitTurnoverRule(ruleId = null) {
    const data = {
        rule_name: document.getElementById('turnoverRuleName').value,
        multiplier: parseFloat(document.getElementById('turnoverMultiplier').value),
        valid_days: parseInt(document.getElementById('turnoverValidDays').value),
        games_included: document.getElementById('turnoverGames').value || null,
        description: document.getElementById('turnoverDescription').value || null,
        status: document.getElementById('turnoverStatus').checked ? 1 : 0
    };
    
    try {
        const url = ruleId ? `/finance/turnover-rules/${ruleId}` : '/finance/turnover-rules';
        const method = ruleId ? 'PUT' : 'POST';
        const res = await apiRequest(url, { method, body: JSON.stringify(data) });
        if (res.success) {
            alert(ruleId ? '更新成功' : '添加成功');
            closeModal();
            renderTurnoverRules();
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

async function editTurnoverRule(ruleId) {
    try {
        const res = await apiRequest(`/finance/turnover-rules/${ruleId}`);
        const rule = res.data;
        showAddTurnoverRule();
        document.querySelector('.card-header').innerHTML = '<i class="fas fa-edit mr-2 text-blue-500"></i>编辑流水稽核规则';
        document.getElementById('turnoverRuleName').value = rule.rule_name || '';
        document.getElementById('turnoverMultiplier').value = rule.multiplier || '';
        document.getElementById('turnoverValidDays').value = rule.valid_days || '';
        document.getElementById('turnoverGames').value = rule.games_included || '';
        document.getElementById('turnoverDescription').value = rule.description || '';
        document.getElementById('turnoverStatus').checked = rule.status === 1;
        document.getElementById('turnoverRuleForm').onsubmit = async (e) => { e.preventDefault(); await submitTurnoverRule(ruleId); };
    } catch (error) {
        alert('获取规则信息失败: ' + error.message);
    }
}

async function deleteTurnoverRule(ruleId, ruleName) {
    if (!confirm(`确定要删除流水稽核规则「${ruleName}」吗？`)) return;
    try {
        const res = await apiRequest(`/finance/turnover-rules/${ruleId}`, { method: 'DELETE' });
        if (res.success) {
            alert('删除成功');
            renderTurnoverRules();
        } else {
            alert(res.message || '删除失败');
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

async function toggleTurnoverStatus(ruleId, currentStatus) {
    const newStatus = currentStatus === 1 ? 0 : 1;
    try {
        const res = await apiRequest(`/finance/turnover-rules/${ruleId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        if (res.success) {
            renderTurnoverRules();
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

// 实时注单监控
async function renderRealtimeBets() {
    const content = document.getElementById('pageContent');
    try {
        const data = await apiRequest('/bets/realtime');
        const bets = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="text-lg font-semibold">
                        <i class="fas fa-broadcast-tower mr-2 text-red-500"></i>实时注单监控
                        <span class="badge badge-danger ml-2">${bets.length}</span>
                    </h3>
                    <button onclick="renderRealtimeBets()" class="btn btn-primary text-sm">
                        <i class="fas fa-sync-alt mr-1"></i> 刷新
                    </button>
                </div>
                <div class="p-4">
                    <table class="data-table">
                        <thead>
                            <tr><th>注单号</th><th>会员</th><th>游戏</th><th>桌台</th><th>金额</th><th>时间</th></tr>
                        </thead>
                        <tbody>
                            ${bets.length === 0 ? '<tr><td colspan="6" class="text-center text-gray-500 py-4">暂无实时注单</td></tr>' : 
                            bets.map(b => `
                                <tr>
                                    <td class="font-mono text-sm">${escapeHtml(b.bet_no || '')}</td>
                                    <td>${escapeHtml(b.username || '')}</td>
                                    <td><span class="badge badge-info">${escapeHtml(b.game_type || '')}</span></td>
                                    <td>${escapeHtml(b.table_no || '')}</td>
                                    <td class="font-semibold text-blue-600">${formatMoney(b.bet_amount)}</td>
                                    <td class="text-sm text-gray-500">${formatDate(b.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        setTimeout(() => { if (currentPage === 'bets-realtime') renderRealtimeBets(); }, 10000);
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

// 特殊注单监控
async function renderSpecialBets() {
    const content = document.getElementById('pageContent');
    try {
        const data = await apiRequest('/bets/special');
        const bets = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="text-lg font-semibold">
                        <i class="fas fa-exclamation-triangle mr-2 text-orange-500"></i>特殊注单监控
                        <span class="badge badge-warning ml-2">${bets.length}</span>
                    </h3>
                    <button onclick="renderSpecialBets()" class="btn btn-primary text-sm"><i class="fas fa-sync-alt mr-1"></i> 刷新</button>
                </div>
                <div class="p-4">
                    <div class="mb-4 p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
                        <i class="fas fa-info-circle mr-1"></i> 特殊注单包括: 高赔率(>5倍), 三宝, 围骰, 对子等
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr><th>注单号</th><th>会员</th><th>游戏</th><th>类型</th><th>金额</th><th>赔率</th><th>时间</th></tr>
                        </thead>
                        <tbody>
                            ${bets.length === 0 ? '<tr><td colspan="7" class="text-center text-gray-500 py-4">暂无特殊注单</td></tr>' : 
                            bets.map(b => `
                                <tr class="${parseFloat(b.odds) > 5 ? 'bg-red-50' : ''}">
                                    <td class="font-mono text-sm">${escapeHtml(b.bet_no || '')}</td>
                                    <td>${escapeHtml(b.username || '')}</td>
                                    <td><span class="badge badge-info">${escapeHtml(b.game_type || '')}</span></td>
                                    <td><span class="badge badge-warning">${escapeHtml(b.special_type || '高赔率')}</span></td>
                                    <td class="font-semibold text-red-600">${formatMoney(b.bet_amount)}</td>
                                    <td class="font-semibold text-orange-600">${b.odds || '-'}x</td>
                                    <td class="text-sm text-gray-500">${formatDate(b.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

// 风控规则 - 完整CRUD
async function renderRiskRules() {
    const content = document.getElementById('pageContent');
    try {
        const data = await apiRequest('/risk/rules');
        const rules = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <h3 class="text-lg font-semibold"><i class="fas fa-gavel mr-2 text-red-500"></i>风控规则管理</h3>
                    <button onclick="showAddRiskRule()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增规则</button>
                </div>
                <div class="p-4">
                    <table class="data-table">
                        <thead>
                            <tr><th>ID</th><th>规则名称</th><th>类型</th><th>触发条件</th><th>处理动作</th><th>预警次数</th><th>状态</th><th>操作</th></tr>
                        </thead>
                        <tbody>
                            ${rules.length === 0 ? '<tr><td colspan="8" class="text-center text-gray-500 py-4">暂无风控规则</td></tr>' : 
                            rules.map(r => `
                                <tr>
                                    <td>${r.rule_id}</td>
                                    <td class="font-medium">${escapeHtml(r.rule_name || '')}</td>
                                    <td><span class="badge badge-info">${getRiskTypeLabel(r.rule_type)}</span></td>
                                    <td class="text-sm max-w-xs truncate" title="${escapeAttr(r.rule_condition || '')}">${escapeHtml(r.rule_condition || '-')}</td>
                                    <td><span class="badge badge-warning">${getRiskActionLabel(r.rule_action)}</span></td>
                                    <td><span class="font-semibold text-red-600">${r.alert_count || 0}</span></td>
                                    <td>
                                        <button onclick="toggleRiskRuleStatus(${r.rule_id}, ${r.status})" class="cursor-pointer">
                                            ${r.status === 1 ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-danger">禁用</span>'}
                                        </button>
                                    </td>
                                    <td>
                                        <button onclick="editRiskRule(${r.rule_id})" class="text-blue-500 hover:text-blue-700 mr-2" title="编辑"><i class="fas fa-edit"></i></button>
                                        <button onclick="deleteRiskRule(${r.rule_id}, '${escapeAttr(r.rule_name)}')" class="text-red-500 hover:text-red-700" title="删除"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

function getRiskTypeLabel(type) {
    const types = {
        'bet_amount': '单笔投注额',
        'win_amount': '单笔赢额',
        'daily_win': '日赢额',
        'daily_loss': '日输额',
        'consecutive_win': '连续赢',
        'ip_multi_account': 'IP多账号',
        'device_multi_account': '设备多账号',
        'pattern_bet': '投注模式'
    };
    return types[type] || type || '-';
}

function getRiskActionLabel(action) {
    const actions = {
        'alert': '预警通知',
        'freeze': '冻结账户',
        'limit_bet': '限制投注',
        'notify_admin': '通知管理员',
        'auto_review': '自动审核'
    };
    return actions[action] || action || '-';
}

function showAddRiskRule() {
    openModal(`
        <div class="card-header"><i class="fas fa-plus-circle mr-2 text-red-500"></i>新增风控规则</div>
        <div class="p-6">
            <form id="riskRuleForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">规则名称 *</label>
                    <input type="text" id="riskRuleName" required class="form-input w-full" placeholder="如：单笔大额投注预警">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">规则类型 *</label>
                        <select id="riskRuleType" required class="form-input w-full">
                            <option value="">请选择</option>
                            <option value="bet_amount">单笔投注额</option>
                            <option value="win_amount">单笔赢额</option>
                            <option value="daily_win">日赢额</option>
                            <option value="daily_loss">日输额</option>
                            <option value="consecutive_win">连续赢</option>
                            <option value="ip_multi_account">IP多账号</option>
                            <option value="device_multi_account">设备多账号</option>
                            <option value="pattern_bet">投注模式</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">处理动作 *</label>
                        <select id="riskRuleAction" required class="form-input w-full">
                            <option value="">请选择</option>
                            <option value="alert">预警通知</option>
                            <option value="notify_admin">通知管理员</option>
                            <option value="limit_bet">限制投注</option>
                            <option value="freeze">冻结账户</option>
                            <option value="auto_review">自动审核</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">触发条件 *</label>
                    <input type="text" id="riskRuleCondition" required class="form-input w-full" placeholder="如：amount > 50000 或 count > 5">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">阈值</label>
                        <input type="number" id="riskRuleThreshold" class="form-input w-full" placeholder="数值阈值">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">统计时间(分钟)</label>
                        <input type="number" id="riskRuleTimeWindow" class="form-input w-full" placeholder="如：60">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">描述说明</label>
                    <textarea id="riskRuleDescription" rows="2" class="form-input w-full" placeholder="规则描述"></textarea>
                </div>
                <div class="flex items-center">
                    <input type="checkbox" id="riskRuleStatus" checked class="mr-2">
                    <label for="riskRuleStatus" class="text-sm">立即启用</label>
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" onclick="closeModal()" class="btn btn-outline">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        </div>
    `);
    document.getElementById('riskRuleForm').onsubmit = async (e) => { e.preventDefault(); await submitRiskRule(); };
}

async function submitRiskRule(ruleId = null) {
    const data = {
        rule_name: document.getElementById('riskRuleName').value,
        rule_type: document.getElementById('riskRuleType').value,
        rule_action: document.getElementById('riskRuleAction').value,
        rule_condition: document.getElementById('riskRuleCondition').value,
        threshold_value: document.getElementById('riskRuleThreshold').value ? parseFloat(document.getElementById('riskRuleThreshold').value) : null,
        time_window: document.getElementById('riskRuleTimeWindow').value ? parseInt(document.getElementById('riskRuleTimeWindow').value) : null,
        description: document.getElementById('riskRuleDescription').value || null,
        status: document.getElementById('riskRuleStatus').checked ? 1 : 0
    };
    
    try {
        const url = ruleId ? `/risk/rules/${ruleId}` : '/risk/rules';
        const method = ruleId ? 'PUT' : 'POST';
        const res = await apiRequest(url, { method, body: JSON.stringify(data) });
        if (res.success) {
            alert(ruleId ? '更新成功' : '添加成功');
            closeModal();
            renderRiskRules();
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

async function editRiskRule(ruleId) {
    try {
        const res = await apiRequest(`/risk/rules/${ruleId}`);
        const rule = res.data;
        showAddRiskRule();
        document.querySelector('.card-header').innerHTML = '<i class="fas fa-edit mr-2 text-red-500"></i>编辑风控规则';
        document.getElementById('riskRuleName').value = rule.rule_name || '';
        document.getElementById('riskRuleType').value = rule.rule_type || '';
        document.getElementById('riskRuleAction').value = rule.rule_action || '';
        document.getElementById('riskRuleCondition').value = rule.rule_condition || '';
        document.getElementById('riskRuleThreshold').value = rule.threshold_value || '';
        document.getElementById('riskRuleTimeWindow').value = rule.time_window || '';
        document.getElementById('riskRuleDescription').value = rule.description || '';
        document.getElementById('riskRuleStatus').checked = rule.status === 1;
        document.getElementById('riskRuleForm').onsubmit = async (e) => { e.preventDefault(); await submitRiskRule(ruleId); };
    } catch (error) {
        alert('获取规则信息失败: ' + error.message);
    }
}

async function deleteRiskRule(ruleId, ruleName) {
    if (!confirm(`确定要删除风控规则「${ruleName}」吗？此操作不可恢复！`)) return;
    try {
        const res = await apiRequest(`/risk/rules/${ruleId}`, { method: 'DELETE' });
        if (res.success) {
            alert('删除成功');
            renderRiskRules();
        } else {
            alert(res.message || '删除失败');
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

async function toggleRiskRuleStatus(ruleId, currentStatus) {
    const newStatus = currentStatus === 1 ? 0 : 1;
    try {
        const res = await apiRequest(`/risk/rules/${ruleId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        if (res.success) {
            renderRiskRules();
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

// 限红组 - 完整CRUD
async function renderLimitGroups() {
    const content = document.getElementById('pageContent');
    try {
        const data = await apiRequest('/risk/limit-groups');
        const groups = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <h3 class="text-lg font-semibold"><i class="fas fa-hand-holding-usd mr-2 text-orange-500"></i>限红组管理</h3>
                    <button onclick="showAddLimitGroup()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增限红组</button>
                </div>
                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        ${groups.length === 0 ? '<div class="col-span-3 text-center text-gray-500 py-10">暂无限红组</div>' :
                        groups.map(g => `
                            <div class="bg-gray-50 rounded-lg p-4 hover:shadow-lg transition">
                                <div class="flex items-center justify-between mb-3">
                                    <h4 class="font-semibold">${escapeHtml(g.group_name)}</h4>
                                    <span class="badge badge-info">${g.user_count || 0}人</span>
                                </div>
                                <p class="text-gray-500 text-sm mb-3">${escapeHtml(g.description) || '无描述'}</p>
                                <div class="space-y-2 text-sm">
                                    <div class="flex justify-between"><span>百家乐</span><span>¥${formatNumber(g.baccarat_min || 0)}-${formatNumber(g.baccarat_max || 0)}</span></div>
                                    <div class="flex justify-between"><span>龙虎</span><span>¥${formatNumber(g.dragon_tiger_min || 0)}-${formatNumber(g.dragon_tiger_max || 0)}</span></div>
                                    <div class="flex justify-between"><span>轮盘</span><span>¥${formatNumber(g.roulette_min || 0)}-${formatNumber(g.roulette_max || 0)}</span></div>
                                </div>
                                <div class="mt-4 flex space-x-2">
                                    <button onclick="editLimitGroup(${g.group_id})" class="btn btn-outline text-sm flex-1"><i class="fas fa-edit mr-1"></i>编辑</button>
                                    <button onclick="deleteLimitGroup(${g.group_id}, '${escapeAttr(g.group_name)}')" class="btn btn-danger text-sm"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

function showAddLimitGroup() {
    openModal(`
        <div class="card-header"><i class="fas fa-plus-circle mr-2 text-orange-500"></i>新增限红组</div>
        <div class="p-6">
            <form id="limitGroupForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">组名称 *</label>
                        <input type="text" id="limitGroupName" required class="form-input w-full" placeholder="如：VIP限红组">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
                        <input type="text" id="limitGroupDesc" class="form-input w-full" placeholder="组描述">
                    </div>
                </div>
                <div class="border rounded-lg p-4 bg-blue-50">
                    <h4 class="font-semibold text-blue-700 mb-3"><i class="fas fa-dice mr-1"></i>百家乐限红</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">最小投注</label>
                            <input type="number" id="limitBaccaratMin" class="form-input w-full" value="100">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">最大投注</label>
                            <input type="number" id="limitBaccaratMax" class="form-input w-full" value="100000">
                        </div>
                    </div>
                </div>
                <div class="border rounded-lg p-4 bg-green-50">
                    <h4 class="font-semibold text-green-700 mb-3"><i class="fas fa-dragon mr-1"></i>龙虎限红</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">最小投注</label>
                            <input type="number" id="limitDragonMin" class="form-input w-full" value="100">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">最大投注</label>
                            <input type="number" id="limitDragonMax" class="form-input w-full" value="50000">
                        </div>
                    </div>
                </div>
                <div class="border rounded-lg p-4 bg-purple-50">
                    <h4 class="font-semibold text-purple-700 mb-3"><i class="fas fa-circle-notch mr-1"></i>轮盘限红</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">最小投注</label>
                            <input type="number" id="limitRouletteMin" class="form-input w-full" value="50">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">最大投注</label>
                            <input type="number" id="limitRouletteMax" class="form-input w-full" value="30000">
                        </div>
                    </div>
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button type="button" onclick="closeModal()" class="btn btn-outline">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        </div>
    `);
    document.getElementById('limitGroupForm').onsubmit = async (e) => { e.preventDefault(); await submitLimitGroup(); };
}

async function submitLimitGroup(groupId = null) {
    const data = {
        group_name: document.getElementById('limitGroupName').value,
        description: document.getElementById('limitGroupDesc').value || null,
        baccarat_min: parseFloat(document.getElementById('limitBaccaratMin').value) || 100,
        baccarat_max: parseFloat(document.getElementById('limitBaccaratMax').value) || 100000,
        dragon_tiger_min: parseFloat(document.getElementById('limitDragonMin').value) || 100,
        dragon_tiger_max: parseFloat(document.getElementById('limitDragonMax').value) || 50000,
        roulette_min: parseFloat(document.getElementById('limitRouletteMin').value) || 50,
        roulette_max: parseFloat(document.getElementById('limitRouletteMax').value) || 30000
    };
    
    try {
        const url = groupId ? `/risk/limit-groups/${groupId}` : '/risk/limit-groups';
        const method = groupId ? 'PUT' : 'POST';
        const res = await apiRequest(url, { method, body: JSON.stringify(data) });
        if (res.success) {
            alert(groupId ? '更新成功' : '添加成功');
            closeModal();
            renderLimitGroups();
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

async function editLimitGroup(groupId) {
    try {
        const res = await apiRequest(`/risk/limit-groups/${groupId}`);
        const group = res.data;
        showAddLimitGroup();
        document.querySelector('.card-header').innerHTML = '<i class="fas fa-edit mr-2 text-orange-500"></i>编辑限红组';
        document.getElementById('limitGroupName').value = group.group_name || '';
        document.getElementById('limitGroupDesc').value = group.description || '';
        document.getElementById('limitBaccaratMin').value = group.baccarat_min || 100;
        document.getElementById('limitBaccaratMax').value = group.baccarat_max || 100000;
        document.getElementById('limitDragonMin').value = group.dragon_tiger_min || 100;
        document.getElementById('limitDragonMax').value = group.dragon_tiger_max || 50000;
        document.getElementById('limitRouletteMin').value = group.roulette_min || 50;
        document.getElementById('limitRouletteMax').value = group.roulette_max || 30000;
        document.getElementById('limitGroupForm').onsubmit = async (e) => { e.preventDefault(); await submitLimitGroup(groupId); };
    } catch (error) {
        alert('获取限红组信息失败: ' + error.message);
    }
}

async function deleteLimitGroup(groupId, groupName) {
    if (!confirm(`确定要删除限红组「${groupName}」吗？已使用此组的玩家将失去限红设置！`)) return;
    try {
        const res = await apiRequest(`/risk/limit-groups/${groupId}`, { method: 'DELETE' });
        if (res.success) {
            alert('删除成功');
            renderLimitGroups();
        } else {
            alert(res.message || '删除失败');
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

// 游戏报表
async function renderGameReport() {
    const content = document.getElementById('pageContent');
    const { startDate, endDate } = getDefaultDateRange();
    
    // 加载游戏类型
    let gameTypeOptions = '<option value="">全部游戏</option>';
    try {
        const gameTypeRes = await apiRequest('/reports/game-types');
        (gameTypeRes.data || []).forEach(g => {
            gameTypeOptions += `<option value="${g.game_type}">${escapeHtml(g.game_type)}</option>`;
        });
    } catch (e) { console.error('加载游戏类型失败:', e); }
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header bg-purple-50">
                <h3 class="text-lg font-semibold text-purple-700"><i class="fas fa-gamepad mr-2"></i>游戏报表 - 下注金额/区域统计</h3>
            </div>
            <!-- 筛选条件 -->
            <div class="p-4 bg-gray-50 border-b">
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">开始日期</label>
                        <input type="date" id="GameStartDate" value="${startDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">结束日期</label>
                        <input type="date" id="GameEndDate" value="${endDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">游戏类型</label>
                        <select id="GameTypeFilter" class="form-input w-full text-sm">${gameTypeOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">统计维度</label>
                        <select id="GameDimension" class="form-input w-full text-sm">
                            <option value="game">按游戏类型</option>
                            <option value="area">按下注区域</option>
                            <option value="table">按桌台</option>
                        </select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button onclick="queryGame()" class="btn btn-primary text-sm flex-1"><i class="fas fa-search mr-1"></i>查询</button>
                        <button onclick="exportGame()" class="btn bg-green-500 text-white text-sm hover:bg-green-600"><i class="fas fa-download"></i></button>
                    </div>
                </div>
            </div>
            <div class="p-4" id="gameReportContent">
                <div class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
            </div>
        </div>
    `;
    
    await queryGame();
}

async function queryGame() {
    const startDate = document.getElementById('GameStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('GameEndDate')?.value || getDefaultDateRange().endDate;
    const gameType = document.getElementById('GameTypeFilter')?.value || '';
    const dimension = document.getElementById('GameDimension')?.value || 'game';
    const container = document.getElementById('gameReportContent');
    
    try {
        // 根据维度选择不同的API
        let apiUrl = '';
        if (dimension === 'area') {
            apiUrl = `/reports/bet-area-stats?start_date=${startDate}&end_date=${endDate}${gameType ? '&game_type=' + gameType : ''}`;
        } else if (dimension === 'table') {
            apiUrl = `/reports/table-stats?start_date=${startDate}&end_date=${endDate}`;
        } else {
            apiUrl = `/reports/game?start_date=${startDate}&end_date=${endDate}`;
        }
        
        const data = await apiRequest(apiUrl);
        const list = data.data || [];
        currentReportData.game = list;
        
        // 计算汇总
        const summary = list.reduce((acc, r) => ({
            bet_count: acc.bet_count + (r.bet_count || 0),
            player_count: acc.player_count + (r.player_count || 0),
            total_bet: acc.total_bet + parseFloat(r.total_bet || 0),
            valid_bet: acc.valid_bet + parseFloat(r.valid_bet || 0),
            total_win_loss: acc.total_win_loss + parseFloat(r.total_win_loss || r.player_win_loss || 0),
            company_profit: acc.company_profit + parseFloat(r.company_profit || 0)
        }), { bet_count: 0, player_count: 0, total_bet: 0, valid_bet: 0, total_win_loss: 0, company_profit: 0 });
        
        // 根据维度显示不同的表头
        const dimensionConfig = {
            game: { title: '游戏类型', field: 'game_type', label: '游戏' },
            area: { title: '下注区域', field: 'bet_area', label: '区域', extra: 'game_type' },
            table: { title: '桌台', field: 'table_name', label: '桌台', extra: 'game_type' }
        };
        const cfg = dimensionConfig[dimension];
        
        container.innerHTML = `
            <!-- 汇总统计 -->
            <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                <div class="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                    <div class="text-xs text-gray-600">${cfg.label}数量</div>
                    <div class="text-lg font-bold text-purple-600">${list.length}</div>
                </div>
                <div class="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                    <div class="text-xs text-gray-600">总注单</div>
                    <div class="text-lg font-bold text-blue-600">${formatNumber(summary.bet_count)}</div>
                </div>
                <div class="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                    <div class="text-xs text-gray-600">投注人数</div>
                    <div class="text-lg font-bold text-indigo-600">${formatNumber(summary.player_count)}</div>
                </div>
                <div class="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-100">
                    <div class="text-xs text-gray-600">总投注额</div>
                    <div class="text-lg font-bold text-cyan-600">${formatMoney(summary.total_bet)}</div>
                </div>
                <div class="bg-${summary.total_win_loss >= 0 ? 'green' : 'red'}-50 rounded-lg p-3 text-center border">
                    <div class="text-xs text-gray-600">玩家盈亏</div>
                    <div class="text-lg font-bold text-${summary.total_win_loss >= 0 ? 'green' : 'red'}-600">${formatMoney(summary.total_win_loss)}</div>
                </div>
                <div class="bg-${summary.company_profit >= 0 ? 'green' : 'red'}-50 rounded-lg p-3 text-center border">
                    <div class="text-xs text-gray-600">公司利润</div>
                    <div class="text-lg font-bold text-${summary.company_profit >= 0 ? 'green' : 'red'}-600">${formatMoney(summary.company_profit)}</div>
                </div>
            </div>
            
            <!-- 数据表格 -->
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${cfg.extra ? '<th>游戏</th>' : ''}
                            <th>${cfg.title}</th>
                            <th>注单数</th>
                            <th>投注人数</th>
                            <th>下注金额</th>
                            <th>有效投注</th>
                            <th>玩家输赢</th>
                            <th>公司利润</th>
                            <th>杀数(%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? `<tr><td colspan="${cfg.extra ? 9 : 8}" class="text-center text-gray-500 py-4">暂无数据</td></tr>` : 
                        list.map(r => `
                            <tr>
                                ${cfg.extra ? `<td><span class="badge badge-info">${escapeHtml(r.game_type || '-')}</span></td>` : ''}
                                <td class="font-medium">${escapeHtml(r[cfg.field] || r.table_id || '-')}</td>
                                <td>${formatNumber(r.bet_count || 0)}</td>
                                <td>${formatNumber(r.player_count || 0)}</td>
                                <td class="font-medium">${formatMoney(r.total_bet || 0)}</td>
                                <td>${formatMoney(r.valid_bet || 0)}</td>
                                <td class="${parseFloat(r.total_win_loss || r.player_win_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(r.total_win_loss || r.player_win_loss || 0)}</td>
                                <td class="${parseFloat(r.company_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">${formatMoney(r.company_profit || 0)}</td>
                                <td>${r.valid_bet > 0 ? ((r.company_profit / r.valid_bet) * 100).toFixed(2) : (r.profit_rate || 0)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

function exportGame() {
    exportToExcel(currentReportData.game, [
        { key: 'game_type', label: '游戏类型' },
        { key: 'bet_count', label: '注单数' },
        { key: 'total_bet', label: '总投注' },
        { key: 'valid_bet', label: '有效投注' },
        { key: 'total_win_loss', label: '玩家输赢' },
        { key: 'company_profit', label: '公司利润' }
    ], '游戏报表');
}

// 盈亏日报
async function renderDailyReport() {
    const content = document.getElementById('pageContent');
    const { startDate, endDate } = getDefaultDateRange();
    
    // 加载筛选选项
    let shareholderOptions = '<option value="">全部股东</option>';
    let agentOptions = '<option value="">全部代理</option>';
    try {
        const [shareholderRes, agentRes] = await Promise.all([
            apiRequest('/reports/shareholders'),
            apiRequest('/reports/agents-list')
        ]);
        (shareholderRes.data || []).forEach(s => {
            shareholderOptions += `<option value="${s.agent_id}">${escapeHtml(s.agent_username)}</option>`;
        });
        (agentRes.data || []).forEach(a => {
            agentOptions += `<option value="${a.agent_id}">${escapeHtml(a.agent_username)}</option>`;
        });
    } catch (e) { console.error('加载筛选选项失败:', e); }
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header bg-orange-50">
                <h3 class="text-lg font-semibold text-orange-700"><i class="fas fa-calendar-day mr-2"></i>盈亏日报 - 每日对账</h3>
            </div>
            <!-- 筛选条件 -->
            <div class="p-4 bg-gray-50 border-b">
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">开始日期</label>
                        <input type="date" id="DailyStartDate" value="${startDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">结束日期</label>
                        <input type="date" id="DailyEndDate" value="${endDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">股东</label>
                        <select id="DailyShareholder" class="form-input w-full text-sm" onchange="loadAgentsByShareholder('Daily')">${shareholderOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">代理</label>
                        <select id="DailyAgent" class="form-input w-full text-sm">${agentOptions}</select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button onclick="queryDaily()" class="btn btn-primary text-sm flex-1"><i class="fas fa-search mr-1"></i>查询</button>
                        <button onclick="exportDaily()" class="btn bg-green-500 text-white text-sm hover:bg-green-600"><i class="fas fa-download"></i></button>
                    </div>
                </div>
            </div>
            <div class="p-4" id="dailyReportContent">
                <div class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
            </div>
        </div>
    `;
    
    await queryDaily();
}

async function queryDaily() {
    const startDate = document.getElementById('DailyStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('DailyEndDate')?.value || getDefaultDateRange().endDate;
    const shareholderId = document.getElementById('DailyShareholder')?.value || '';
    const agentId = document.getElementById('DailyAgent')?.value || '';
    const container = document.getElementById('dailyReportContent');
    
    try {
        // 获取日报数据和综合数据
        const [dailyRes, compRes] = await Promise.all([
            apiRequest(`/reports/daily?start_date=${startDate}&end_date=${endDate}`),
            apiRequest(`/reports/comprehensive?start_date=${startDate}&end_date=${endDate}${shareholderId ? '&shareholder_id=' + shareholderId : ''}${agentId ? '&agent_id=' + agentId : ''}`)
        ]);
        
        const list = dailyRes.data || [];
        const compData = compRes.data || {};
        currentReportData.daily = { list, comprehensive: compData };
        
        // 计算汇总
        const summary = list.reduce((acc, r) => ({
            new_players: acc.new_players + (r.new_players || 0),
            betting_players: Math.max(acc.betting_players, r.betting_players || 0),
            bet_count: acc.bet_count + (r.bet_count || 0),
            bet_amount: acc.bet_amount + parseFloat(r.bet_amount || r.total_bet || 0),
            valid_bet: acc.valid_bet + parseFloat(r.valid_bet || 0),
            player_win_loss: acc.player_win_loss + parseFloat(r.player_win_loss || 0),
            company_profit: acc.company_profit + parseFloat(r.company_profit || 0),
            deposit_amount: acc.deposit_amount + parseFloat(r.deposit_amount || 0),
            withdraw_amount: acc.withdraw_amount + parseFloat(r.withdraw_amount || 0)
        }), { new_players: 0, betting_players: 0, bet_count: 0, bet_amount: 0, valid_bet: 0, player_win_loss: 0, company_profit: 0, deposit_amount: 0, withdraw_amount: 0 });
        
        // 计算佣金
        const totalCommission = (compData.agents || []).reduce((sum, a) => sum + parseFloat(a.commission_earned || 0), 0);
        
        container.innerHTML = `
            <!-- 汇总统计卡片 -->
            <div class="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2 mb-4">
                <div class="bg-orange-50 rounded-lg p-2 text-center border border-orange-100">
                    <div class="text-xs text-gray-600">统计天数</div>
                    <div class="text-base font-bold text-orange-600">${list.length}天</div>
                </div>
                <div class="bg-teal-50 rounded-lg p-2 text-center border border-teal-100">
                    <div class="text-xs text-gray-600">新增玩家</div>
                    <div class="text-base font-bold text-teal-600">${formatNumber(summary.new_players)}</div>
                </div>
                <div class="bg-blue-50 rounded-lg p-2 text-center border border-blue-100">
                    <div class="text-xs text-gray-600">投注人数</div>
                    <div class="text-base font-bold text-blue-600">${formatNumber(summary.betting_players)}</div>
                </div>
                <div class="bg-indigo-50 rounded-lg p-2 text-center border border-indigo-100">
                    <div class="text-xs text-gray-600">总注单</div>
                    <div class="text-base font-bold text-indigo-600">${formatNumber(summary.bet_count)}</div>
                </div>
                <div class="bg-purple-50 rounded-lg p-2 text-center border border-purple-100">
                    <div class="text-xs text-gray-600">总投注</div>
                    <div class="text-base font-bold text-purple-600">${formatMoney(summary.bet_amount)}</div>
                </div>
                <div class="bg-${summary.player_win_loss >= 0 ? 'green' : 'red'}-50 rounded-lg p-2 text-center border">
                    <div class="text-xs text-gray-600">会员输赢</div>
                    <div class="text-base font-bold text-${summary.player_win_loss >= 0 ? 'green' : 'red'}-600">${formatMoney(summary.player_win_loss)}</div>
                </div>
                <div class="bg-${summary.company_profit >= 0 ? 'green' : 'red'}-50 rounded-lg p-2 text-center border">
                    <div class="text-xs text-gray-600">公司盈利</div>
                    <div class="text-base font-bold text-${summary.company_profit >= 0 ? 'green' : 'red'}-600">${formatMoney(summary.company_profit)}</div>
                </div>
                <div class="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
                    <div class="text-xs text-gray-600">总存款</div>
                    <div class="text-base font-bold text-emerald-600">${formatMoney(summary.deposit_amount)}</div>
                </div>
                <div class="bg-amber-50 rounded-lg p-2 text-center border border-amber-100">
                    <div class="text-xs text-gray-600">总取款</div>
                    <div class="text-base font-bold text-amber-600">${formatMoney(summary.withdraw_amount)}</div>
                </div>
                <div class="bg-rose-50 rounded-lg p-2 text-center border border-rose-100">
                    <div class="text-xs text-gray-600">代理佣金</div>
                    <div class="text-base font-bold text-rose-600">${formatMoney(totalCommission)}</div>
                </div>
            </div>
            
            <!-- 每日明细表格 -->
            <div class="overflow-x-auto">
                <table class="data-table text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th>日期</th>
                            <th>新增玩家</th>
                            <th>投注人数</th>
                            <th>注单数</th>
                            <th>投注额</th>
                            <th>有效投注</th>
                            <th>会员输赢</th>
                            <th>公司盈利</th>
                            <th>存款</th>
                            <th>取款</th>
                            <th>杀数(%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? '<tr><td colspan="11" class="text-center text-gray-500 py-4">暂无数据</td></tr>' : 
                        list.map(r => `
                            <tr>
                                <td class="font-medium">${r.report_date}</td>
                                <td>${formatNumber(r.new_players || 0)}</td>
                                <td>${formatNumber(r.betting_players || 0)}</td>
                                <td>${formatNumber(r.bet_count || 0)}</td>
                                <td>${formatMoney(r.bet_amount || r.total_bet || 0)}</td>
                                <td>${formatMoney(r.valid_bet || 0)}</td>
                                <td class="${parseFloat(r.player_win_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(r.player_win_loss || 0)}</td>
                                <td class="${parseFloat(r.company_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">${formatMoney(r.company_profit || 0)}</td>
                                <td class="text-emerald-600">${formatMoney(r.deposit_amount || 0)}</td>
                                <td class="text-amber-600">${formatMoney(r.withdraw_amount || 0)}</td>
                                <td>${r.valid_bet > 0 ? ((r.company_profit / r.valid_bet) * 100).toFixed(2) : 0}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

function exportDaily() {
    const data = currentReportData.daily?.list || currentReportData.daily || [];
    exportToExcel(data, [
        { key: 'report_date', label: '日期' },
        { key: 'new_players', label: '新增玩家' },
        { key: 'betting_players', label: '投注人数' },
        { key: 'bet_count', label: '注单数' },
        { key: 'bet_amount', label: '投注额' },
        { key: 'valid_bet', label: '有效投注' },
        { key: 'player_win_loss', label: '会员输赢' },
        { key: 'company_profit', label: '公司盈利' },
        { key: 'deposit_amount', label: '存款' },
        { key: 'withdraw_amount', label: '取款' }
    ], '盈亏日报');
}

// ==================== 注单明细报表 ====================
async function renderBetDetails() {
    const content = document.getElementById('pageContent');
    const { startDate, endDate } = getDefaultDateRange();
    
    // 加载筛选选项
    let shareholderOptions = '<option value="">全部股东</option>';
    let agentOptions = '<option value="">全部代理</option>';
    let gameTypeOptions = '<option value="">全部游戏</option>';
    try {
        const [shareholderRes, agentRes, gameTypeRes] = await Promise.all([
            apiRequest('/reports/shareholders'),
            apiRequest('/reports/agents-list'),
            apiRequest('/reports/game-types')
        ]);
        (shareholderRes.data || []).forEach(s => {
            shareholderOptions += `<option value="${s.agent_id}">${escapeHtml(s.agent_username)}</option>`;
        });
        (agentRes.data || []).forEach(a => {
            agentOptions += `<option value="${a.agent_id}">${escapeHtml(a.agent_username)}</option>`;
        });
        (gameTypeRes.data || []).forEach(g => {
            gameTypeOptions += `<option value="${g.game_type}">${escapeHtml(g.game_type)}</option>`;
        });
    } catch (e) { console.error('加载筛选选项失败:', e); }
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <h3 class="text-lg font-semibold"><i class="fas fa-list-alt mr-2"></i>注单明细查询</h3>
            </div>
            <!-- 完整筛选条件 -->
            <div class="p-4 bg-gray-50 border-b">
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">注单号</label>
                        <input type="text" id="BetDetailsBetNo" placeholder="输入注单号" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">会员账号</label>
                        <input type="text" id="BetDetailsUsername" placeholder="输入会员账号" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">股东</label>
                        <select id="BetDetailsShareholder" class="form-input w-full text-sm" onchange="loadAgentsByShareholder('BetDetails')">${shareholderOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">代理</label>
                        <select id="BetDetailsAgent" class="form-input w-full text-sm">${agentOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">开始日期</label>
                        <input type="date" id="BetDetailsStartDate" value="${startDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">结束日期</label>
                        <input type="date" id="BetDetailsEndDate" value="${endDate}" class="form-input w-full text-sm">
                    </div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">游戏类型</label>
                        <select id="BetDetailsGameType" class="form-input w-full text-sm">${gameTypeOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">桌台号</label>
                        <input type="text" id="BetDetailsTableCode" placeholder="输入桌台号" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">下注区域</label>
                        <input type="text" id="BetDetailsBetArea" placeholder="如:庄/闲/和" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">最小金额</label>
                        <input type="number" id="BetDetailsMinAmount" placeholder="最小" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">最大金额</label>
                        <input type="number" id="BetDetailsMaxAmount" placeholder="最大" class="form-input w-full text-sm">
                    </div>
                    <div class="flex items-end gap-2">
                        <button onclick="queryBetDetails(1)" class="btn btn-primary text-sm flex-1"><i class="fas fa-search mr-1"></i>查询</button>
                        <button onclick="exportBetDetails()" class="btn bg-green-500 text-white text-sm hover:bg-green-600"><i class="fas fa-download"></i></button>
                    </div>
                </div>
            </div>
            <div class="p-4" id="betDetailsContent">
                <div class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
            </div>
        </div>
    `;
    
    await queryBetDetails(1);
}

let betDetailsCurrentPage = 1;
async function queryBetDetails(page = 1) {
    betDetailsCurrentPage = page;
    const container = document.getElementById('betDetailsContent');
    
    // 获取筛选条件
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('pageSize', '50');
    
    const betNo = document.getElementById('BetDetailsBetNo')?.value;
    const username = document.getElementById('BetDetailsUsername')?.value;
    const shareholderId = document.getElementById('BetDetailsShareholder')?.value;
    const agentId = document.getElementById('BetDetailsAgent')?.value;
    const startDate = document.getElementById('BetDetailsStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('BetDetailsEndDate')?.value || getDefaultDateRange().endDate;
    const gameType = document.getElementById('BetDetailsGameType')?.value;
    const tableCode = document.getElementById('BetDetailsTableCode')?.value;
    const betArea = document.getElementById('BetDetailsBetArea')?.value;
    const minAmount = document.getElementById('BetDetailsMinAmount')?.value;
    const maxAmount = document.getElementById('BetDetailsMaxAmount')?.value;
    
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    if (betNo) params.append('bet_id', betNo);
    if (username) params.append('username', username);
    if (shareholderId) params.append('shareholder_id', shareholderId);
    if (agentId) params.append('agent_id', agentId);
    if (gameType) params.append('game_type', gameType);
    if (tableCode) params.append('table_id', tableCode);
    if (betArea) params.append('bet_area', betArea);
    if (minAmount) params.append('min_amount', minAmount);
    if (maxAmount) params.append('max_amount', maxAmount);
    
    try {
        const res = await apiRequest(`/reports/bet-details?${params.toString()}`);
        const { list, total, summary } = res.data || {};
        currentReportData.betDetails = { list, total, summary };
        
        const totalPages = Math.ceil((total || 0) / 50);
        
        container.innerHTML = `
            <!-- 汇总统计 -->
            <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                <div class="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                    <div class="text-xs text-gray-600">总注单数</div>
                    <div class="text-lg font-bold text-blue-600">${formatNumber(summary?.total_bets || 0)}</div>
                </div>
                <div class="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                    <div class="text-xs text-gray-600">投注人数</div>
                    <div class="text-lg font-bold text-indigo-600">${formatNumber(summary?.player_count || 0)}</div>
                </div>
                <div class="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                    <div class="text-xs text-gray-600">总下注金额</div>
                    <div class="text-lg font-bold text-purple-600">${formatMoney(summary?.total_bet || 0)}</div>
                </div>
                <div class="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-100">
                    <div class="text-xs text-gray-600">有效投注</div>
                    <div class="text-lg font-bold text-cyan-600">${formatMoney(summary?.valid_bet || 0)}</div>
                </div>
                <div class="bg-${parseFloat(summary?.player_win_loss || 0) >= 0 ? 'green' : 'red'}-50 rounded-lg p-3 text-center border">
                    <div class="text-xs text-gray-600">会员输赢</div>
                    <div class="text-lg font-bold text-${parseFloat(summary?.player_win_loss || 0) >= 0 ? 'green' : 'red'}-600">${formatMoney(summary?.player_win_loss || 0)}</div>
                </div>
                <div class="bg-${parseFloat(summary?.company_profit || 0) >= 0 ? 'green' : 'red'}-50 rounded-lg p-3 text-center border">
                    <div class="text-xs text-gray-600">公司盈利</div>
                    <div class="text-lg font-bold text-${parseFloat(summary?.company_profit || 0) >= 0 ? 'green' : 'red'}-600">${formatMoney(summary?.company_profit || 0)}</div>
                </div>
            </div>
            
            <!-- 注单列表 -->
            <div class="overflow-x-auto">
                <table class="data-table text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th>注单号</th>
                            <th>会员账号</th>
                            <th>所属代理</th>
                            <th>游戏类型</th>
                            <th>桌台</th>
                            <th>下注区域</th>
                            <th>下注金额</th>
                            <th>有效投注</th>
                            <th>输赢金额</th>
                            <th>下注时间</th>
                            <th>结算时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(!list || list.length === 0) ? '<tr><td colspan="11" class="text-center text-gray-500 py-4">暂无数据</td></tr>' : 
                        list.map(b => `
                            <tr class="hover:bg-gray-50">
                                <td class="font-mono text-xs">${escapeHtml(b.bet_no || b.bet_id || '-')}</td>
                                <td>
                                    <div class="font-medium">${escapeHtml(b.username || '-')}</div>
                                    <div class="text-xs text-gray-500">VIP${b.vip_level || 0}</div>
                                </td>
                                <td>
                                    <div>${escapeHtml(b.agent_username || '-')}</div>
                                    ${b.shareholder_name ? `<div class="text-xs text-gray-500">${escapeHtml(b.shareholder_name)}</div>` : ''}
                                </td>
                                <td><span class="badge badge-info">${escapeHtml(b.game_type || '-')}</span></td>
                                <td>${escapeHtml(b.table_id || '-')}</td>
                                <td><span class="badge badge-purple">${escapeHtml(b.bet_area || '-')}</span></td>
                                <td class="font-medium">${formatMoney(b.bet_amount || 0)}</td>
                                <td>${formatMoney(b.valid_bet_amount || 0)}</td>
                                <td class="${parseFloat(b.win_loss_amount || 0) >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">${formatMoney(b.win_loss_amount || 0)}</td>
                                <td class="text-xs">${b.created_at || '-'}</td>
                                <td class="text-xs">${b.settled_at || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <!-- 分页 -->
            ${total > 50 ? `
            <div class="flex items-center justify-between mt-4 pt-4 border-t">
                <div class="text-sm text-gray-600">
                    共 ${formatNumber(total)} 条记录，第 ${page}/${totalPages} 页
                </div>
                <div class="flex gap-2">
                    <button onclick="queryBetDetails(1)" class="btn btn-sm ${page === 1 ? 'btn-disabled' : 'btn-outline'}" ${page === 1 ? 'disabled' : ''}>首页</button>
                    <button onclick="queryBetDetails(${page - 1})" class="btn btn-sm ${page === 1 ? 'btn-disabled' : 'btn-outline'}" ${page === 1 ? 'disabled' : ''}>上一页</button>
                    <button onclick="queryBetDetails(${page + 1})" class="btn btn-sm ${page >= totalPages ? 'btn-disabled' : 'btn-outline'}" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
                    <button onclick="queryBetDetails(${totalPages})" class="btn btn-sm ${page >= totalPages ? 'btn-disabled' : 'btn-outline'}" ${page >= totalPages ? 'disabled' : ''}>末页</button>
                </div>
            </div>
            ` : ''}
        `;
    } catch (error) {
        container.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

function exportBetDetails() {
    const data = currentReportData.betDetails?.list || [];
    if (data.length === 0) {
        alert('暂无数据可导出');
        return;
    }
    exportToExcel(data, [
        { key: 'bet_no', label: '注单号' },
        { key: 'username', label: '会员账号' },
        { key: 'vip_level', label: 'VIP等级' },
        { key: 'agent_username', label: '所属代理' },
        { key: 'shareholder_name', label: '所属股东' },
        { key: 'game_type', label: '游戏类型' },
        { key: 'table_id', label: '桌台号' },
        { key: 'bet_area', label: '下注区域' },
        { key: 'bet_amount', label: '下注金额' },
        { key: 'valid_bet_amount', label: '有效投注' },
        { key: 'win_loss_amount', label: '输赢金额' },
        { key: 'created_at', label: '下注时间' },
        { key: 'settled_at', label: '结算时间' }
    ], '注单明细');
}

// ==================== 盈利分成报表 ====================
async function renderProfitSharing() {
    const content = document.getElementById('pageContent');
    const { startDate, endDate } = getDefaultDateRange();
    
    // 加载股东下拉选项
    let shareholderOptions = '<option value="">全部股东</option>';
    try {
        const shareholderRes = await apiRequest('/reports/shareholders');
        (shareholderRes.data || []).forEach(s => {
            shareholderOptions += `<option value="${s.agent_id}">${escapeHtml(s.agent_username)}</option>`;
        });
    } catch (e) { console.error('加载股东列表失败:', e); }
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header bg-gradient-to-r from-green-500 to-teal-600 text-white">
                <h3 class="text-lg font-semibold"><i class="fas fa-hand-holding-usd mr-2"></i>盈利分成报表 - 对账与结算</h3>
            </div>
            <!-- 筛选条件 -->
            <div class="p-4 bg-gray-50 border-b">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">开始日期</label>
                        <input type="date" id="ProfitStartDate" value="${startDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">结束日期</label>
                        <input type="date" id="ProfitEndDate" value="${endDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">股东</label>
                        <select id="ProfitShareholder" class="form-input w-full text-sm">${shareholderOptions}</select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button onclick="queryProfitSharing()" class="btn btn-primary text-sm flex-1"><i class="fas fa-search mr-1"></i>查询</button>
                        <button onclick="exportProfitSharing()" class="btn bg-green-500 text-white text-sm hover:bg-green-600"><i class="fas fa-download"></i></button>
                    </div>
                </div>
            </div>
            <div class="p-4" id="profitSharingContent">
                <div class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
            </div>
        </div>
    `;
    
    await queryProfitSharing();
}

async function queryProfitSharing() {
    const startDate = document.getElementById('ProfitStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('ProfitEndDate')?.value || getDefaultDateRange().endDate;
    const shareholderId = document.getElementById('ProfitShareholder')?.value || '';
    const container = document.getElementById('profitSharingContent');
    
    try {
        const res = await apiRequest(`/reports/profit-sharing?start_date=${startDate}&end_date=${endDate}${shareholderId ? '&shareholder_id=' + shareholderId : ''}`);
        const data = res.data || {};
        currentReportData.profitSharing = data;
        
        const summary = data.summary || {};
        const shareholders = data.shareholders || [];
        const agents = data.agents || [];
        
        container.innerHTML = `
            <!-- 总体盈亏汇总 -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border border-blue-100">
                <h4 class="text-sm font-semibold text-gray-700 mb-3"><i class="fas fa-chart-pie mr-1"></i>总体盈亏汇总</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div class="bg-white rounded-lg p-3 text-center shadow-sm">
                        <div class="text-xs text-gray-500">总投注额</div>
                        <div class="text-lg font-bold text-blue-600">${formatMoney(summary.total_bet || 0)}</div>
                    </div>
                    <div class="bg-white rounded-lg p-3 text-center shadow-sm">
                        <div class="text-xs text-gray-500">有效投注</div>
                        <div class="text-lg font-bold text-indigo-600">${formatMoney(summary.valid_bet || 0)}</div>
                    </div>
                    <div class="bg-white rounded-lg p-3 text-center shadow-sm">
                        <div class="text-xs text-gray-500">会员输赢</div>
                        <div class="text-lg font-bold ${parseFloat(summary.player_win_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(summary.player_win_loss || 0)}</div>
                    </div>
                    <div class="bg-white rounded-lg p-3 text-center shadow-sm">
                        <div class="text-xs text-gray-500">毛利润</div>
                        <div class="text-lg font-bold ${parseFloat(summary.gross_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(summary.gross_profit || 0)}</div>
                    </div>
                    <div class="bg-white rounded-lg p-3 text-center shadow-sm border-2 border-orange-200">
                        <div class="text-xs text-gray-500">股东应得</div>
                        <div class="text-lg font-bold text-orange-600">${formatMoney(summary.shareholder_share || 0)}</div>
                    </div>
                    <div class="bg-white rounded-lg p-3 text-center shadow-sm border-2 border-purple-200">
                        <div class="text-xs text-gray-500">代理佣金</div>
                        <div class="text-lg font-bold text-purple-600">${formatMoney(summary.agent_commission || 0)}</div>
                    </div>
                    <div class="bg-white rounded-lg p-3 text-center shadow-sm border-2 border-teal-200">
                        <div class="text-xs text-gray-500">公司净利</div>
                        <div class="text-lg font-bold text-teal-600">${formatMoney(summary.company_net_profit || 0)}</div>
                    </div>
                </div>
            </div>
            
            <!-- 股东盈利分成明细 -->
            <div class="mb-6">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-semibold text-gray-700"><i class="fas fa-user-tie mr-1"></i>股东盈利分成明细</h4>
                    <button onclick="exportShareholderProfit()" class="btn btn-sm bg-orange-500 text-white hover:bg-orange-600"><i class="fas fa-download mr-1"></i>导出股东报表</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="data-table text-sm">
                        <thead class="bg-orange-50">
                            <tr>
                                <th>股东账号</th>
                                <th>占成比例</th>
                                <th>下级代理数</th>
                                <th>玩家数</th>
                                <th>总投注</th>
                                <th>有效投注</th>
                                <th>会员输赢</th>
                                <th>毛利润</th>
                                <th class="bg-orange-100">应得金额</th>
                                <th>平台收益</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${shareholders.length === 0 ? '<tr><td colspan="10" class="text-center text-gray-500 py-4">暂无数据</td></tr>' : 
                            shareholders.map(s => `
                                <tr>
                                    <td class="font-medium">${escapeHtml(s.shareholder_name || s.agent_username || '-')}</td>
                                    <td><span class="badge badge-orange">${s.share_ratio || 0}%</span></td>
                                    <td>${formatNumber(s.sub_agent_count || 0)}</td>
                                    <td>${formatNumber(s.player_count || 0)}</td>
                                    <td>${formatMoney(s.total_bet || 0)}</td>
                                    <td>${formatMoney(s.valid_bet || 0)}</td>
                                    <td class="${parseFloat(s.player_win_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(s.player_win_loss || 0)}</td>
                                    <td class="${parseFloat(s.gross_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">${formatMoney(s.gross_profit || 0)}</td>
                                    <td class="bg-orange-50 text-orange-600 font-bold">${formatMoney(s.shareholder_profit || 0)}</td>
                                    <td class="text-teal-600 font-medium">${formatMoney(s.platform_profit || 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        ${shareholders.length > 0 ? `
                        <tfoot class="bg-gray-100 font-bold">
                            <tr>
                                <td colspan="4">合计</td>
                                <td>${formatMoney(shareholders.reduce((s,r) => s + parseFloat(r.total_bet || 0), 0))}</td>
                                <td>${formatMoney(shareholders.reduce((s,r) => s + parseFloat(r.valid_bet || 0), 0))}</td>
                                <td class="${shareholders.reduce((s,r) => s + parseFloat(r.player_win_loss || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(shareholders.reduce((s,r) => s + parseFloat(r.player_win_loss || 0), 0))}</td>
                                <td class="${shareholders.reduce((s,r) => s + parseFloat(r.gross_profit || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(shareholders.reduce((s,r) => s + parseFloat(r.gross_profit || 0), 0))}</td>
                                <td class="text-orange-600">${formatMoney(shareholders.reduce((s,r) => s + parseFloat(r.shareholder_profit || 0), 0))}</td>
                                <td class="text-teal-600">${formatMoney(shareholders.reduce((s,r) => s + parseFloat(r.platform_profit || 0), 0))}</td>
                            </tr>
                        </tfoot>
                        ` : ''}
                    </table>
                </div>
            </div>
            
            <!-- 代理佣金明细 -->
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-semibold text-gray-700"><i class="fas fa-users mr-1"></i>代理佣金明细</h4>
                    <button onclick="exportAgentCommission()" class="btn btn-sm bg-purple-500 text-white hover:bg-purple-600"><i class="fas fa-download mr-1"></i>导出代理报表</button>
                </div>
                <div class="overflow-x-auto max-h-[400px]">
                    <table class="data-table text-sm">
                        <thead class="bg-purple-50 sticky top-0">
                            <tr>
                                <th>代理账号</th>
                                <th>所属股东</th>
                                <th>层级</th>
                                <th>佣金比例</th>
                                <th>玩家数</th>
                                <th>总投注</th>
                                <th>有效投注</th>
                                <th>会员输赢</th>
                                <th>毛利润</th>
                                <th class="bg-purple-100">应得佣金</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${agents.length === 0 ? '<tr><td colspan="10" class="text-center text-gray-500 py-4">暂无数据</td></tr>' : 
                            agents.map(a => `
                                <tr>
                                    <td class="font-medium">${escapeHtml(a.agent_username || '-')}</td>
                                    <td>${escapeHtml(a.shareholder_name || '-')}</td>
                                    <td>${getLevelBadge(a.level)}</td>
                                    <td><span class="badge badge-purple">${a.commission_ratio || 0}%</span></td>
                                    <td>${formatNumber(a.player_count || 0)}</td>
                                    <td>${formatMoney(a.total_bet || 0)}</td>
                                    <td>${formatMoney(a.valid_bet || 0)}</td>
                                    <td class="${parseFloat(a.player_win_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(a.player_win_loss || 0)}</td>
                                    <td class="${parseFloat(a.gross_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">${formatMoney(a.gross_profit || 0)}</td>
                                    <td class="bg-purple-50 text-purple-600 font-bold">${formatMoney(a.commission_earned || 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        ${agents.length > 0 ? `
                        <tfoot class="bg-gray-100 font-bold">
                            <tr>
                                <td colspan="5">合计</td>
                                <td>${formatMoney(agents.reduce((s,r) => s + parseFloat(r.total_bet || 0), 0))}</td>
                                <td>${formatMoney(agents.reduce((s,r) => s + parseFloat(r.valid_bet || 0), 0))}</td>
                                <td class="${agents.reduce((s,r) => s + parseFloat(r.player_win_loss || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(agents.reduce((s,r) => s + parseFloat(r.player_win_loss || 0), 0))}</td>
                                <td class="${agents.reduce((s,r) => s + parseFloat(r.gross_profit || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(agents.reduce((s,r) => s + parseFloat(r.gross_profit || 0), 0))}</td>
                                <td class="text-purple-600">${formatMoney(agents.reduce((s,r) => s + parseFloat(r.commission_earned || 0), 0))}</td>
                            </tr>
                        </tfoot>
                        ` : ''}
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

function exportProfitSharing() {
    const data = currentReportData.profitSharing || {};
    const shareholders = data.shareholders || [];
    const agents = data.agents || [];
    
    // 合并导出股东和代理数据
    const exportData = [
        { type: '=== 股东盈利分成 ===' },
        ...shareholders.map(s => ({
            type: '股东',
            name: s.shareholder_name || s.agent_username,
            share_ratio: (s.share_ratio || 0) + '%',
            player_count: s.player_count,
            total_bet: s.total_bet,
            valid_bet: s.valid_bet,
            player_win_loss: s.player_win_loss,
            gross_profit: s.gross_profit,
            earned: s.shareholder_profit,
            platform: s.platform_profit
        })),
        { type: '=== 代理佣金明细 ===' },
        ...agents.map(a => ({
            type: '代理',
            name: a.agent_username,
            share_ratio: (a.commission_ratio || 0) + '%',
            player_count: a.player_count,
            total_bet: a.total_bet,
            valid_bet: a.valid_bet,
            player_win_loss: a.player_win_loss,
            gross_profit: a.gross_profit,
            earned: a.commission_earned,
            platform: ''
        }))
    ];
    
    exportToExcel(exportData, [
        { key: 'type', label: '类型' },
        { key: 'name', label: '账号' },
        { key: 'share_ratio', label: '分成/佣金比例' },
        { key: 'player_count', label: '玩家数' },
        { key: 'total_bet', label: '总投注' },
        { key: 'valid_bet', label: '有效投注' },
        { key: 'player_win_loss', label: '会员输赢' },
        { key: 'gross_profit', label: '毛利润' },
        { key: 'earned', label: '应得金额' },
        { key: 'platform', label: '平台收益' }
    ], '盈利分成报表');
}

function exportShareholderProfit() {
    const shareholders = currentReportData.profitSharing?.shareholders || [];
    exportToExcel(shareholders, [
        { key: 'shareholder_name', label: '股东账号' },
        { key: 'share_ratio', label: '占成比例(%)' },
        { key: 'sub_agent_count', label: '下级代理数' },
        { key: 'player_count', label: '玩家数' },
        { key: 'total_bet', label: '总投注' },
        { key: 'valid_bet', label: '有效投注' },
        { key: 'player_win_loss', label: '会员输赢' },
        { key: 'gross_profit', label: '毛利润' },
        { key: 'shareholder_profit', label: '应得金额' },
        { key: 'platform_profit', label: '平台收益' }
    ], '股东盈利分成');
}

function exportAgentCommission() {
    const agents = currentReportData.profitSharing?.agents || [];
    exportToExcel(agents, [
        { key: 'agent_username', label: '代理账号' },
        { key: 'shareholder_name', label: '所属股东' },
        { key: 'level', label: '层级' },
        { key: 'commission_ratio', label: '佣金比例(%)' },
        { key: 'player_count', label: '玩家数' },
        { key: 'total_bet', label: '总投注' },
        { key: 'valid_bet', label: '有效投注' },
        { key: 'player_win_loss', label: '会员输赢' },
        { key: 'gross_profit', label: '毛利润' },
        { key: 'commission_earned', label: '应得佣金' }
    ], '代理佣金明细');
}

// 代理业绩
async function renderAgentPerformance() {
    const content = document.getElementById('pageContent');
    const { startDate, endDate } = getDefaultDateRange();
    
    // 加载股东下拉选项
    let shareholderOptions = '<option value="">全部股东</option>';
    try {
        const shareholderRes = await apiRequest('/reports/shareholders');
        (shareholderRes.data || []).forEach(s => {
            shareholderOptions += `<option value="${s.agent_id}">${escapeHtml(s.agent_username)}</option>`;
        });
    } catch (e) { console.error('加载股东列表失败:', e); }
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header bg-indigo-50">
                <h3 class="text-lg font-semibold text-indigo-700"><i class="fas fa-user-tie mr-2"></i>代理业绩报表 - 佣金结算</h3>
            </div>
            <!-- 筛选条件 -->
            <div class="p-4 bg-gray-50 border-b">
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">开始日期</label>
                        <input type="date" id="AgentStartDate" value="${startDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">结束日期</label>
                        <input type="date" id="AgentEndDate" value="${endDate}" class="form-input w-full text-sm">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">所属股东</label>
                        <select id="AgentShareholder" class="form-input w-full text-sm">${shareholderOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">代理账号</label>
                        <input type="text" id="AgentUsername" placeholder="输入代理账号" class="form-input w-full text-sm">
                    </div>
                    <div class="flex items-end gap-2">
                        <button onclick="queryAgent()" class="btn btn-primary text-sm flex-1"><i class="fas fa-search mr-1"></i>查询</button>
                        <button onclick="exportAgent()" class="btn bg-green-500 text-white text-sm hover:bg-green-600"><i class="fas fa-download"></i></button>
                    </div>
                </div>
            </div>
            <div class="p-4" id="agentPerformanceContent">
                <div class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
            </div>
        </div>
    `;
    
    await queryAgent();
}

async function queryAgent() {
    const startDate = document.getElementById('AgentStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('AgentEndDate')?.value || getDefaultDateRange().endDate;
    const shareholderId = document.getElementById('AgentShareholder')?.value || '';
    const agentUsername = document.getElementById('AgentUsername')?.value || '';
    const container = document.getElementById('agentPerformanceContent');
    
    try {
        // 获取代理业绩数据和综合报表数据
        const [perfRes, compRes] = await Promise.all([
            apiRequest(`/reports/agent-performance?start_date=${startDate}&end_date=${endDate}`),
            apiRequest(`/reports/comprehensive?start_date=${startDate}&end_date=${endDate}${shareholderId ? '&shareholder_id=' + shareholderId : ''}`)
        ]);
        
        let list = perfRes.data || [];
        const compData = compRes.data || {};
        
        // 根据代理账号筛选
        if (agentUsername) {
            list = list.filter(a => (a.agent_username || '').toLowerCase().includes(agentUsername.toLowerCase()));
        }
        
        currentReportData.agent = { list, comprehensive: compData };
        
        // 计算汇总
        const summary = list.reduce((acc, a) => ({
            player_count: acc.player_count + (a.player_count || 0),
            total_bet: acc.total_bet + parseFloat(a.total_bet || 0),
            valid_bet: acc.valid_bet + parseFloat(a.valid_bet || 0),
            total_win_loss: acc.total_win_loss + parseFloat(a.total_win_loss || 0),
            company_profit: acc.company_profit + parseFloat(a.company_profit || 0),
            commission_earned: acc.commission_earned + parseFloat(a.commission_earned || 0)
        }), { player_count: 0, total_bet: 0, valid_bet: 0, total_win_loss: 0, company_profit: 0, commission_earned: 0 });
        
        container.innerHTML = `
            <!-- 汇总统计卡片 -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                <div class="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                    <div class="text-xs text-gray-600">代理数量</div>
                    <div class="text-lg font-bold text-indigo-600">${list.length}</div>
                </div>
                <div class="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                    <div class="text-xs text-gray-600">总玩家数</div>
                    <div class="text-lg font-bold text-blue-600">${formatNumber(summary.player_count)}</div>
                </div>
                <div class="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                    <div class="text-xs text-gray-600">总投注额</div>
                    <div class="text-lg font-bold text-purple-600">${formatMoney(summary.total_bet)}</div>
                </div>
                <div class="bg-${summary.total_win_loss >= 0 ? 'green' : 'red'}-50 rounded-lg p-3 text-center border">
                    <div class="text-xs text-gray-600">玩家输赢</div>
                    <div class="text-lg font-bold text-${summary.total_win_loss >= 0 ? 'green' : 'red'}-600">${formatMoney(summary.total_win_loss)}</div>
                </div>
                <div class="bg-${summary.company_profit >= 0 ? 'green' : 'red'}-50 rounded-lg p-3 text-center border">
                    <div class="text-xs text-gray-600">公司盈利</div>
                    <div class="text-lg font-bold text-${summary.company_profit >= 0 ? 'green' : 'red'}-600">${formatMoney(summary.company_profit)}</div>
                </div>
                <div class="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                    <div class="text-xs text-gray-600">应付佣金</div>
                    <div class="text-lg font-bold text-orange-600">${formatMoney(summary.commission_earned)}</div>
                </div>
            </div>
            
            <!-- 代理明细表格 -->
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead class="bg-gray-100">
                        <tr>
                            <th>代理账号</th>
                            <th>昵称</th>
                            <th>层级</th>
                            <th>佣金比例</th>
                            <th>玩家数</th>
                            <th>投注额</th>
                            <th>有效投注</th>
                            <th>玩家输赢</th>
                            <th>公司盈利</th>
                            <th>应付佣金</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? '<tr><td colspan="10" class="text-center text-gray-500 py-4">暂无数据</td></tr>' : 
                        list.map(a => `
                            <tr>
                                <td class="font-mono font-medium">${escapeHtml(a.agent_username || '-')}</td>
                                <td>${escapeHtml(a.nickname || '-')}</td>
                                <td>${getLevelBadge(a.level)}</td>
                                <td><span class="badge badge-info">${a.commission_ratio || 0}%</span></td>
                                <td>${formatNumber(a.player_count || 0)}</td>
                                <td>${formatMoney(a.total_bet || 0)}</td>
                                <td>${formatMoney(a.valid_bet || 0)}</td>
                                <td class="${parseFloat(a.total_win_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(a.total_win_loss || 0)}</td>
                                <td class="${parseFloat(a.company_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">${formatMoney(a.company_profit || 0)}</td>
                                <td class="text-orange-600 font-bold">${formatMoney(a.commission_earned || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

function exportAgent() {
    const data = currentReportData.agent?.list || currentReportData.agent || [];
    exportToExcel(data, [
        { key: 'agent_username', label: '代理账号' },
        { key: 'nickname', label: '昵称' },
        { key: 'level', label: '层级' },
        { key: 'commission_ratio', label: '佣金比例(%)' },
        { key: 'player_count', label: '玩家数' },
        { key: 'total_bet', label: '投注额' },
        { key: 'valid_bet', label: '有效投注' },
        { key: 'total_win_loss', label: '玩家输赢' },
        { key: 'company_profit', label: '公司盈利' },
        { key: 'commission_earned', label: '应付佣金' }
    ], '代理业绩报表');
}

// ==================== 转账记录报表 ====================
async function renderTransferRecords() {
    const content = document.getElementById('pageContent');
    const defaultRange = getDefaultDateRange();
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <!-- 标题栏 -->
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold">
                        <i class="fas fa-exchange-alt mr-2 text-purple-500"></i>转账记录报表
                        <span class="badge badge-blue ml-2">会员互转</span>
                    </h3>
                    <div class="flex space-x-2">
                        <button onclick="showFeeSettings()" class="btn btn-outline text-sm">
                            <i class="fas fa-cog mr-1"></i>手续费设置
                        </button>
                        <button onclick="exportTransfer()" class="btn btn-success text-sm">
                            <i class="fas fa-file-excel mr-1"></i>导出
                        </button>
                    </div>
                </div>
                <!-- 筛选条件 -->
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">开始日期</label>
                            <input type="date" id="TransferStartDate" class="form-input text-sm w-full" value="${defaultRange.startDate}">
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">结束日期</label>
                            <input type="date" id="TransferEndDate" class="form-input text-sm w-full" value="${defaultRange.endDate}">
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">转出会员</label>
                            <input type="text" id="TransferFromUser" class="form-input text-sm w-full" placeholder="输入账号">
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">转入会员</label>
                            <input type="text" id="TransferToUser" class="form-input text-sm w-full" placeholder="输入账号">
                        </div>
                        <div class="flex items-end">
                            <button onclick="queryTransfer()" class="btn btn-primary text-sm w-full h-[38px]">
                                <i class="fas fa-search mr-1"></i>查询
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-4" id="transferContent">
                <div class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
            </div>
        </div>
    `;
    
    await queryTransfer();
}

async function queryTransfer() {
    const startDate = document.getElementById('TransferStartDate')?.value || getDefaultDateRange().startDate;
    const endDate = document.getElementById('TransferEndDate')?.value || getDefaultDateRange().endDate;
    const fromUser = document.getElementById('TransferFromUser')?.value || '';
    const toUser = document.getElementById('TransferToUser')?.value || '';
    const container = document.getElementById('transferContent');
    
    try {
        // 只查询会员互转类型
        let url = `/reports/transfers?start_date=${startDate}&end_date=${endDate}&transfer_type=member`;
        if (fromUser) url += `&from_username=${encodeURIComponent(fromUser)}`;
        if (toUser) url += `&to_username=${encodeURIComponent(toUser)}`;
        
        const res = await apiRequest(url);
        const { list, total, summary } = res.data || { list: [], total: 0, summary: {} };
        currentReportData.transfer = list;
        
        container.innerHTML = `
            <!-- 汇总统计卡片 -->
            <div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                <div class="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                    <div class="text-xs text-gray-500 mb-1">转账笔数</div>
                    <div class="text-lg font-bold text-purple-600">${formatNumber(summary.total_count || 0)}</div>
                </div>
                <div class="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                    <div class="text-xs text-gray-500 mb-1">转账总额</div>
                    <div class="text-lg font-bold text-blue-600">${formatMoney(summary.total_amount || 0)}</div>
                </div>
                <div class="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                    <div class="text-xs text-gray-500 mb-1">手续费收入</div>
                    <div class="text-lg font-bold text-orange-600">${formatMoney(summary.total_fee || 0)}</div>
                </div>
                <div class="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                    <div class="text-xs text-gray-500 mb-1">实际到账</div>
                    <div class="text-lg font-bold text-green-600">${formatMoney(summary.total_actual || 0)}</div>
                </div>
                <div class="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                    <div class="text-xs text-gray-500 mb-1">转出人数</div>
                    <div class="text-lg font-bold text-indigo-600">${formatNumber(summary.unique_senders || 0)}</div>
                </div>
                <div class="bg-pink-50 rounded-lg p-3 text-center border border-pink-100">
                    <div class="text-xs text-gray-500 mb-1">转入人数</div>
                    <div class="text-lg font-bold text-pink-600">${formatNumber(summary.unique_receivers || 0)}</div>
                </div>
            </div>
            
            <!-- 数据表格 -->
            <div class="border rounded-lg overflow-hidden">
                <table class="data-table mb-0">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left">订单号</th>
                            <th class="text-left">转出会员</th>
                            <th class="text-center" style="width:60px;"></th>
                            <th class="text-left">转入会员</th>
                            <th class="text-right">转账金额</th>
                            <th class="text-right">手续费</th>
                            <th class="text-right">实际到账</th>
                            <th class="text-center">状态</th>
                            <th class="text-center">转账时间</th>
                            <th class="text-center" style="width:80px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? 
                            '<tr><td colspan="10" class="text-center text-gray-400 py-12"><i class="fas fa-inbox text-4xl mb-3 block"></i>暂无转账记录</td></tr>' : 
                            list.map(t => {
                                const statusMap = { 0: { label: '失败', color: 'red' }, 1: { label: '成功', color: 'green' }, 2: { label: '处理中', color: 'yellow' } };
                                const statusInfo = statusMap[t.status] || { label: '未知', color: 'gray' };
                                
                                return `
                                    <tr class="hover:bg-gray-50 border-b">
                                        <td class="text-left">
                                            <span class="font-mono text-xs text-gray-500">${escapeHtml(t.order_no || '')}</span>
                                        </td>
                                        <td class="text-left">
                                            <div class="font-medium text-blue-600">${escapeHtml(t.from_username || '')}</div>
                                            <div class="text-xs text-gray-400"><i class="fas fa-wifi mr-1"></i>${escapeHtml(t.ip_address || '-')}</div>
                                        </td>
                                        <td class="text-center">
                                            <i class="fas fa-arrow-right text-purple-400 text-lg"></i>
                                        </td>
                                        <td class="text-left">
                                            <div class="font-medium text-green-600">${escapeHtml(t.to_username || '')}</div>
                                            <div class="text-xs text-gray-400"><i class="fas fa-wifi mr-1"></i>${escapeHtml(t.to_ip_address || '-')}</div>
                                        </td>
                                        <td class="text-right font-bold text-purple-600">${formatMoney(t.amount)}</td>
                                        <td class="text-right ${parseFloat(t.fee) > 0 ? 'text-orange-600' : 'text-gray-400'}">${formatMoney(t.fee)}</td>
                                        <td class="text-right font-medium text-green-600">${formatMoney(t.actual_amount)}</td>
                                        <td class="text-center"><span class="badge badge-${statusInfo.color}">${statusInfo.label}</span></td>
                                        <td class="text-center text-xs text-gray-500">${formatDate(t.created_at)}</td>
                                        <td class="text-center">
                                            <button onclick="viewTransferDetail(${t.transfer_id})" class="text-blue-500 hover:text-blue-700" title="查看详情">
                                                <i class="fas fa-search-plus"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')
                        }
                    </tbody>
                </table>
            </div>
            
            <!-- 底部信息 -->
            <div class="mt-3 text-xs text-gray-400 text-right">
                共 ${formatNumber(total)} 条记录
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="text-center text-red-500 py-10"><i class="fas fa-exclamation-circle mr-2"></i>加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

// 查看转账详情
async function viewTransferDetail(transferId) {
    try {
        const res = await apiRequest(`/reports/transfers/${transferId}`);
        const t = res.data;
        const fromUser = t.from_user_info || {};
        const toUser = t.to_user_info || {};
        const fundSource = t.fund_source || [];
        
        const statusMap = { 0: '失败', 1: '成功', 2: '处理中' };
        const txTypeMap = { 1: '存款', 2: '提款', 3: '投注', 4: '派彩', 5: '红利', 6: '洗码', 7: '调账', 8: '转入', 9: '转出' };
        
        openModal(`
            <div class="card-header flex items-center justify-between">
                <span><i class="fas fa-exchange-alt mr-2 text-purple-500"></i>转账详情</span>
                <span class="badge badge-${t.status === 1 ? 'success' : 'danger'}">${statusMap[t.status] || '未知'}</span>
            </div>
            <div class="p-6" style="max-height: 80vh; overflow-y: auto;">
                <!-- 基本信息 -->
                <div class="grid grid-cols-3 gap-3 mb-4">
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <div class="text-xs text-gray-500 mb-1">订单号</div>
                        <div class="font-mono text-sm font-medium">${escapeHtml(t.order_no || '')}</div>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <div class="text-xs text-gray-500 mb-1">转账时间</div>
                        <div class="text-sm font-medium">${formatDate(t.created_at)}</div>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <div class="text-xs text-gray-500 mb-1">类型</div>
                        <div class="text-sm font-medium">会员互转</div>
                    </div>
                </div>
                
                <!-- 转账流程图 -->
                <div class="bg-gradient-to-r from-blue-50 via-purple-50 to-green-50 rounded-lg p-4 mb-4">
                    <div class="flex items-stretch justify-between">
                        <!-- 转出方 -->
                        <div class="flex-1 bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
                            <div class="flex items-center mb-2">
                                <i class="fas fa-user-minus text-blue-500 mr-2"></i>
                                <span class="text-sm text-gray-500">转出方</span>
                            </div>
                            <div class="font-bold text-blue-600 text-lg">${escapeHtml(t.from_username || '')}</div>
                            <div class="text-xs text-gray-400 mb-2">ID: ${t.from_user_id}</div>
                            <div class="bg-blue-50 rounded p-2 text-sm space-y-1">
                                <div class="flex justify-between">
                                    <span class="text-gray-500">转前余额:</span>
                                    <span class="font-medium">${formatMoney(t.from_balance_before)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-500">转后余额:</span>
                                    <span class="font-medium text-blue-600">${formatMoney(t.from_balance_after)}</span>
                                </div>
                            </div>
                            <div class="mt-2 pt-2 border-t text-xs">
                                <div class="flex items-center text-gray-500">
                                    <i class="fas fa-map-marker-alt mr-1 text-red-400"></i>
                                    <span>IP: </span>
                                    <span class="font-mono ml-1 text-gray-700">${escapeHtml(t.from_ip || t.ip_address || '-')}</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 中间箭头和金额 -->
                        <div class="flex flex-col items-center justify-center px-4">
                            <div class="text-2xl font-bold text-purple-600">${formatMoney(t.amount)}</div>
                            <div class="flex items-center my-2">
                                <div class="w-8 h-0.5 bg-purple-300"></div>
                                <i class="fas fa-arrow-right text-purple-500 text-2xl mx-1"></i>
                                <div class="w-8 h-0.5 bg-purple-300"></div>
                            </div>
                            ${parseFloat(t.fee) > 0 ? `
                                <div class="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                    手续费: ${formatMoney(t.fee)}
                                </div>
                            ` : ''}
                            <div class="text-sm text-green-600 mt-1">
                                实到: ${formatMoney(t.actual_amount)}
                            </div>
                        </div>
                        
                        <!-- 接收方 -->
                        <div class="flex-1 bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
                            <div class="flex items-center mb-2">
                                <i class="fas fa-user-plus text-green-500 mr-2"></i>
                                <span class="text-sm text-gray-500">接收方</span>
                            </div>
                            <div class="font-bold text-green-600 text-lg">${escapeHtml(t.to_username || '')}</div>
                            <div class="text-xs text-gray-400 mb-2">ID: ${t.to_user_id}</div>
                            <div class="bg-green-50 rounded p-2 text-sm space-y-1">
                                <div class="flex justify-between">
                                    <span class="text-gray-500">转前余额:</span>
                                    <span class="font-medium">${formatMoney(t.to_balance_before)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-500">转后余额:</span>
                                    <span class="font-medium text-green-600">${formatMoney(t.to_balance_after)}</span>
                                </div>
                            </div>
                            <div class="mt-2 pt-2 border-t text-xs">
                                <div class="flex items-center text-gray-500">
                                    <i class="fas fa-map-marker-alt mr-1 text-red-400"></i>
                                    <span>IP: </span>
                                    <span class="font-mono ml-1 text-gray-700">${escapeHtml(t.to_ip || t.to_ip_address || '-')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 转出人账户汇总 -->
                <div class="border rounded-lg mb-4">
                    <div class="bg-blue-50 px-4 py-2 rounded-t-lg border-b flex items-center">
                        <i class="fas fa-wallet text-blue-500 mr-2"></i>
                        <span class="font-medium">转出人账户概览</span>
                        <span class="text-xs text-gray-500 ml-2">(${escapeHtml(t.from_username || '')})</span>
                    </div>
                    <div class="p-4">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div class="text-center p-2 bg-gray-50 rounded">
                                <div class="text-xs text-gray-500">当前余额</div>
                                <div class="font-bold text-blue-600">${formatMoney(fromUser.balance || 0)}</div>
                            </div>
                            <div class="text-center p-2 bg-gray-50 rounded">
                                <div class="text-xs text-gray-500">累计存款</div>
                                <div class="font-medium text-green-600">${formatMoney(fromUser.total_deposit_amount || 0)}</div>
                            </div>
                            <div class="text-center p-2 bg-gray-50 rounded">
                                <div class="text-xs text-gray-500">累计红利</div>
                                <div class="font-medium text-pink-600">${formatMoney(fromUser.total_bonus || 0)}</div>
                            </div>
                            <div class="text-center p-2 bg-gray-50 rounded">
                                <div class="text-xs text-gray-500">累计投注</div>
                                <div class="font-medium text-purple-600">${formatMoney(fromUser.total_bet || 0)}</div>
                            </div>
                            <div class="text-center p-2 bg-gray-50 rounded">
                                <div class="text-xs text-gray-500">累计提款</div>
                                <div class="font-medium text-red-600">${formatMoney(fromUser.total_withdraw_amount || 0)}</div>
                            </div>
                            <div class="text-center p-2 bg-gray-50 rounded">
                                <div class="text-xs text-gray-500">转出总额</div>
                                <div class="font-medium text-orange-600">${formatMoney(fromUser.total_transfer_out || 0)}</div>
                            </div>
                            <div class="text-center p-2 bg-gray-50 rounded">
                                <div class="text-xs text-gray-500">转入总额</div>
                                <div class="font-medium text-teal-600">${formatMoney(fromUser.total_transfer_in || 0)}</div>
                            </div>
                            <div class="text-center p-2 bg-gray-50 rounded">
                                <div class="text-xs text-gray-500">资金净值</div>
                                <div class="font-medium">${formatMoney((fromUser.total_deposit_amount || 0) + (fromUser.total_bonus || 0) + (fromUser.total_transfer_in || 0) - (fromUser.total_withdraw_amount || 0) - (fromUser.total_transfer_out || 0))}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 转出人资金来源账单 -->
                <div class="border rounded-lg mb-4">
                    <div class="bg-orange-50 px-4 py-2 rounded-t-lg border-b flex items-center justify-between">
                        <div class="flex items-center">
                            <i class="fas fa-history text-orange-500 mr-2"></i>
                            <span class="font-medium">资金来源账单</span>
                            <span class="text-xs text-gray-500 ml-2">(转账前近期交易)</span>
                        </div>
                        <span class="badge badge-orange">${fundSource.length} 条</span>
                    </div>
                    <div class="max-h-60 overflow-y-auto">
                        ${fundSource.length > 0 ? `
                            <table class="data-table mb-0 text-sm">
                                <thead class="sticky top-0 bg-white">
                                    <tr>
                                        <th>时间</th>
                                        <th>类型</th>
                                        <th>金额</th>
                                        <th>余额变动</th>
                                        <th>备注</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${fundSource.map(tx => {
                                        const isIncome = parseFloat(tx.amount) > 0;
                                        return `
                                            <tr>
                                                <td class="text-xs text-gray-500">${formatDate(tx.created_at)}</td>
                                                <td><span class="badge badge-${isIncome ? 'success' : 'warning'}">${txTypeMap[tx.transaction_type] || '其他'}</span></td>
                                                <td class="${isIncome ? 'text-green-600' : 'text-red-600'} font-medium">
                                                    ${isIncome ? '+' : ''}${formatMoney(tx.amount)}
                                                </td>
                                                <td class="text-xs">
                                                    ${formatMoney(tx.balance_before)} → ${formatMoney(tx.balance_after)}
                                                </td>
                                                <td class="text-xs text-gray-500 max-w-[150px] truncate" title="${escapeHtml(tx.remark || '')}">${escapeHtml(tx.remark || '-')}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        ` : '<div class="p-4 text-center text-gray-500 text-sm">暂无交易记录</div>'}
                    </div>
                </div>
                
                ${t.remark ? `
                    <div class="bg-yellow-50 p-3 rounded-lg mb-4">
                        <div class="text-xs text-gray-500 mb-1"><i class="fas fa-comment mr-1"></i>转账备注</div>
                        <div class="text-sm">${escapeHtml(t.remark)}</div>
                    </div>
                ` : ''}
                
                <div class="flex justify-end">
                    <button onclick="closeModal()" class="btn btn-outline">关闭</button>
                </div>
            </div>
        `, 'max-w-4xl');
    } catch (error) {
        alert('获取详情失败: ' + error.message);
    }
}

// 导出转账记录
function exportTransfer() {
    if (!currentReportData.transfer || currentReportData.transfer.length === 0) {
        alert('没有可导出的数据');
        return;
    }
    
    const statusMap = { 0: '失败', 1: '成功', 2: '处理中' };
    
    const exportData = currentReportData.transfer.map(t => ({
        ...t,
        status_text: statusMap[t.status] || '未知'
    }));
    
    exportToExcel(exportData, [
        { key: 'order_no', label: '订单号' },
        { key: 'from_username', label: '转出会员' },
        { key: 'ip_address', label: '转出IP' },
        { key: 'to_username', label: '转入会员' },
        { key: 'to_ip_address', label: '转入IP' },
        { key: 'amount', label: '转账金额' },
        { key: 'fee', label: '手续费' },
        { key: 'actual_amount', label: '实际到账' },
        { key: 'status_text', label: '状态' },
        { key: 'created_at', label: '时间' },
        { key: 'remark', label: '备注' }
    ], '会员转账记录');
}

// ==================== 转账手续费设置 ====================
async function showFeeSettings() {
    try {
        const res = await apiRequest('/transfer/fee-settings');
        const rules = res.data || [];
        
        const feeTypeMap = { 'percent': '百分比', 'fixed': '固定金额' };
        const transferTypeMap = { 'all': '全部会员', 'member': '会员互转' };
        
        openModal(`
            <div class="card-header flex items-center justify-between">
                <span><i class="fas fa-cog mr-2 text-orange-500"></i>转账手续费设置</span>
                <button onclick="showAddFeeRule()" class="btn btn-primary text-sm">
                    <i class="fas fa-plus mr-1"></i>新增规则
                </button>
            </div>
            <div class="p-4" style="max-height: 70vh; overflow-y: auto;">
                <div class="text-sm text-gray-500 mb-4 bg-blue-50 p-3 rounded-lg">
                    <i class="fas fa-info-circle mr-1"></i>
                    规则按优先级从高到低匹配，匹配到第一个符合条件的规则后停止。VIP等级0表示适用所有等级。
                </div>
                
                ${rules.length > 0 ? `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>规则名称</th>
                                <th>类型</th>
                                <th>费率/金额</th>
                                <th>限额范围</th>
                                <th>适用类型</th>
                                <th>VIP</th>
                                <th>免费次数</th>
                                <th>优先级</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rules.map(r => `
                                <tr class="${r.status === 1 ? '' : 'bg-gray-100 opacity-60'}">
                                    <td>
                                        <div class="font-medium">${escapeHtml(r.fee_name)}</div>
                                        ${r.description ? `<div class="text-xs text-gray-500">${escapeHtml(r.description)}</div>` : ''}
                                    </td>
                                    <td><span class="badge badge-${r.fee_type === 'percent' ? 'blue' : 'green'}">${feeTypeMap[r.fee_type]}</span></td>
                                    <td class="font-mono">
                                        ${r.fee_type === 'percent' ? 
                                            `${(r.fee_value * 100).toFixed(2)}%` : 
                                            formatMoney(r.fee_value)
                                        }
                                        ${(r.min_fee > 0 || r.max_fee > 0) ? 
                                            `<div class="text-xs text-gray-500">${r.min_fee > 0 ? '最低'+formatMoney(r.min_fee) : ''}${r.max_fee > 0 ? ' 最高'+formatMoney(r.max_fee) : ''}</div>` : ''
                                        }
                                    </td>
                                    <td class="text-xs">
                                        ${r.min_amount > 0 ? formatMoney(r.min_amount) : '0'} ~ ${r.max_amount > 0 ? formatMoney(r.max_amount) : '不限'}
                                    </td>
                                    <td><span class="badge badge-outline">${transferTypeMap[r.transfer_type]}</span></td>
                                    <td>${r.vip_level > 0 ? `VIP${r.vip_level}+` : '全部'}</td>
                                    <td>${r.daily_free_count > 0 ? `${r.daily_free_count}次/日` : '-'}</td>
                                    <td class="font-bold text-purple-600">${r.priority}</td>
                                    <td>
                                        <button onclick="toggleFeeRule(${r.fee_id})" class="badge badge-${r.status === 1 ? 'success' : 'secondary'} cursor-pointer">
                                            ${r.status === 1 ? '启用' : '禁用'}
                                        </button>
                                    </td>
                                    <td>
                                        <div class="flex space-x-1">
                                            <button onclick="editFeeRule(${r.fee_id})" class="text-blue-500 hover:text-blue-700" title="编辑">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="deleteFeeRule(${r.fee_id}, '${escapeAttr(r.fee_name)}')" class="text-red-500 hover:text-red-700" title="删除">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `
                    <div class="text-center text-gray-500 py-10">
                        <i class="fas fa-inbox text-4xl mb-3"></i>
                        <p>暂无手续费规则</p>
                        <button onclick="showAddFeeRule()" class="btn btn-primary mt-3">新增规则</button>
                    </div>
                `}
                
                <div class="flex justify-end mt-4">
                    <button onclick="closeModal()" class="btn btn-outline">关闭</button>
                </div>
            </div>
        `, 'max-w-5xl');
    } catch (error) {
        alert('加载手续费设置失败: ' + error.message);
    }
}

// 新增/编辑手续费规则弹窗
function showAddFeeRule(ruleData = null) {
    const isEdit = ruleData !== null;
    const r = ruleData || {};
    
    openModal(`
        <div class="card-header">
            <i class="fas fa-${isEdit ? 'edit' : 'plus'} mr-2 text-orange-500"></i>
            ${isEdit ? '编辑' : '新增'}手续费规则
        </div>
        <div class="p-6">
            <form id="feeRuleForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">规则名称 <span class="text-red-500">*</span></label>
                        <input type="text" id="feeName" class="form-input w-full" value="${escapeAttr(r.fee_name || '')}" placeholder="如：默认手续费" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                        <input type="number" id="feePriority" class="form-input w-full" value="${r.priority || 0}" min="0" placeholder="数值越大优先级越高">
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">手续费类型 <span class="text-red-500">*</span></label>
                        <select id="feeType" class="form-input w-full" onchange="updateFeeValueLabel()">
                            <option value="percent" ${r.fee_type === 'percent' ? 'selected' : ''}>百分比</option>
                            <option value="fixed" ${r.fee_type === 'fixed' ? 'selected' : ''}>固定金额</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" id="feeValueLabel">费率 (如0.01=1%)</label>
                        <input type="number" id="feeValue" class="form-input w-full" value="${r.fee_value || 0}" step="0.0001" min="0">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">每日免费次数</label>
                        <input type="number" id="feeFreeCount" class="form-input w-full" value="${r.daily_free_count || 0}" min="0" placeholder="0=无免费">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最低手续费</label>
                        <input type="number" id="feeMin" class="form-input w-full" value="${r.min_fee || 0}" step="0.01" min="0">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最高手续费 (0=不限)</label>
                        <input type="number" id="feeMax" class="form-input w-full" value="${r.max_fee || 0}" step="0.01" min="0">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最低转账金额</label>
                        <input type="number" id="feeMinAmount" class="form-input w-full" value="${r.min_amount || 0}" step="0.01" min="0">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最高转账金额 (0=不限)</label>
                        <input type="number" id="feeMaxAmount" class="form-input w-full" value="${r.max_amount || 0}" step="0.01" min="0">
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">适用类型</label>
                        <select id="feeTransferType" class="form-input w-full">
                            <option value="all" ${r.transfer_type === 'all' ? 'selected' : ''}>全部会员</option>
                            <option value="member" ${r.transfer_type === 'member' ? 'selected' : ''}>会员互转</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">适用VIP等级</label>
                        <select id="feeVipLevel" class="form-input w-full">
                            <option value="0" ${r.vip_level == 0 ? 'selected' : ''}>全部等级</option>
                            ${[1,2,3,4,5,6,7,8,9,10].map(v => `<option value="${v}" ${r.vip_level == v ? 'selected' : ''}>VIP${v}及以上</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">状态</label>
                        <select id="feeStatus" class="form-input w-full">
                            <option value="1" ${r.status !== 0 ? 'selected' : ''}>启用</option>
                            <option value="0" ${r.status === 0 ? 'selected' : ''}>禁用</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">描述说明</label>
                    <textarea id="feeDescription" class="form-input w-full" rows="2" placeholder="规则说明">${escapeHtml(r.description || '')}</textarea>
                </div>
                
                <div class="flex justify-end space-x-2 pt-4 border-t">
                    <button type="button" onclick="showFeeSettings()" class="btn btn-outline">返回列表</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>保存</button>
                </div>
            </form>
        </div>
    `, 'max-w-2xl');
    
    updateFeeValueLabel();
    
    document.getElementById('feeRuleForm').onsubmit = async (e) => {
        e.preventDefault();
        await submitFeeRule(isEdit ? r.fee_id : null);
    };
}

function updateFeeValueLabel() {
    const type = document.getElementById('feeType').value;
    const label = document.getElementById('feeValueLabel');
    label.textContent = type === 'percent' ? '费率 (如0.01=1%)' : '固定金额';
}

async function submitFeeRule(feeId) {
    const data = {
        fee_name: document.getElementById('feeName').value,
        fee_type: document.getElementById('feeType').value,
        fee_value: parseFloat(document.getElementById('feeValue').value) || 0,
        min_fee: parseFloat(document.getElementById('feeMin').value) || 0,
        max_fee: parseFloat(document.getElementById('feeMax').value) || 0,
        min_amount: parseFloat(document.getElementById('feeMinAmount').value) || 0,
        max_amount: parseFloat(document.getElementById('feeMaxAmount').value) || 0,
        transfer_type: document.getElementById('feeTransferType').value,
        vip_level: parseInt(document.getElementById('feeVipLevel').value) || 0,
        daily_free_count: parseInt(document.getElementById('feeFreeCount').value) || 0,
        status: parseInt(document.getElementById('feeStatus').value),
        priority: parseInt(document.getElementById('feePriority').value) || 0,
        description: document.getElementById('feeDescription').value
    };
    
    try {
        const url = feeId ? `/transfer/fee-settings/${feeId}` : '/transfer/fee-settings';
        const method = feeId ? 'PUT' : 'POST';
        
        const res = await apiRequest(url, { method, body: JSON.stringify(data) });
        
        if (res.success) {
            alert(feeId ? '规则更新成功' : '规则创建成功');
            showFeeSettings();
        } else {
            alert(res.message || '操作失败');
        }
    } catch (error) {
        alert('操作失败: ' + error.message);
    }
}

async function editFeeRule(feeId) {
    try {
        const res = await apiRequest(`/transfer/fee-settings/${feeId}`);
        if (res.success) {
            showAddFeeRule(res.data);
        } else {
            alert('获取规则详情失败');
        }
    } catch (error) {
        alert('获取规则详情失败: ' + error.message);
    }
}

async function deleteFeeRule(feeId, feeName) {
    if (!confirm(`确定要删除规则「${feeName}」吗？`)) return;
    
    try {
        const res = await apiRequest(`/transfer/fee-settings/${feeId}`, { method: 'DELETE' });
        if (res.success) {
            alert('规则已删除');
            showFeeSettings();
        } else {
            alert(res.message || '删除失败');
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

async function toggleFeeRule(feeId) {
    try {
        const res = await apiRequest(`/transfer/fee-settings/${feeId}/toggle`, { method: 'PUT' });
        if (res.success) {
            showFeeSettings();
        } else {
            alert(res.message || '切换状态失败');
        }
    } catch (error) {
        alert('切换状态失败: ' + error.message);
    }
}

// 角色权限管理 - 增强版
async function renderRoles() {
    const content = document.getElementById('pageContent');
    try {
        const [rolesData, permsData] = await Promise.all([
            apiRequest('/admin/roles'),
            apiRequest('/admin/permissions')
        ]);
        const roles = rolesData.data || [];
        const permissions = permsData.data || [];
        
        content.innerHTML = `
            <div class="grid grid-cols-2 gap-6">
                <div class="card">
                    <div class="card-header flex items-center justify-between">
                        <h3 class="text-lg font-semibold"><i class="fas fa-user-shield mr-2"></i>角色管理 <span class="badge badge-primary">${roles.length}</span></h3>
                        <button onclick="showAddRole()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增角色</button>
                    </div>
                    <div class="p-4">
                        <table class="data-table">
                            <thead><tr><th>角色名称</th><th>描述</th><th>用户数</th><th>操作</th></tr></thead>
                            <tbody>
                                ${roles.map(r => `
                                    <tr>
                                        <td class="font-semibold">${escapeHtml(r.role_name || '')}</td>
                                        <td class="text-sm text-gray-600">${escapeHtml(r.description || '')}</td>
                                        <td><span class="badge badge-info">${r.user_count || 0}</span></td>
                                        <td>
                                            <button onclick="editRole(${r.role_id})" class="text-blue-500 hover:text-blue-700 mr-2" title="编辑"><i class="fas fa-edit"></i></button>
                                            <button onclick="deleteRole(${r.role_id}, '${escapeAttr(r.role_name)}')" class="text-red-500 hover:text-red-700" title="删除"><i class="fas fa-trash"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="text-lg font-semibold"><i class="fas fa-key mr-2"></i>权限列表 (${permissions.length})</h3></div>
                    <div class="p-4 max-h-96 overflow-y-auto">
                        <div class="flex flex-wrap gap-2">
                            ${permissions.map(p => `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded" title="${escapeHtml(p.permission_code || '')}">${escapeHtml(p.permission_name || '')}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

// 登录日志
async function renderLoginLogs() {
    const content = document.getElementById('pageContent');
    try {
        const data = await apiRequest('/admin/audit-logs?size=100');
        const allLogs = data.data?.list || [];
        const loginLogs = allLogs.filter(log => log.operation_type === 'LOGIN');
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="text-lg font-semibold"><i class="fas fa-sign-in-alt mr-2"></i>登录日志</h3>
                    <button onclick="renderLoginLogs()" class="btn btn-primary text-sm"><i class="fas fa-sync-alt mr-1"></i> 刷新</button>
                </div>
                <div class="p-4">
                    <table class="data-table">
                        <thead><tr><th>管理员</th><th>登录IP</th><th>登录时间</th><th>状态</th></tr></thead>
                        <tbody>
                            ${loginLogs.length === 0 ? '<tr><td colspan="4" class="text-center text-gray-500 py-4">暂无登录记录</td></tr>' : 
                            loginLogs.map(log => `
                                <tr>
                                    <td class="font-mono">${escapeHtml(log.admin_username || '')}</td>
                                    <td class="font-mono text-sm">${escapeHtml(log.ip_address || '')}</td>
                                    <td class="text-sm text-gray-500">${formatDate(log.created_at)}</td>
                                    <td><span class="badge badge-success">成功</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

// ==================== V2.1.10 新增功能 ====================

// 洗码方案 - 新增/编辑
function showAddCommissionScheme() {
    openModal(`
        <div class="p-6" style="min-width: 550px;">
            <h3 class="text-lg font-bold mb-4"><i class="fas fa-plus-circle text-purple-500 mr-2"></i>新增洗码方案</h3>
            <form id="schemeForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">方案名称 <span class="text-red-500">*</span></label>
                        <input type="text" id="schemeName" class="form-input w-full" placeholder="如：VIP洗码方案" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">结算周期</label>
                        <select id="schemeCycle" class="form-input w-full">
                            <option value="0">实时结算</option>
                            <option value="1" selected>日结</option>
                            <option value="2">周结</option>
                            <option value="3">月结</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最低有效投注</label>
                        <input type="number" id="schemeMinBet" class="form-input w-full" value="100" min="0">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">单日上限 (0=无限)</label>
                        <input type="number" id="schemeDailyMax" class="form-input w-full" value="0" min="0">
                    </div>
                </div>
                <div class="border rounded-lg p-4 bg-gray-50">
                    <h4 class="text-sm font-semibold mb-3"><i class="fas fa-percent text-blue-500 mr-1"></i>返水比例设置 (%)</h4>
                    <div class="grid grid-cols-4 gap-4">
                        <div><label class="block text-xs text-gray-600 mb-1">百家乐</label><input type="number" id="rateBaccarat" class="form-input w-full" value="0.8" min="0" max="10" step="0.01"></div>
                        <div><label class="block text-xs text-gray-600 mb-1">龙虎</label><input type="number" id="rateDragonTiger" class="form-input w-full" value="0.8" min="0" max="10" step="0.01"></div>
                        <div><label class="block text-xs text-gray-600 mb-1">轮盘</label><input type="number" id="rateRoulette" class="form-input w-full" value="0.6" min="0" max="10" step="0.01"></div>
                        <div><label class="block text-xs text-gray-600 mb-1">牛牛</label><input type="number" id="rateNiuniu" class="form-input w-full" value="0.7" min="0" max="10" step="0.01"></div>
                    </div>
                </div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">状态</label><select id="schemeStatus" class="form-input w-full"><option value="1">启用</option><option value="0">禁用</option></select></div>
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>保存</button>
                </div>
            </form>
        </div>
    `);
    document.getElementById('schemeForm').onsubmit = async (e) => { e.preventDefault(); await submitCommissionScheme(); };
}

async function submitCommissionScheme(schemeId = null) {
    const data = {
        scheme_name: document.getElementById('schemeName').value.trim(),
        settlement_cycle: parseInt(document.getElementById('schemeCycle').value),
        min_valid_bet: parseFloat(document.getElementById('schemeMinBet').value) || 0,
        daily_max_amount: parseFloat(document.getElementById('schemeDailyMax').value) || null,
        baccarat_rate: (parseFloat(document.getElementById('rateBaccarat').value) || 0) / 100,
        dragon_tiger_rate: (parseFloat(document.getElementById('rateDragonTiger').value) || 0) / 100,
        roulette_rate: (parseFloat(document.getElementById('rateRoulette').value) || 0) / 100,
        niuniu_rate: (parseFloat(document.getElementById('rateNiuniu').value) || 0) / 100,
        status: parseInt(document.getElementById('schemeStatus').value)
    };
    if (!data.scheme_name) { alert('请输入方案名称'); return; }
    try {
        const url = schemeId ? `/commission/schemes/${schemeId}` : '/commission/schemes';
        const res = await apiRequest(url, { method: schemeId ? 'PUT' : 'POST', body: JSON.stringify(data) });
        if (res.success) { closeModal(); alert(schemeId ? '方案更新成功' : '方案创建成功'); loadPage('commission-schemes'); }
        else { alert(res.message || '操作失败'); }
    } catch (error) { alert('操作失败: ' + error.message); }
}

async function editCommissionScheme(schemeId) {
    try {
        const res = await apiRequest(`/commission/schemes/${schemeId}`);
        if (!res.success) { alert('获取方案详情失败'); return; }
        const s = res.data;
        showAddCommissionScheme();
        setTimeout(() => {
            document.getElementById('schemeName').value = s.scheme_name || '';
            document.getElementById('schemeCycle').value = s.settlement_cycle || 1;
            document.getElementById('schemeMinBet').value = s.min_valid_bet || 0;
            document.getElementById('schemeDailyMax').value = s.daily_max_amount || 0;
            document.getElementById('rateBaccarat').value = (s.baccarat_rate || 0) * 100;
            document.getElementById('rateDragonTiger').value = (s.dragon_tiger_rate || 0) * 100;
            document.getElementById('rateRoulette').value = (s.roulette_rate || 0) * 100;
            document.getElementById('rateNiuniu').value = (s.niuniu_rate || 0) * 100;
            document.getElementById('schemeStatus').value = s.status;
            document.querySelector('#schemeForm').previousElementSibling.innerHTML = '<i class="fas fa-edit text-purple-500 mr-2"></i>编辑洗码方案';
            document.getElementById('schemeForm').onsubmit = async (e) => { e.preventDefault(); await submitCommissionScheme(schemeId); };
        }, 100);
    } catch (error) { alert('获取详情失败: ' + error.message); }
}

async function deleteCommissionScheme(schemeId, schemeName) {
    if (!confirm(`确定删除方案 "${schemeName}" 吗？`)) return;
    try {
        const res = await apiRequest(`/commission/schemes/${schemeId}`, { method: 'DELETE' });
        if (res.success) { alert('删除成功'); loadPage('commission-schemes'); }
        else { alert(res.message || '删除失败'); }
    } catch (error) { alert('删除失败: ' + error.message); }
}

// 新增荷官
function showAddDealer() {
    openModal(`
        <div class="p-6" style="min-width: 500px;">
            <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-plus text-pink-500 mr-2"></i>新增荷官</h3>
            <form id="dealerForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">工号 <span class="text-red-500">*</span></label><input type="text" id="dealerStaffId" class="form-input w-full" placeholder="如：D001" required></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">状态</label><select id="dealerStatus" class="form-input w-full"><option value="1">在职</option><option value="2">休假</option><option value="0">离职</option></select></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">中文艺名 <span class="text-red-500">*</span></label><input type="text" id="dealerNameCn" class="form-input w-full" placeholder="如：小美" required></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">英文艺名</label><input type="text" id="dealerNameEn" class="form-input w-full" placeholder="如：Mei"></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">真实姓名</label><input type="text" id="dealerRealName" class="form-input w-full" placeholder="如：张美丽"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">联系电话</label><input type="text" id="dealerPhone" class="form-input w-full" placeholder="如：13800138000"></div>
                </div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">备注</label><textarea id="dealerRemark" class="form-input w-full" rows="2" placeholder="备注信息"></textarea></div>
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>保存</button>
                </div>
            </form>
        </div>
    `);
    document.getElementById('dealerForm').onsubmit = async (e) => { e.preventDefault(); await submitDealer(); };
}

async function submitDealer(dealerId = null) {
    const data = {
        staff_id: document.getElementById('dealerStaffId').value.trim(),
        stage_name_cn: document.getElementById('dealerNameCn').value.trim(),
        stage_name_en: document.getElementById('dealerNameEn').value.trim() || null,
        real_name: document.getElementById('dealerRealName').value.trim() || null,
        phone: document.getElementById('dealerPhone').value.trim() || null,
        remark: document.getElementById('dealerRemark').value.trim() || null,
        status: parseInt(document.getElementById('dealerStatus').value)
    };
    if (!data.staff_id || !data.stage_name_cn) { alert('请填写工号和中文艺名'); return; }
    try {
        const url = dealerId ? `/dealers/${dealerId}` : '/dealers';
        const res = await apiRequest(url, { method: dealerId ? 'PUT' : 'POST', body: JSON.stringify(data) });
        if (res.success) { closeModal(); alert(dealerId ? '荷官信息更新成功' : '荷官添加成功'); loadPage('studio-dealers'); }
        else { alert(res.message || '操作失败'); }
    } catch (error) { alert('操作失败: ' + error.message); }
}

async function editDealer(dealerId) {
    try {
        const res = await apiRequest(`/dealers/${dealerId}`);
        if (!res.success) { alert('获取荷官信息失败'); return; }
        const d = res.data;
        showAddDealer();
        setTimeout(() => {
            document.getElementById('dealerStaffId').value = d.staff_id || '';
            document.getElementById('dealerNameCn').value = d.stage_name_cn || '';
            document.getElementById('dealerNameEn').value = d.stage_name_en || '';
            document.getElementById('dealerRealName').value = d.real_name || '';
            document.getElementById('dealerPhone').value = d.phone || '';
            document.getElementById('dealerRemark').value = d.remark || '';
            document.getElementById('dealerStatus').value = d.status;
            document.querySelector('#dealerForm').previousElementSibling.innerHTML = '<i class="fas fa-user-edit text-pink-500 mr-2"></i>编辑荷官信息';
            document.getElementById('dealerForm').onsubmit = async (e) => { e.preventDefault(); await submitDealer(dealerId); };
        }, 100);
    } catch (error) { alert('获取详情失败: ' + error.message); }
}

// 新增桌台
function showAddTable() {
    openModal(`
        <div class="p-6" style="min-width: 500px;">
            <h3 class="text-lg font-bold mb-4"><i class="fas fa-plus-circle text-blue-500 mr-2"></i>新增桌台</h3>
            <form id="tableForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">桌台代码 <span class="text-red-500">*</span></label><input type="text" id="tableCode" class="form-input w-full" placeholder="如：A01" required></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">桌台名称</label><input type="text" id="tableName" class="form-input w-full" placeholder="如：贵宾厅1号桌"></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">游戏类型 <span class="text-red-500">*</span></label><select id="tableGameType" class="form-input w-full" required><option value="baccarat">百家乐</option><option value="dragon_tiger">龙虎</option><option value="roulette">轮盘</option><option value="niuniu">牛牛</option><option value="sic_bo">骰宝</option></select></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">状态</label><select id="tableStatus" class="form-input w-full"><option value="1">正常</option><option value="0">维护</option><option value="-1">关闭</option></select></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">最低投注</label><input type="number" id="tableMinBet" class="form-input w-full" value="100" min="0"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">最高投注</label><input type="number" id="tableMaxBet" class="form-input w-full" value="50000" min="0"></div>
                </div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">视频流URL</label><input type="text" id="tableVideoUrl" class="form-input w-full" placeholder="rtmp://..."></div>
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>保存</button>
                </div>
            </form>
        </div>
    `);
    document.getElementById('tableForm').onsubmit = async (e) => { e.preventDefault(); await submitTable(); };
}

async function submitTable(tableId = null) {
    const data = {
        table_code: document.getElementById('tableCode').value.trim(),
        table_name: document.getElementById('tableName').value.trim() || null,
        game_type: document.getElementById('tableGameType').value,
        min_bet: parseFloat(document.getElementById('tableMinBet').value) || 100,
        max_bet: parseFloat(document.getElementById('tableMaxBet').value) || 50000,
        video_url: document.getElementById('tableVideoUrl').value.trim() || null,
        status: parseInt(document.getElementById('tableStatus').value)
    };
    if (!data.table_code) { alert('请填写桌台代码'); return; }
    if (data.min_bet >= data.max_bet) { alert('最低投注不能大于等于最高投注'); return; }
    try {
        const url = tableId ? `/tables/${tableId}` : '/tables';
        const res = await apiRequest(url, { method: tableId ? 'PUT' : 'POST', body: JSON.stringify(data) });
        if (res.success) { closeModal(); alert(tableId ? '桌台信息更新成功' : '桌台添加成功'); loadPage('studio-tables'); }
        else { alert(res.message || '操作失败'); }
    } catch (error) { alert('操作失败: ' + error.message); }
}

async function editTable(tableId) {
    try {
        const res = await apiRequest(`/tables/${tableId}`);
        if (!res.success) { alert('获取桌台信息失败'); return; }
        const t = res.data;
        showAddTable();
        setTimeout(() => {
            document.getElementById('tableCode').value = t.table_code || '';
            document.getElementById('tableName').value = t.table_name || '';
            document.getElementById('tableGameType').value = t.game_type || 'baccarat';
            document.getElementById('tableMinBet').value = t.min_bet || 100;
            document.getElementById('tableMaxBet').value = t.max_bet || 50000;
            document.getElementById('tableVideoUrl').value = t.video_url || '';
            document.getElementById('tableStatus').value = t.status;
            document.querySelector('#tableForm').previousElementSibling.innerHTML = '<i class="fas fa-edit text-blue-500 mr-2"></i>编辑桌台信息';
            document.getElementById('tableForm').onsubmit = async (e) => { e.preventDefault(); await submitTable(tableId); };
        }, 100);
    } catch (error) { alert('获取详情失败: ' + error.message); }
}

// 角色权限管理 - 增强版 V2.1.13
// 权限结构定义 - 用于前端展示层级结构
const permissionStructure = {
    'menu': { name: '菜单权限', icon: 'fa-bars', color: 'indigo' },
    'dashboard': { name: '仪表盘', icon: 'fa-tachometer-alt', color: 'blue', parent: 'menu:dashboard' },
    'player': { name: '玩家管理', icon: 'fa-users', color: 'green', parent: 'menu:hierarchy' },
    'player_stats': { name: '玩家统计', icon: 'fa-chart-pie', color: 'green', parent: 'menu:hierarchy' },
    'agent': { name: '代理管理', icon: 'fa-user-tie', color: 'green', parent: 'menu:hierarchy' },
    'finance_transaction': { name: '交易记录', icon: 'fa-exchange-alt', color: 'yellow', parent: 'menu:finance' },
    'finance_deposit': { name: '存款管理', icon: 'fa-plus-circle', color: 'yellow', parent: 'menu:finance' },
    'finance_withdraw': { name: '取款管理', icon: 'fa-minus-circle', color: 'yellow', parent: 'menu:finance' },
    'finance_turnover': { name: '流水稽核', icon: 'fa-calculator', color: 'yellow', parent: 'menu:finance' },
    'bet': { name: '注单管理', icon: 'fa-dice', color: 'purple', parent: 'menu:bet' },
    'commission_scheme': { name: '洗码方案', icon: 'fa-percentage', color: 'pink', parent: 'menu:commission' },
    'commission_record': { name: '洗码记录', icon: 'fa-history', color: 'pink', parent: 'menu:commission' },
    'risk_rule': { name: '风控规则', icon: 'fa-shield-alt', color: 'red', parent: 'menu:risk' },
    'risk_alert': { name: '风控告警', icon: 'fa-exclamation-triangle', color: 'red', parent: 'menu:risk' },
    'risk_limit': { name: '限红设置', icon: 'fa-hand-paper', color: 'red', parent: 'menu:risk' },
    'report_settlement': { name: '结算报表', icon: 'fa-file-invoice-dollar', color: 'teal', parent: 'menu:report' },
    'report_ranking': { name: '盈亏排行', icon: 'fa-trophy', color: 'teal', parent: 'menu:report' },
    'report_game': { name: '游戏报表', icon: 'fa-gamepad', color: 'teal', parent: 'menu:report' },
    'report_daily': { name: '盈亏日报', icon: 'fa-calendar-day', color: 'teal', parent: 'menu:report' },
    'report_agent': { name: '代理业绩', icon: 'fa-user-tie', color: 'teal', parent: 'menu:report' },
    'report_transfer': { name: '转账记录', icon: 'fa-exchange-alt', color: 'purple', parent: 'menu:report' },
    'content_announcement': { name: '公告管理', icon: 'fa-bullhorn', color: 'orange', parent: 'menu:content' },
    'system_admin': { name: '账号管理', icon: 'fa-user-cog', color: 'gray', parent: 'menu:system' },
    'system_role': { name: '角色权限', icon: 'fa-user-shield', color: 'gray', parent: 'menu:system' },
    'system_2fa': { name: '2FA设置', icon: 'fa-lock', color: 'gray', parent: 'menu:system' },
    'system_whitelist': { name: 'IP白名单', icon: 'fa-shield-alt', color: 'gray', parent: 'menu:system' },
    'system_log': { name: '日志管理', icon: 'fa-history', color: 'gray', parent: 'menu:system' },
    'studio_dealer': { name: '荷官管理', icon: 'fa-user', color: 'cyan', parent: 'menu:studio' },
    'studio_table': { name: '桌台管理', icon: 'fa-table', color: 'cyan', parent: 'menu:studio' },
    'studio_shift': { name: '排班管理', icon: 'fa-calendar-alt', color: 'cyan', parent: 'menu:studio' }
};

// 一级菜单映射
const menuMapping = {
    'menu:dashboard': { name: '仪表盘', icon: 'fa-tachometer-alt', modules: ['dashboard'] },
    'menu:hierarchy': { name: '层级管理', icon: 'fa-sitemap', modules: ['player', 'player_stats', 'agent'] },
    'menu:finance': { name: '财务管理', icon: 'fa-yen-sign', modules: ['finance_transaction', 'finance_deposit', 'finance_withdraw', 'finance_turnover'] },
    'menu:bet': { name: '注单管理', icon: 'fa-dice', modules: ['bet'] },
    'menu:commission': { name: '洗码管理', icon: 'fa-percentage', modules: ['commission_scheme', 'commission_record'] },
    'menu:risk': { name: '风控管理', icon: 'fa-shield-alt', modules: ['risk_rule', 'risk_alert', 'risk_limit'] },
    'menu:report': { name: '报表中心', icon: 'fa-chart-bar', modules: ['report_settlement', 'report_ranking', 'report_game', 'report_daily', 'report_agent', 'report_transfer'] },
    'menu:content': { name: '内容管理', icon: 'fa-newspaper', modules: ['content_announcement'] },
    'menu:system': { name: '系统控制', icon: 'fa-cogs', modules: ['system_admin', 'system_role', 'system_2fa', 'system_whitelist', 'system_log'] },
    'menu:studio': { name: '现场运营', icon: 'fa-video', modules: ['studio_dealer', 'studio_table', 'studio_shift'] }
};

function showAddRole() {
    showModal(`
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-shield text-indigo-500 mr-2"></i>新增角色</h3>
        <form id="roleForm" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">角色名称 <span class="text-red-500">*</span></label><input type="text" id="roleName" class="form-input w-full" placeholder="如：财务主管" required></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">描述</label><input type="text" id="roleDesc" class="form-input w-full" placeholder="角色描述"></div>
            </div>
            <div>
                <div class="flex items-center justify-between mb-2">
                    <label class="text-sm font-medium text-gray-700">分配权限</label>
                    <div class="space-x-2">
                        <button type="button" onclick="selectAllPermissions(true)" class="text-xs text-blue-500 hover:underline">全选</button>
                        <button type="button" onclick="selectAllPermissions(false)" class="text-xs text-gray-500 hover:underline">清空</button>
                    </div>
                </div>
                <div id="permissionCheckboxes" class="border rounded-lg bg-gray-50 max-h-[500px] overflow-y-auto">
                    <div class="text-center text-gray-500 py-4">加载权限列表...</div>
                </div>
            </div>
            <div class="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>保存</button>
            </div>
        </form>
    `, 'max-w-4xl');
    loadPermissionsForRole();
    document.getElementById('roleForm').onsubmit = async (e) => { e.preventDefault(); await submitRole(); };
}

async function loadPermissionsForRole(selectedPerms = []) {
    try {
        const res = await apiRequest('/admin/permissions');
        const perms = res.data || [];
        const container = document.getElementById('permissionCheckboxes');
        
        // 分离一级菜单权限和细分权限
        const menuPerms = perms.filter(p => p.module === 'menu');
        const detailPerms = perms.filter(p => p.module !== 'menu');
        
        // 按module分组细分权限
        const groupedPerms = {};
        detailPerms.forEach(p => {
            if (!groupedPerms[p.module]) groupedPerms[p.module] = [];
            groupedPerms[p.module].push(p);
        });
        
        // 生成HTML - 按一级菜单分组
        let html = '';
        Object.entries(menuMapping).forEach(([menuCode, menuInfo]) => {
            const menuPerm = menuPerms.find(p => p.permission_code === menuCode);
            if (!menuPerm) return;
            
            const isMenuChecked = selectedPerms.includes(String(menuPerm.permission_id));
            
            html += `
                <div class="border-b last:border-b-0">
                    <div class="flex items-center p-3 bg-gray-100 hover:bg-gray-200 cursor-pointer" onclick="togglePermissionGroup('${menuCode}')">
                        <i class="fas fa-chevron-down text-gray-400 mr-2 transition-transform" id="icon-${menuCode.replace(':', '-')}"></i>
                        <label class="flex items-center flex-1 cursor-pointer" onclick="event.stopPropagation()">
                            <input type="checkbox" name="perms" value="${menuPerm.permission_id}" 
                                   ${isMenuChecked ? 'checked' : ''} 
                                   class="rounded border-gray-300 mr-2 menu-perm" 
                                   data-menu="${menuCode}"
                                   onchange="toggleMenuPermission('${menuCode}', this.checked)">
                            <i class="fas ${menuInfo.icon} text-indigo-500 mr-2"></i>
                            <span class="font-semibold">${menuInfo.name}</span>
                        </label>
                        <span class="text-xs text-gray-500" id="count-${menuCode.replace(':', '-')}">0 / 0</span>
                    </div>
                    <div class="p-3 hidden" id="group-${menuCode.replace(':', '-')}">
            `;
            
            // 添加该一级菜单下的所有模块
            menuInfo.modules.forEach(moduleName => {
                const modulePerms = groupedPerms[moduleName] || [];
                if (modulePerms.length === 0) return;
                
                const moduleInfo = permissionStructure[moduleName] || { name: moduleName, icon: 'fa-circle', color: 'gray' };
                
                html += `
                    <div class="mb-3 last:mb-0">
                        <div class="flex items-center mb-2 pb-1 border-b border-gray-200">
                            <label class="flex items-center cursor-pointer">
                                <input type="checkbox" class="module-select-all rounded border-gray-300 mr-2" 
                                       data-module="${moduleName}" data-menu="${menuCode}"
                                       onchange="toggleModulePermissions('${moduleName}', '${menuCode}', this.checked)">
                                <i class="fas ${moduleInfo.icon} text-${moduleInfo.color}-500 mr-2 text-sm"></i>
                                <span class="text-sm font-medium text-gray-700">${moduleInfo.name}</span>
                            </label>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pl-6">
                            ${modulePerms.map(p => `
                                <label class="flex items-center text-sm cursor-pointer hover:bg-white p-1 rounded">
                                    <input type="checkbox" name="perms" value="${p.permission_id}" 
                                           ${selectedPerms.includes(String(p.permission_id)) ? 'checked' : ''} 
                                           class="rounded border-gray-300 mr-2 detail-perm" 
                                           data-module="${moduleName}" data-menu="${menuCode}"
                                           onchange="updatePermissionCounts('${menuCode}')">
                                    <span class="text-gray-600">${escapeHtml(p.permission_name)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        });
        
        container.innerHTML = html || '<div class="text-center text-gray-500 py-4">暂无权限数据</div>';
        
        // 更新所有计数
        Object.keys(menuMapping).forEach(menuCode => {
            updatePermissionCounts(menuCode);
            updateModuleCheckboxes(menuCode);
        });
        
    } catch (error) { 
        document.getElementById('permissionCheckboxes').innerHTML = '<div class="text-red-500 text-center py-4">加载失败: ' + error.message + '</div>'; 
    }
}

// 展开/收起权限组
function togglePermissionGroup(menuCode) {
    const groupId = 'group-' + menuCode.replace(':', '-');
    const iconId = 'icon-' + menuCode.replace(':', '-');
    const group = document.getElementById(groupId);
    const icon = document.getElementById(iconId);
    if (group.classList.contains('hidden')) {
        group.classList.remove('hidden');
        icon.style.transform = 'rotate(0deg)';
    } else {
        group.classList.add('hidden');
        icon.style.transform = 'rotate(-90deg)';
    }
}

// 切换一级菜单权限时，联动子权限
function toggleMenuPermission(menuCode, checked) {
    const detailPerms = document.querySelectorAll(`input.detail-perm[data-menu="${menuCode}"]`);
    const moduleCheckboxes = document.querySelectorAll(`input.module-select-all[data-menu="${menuCode}"]`);
    
    detailPerms.forEach(cb => cb.checked = checked);
    moduleCheckboxes.forEach(cb => cb.checked = checked);
    updatePermissionCounts(menuCode);
}

// 切换模块全选
function toggleModulePermissions(moduleName, menuCode, checked) {
    const modulePerms = document.querySelectorAll(`input.detail-perm[data-module="${moduleName}"]`);
    modulePerms.forEach(cb => cb.checked = checked);
    updatePermissionCounts(menuCode);
    
    // 如果勾选了模块下的任意权限，自动勾选一级菜单
    if (checked) {
        const menuPerm = document.querySelector(`input.menu-perm[data-menu="${menuCode}"]`);
        if (menuPerm) menuPerm.checked = true;
    }
}

// 更新权限计数
function updatePermissionCounts(menuCode) {
    const countId = 'count-' + menuCode.replace(':', '-');
    const countEl = document.getElementById(countId);
    if (!countEl) return;
    
    const total = document.querySelectorAll(`input.detail-perm[data-menu="${menuCode}"]`).length;
    const checked = document.querySelectorAll(`input.detail-perm[data-menu="${menuCode}"]:checked`).length;
    countEl.textContent = `${checked} / ${total}`;
    
    // 更新模块全选状态
    updateModuleCheckboxes(menuCode);
}

// 更新模块全选checkbox状态
function updateModuleCheckboxes(menuCode) {
    const modules = menuMapping[menuCode]?.modules || [];
    modules.forEach(moduleName => {
        const moduleCheckbox = document.querySelector(`input.module-select-all[data-module="${moduleName}"]`);
        if (!moduleCheckbox) return;
        
        const modulePerms = document.querySelectorAll(`input.detail-perm[data-module="${moduleName}"]`);
        const checkedPerms = document.querySelectorAll(`input.detail-perm[data-module="${moduleName}"]:checked`);
        
        moduleCheckbox.checked = modulePerms.length > 0 && modulePerms.length === checkedPerms.length;
        moduleCheckbox.indeterminate = checkedPerms.length > 0 && checkedPerms.length < modulePerms.length;
    });
}

// 全选/清空权限
function selectAllPermissions(select) {
    document.querySelectorAll('input[name="perms"]').forEach(cb => cb.checked = select);
    document.querySelectorAll('input.module-select-all').forEach(cb => cb.checked = select);
    Object.keys(menuMapping).forEach(menuCode => updatePermissionCounts(menuCode));
}

async function submitRole(roleId = null) {
    const selectedPerms = Array.from(document.querySelectorAll('input[name="perms"]:checked')).map(cb => cb.value);
    const data = { 
        role_name: document.getElementById('roleName').value.trim(), 
        description: document.getElementById('roleDesc').value.trim() || null, 
        permissions: selectedPerms.join(',') 
    };
    if (!data.role_name) { alert('请输入角色名称'); return; }
    if (selectedPerms.length === 0) { alert('请至少选择一个权限'); return; }
    
    try {
        const url = roleId ? `/admin/roles/${roleId}` : '/admin/roles';
        const res = await apiRequest(url, { method: roleId ? 'PUT' : 'POST', body: JSON.stringify(data) });
        if (res.success) { closeModal(); alert(roleId ? '角色更新成功' : '角色创建成功'); loadPage('system-roles'); }
        else { alert(res.message || '操作失败'); }
    } catch (error) { alert('操作失败: ' + error.message); }
}

async function editRole(roleId) {
    try {
        const res = await apiRequest(`/admin/roles/${roleId}`);
        if (!res.success) { alert('获取角色信息失败'); return; }
        const r = res.data;
        showAddRole();
        setTimeout(async () => {
            document.getElementById('roleName').value = r.role_name || '';
            document.getElementById('roleDesc').value = r.description || '';
            const perms = r.permissions ? r.permissions.split(',').map(p => p.trim()) : [];
            await loadPermissionsForRole(perms);
            document.querySelector('#roleForm').previousElementSibling.innerHTML = '<i class="fas fa-user-shield text-indigo-500 mr-2"></i>编辑角色 - ' + escapeHtml(r.role_name);
            document.getElementById('roleForm').onsubmit = async (e) => { e.preventDefault(); await submitRole(roleId); };
        }, 100);
    } catch (error) { alert('获取详情失败: ' + error.message); }
}

async function deleteRole(roleId, roleName) {
    if (!confirm(`确定删除角色 "${roleName}" 吗？`)) return;
    try {
        const res = await apiRequest(`/admin/roles/${roleId}`, { method: 'DELETE' });
        if (res.success) { alert('删除成功'); loadPage('system-roles'); }
        else { alert(res.message || '删除失败'); }
    } catch (error) { alert('删除失败: ' + error.message); }
}

// 角色权限管理 - 增强版渲染
async function renderRolesEnhanced() {
    const content = document.getElementById('pageContent');
    try {
        const [rolesData, permsData] = await Promise.all([
            apiRequest('/admin/roles'),
            apiRequest('/admin/permissions')
        ]);
        const roles = rolesData.data || [];
        const permissions = permsData.data || [];
        
        // 统计一级菜单和细分权限数量
        const menuCount = permissions.filter(p => p.module === 'menu').length;
        const detailCount = permissions.filter(p => p.module !== 'menu').length;
        
        content.innerHTML = `
            <div class="space-y-6">
                <div class="card">
                    <div class="card-header flex items-center justify-between">
                        <h3 class="text-lg font-semibold"><i class="fas fa-user-shield mr-2 text-indigo-500"></i>角色管理</h3>
                        <button onclick="showAddRole()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增角色</button>
                    </div>
                    <div class="p-4">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>角色名称</th>
                                    <th>描述</th>
                                    <th>权限数</th>
                                    <th>用户数</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${roles.length === 0 ? '<tr><td colspan="6" class="text-center text-gray-500 py-4">暂无角色</td></tr>' : 
                                roles.map(r => {
                                    const permCount = r.permissions ? r.permissions.split(',').length : 0;
                                    return `
                                    <tr>
                                        <td class="text-gray-500">${r.role_id}</td>
                                        <td class="font-semibold">${escapeHtml(r.role_name || '')}</td>
                                        <td class="text-sm text-gray-600">${escapeHtml(r.description || '-')}</td>
                                        <td><span class="badge badge-success">${permCount}</span></td>
                                        <td><span class="badge badge-info">${r.user_count || 0}</span></td>
                                        <td class="space-x-1">
                                            <button onclick="editRole(${r.role_id})" class="text-blue-500 hover:text-blue-700" title="编辑权限"><i class="fas fa-edit"></i></button>
                                            <button onclick="viewRolePermissions(${r.role_id}, '${escapeAttr(r.role_name)}')" class="text-green-500 hover:text-green-700" title="查看权限"><i class="fas fa-key"></i></button>
                                            ${r.role_id > 3 ? `<button onclick="deleteRole(${r.role_id}, '${escapeAttr(r.role_name)}')" class="text-red-500 hover:text-red-700" title="删除"><i class="fas fa-trash"></i></button>` : ''}
                                        </td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="text-lg font-semibold">
                            <i class="fas fa-key mr-2 text-yellow-500"></i>权限总览 
                            <span class="text-sm font-normal text-gray-500 ml-2">
                                (${menuCount} 个一级菜单 / ${detailCount} 个细分权限)
                            </span>
                        </h3>
                    </div>
                    <div class="p-4">
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            ${Object.entries(menuMapping).map(([menuCode, menuInfo]) => {
                                const modulePerms = menuInfo.modules.flatMap(m => permissions.filter(p => p.module === m));
                                return `
                                    <div class="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition">
                                        <div class="flex items-center mb-2">
                                            <i class="fas ${menuInfo.icon} text-indigo-500 mr-2"></i>
                                            <span class="font-medium text-sm">${menuInfo.name}</span>
                                        </div>
                                        <div class="text-xs text-gray-500">
                                            ${menuInfo.modules.map(m => {
                                                const count = permissions.filter(p => p.module === m).length;
                                                const info = permissionStructure[m] || { name: m };
                                                return `<div class="flex justify-between"><span>${info.name}</span><span class="text-indigo-600">${count}</span></div>`;
                                            }).join('')}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

// 查看角色权限详情
async function viewRolePermissions(roleId, roleName) {
    try {
        const [roleRes, permsRes] = await Promise.all([
            apiRequest(`/admin/roles/${roleId}`),
            apiRequest('/admin/permissions')
        ]);
        
        if (!roleRes.success) { alert('获取角色信息失败'); return; }
        
        const role = roleRes.data;
        const allPerms = permsRes.data || [];
        const rolePermIds = role.permissions ? role.permissions.split(',').map(p => p.trim()) : [];
        const rolePerms = allPerms.filter(p => rolePermIds.includes(String(p.permission_id)));
        
        // 按一级菜单分组显示
        let html = `<h3 class="text-lg font-bold mb-4"><i class="fas fa-key text-yellow-500 mr-2"></i>${escapeHtml(roleName)} - 权限详情</h3>`;
        html += `<div class="max-h-[500px] overflow-y-auto space-y-3">`;
        
        Object.entries(menuMapping).forEach(([menuCode, menuInfo]) => {
            const menuPerm = rolePerms.find(p => p.permission_code === menuCode);
            if (!menuPerm) return;
            
            const modulePerms = menuInfo.modules.flatMap(m => rolePerms.filter(p => p.module === m));
            
            html += `
                <div class="border rounded-lg overflow-hidden">
                    <div class="bg-indigo-50 px-3 py-2 flex items-center">
                        <i class="fas ${menuInfo.icon} text-indigo-500 mr-2"></i>
                        <span class="font-semibold">${menuInfo.name}</span>
                        <span class="ml-auto badge badge-info">${modulePerms.length} 权限</span>
                    </div>
                    <div class="p-3">
                        ${menuInfo.modules.map(moduleName => {
                            const modPerms = rolePerms.filter(p => p.module === moduleName);
                            if (modPerms.length === 0) return '';
                            const modInfo = permissionStructure[moduleName] || { name: moduleName };
                            return `
                                <div class="mb-2 last:mb-0">
                                    <div class="text-sm font-medium text-gray-600 mb-1">${modInfo.name}</div>
                                    <div class="flex flex-wrap gap-1">
                                        ${modPerms.map(p => `<span class="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">${escapeHtml(p.permission_name)}</span>`).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        html += `<div class="flex justify-end mt-4 pt-4 border-t"><button onclick="closeModal()" class="btn btn-secondary">关闭</button></div>`;
        
        showModal(html, 'max-w-2xl');
    } catch (error) {
        alert('加载失败: ' + error.message);
    }
}

// ==================== IP白名单管理 ====================

async function renderIPWhitelist() {
    const content = document.getElementById('pageContent');
    try {
        const res = await apiRequest('/admin/ip-whitelist');
        const list = res.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <h3 class="text-lg font-semibold"><i class="fas fa-shield-alt mr-2 text-blue-500"></i>IP白名单管理 <span class="badge badge-primary">${list.length}</span></h3>
                    <div class="flex gap-2">
                        <button onclick="showAddIPWhitelist()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>添加IP</button>
                        <button onclick="renderIPWhitelist()" class="btn btn-secondary text-sm"><i class="fas fa-sync-alt mr-1"></i>刷新</button>
                    </div>
                </div>
                <div class="p-4">
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <div class="flex items-center">
                            <i class="fas fa-info-circle text-yellow-500 mr-2"></i>
                            <span class="text-yellow-700 text-sm">提示: IP白名单用于限制系统访问来源，只有在白名单中的IP才能访问后台。<code class="bg-yellow-100 px-1 rounded">0.0.0.0</code> 表示允许所有IP。</span>
                        </div>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" id="selectAllIP" onchange="toggleSelectAllIP()"></th>
                                <th>IP地址</th>
                                <th>类型</th>
                                <th>描述</th>
                                <th>添加人</th>
                                <th>添加时间</th>
                                <th>过期时间</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.length === 0 ? '<tr><td colspan="9" class="text-center text-gray-500 py-4">暂无IP白名单记录</td></tr>' : 
                            list.map(ip => `
                                <tr>
                                    <td><input type="checkbox" class="ip-checkbox" value="${ip.id}"></td>
                                    <td class="font-mono font-medium">${escapeHtml(ip.ip_address)}</td>
                                    <td><span class="badge ${ip.ip_type === 'single' ? 'badge-info' : ip.ip_type === 'range' ? 'badge-warning' : 'badge-success'}">${ip.ip_type === 'single' ? '单个IP' : ip.ip_type === 'range' ? 'IP范围' : 'CIDR'}</span></td>
                                    <td class="text-sm text-gray-600">${escapeHtml(ip.description || '-')}</td>
                                    <td class="text-sm">${escapeHtml(ip.admin_username || 'system')}</td>
                                    <td class="text-sm text-gray-500">${formatDate(ip.created_at)}</td>
                                    <td class="text-sm ${ip.expires_at && new Date(ip.expires_at) < new Date() ? 'text-red-500' : 'text-gray-500'}">${ip.expires_at ? formatDate(ip.expires_at) : '永久'}</td>
                                    <td>
                                        <button onclick="toggleIPStatus(${ip.id}, ${ip.status === 1 ? 0 : 1})" class="cursor-pointer">
                                            ${ip.status === 1 ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-danger">禁用</span>'}
                                        </button>
                                    </td>
                                    <td>
                                        <button onclick="editIPWhitelist(${ip.id})" class="text-blue-500 hover:text-blue-700 mr-2" title="编辑"><i class="fas fa-edit"></i></button>
                                        <button onclick="deleteIPWhitelist(${ip.id}, '${escapeAttr(ip.ip_address)}')" class="text-red-500 hover:text-red-700" title="删除"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${list.length > 0 ? `
                        <div class="mt-4 flex gap-2">
                            <button onclick="batchIPStatus(1)" class="btn btn-success text-sm"><i class="fas fa-check mr-1"></i>批量启用</button>
                            <button onclick="batchIPStatus(0)" class="btn btn-warning text-sm"><i class="fas fa-ban mr-1"></i>批量禁用</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

function showAddIPWhitelist() {
    openModal(`
        <div class="p-6" style="min-width: 450px;">
            <h3 class="text-lg font-bold mb-4"><i class="fas fa-plus-circle text-blue-500 mr-2"></i>添加IP白名单</h3>
            <form id="ipWhitelistForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">IP地址 <span class="text-red-500">*</span></label>
                    <input type="text" id="ipAddress" class="form-input w-full" placeholder="如: 192.168.1.100 或 192.168.1.0/24" required>
                    <p class="text-xs text-gray-500 mt-1">支持单个IP、CIDR格式(如192.168.1.0/24)或IP范围(如192.168.1.1-192.168.1.255)</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">IP类型</label>
                    <select id="ipType" class="form-input w-full">
                        <option value="single">单个IP</option>
                        <option value="cidr">CIDR网段</option>
                        <option value="range">IP范围</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <input type="text" id="ipDescription" class="form-input w-full" placeholder="如: 办公室网络、VPN出口等">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">过期时间 <span class="text-gray-400">(可选)</span></label>
                    <input type="datetime-local" id="ipExpires" class="form-input w-full">
                    <p class="text-xs text-gray-500 mt-1">留空表示永久有效</p>
                </div>
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>保存</button>
                </div>
            </form>
        </div>
    `);
    document.getElementById('ipWhitelistForm').onsubmit = async (e) => { e.preventDefault(); await submitIPWhitelist(); };
}

async function submitIPWhitelist(id = null) {
    const data = {
        ip_address: document.getElementById('ipAddress').value.trim(),
        ip_type: document.getElementById('ipType').value,
        description: document.getElementById('ipDescription').value.trim() || null,
        expires_at: document.getElementById('ipExpires').value || null
    };
    if (!data.ip_address) { alert('请输入IP地址'); return; }
    
    try {
        const url = id ? `/admin/ip-whitelist/${id}` : '/admin/ip-whitelist';
        const method = id ? 'PUT' : 'POST';
        const res = await apiRequest(url, { method, body: JSON.stringify(data) });
        if (res.success) { 
            closeModal(); 
            alert(id ? 'IP白名单更新成功' : 'IP已添加到白名单'); 
            loadPage('system-ip-whitelist'); 
        } else { 
            alert(res.message || '操作失败'); 
        }
    } catch (error) { 
        alert('操作失败: ' + error.message); 
    }
}

async function editIPWhitelist(id) {
    try {
        const res = await apiRequest(`/admin/ip-whitelist/${id}`);
        if (!res.success) { alert('获取详情失败'); return; }
        const ip = res.data;
        showAddIPWhitelist();
        setTimeout(() => {
            document.getElementById('ipAddress').value = ip.ip_address || '';
            document.getElementById('ipType').value = ip.ip_type || 'single';
            document.getElementById('ipDescription').value = ip.description || '';
            document.getElementById('ipExpires').value = ip.expires_at ? ip.expires_at.slice(0, 16) : '';
            document.querySelector('#ipWhitelistForm').previousElementSibling.innerHTML = '<i class="fas fa-edit text-blue-500 mr-2"></i>编辑IP白名单';
            document.getElementById('ipWhitelistForm').onsubmit = async (e) => { e.preventDefault(); await submitIPWhitelist(id); };
        }, 100);
    } catch (error) { alert('获取详情失败: ' + error.message); }
}

async function deleteIPWhitelist(id, ipAddress) {
    if (!confirm(`确定要从白名单中移除IP "${ipAddress}" 吗？`)) return;
    try {
        const res = await apiRequest(`/admin/ip-whitelist/${id}`, { method: 'DELETE' });
        if (res.success) { alert('IP已从白名单移除'); loadPage('system-ip-whitelist'); }
        else { alert(res.message || '删除失败'); }
    } catch (error) { alert('删除失败: ' + error.message); }
}

async function toggleIPStatus(id, status) {
    try {
        const res = await apiRequest(`/admin/ip-whitelist/${id}`, { 
            method: 'PUT', 
            body: JSON.stringify({ status }) 
        });
        if (res.success) { loadPage('system-ip-whitelist'); }
        else { alert(res.message || '操作失败'); }
    } catch (error) { alert('操作失败: ' + error.message); }
}

function toggleSelectAllIP() {
    const checked = document.getElementById('selectAllIP').checked;
    document.querySelectorAll('.ip-checkbox').forEach(cb => cb.checked = checked);
}

async function batchIPStatus(status) {
    const ids = Array.from(document.querySelectorAll('.ip-checkbox:checked')).map(cb => parseInt(cb.value));
    if (ids.length === 0) { alert('请选择要操作的IP'); return; }
    if (!confirm(`确定要${status === 1 ? '启用' : '禁用'}选中的 ${ids.length} 条IP吗？`)) return;
    
    try {
        const res = await apiRequest('/admin/ip-whitelist/batch-status', { 
            method: 'POST', 
            body: JSON.stringify({ ids, status }) 
        });
        if (res.success) { alert(res.message); loadPage('system-ip-whitelist'); }
        else { alert(res.message || '操作失败'); }
    } catch (error) { alert('操作失败: ' + error.message); }
}

// 2FA设置页面
async function render2FASettings() {
    const content = document.getElementById('pageContent');
    try {
        const res = await apiRequest('/admin/2fa/status');
        const enabled = res.data?.enabled || false;
        
        content.innerHTML = `
            <div class="max-w-3xl mx-auto">
                <div class="card">
                    <div class="card-header">
                        <h3 class="text-lg font-semibold"><i class="fas fa-shield-alt mr-2 text-green-500"></i>双因素认证 (2FA) 设置</h3>
                    </div>
                    <div class="p-6">
                        <div class="text-center mb-8">
                            <div class="w-28 h-28 mx-auto mb-4 rounded-full flex items-center justify-center ${enabled ? 'bg-green-100' : 'bg-gray-100'} shadow-lg">
                                <i class="fas ${enabled ? 'fa-lock text-green-500' : 'fa-unlock text-gray-400'} text-5xl"></i>
                            </div>
                            <h4 class="text-2xl font-bold ${enabled ? 'text-green-600' : 'text-gray-600'}">${enabled ? '✅ 2FA 已启用' : '⚠️ 2FA 未启用'}</h4>
                            <p class="text-gray-500 mt-2">双因素认证为您的账户添加额外的安全保护层</p>
                        </div>
                        
                        ${enabled ? `
                            <div class="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
                                <div class="flex items-start">
                                    <i class="fas fa-check-circle text-green-500 mr-4 text-2xl mt-1"></i>
                                    <div>
                                        <h5 class="font-bold text-green-800 text-lg">您的账户受到双重保护</h5>
                                        <p class="text-green-600 mt-1">每次登录系统时，除了密码外，还需要输入动态验证码</p>
                                        <ul class="text-green-700 text-sm mt-3 space-y-1">
                                            <li><i class="fas fa-check mr-2"></i>防止密码泄露导致的账户被盗</li>
                                            <li><i class="fas fa-check mr-2"></i>符合企业安全合规要求</li>
                                            <li><i class="fas fa-check mr-2"></i>30秒动态验证码，更安全</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-4">
                                <button onclick="loadPage('system-2fa')" class="btn btn-secondary flex-1"><i class="fas fa-sync-alt mr-2"></i>刷新状态</button>
                                <button onclick="disable2FA()" class="btn btn-danger flex-1"><i class="fas fa-times mr-2"></i>禁用2FA</button>
                            </div>
                        ` : `
                            <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6">
                                <div class="flex items-start">
                                    <i class="fas fa-exclamation-triangle text-yellow-500 mr-4 text-2xl mt-1"></i>
                                    <div>
                                        <h5 class="font-bold text-yellow-800 text-lg">强烈建议启用2FA</h5>
                                        <p class="text-yellow-700 mt-1">开启双因素认证，大幅提升账户安全性</p>
                                        <ul class="text-yellow-700 text-sm mt-3 space-y-1">
                                            <li><i class="fas fa-info-circle mr-2"></i>需要安装 Google Authenticator 或类似应用</li>
                                            <li><i class="fas fa-info-circle mr-2"></i>扫描二维码即可完成绑定</li>
                                            <li><i class="fas fa-info-circle mr-2"></i>绑定后每次登录需输入6位动态码</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <button onclick="show2FASetup()" class="btn btn-primary w-full py-3 text-lg"><i class="fas fa-shield-alt mr-2"></i>立即设置2FA</button>
                        `}
                    </div>
                </div>
                
                <!-- 2FA使用说明 -->
                <div class="card mt-6">
                    <div class="card-header">
                        <h3 class="text-lg font-semibold"><i class="fas fa-question-circle mr-2 text-blue-500"></i>什么是双因素认证？</h3>
                    </div>
                    <div class="p-6">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="text-center p-4 bg-blue-50 rounded-lg">
                                <div class="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                                    <i class="fas fa-mobile-alt text-blue-500 text-2xl"></i>
                                </div>
                                <h4 class="font-bold text-blue-800">第一步</h4>
                                <p class="text-blue-600 text-sm mt-2">下载 Google Authenticator<br>或其他2FA验证器应用</p>
                            </div>
                            <div class="text-center p-4 bg-green-50 rounded-lg">
                                <div class="w-16 h-16 bg-green-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                                    <i class="fas fa-qrcode text-green-500 text-2xl"></i>
                                </div>
                                <h4 class="font-bold text-green-800">第二步</h4>
                                <p class="text-green-600 text-sm mt-2">使用应用扫描<br>系统生成的二维码</p>
                            </div>
                            <div class="text-center p-4 bg-purple-50 rounded-lg">
                                <div class="w-16 h-16 bg-purple-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                                    <i class="fas fa-key text-purple-500 text-2xl"></i>
                                </div>
                                <h4 class="font-bold text-purple-800">第三步</h4>
                                <p class="text-purple-600 text-sm mt-2">输入6位动态验证码<br>完成绑定</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="text-center text-red-500 py-10">加载失败: ' + escapeHtml(error.message) + '</div>';
    }
}

// 2FA 绑定功能
function show2FASetup() {
    openModal(`
        <div class="p-6" style="min-width: 400px;">
            <h3 class="text-lg font-bold mb-4"><i class="fas fa-shield-alt text-green-500 mr-2"></i>绑定双重认证 (2FA)</h3>
            <div id="twoFAContent" class="text-center"><div class="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto"></div><p class="mt-2 text-gray-500">正在生成二维码...</p></div>
        </div>
    `);
    generate2FASecret();
}

async function generate2FASecret() {
    try {
        const res = await apiRequest('/admin/2fa/generate', { method: 'POST' });
        if (!res.success) { document.getElementById('twoFAContent').innerHTML = '<div class="text-red-500">' + escapeHtml(res.message || '生成失败') + '</div>'; return; }
        const { secret, qr_url } = res.data;
        document.getElementById('twoFAContent').innerHTML = `
            <div class="space-y-4">
                <div class="bg-gray-100 p-4 rounded-lg"><p class="text-sm text-gray-600 mb-2">使用 Google Authenticator 或其他 2FA 应用扫描下方二维码：</p><img src="${qr_url}" alt="2FA QR Code" class="mx-auto w-48 h-48 border rounded"></div>
                <div class="text-sm"><p class="text-gray-600">或手动输入密钥：</p><code class="block bg-gray-100 p-2 rounded mt-1 text-xs font-mono break-all">${secret}</code></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">输入验证码确认绑定：</label><input type="text" id="verifyCode" class="form-input w-full text-center text-lg tracking-widest" maxlength="6" placeholder="000000" pattern="[0-9]{6}"></div>
                <div class="flex gap-3"><button onclick="closeModal()" class="btn btn-secondary flex-1">取消</button><button onclick="verify2FA('${secret}')" class="btn btn-success flex-1"><i class="fas fa-check mr-1"></i>确认绑定</button></div>
            </div>
        `;
    } catch (error) { document.getElementById('twoFAContent').innerHTML = '<div class="text-red-500">生成失败: ' + escapeHtml(error.message) + '</div>'; }
}

async function verify2FA(secret) {
    const code = document.getElementById('verifyCode').value.trim();
    if (!/^\d{6}$/.test(code)) { alert('请输入6位数字验证码'); return; }
    try {
        const res = await apiRequest('/admin/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
        if (res.success) { closeModal(); alert('🎉 2FA 绑定成功！\n下次登录将需要输入动态验证码。'); loadPage('system-2fa'); }
        else { alert(res.message || '验证失败，请检查验证码'); }
    } catch (error) { alert('验证失败: ' + error.message); }
}

async function disable2FA() {
    if (!confirm('⚠️ 确定要关闭双重认证吗？\n这将降低您账户的安全性。')) return;
    const password = prompt('请输入您的登录密码以确认操作：');
    if (!password) { alert('请输入密码'); return; }
    try {
        const res = await apiRequest('/admin/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) });
        if (res.success) { alert('2FA 已关闭'); loadPage('system-2fa'); }
        else { alert(res.message || '关闭失败，请检查密码是否正确'); }
    } catch (error) { alert('操作失败: ' + error.message); }
}

// 报表查询功能增强
async function searchSettlementReport() {
    const startDate = document.getElementById('settlementStartDate')?.value;
    const endDate = document.getElementById('settlementEndDate')?.value;
    if (!startDate || !endDate) { alert('请选择日期范围'); return; }
    try {
        const res = await apiRequest(`/reports/settlement?start_date=${startDate}&end_date=${endDate}`);
        renderSettlementTable(res.data || []);
    } catch (error) { alert('查询失败: ' + error.message); }
}

function renderSettlementTable(data) {
    const tbody = document.querySelector('#settlementTable tbody');
    if (!tbody) return;
    tbody.innerHTML = data.length === 0 ? '<tr><td colspan="7" class="text-center text-gray-500 py-4">暂无数据</td></tr>' :
        data.map(r => `<tr><td>${r.date}</td><td>${r.bet_count}</td><td>¥ ${formatNumber(r.total_bet)}</td><td>¥ ${formatNumber(r.valid_bet)}</td><td class="${r.total_win_loss >= 0 ? 'text-green-600' : 'text-red-600'}">${r.total_win_loss >= 0 ? '+' : ''}${formatNumber(r.total_win_loss)}</td><td class="${r.company_profit >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">${r.company_profit >= 0 ? '+' : ''}${formatNumber(r.company_profit)}</td><td>${r.valid_bet > 0 ? ((r.company_profit / r.valid_bet) * 100).toFixed(2) : 0}%</td></tr>`).join('');
}

async function searchGameReport() {
    const startDate = document.getElementById('gameStartDate')?.value;
    const endDate = document.getElementById('gameEndDate')?.value;
    if (!startDate || !endDate) { alert('请选择日期范围'); return; }
    try {
        const res = await apiRequest(`/reports/game?start_date=${startDate}&end_date=${endDate}`);
        renderGameTable(res.data || []);
    } catch (error) { alert('查询失败: ' + error.message); }
}

function renderGameTable(data) {
    const tbody = document.querySelector('#gameTable tbody');
    if (!tbody) return;
    tbody.innerHTML = data.length === 0 ? '<tr><td colspan="6" class="text-center text-gray-500 py-4">暂无数据</td></tr>' :
        data.map(r => `<tr><td><span class="badge badge-info">${escapeHtml(r.game_type || '')}</span></td><td>${r.bet_count || 0}</td><td>${formatMoney(r.total_bet)}</td><td>${formatMoney(r.valid_bet)}</td><td class="${parseFloat(r.total_win_loss) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(r.total_win_loss)}</td><td class="${parseFloat(r.company_profit) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(r.company_profit)}</td></tr>`).join('');
}

async function searchAgentPerformance() {
    const startDate = document.getElementById('agentStartDate')?.value;
    const endDate = document.getElementById('agentEndDate')?.value;
    const keyword = document.getElementById('agentKeyword')?.value || '';
    if (!startDate || !endDate) { alert('请选择日期范围'); return; }
    try {
        let url = `/reports/agent-performance?start_date=${startDate}&end_date=${endDate}`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
        const res = await apiRequest(url);
        renderAgentTable(res.data || []);
    } catch (error) { alert('查询失败: ' + error.message); }
}

function renderAgentTable(data) {
    const tbody = document.querySelector('#agentTable tbody');
    if (!tbody) return;
    tbody.innerHTML = data.length === 0 ? '<tr><td colspan="8" class="text-center text-gray-500 py-4">暂无数据</td></tr>' :
        data.map(a => `<tr><td class="font-mono">${escapeHtml(a.agent_username || '')}</td><td>${escapeHtml(a.nickname || '')}</td><td>${getLevelBadge(a.level)}</td><td>${a.player_count || 0}</td><td>${formatMoney(a.total_bet)}</td><td>${formatMoney(a.valid_bet)}</td><td class="${parseFloat(a.total_win_loss) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(a.total_win_loss)}</td><td class="${parseFloat(a.company_profit) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(a.company_profit)}</td></tr>`).join('');
}

// 删除荷官
async function deleteDealer(dealerId, name) {
    if (!confirm(`确定删除荷官 "${name}" 吗？`)) return;
    try {
        const res = await apiRequest(`/dealers/${dealerId}`, { method: 'DELETE' });
        if (res.success) { alert('删除成功'); loadPage('studio-dealers'); }
        else { alert(res.message || '删除失败'); }
    } catch (error) { alert('删除失败: ' + error.message); }
}

// 删除桌台
async function deleteTable(tableId, code) {
    if (!confirm(`确定删除桌台 "${code}" 吗？`)) return;
    try {
        const res = await apiRequest(`/tables/${tableId}`, { method: 'DELETE' });
        if (res.success) { alert('删除成功'); loadPage('studio-tables'); }
        else { alert(res.message || '删除失败'); }
    } catch (error) { alert('删除失败: ' + error.message); }
}
