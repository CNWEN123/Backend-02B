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
            { id: 'finance-turnover', title: '流水稽核', page: 'finance-turnover' }
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
        'system-roles': { title: '角色权限', handler: renderRoles },
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
                        <button onclick="loadPage('finance-deposits')" class="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center transition">
                            <i class="fas fa-plus-circle text-green-500 text-2xl mb-2"></i>
                            <p class="text-sm font-medium">人工存款</p>
                        </button>
                        <button onclick="loadPage('finance-withdrawals')" class="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-center transition">
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
                    <span>洗码方案配置</span>
                    <button class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增方案</button>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${list.map(scheme => `
                            <div class="border rounded-lg p-4 hover:shadow-lg transition">
                                <div class="flex items-center justify-between mb-3">
                                    <h3 class="font-bold text-lg">${scheme.scheme_name}</h3>
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
                                    <button class="btn btn-outline text-sm flex-1">编辑</button>
                                    <button class="btn btn-primary text-sm flex-1">绑定</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
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
        const res = await apiRequest('/admin/users');
        const list = res.data || [];
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header flex items-center justify-between">
                    <span>管理员账号</span>
                    <button class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增管理员</button>
                </div>
                <div class="card-body">
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>账号</th>
                                    <th>昵称</th>
                                    <th>角色</th>
                                    <th>2FA状态</th>
                                    <th>最后登录IP</th>
                                    <th>最后登录时间</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(admin => `
                                    <tr>
                                        <td class="font-medium">${escapeHtml(admin.username)}</td>
                                        <td>${escapeHtml(admin.nickname) || '-'}</td>
                                        <td><span class="badge badge-info">${escapeHtml(admin.role_name)}</span></td>
                                        <td>${admin.two_fa_enabled ? '<span class="text-green-500"><i class="fas fa-check-circle"></i> 已绑定</span>' : '<span class="text-gray-400">未绑定</span>'}</td>
                                        <td class="font-mono text-sm">${escapeHtml(admin.last_login_ip) || '-'}</td>
                                        <td>${formatDate(admin.last_login_at)}</td>
                                        <td>${getStatusBadge(admin.status)}</td>
                                        <td>
                                            <button class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>
                                            <button class="text-red-500 hover:text-red-700"><i class="fas fa-key"></i></button>
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
                    <span>荷官档案库</span>
                    <button class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增荷官</button>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${list.map(dealer => `
                            <div class="border rounded-lg p-4 text-center hover:shadow-lg transition">
                                <div class="w-20 h-20 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-2xl">
                                    <i class="fas fa-user"></i>
                                </div>
                                <h3 class="font-bold">${dealer.stage_name_cn}</h3>
                                <p class="text-sm text-gray-500">${dealer.stage_name_en || '-'}</p>
                                <p class="text-xs text-gray-400 mt-1">工号: ${dealer.staff_id}</p>
                                <div class="mt-2">
                                    ${dealer.status === 1 ? '<span class="badge badge-success">在职</span>' : dealer.status === 2 ? '<span class="badge badge-warning">休假</span>' : '<span class="badge badge-danger">离职</span>'}
                                </div>
                                <div class="mt-3 flex justify-center space-x-2">
                                    <button class="btn btn-outline text-xs">编辑</button>
                                    <button class="btn btn-primary text-xs">排班</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
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
                    <span>桌台配置</span>
                    <button class="btn btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增桌台</button>
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
                                        <td class="font-medium">${table.table_code}</td>
                                        <td>${table.table_name || '-'}</td>
                                        <td><span class="badge badge-info">${table.game_type}</span></td>
                                        <td>${table.dealer_name || '<span class="text-gray-400">空缺</span>'}</td>
                                        <td>¥${formatNumber(table.min_bet)} - ¥${formatNumber(table.max_bet)}</td>
                                        <td>${table.status === 1 ? '<span class="badge badge-success">正常</span>' : table.status === 0 ? '<span class="badge badge-warning">维护</span>' : '<span class="badge badge-danger">关闭</span>'}</td>
                                        <td>
                                            <button class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>
                                            <button class="text-purple-500 hover:text-purple-700"><i class="fas fa-video"></i></button>
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

// 角色权限管理
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
                    <div class="card-header"><h3 class="text-lg font-semibold"><i class="fas fa-user-shield mr-2"></i>角色管理</h3></div>
                    <div class="p-4">
                        <table class="data-table">
                            <thead><tr><th>角色名称</th><th>描述</th><th>用户数</th></tr></thead>
                            <tbody>
                                ${roles.map(r => `
                                    <tr>
                                        <td class="font-semibold">${escapeHtml(r.role_name || '')}</td>
                                        <td class="text-sm text-gray-600">${escapeHtml(r.description || '')}</td>
                                        <td><span class="badge badge-info">${r.user_count || 0}</span></td>
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
