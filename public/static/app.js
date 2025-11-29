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
            { id: 'finance-payment-methods', title: '收款方式', page: 'finance-payment-methods', badge: 'NEW' }
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
            { id: 'reports-settlement', title: '结算报表', page: 'reports-settlement' },
            { id: 'reports-ranking', title: '盈亏排行', page: 'reports-ranking' },
            { id: 'reports-game', title: '游戏报表', page: 'reports-game' },
            { id: 'reports-daily', title: '盈亏日报', page: 'reports-daily' },
            { id: 'reports-agent', title: '代理业绩', page: 'reports-agent' }
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
        'bets': { title: '注单列表', handler: renderBets },
        'bets-realtime': { title: '实时注单', handler: renderRealtimeBets },
        'bets-special': { title: '特殊注单', handler: renderSpecialBets },
        'commission-schemes': { title: '洗码方案', handler: renderCommissionSchemes },
        'commission-records': { title: '洗码记录', handler: renderCommissionRecords },
        'risk-alerts': { title: '风控预警', handler: renderRiskAlerts },
        'risk-rules': { title: '风控规则', handler: renderRiskRules },
        'risk-limit-groups': { title: '限红组', handler: renderLimitGroups },
        'reports-settlement': { title: '结算报表', handler: renderSettlementReport },
        'reports-ranking': { title: '盈亏排行', handler: renderRanking },
        'reports-game': { title: '游戏报表', handler: renderGameReport },
        'reports-daily': { title: '盈亏日报', handler: renderDailyReport },
        'reports-agent': { title: '代理业绩', handler: renderAgentPerformance },
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
    
    try {
        const [statsRes, trendsRes] = await Promise.all([
            apiRequest('/dashboard/stats'),
            apiRequest('/dashboard/trends')
        ]);
        
        const stats = statsRes.data;
        const trends = trendsRes.data;
        
        content.innerHTML = `
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

function renderPlayerStats() {
    const content = document.getElementById('pageContent');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">玩家统计分析</div>
            <div class="card-body">
                <div class="text-center text-gray-500 py-10">
                    <i class="fas fa-chart-line text-4xl mb-4"></i>
                    <p>玩家LTV分析功能开发中...</p>
                </div>
            </div>
        </div>
    `;
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
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <span>取款申请 <span class="badge badge-danger">${list.length} 待审核</span></span>
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
                                        <th>流水检测</th>
                                        <th>状态</th>
                                        <th>申请时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${list.map(w => `
                                        <tr>
                                            <td class="font-mono text-sm">${w.order_no}</td>
                                            <td>${w.username}</td>
                                            <td class="text-red-600 font-medium">${formatNumber(w.amount)}</td>
                                            <td>${w.flow_check ? '<span class="badge badge-success">已达标</span>' : '<span class="badge badge-danger">未达标</span>'}</td>
                                            <td>${getAuditStatusBadge(w.audit_status)}</td>
                                            <td>${formatDate(w.created_at)}</td>
                                            <td>
                                                <button onclick="auditTransaction(${w.transaction_id}, 'approve')" class="btn btn-success text-xs mr-1">通过</button>
                                                <button onclick="auditTransaction(${w.transaction_id}, 'reject')" class="btn btn-danger text-xs">拒绝</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<div class="text-center text-gray-500 py-10">暂无待审核提款</div>'}
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
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

// ==================== 报表中心 ====================
async function renderSettlementReport() {
    const content = document.getElementById('pageContent');
    
    try {
        const res = await apiRequest('/reports/settlement');
        const list = res.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>结算报表</span>
                    <div class="flex space-x-2">
                        <input type="date" class="px-3 py-2 border rounded-lg text-sm">
                        <input type="date" class="px-3 py-2 border rounded-lg text-sm">
                        <button class="btn btn-primary text-sm">查询</button>
                        <button class="btn btn-success text-sm"><i class="fas fa-file-excel mr-1"></i>导出</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>日期</th>
                                    <th>注单数</th>
                                    <th>总投注</th>
                                    <th>有效投注</th>
                                    <th>玩家盈亏</th>
                                    <th>公司盈亏</th>
                                    <th>杀数(%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(r => `
                                    <tr>
                                        <td>${r.date}</td>
                                        <td>${r.bet_count}</td>
                                        <td>¥ ${formatNumber(r.total_bet)}</td>
                                        <td>¥ ${formatNumber(r.valid_bet)}</td>
                                        <td class="${r.total_win_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                                            ${r.total_win_loss >= 0 ? '+' : ''}${formatNumber(r.total_win_loss)}
                                        </td>
                                        <td class="${r.company_profit >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">
                                            ${r.company_profit >= 0 ? '+' : ''}${formatNumber(r.company_profit)}
                                        </td>
                                        <td>${r.valid_bet > 0 ? ((r.company_profit / r.valid_bet) * 100).toFixed(2) : 0}%</td>
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

async function renderRanking() {
    const content = document.getElementById('pageContent');
    
    try {
        const [profitRes, lossRes] = await Promise.all([
            apiRequest('/reports/ranking?type=loss&limit=20'),
            apiRequest('/reports/ranking?type=profit&limit=20')
        ]);
        
        content.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- 盈利榜 -->
                <div class="card">
                    <div class="card-header bg-green-50 text-green-700">
                        <i class="fas fa-trophy mr-2"></i>盈利排行榜 TOP 20
                    </div>
                    <div class="card-body">
                        <div class="space-y-2">
                            ${profitRes.data.map((p, i) => `
                                <div class="flex items-center justify-between p-2 ${i < 3 ? 'bg-green-50' : ''} rounded">
                                    <div class="flex items-center">
                                        <span class="w-6 h-6 ${i < 3 ? 'bg-green-500 text-white' : 'bg-gray-200'} rounded-full flex items-center justify-center text-sm font-bold mr-3">
                                            ${i + 1}
                                        </span>
                                        <div>
                                            <div class="font-medium">${p.username}</div>
                                            <div class="text-xs text-gray-500">VIP${p.vip_level} | ${p.agent_username || '-'}</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-green-600 font-bold">+${formatNumber(Math.abs(p.total_win_loss))}</div>
                                        <div class="text-xs text-gray-500">投注: ${formatNumber(p.total_bet)}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <!-- 亏损榜 -->
                <div class="card">
                    <div class="card-header bg-red-50 text-red-700">
                        <i class="fas fa-chart-line mr-2"></i>亏损排行榜 TOP 20
                    </div>
                    <div class="card-body">
                        <div class="space-y-2">
                            ${lossRes.data.map((p, i) => `
                                <div class="flex items-center justify-between p-2 ${i < 3 ? 'bg-red-50' : ''} rounded">
                                    <div class="flex items-center">
                                        <span class="w-6 h-6 ${i < 3 ? 'bg-red-500 text-white' : 'bg-gray-200'} rounded-full flex items-center justify-center text-sm font-bold mr-3">
                                            ${i + 1}
                                        </span>
                                        <div>
                                            <div class="font-medium">${p.username}</div>
                                            <div class="text-xs text-gray-500">VIP${p.vip_level} | ${p.agent_username || '-'}</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-red-600 font-bold">${formatNumber(p.total_win_loss)}</div>
                                        <div class="text-xs text-gray-500">投注: ${formatNumber(p.total_bet)}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
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
        const res = await apiRequest(`/shifts?date=${today}`);
        const list = res.data || [];
        
        // 按桌台分组
        const tableShifts = {};
        list.forEach(shift => {
            if (!tableShifts[shift.table_code]) {
                tableShifts[shift.table_code] = {
                    table_name: shift.table_name,
                    shifts: []
                };
            }
            tableShifts[shift.table_code].shifts.push(shift);
        });
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>智能排班 - ${today}</span>
                    <div class="flex space-x-2">
                        <input type="date" value="${today}" class="px-3 py-2 border rounded-lg text-sm">
                        <button class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增排班</button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- 甘特图时间轴 -->
                    <div class="overflow-x-auto">
                        <div class="min-w-[1200px]">
                            <!-- 时间刻度 -->
                            <div class="flex border-b pb-2 mb-4">
                                <div class="w-32 flex-shrink-0 font-medium">桌台</div>
                                <div class="flex-1 flex">
                                    ${Array.from({length: 24}, (_, i) => `
                                        <div class="flex-1 text-center text-sm text-gray-500">${String(i).padStart(2, '0')}:00</div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <!-- 排班行 -->
                            ${Object.entries(tableShifts).map(([code, data]) => `
                                <div class="flex items-center mb-3">
                                    <div class="w-32 flex-shrink-0">
                                        <div class="font-medium">${code}</div>
                                        <div class="text-xs text-gray-500">${data.table_name}</div>
                                    </div>
                                    <div class="flex-1 relative h-10 bg-gray-100 rounded">
                                        ${data.shifts.map(shift => {
                                            const startHour = parseInt(shift.start_time.split(':')[0]);
                                            const endHour = parseInt(shift.end_time.split(':')[0]) || 24;
                                            const left = (startHour / 24) * 100;
                                            const width = ((endHour - startHour) / 24) * 100;
                                            return `
                                                <div class="absolute top-1 h-8 bg-blue-500 text-white text-xs rounded px-2 flex items-center overflow-hidden"
                                                     style="left: ${left}%; width: ${width}%;">
                                                    ${shift.stage_name_cn}
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `).join('')}
                            
                            ${Object.keys(tableShifts).length === 0 ? '<div class="text-center text-gray-500 py-10">暂无排班数据</div>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
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
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
});

// ==================== 新增页面渲染函数 ====================

// 流水稽核规则
async function renderTurnoverRules() {
    const content = document.getElementById('pageContent');
    try {
        const data = await apiRequest('/finance/turnover-rules');
        const rules = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="text-lg font-semibold"><i class="fas fa-clipboard-check mr-2"></i>流水稽核规则</h3>
                </div>
                <div class="p-4">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>规则名称</th>
                                <th>倍数</th>
                                <th>适用游戏</th>
                                <th>有效天数</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rules.map(r => `
                                <tr>
                                    <td>${escapeHtml(r.rule_name)}</td>
                                    <td class="font-semibold">${r.multiplier}x</td>
                                    <td class="text-sm">${escapeHtml(r.games_included || '全部')}</td>
                                    <td>${r.valid_days}天</td>
                                    <td>${r.status === 1 ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-danger">禁用</span>'}</td>
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

// 风控规则
async function renderRiskRules() {
    const content = document.getElementById('pageContent');
    try {
        const data = await apiRequest('/risk/rules');
        const rules = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="text-lg font-semibold"><i class="fas fa-gavel mr-2"></i>风控规则</h3>
                </div>
                <div class="p-4">
                    <table class="data-table">
                        <thead>
                            <tr><th>ID</th><th>规则名称</th><th>类型</th><th>触发条件</th><th>处理动作</th><th>预警次数</th><th>状态</th></tr>
                        </thead>
                        <tbody>
                            ${rules.length === 0 ? '<tr><td colspan="7" class="text-center text-gray-500 py-4">暂无风控规则</td></tr>' : 
                            rules.map(r => `
                                <tr>
                                    <td>${r.rule_id}</td>
                                    <td class="font-medium">${escapeHtml(r.rule_name || '')}</td>
                                    <td><span class="badge badge-info">${escapeHtml(r.rule_type || '')}</span></td>
                                    <td class="text-sm">${escapeHtml(r.rule_condition || '')}</td>
                                    <td><span class="badge badge-warning">${escapeHtml(r.rule_action || '')}</span></td>
                                    <td>${r.alert_count || 0}</td>
                                    <td>${r.status === 1 ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-danger">禁用</span>'}</td>
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

// 限红组
async function renderLimitGroups() {
    const content = document.getElementById('pageContent');
    try {
        const data = await apiRequest('/risk/limit-groups');
        const groups = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="text-lg font-semibold"><i class="fas fa-hand-holding-usd mr-2"></i>限红组管理</h3>
                </div>
                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        ${groups.map(g => `
                            <div class="bg-gray-50 rounded-lg p-4">
                                <div class="flex items-center justify-between mb-3">
                                    <h4 class="font-semibold">${escapeHtml(g.group_name)}</h4>
                                    <span class="badge badge-info">${g.user_count || 0}人</span>
                                </div>
                                <p class="text-gray-500 text-sm mb-3">${escapeHtml(g.description) || '无描述'}</p>
                                <div class="space-y-2 text-sm">
                                    <div class="flex justify-between"><span>百家乐</span><span>¥${formatNumber(g.baccarat_min)}-${formatNumber(g.baccarat_max)}</span></div>
                                    <div class="flex justify-between"><span>龙虎</span><span>¥${formatNumber(g.dragon_tiger_min)}-${formatNumber(g.dragon_tiger_max)}</span></div>
                                    <div class="flex justify-between"><span>轮盘</span><span>¥${formatNumber(g.roulette_min)}-${formatNumber(g.roulette_max)}</span></div>
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

// 游戏报表
async function renderGameReport() {
    const content = document.getElementById('pageContent');
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 8) + '01';
    
    try {
        const data = await apiRequest(`/reports/game?start_date=${monthStart}&end_date=${today}`);
        const list = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="text-lg font-semibold"><i class="fas fa-gamepad mr-2"></i>游戏报表</h3></div>
                <div class="p-4">
                    <table class="data-table">
                        <thead><tr><th>游戏类型</th><th>注单数</th><th>总投注</th><th>有效投注</th><th>玩家输赢</th><th>公司利润</th></tr></thead>
                        <tbody>
                            ${list.length === 0 ? '<tr><td colspan="6" class="text-center text-gray-500 py-4">暂无数据</td></tr>' : 
                            list.map(r => `
                                <tr>
                                    <td><span class="badge badge-info">${escapeHtml(r.game_type || '')}</span></td>
                                    <td>${r.bet_count || 0}</td>
                                    <td>${formatMoney(r.total_bet)}</td>
                                    <td>${formatMoney(r.valid_bet)}</td>
                                    <td class="${parseFloat(r.total_win_loss) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(r.total_win_loss)}</td>
                                    <td class="${parseFloat(r.company_profit) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(r.company_profit)}</td>
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

// 盈亏日报
async function renderDailyReport() {
    const content = document.getElementById('pageContent');
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 8) + '01';
    
    try {
        const data = await apiRequest(`/reports/daily?start_date=${monthStart}&end_date=${today}`);
        const list = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="text-lg font-semibold"><i class="fas fa-calendar-day mr-2"></i>盈亏日报</h3></div>
                <div class="p-4">
                    <table class="data-table">
                        <thead><tr><th>日期</th><th>注单数</th><th>总投注</th><th>有效投注</th><th>玩家输赢</th><th>公司利润</th></tr></thead>
                        <tbody>
                            ${list.length === 0 ? '<tr><td colspan="6" class="text-center text-gray-500 py-4">暂无数据</td></tr>' : 
                            list.map(r => `
                                <tr>
                                    <td>${r.report_date}</td>
                                    <td>${r.bet_count || 0}</td>
                                    <td>${formatMoney(r.total_bet)}</td>
                                    <td>${formatMoney(r.valid_bet)}</td>
                                    <td class="${parseFloat(r.player_win_loss) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(r.player_win_loss)}</td>
                                    <td class="${parseFloat(r.company_profit) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(r.company_profit)}</td>
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

// 代理业绩
async function renderAgentPerformance() {
    const content = document.getElementById('pageContent');
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 8) + '01';
    
    try {
        const data = await apiRequest(`/reports/agent-performance?start_date=${monthStart}&end_date=${today}`);
        const list = data.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="text-lg font-semibold"><i class="fas fa-user-tie mr-2"></i>代理业绩报表</h3></div>
                <div class="p-4">
                    <table class="data-table">
                        <thead><tr><th>代理账号</th><th>昵称</th><th>层级</th><th>玩家数</th><th>投注额</th><th>有效投注</th><th>输赢</th><th>公司利润</th></tr></thead>
                        <tbody>
                            ${list.length === 0 ? '<tr><td colspan="8" class="text-center text-gray-500 py-4">暂无数据</td></tr>' : 
                            list.map(a => `
                                <tr>
                                    <td class="font-mono">${escapeHtml(a.agent_username || '')}</td>
                                    <td>${escapeHtml(a.nickname || '')}</td>
                                    <td>${getLevelBadge(a.level)}</td>
                                    <td>${a.player_count || 0}</td>
                                    <td>${formatMoney(a.total_bet)}</td>
                                    <td>${formatMoney(a.valid_bet)}</td>
                                    <td class="${parseFloat(a.total_win_loss) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(a.total_win_loss)}</td>
                                    <td class="${parseFloat(a.company_profit) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(a.company_profit)}</td>
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

// 角色权限管理 - 增强版
function showAddRole() {
    openModal(`
        <div class="p-6" style="min-width: 500px;">
            <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-shield text-indigo-500 mr-2"></i>新增角色</h3>
            <form id="roleForm" class="space-y-4">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">角色名称 <span class="text-red-500">*</span></label><input type="text" id="roleName" class="form-input w-full" placeholder="如：财务主管" required></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">描述</label><input type="text" id="roleDesc" class="form-input w-full" placeholder="角色描述"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-2">分配权限</label><div id="permissionCheckboxes" class="border rounded-lg p-4 max-h-64 overflow-y-auto bg-gray-50"><div class="text-center text-gray-500 py-2">加载权限列表...</div></div></div>
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>保存</button>
                </div>
            </form>
        </div>
    `);
    loadPermissionsForRole();
    document.getElementById('roleForm').onsubmit = async (e) => { e.preventDefault(); await submitRole(); };
}

async function loadPermissionsForRole(selectedPerms = []) {
    try {
        const res = await apiRequest('/admin/permissions');
        const perms = res.data || [];
        const container = document.getElementById('permissionCheckboxes');
        const permGroups = {};
        perms.forEach(p => { const g = p.permission_code?.split(':')[0] || 'other'; if (!permGroups[g]) permGroups[g] = []; permGroups[g].push(p); });
        container.innerHTML = Object.entries(permGroups).map(([group, items]) => `
            <div class="mb-3"><div class="font-semibold text-gray-700 mb-2 uppercase text-xs">${group}</div><div class="grid grid-cols-2 gap-2">${items.map(p => `<label class="flex items-center space-x-2 text-sm cursor-pointer hover:bg-white p-1 rounded"><input type="checkbox" name="perms" value="${p.permission_code}" ${selectedPerms.includes(p.permission_code) ? 'checked' : ''} class="rounded border-gray-300"><span>${escapeHtml(p.permission_name)}</span></label>`).join('')}</div></div>
        `).join('');
    } catch (error) { document.getElementById('permissionCheckboxes').innerHTML = '<div class="text-red-500 text-center">加载失败</div>'; }
}

async function submitRole(roleId = null) {
    const selectedPerms = Array.from(document.querySelectorAll('input[name="perms"]:checked')).map(cb => cb.value);
    const data = { role_name: document.getElementById('roleName').value.trim(), description: document.getElementById('roleDesc').value.trim() || null, permissions: selectedPerms.join(',') };
    if (!data.role_name) { alert('请输入角色名称'); return; }
    try {
        const url = roleId ? `/admin/roles/${roleId}` : '/admin/roles';
        const res = await apiRequest(url, { method: roleId ? 'PUT' : 'POST', body: JSON.stringify(data) });
        if (res.success) { closeModal(); alert(roleId ? '角色更新成功' : '角色创建成功'); loadPage('admin-roles'); }
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
            const perms = r.permissions ? r.permissions.split(',') : [];
            await loadPermissionsForRole(perms);
            document.querySelector('#roleForm').previousElementSibling.innerHTML = '<i class="fas fa-user-shield text-indigo-500 mr-2"></i>编辑角色';
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

// 角色权限管理 - 增强版
async function renderRolesEnhanced() {
    const content = document.getElementById('pageContent');
    try {
        const [rolesData, permsData] = await Promise.all([
            apiRequest('/admin/roles'),
            apiRequest('/admin/permissions')
        ]);
        const roles = rolesData.data || [];
        const permissions = permsData.data || [];
        
        content.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="card">
                    <div class="card-header flex items-center justify-between">
                        <h3 class="text-lg font-semibold"><i class="fas fa-user-shield mr-2"></i>角色管理</h3>
                        <button onclick="showAddRole()" class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增角色</button>
                    </div>
                    <div class="p-4">
                        <table class="data-table">
                            <thead><tr><th>角色名称</th><th>描述</th><th>用户数</th><th>操作</th></tr></thead>
                            <tbody>
                                ${roles.length === 0 ? '<tr><td colspan="4" class="text-center text-gray-500 py-4">暂无角色</td></tr>' : 
                                roles.map(r => `
                                    <tr>
                                        <td class="font-semibold">${escapeHtml(r.role_name || '')}</td>
                                        <td class="text-sm text-gray-600">${escapeHtml(r.description || '-')}</td>
                                        <td><span class="badge badge-info">${r.user_count || 0}</span></td>
                                        <td>
                                            <button onclick="editRole(${r.role_id})" class="text-blue-500 hover:text-blue-700 mr-2" title="编辑"><i class="fas fa-edit"></i></button>
                                            ${r.role_id > 2 ? `<button onclick="deleteRole(${r.role_id}, '${escapeAttr(r.role_name)}')" class="text-red-500 hover:text-red-700" title="删除"><i class="fas fa-trash"></i></button>` : ''}
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
                        ${Object.entries(permissions.reduce((acc, p) => {
                            const mod = p.module || '其他';
                            if (!acc[mod]) acc[mod] = [];
                            acc[mod].push(p);
                            return acc;
                        }, {})).map(([module, perms]) => `
                            <div class="mb-4">
                                <h4 class="font-medium text-gray-700 mb-2">${escapeHtml(module)}</h4>
                                <div class="flex flex-wrap gap-2">
                                    ${perms.map(p => `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded" title="${escapeAttr(p.permission_code || '')}">${escapeHtml(p.permission_name || '')}</span>`).join('')}
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
