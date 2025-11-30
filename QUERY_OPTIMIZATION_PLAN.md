# 查询条件优化与完善方案

## 📋 需要优化的页面清单

### 1. 会员管理模块
- ✅ **玩家列表** (`renderPlayers`)
  - 现有：账号、状态
  - 新增：用户ID、代理、VIP等级、注册日期范围、余额范围

### 2. 财务管理模块
- ✅ **交易流水** (`renderTransactions`)
  - 现有：日期、类型
  - 新增：订单号、用户名/ID、金额范围、审核状态

- ✅ **存款审核** (`renderDeposits`)
  - 新增：订单号、用户名、日期范围、金额范围、支付方式

- ✅ **提款审核** (`renderWithdrawals`)
  - 新增：订单号、用户名、日期范围、金额范围、状态

### 3. 注单管理模块
- ✅ **注单列表** (`renderBets`)
  - 现有：基本查询
  - 新增：注单号、用户名/ID、游戏类型、靴号、局号、日期范围、金额范围、结算状态

- ✅ **实时监控** (`renderRealtimeBets`)
  - 新增：用户名、游戏类型、金额范围

- ✅ **特殊监控** (`renderSpecialBets`)
  - 新增：用户名、游戏类型、金额范围、异常类型

### 4. 洗码管理模块
- ✅ **洗码记录** (`renderCommissionRecords`)
  - 现有：基本查询
  - 新增：用户名/ID、方案、日期范围、金额范围、发放状态

### 5. 报表中心模块
- ✅ **代理业绩** (`renderAgentPerformance`)
  - 现有：基本查询
  - 新增：代理账号、层级、日期范围、业绩排序

- ✅ **游戏报表** (`renderGameReport`)
  - 新增：游戏类型、日期范围

- ✅ **每日报表** (`renderDailyReport`)
  - 新增：日期范围、代理筛选

### 6. 风控管理模块
- ✅ **风险预警** (`renderRiskAlerts`)
  - 现有：基本查询
  - 新增：用户名、预警类型、严重程度、日期范围、处理状态

---

## 🎨 UI设计规范

### 查询区域布局

```html
<div class="bg-gray-50 p-4 rounded-lg mb-4">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <!-- 第一行：主要筛选条件 -->
        <input type="text" placeholder="订单号/注单号" class="form-input">
        <input type="text" placeholder="用户名/ID" class="form-input">
        <select class="form-input">
            <option>类型筛选</option>
        </select>
        <select class="form-input">
            <option>状态筛选</option>
        </select>
    </div>
    
    <!-- 第二行：日期和高级筛选 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <input type="date" class="form-input" placeholder="开始日期">
        <input type="date" class="form-input" placeholder="结束日期">
        <button onclick="toggleAdvanced()" class="btn btn-secondary">
            <i class="fas fa-filter"></i> 高级筛选
        </button>
        <div class="flex gap-2">
            <button onclick="doSearch()" class="btn btn-primary flex-1">
                <i class="fas fa-search"></i> 查询
            </button>
            <button onclick="resetSearch()" class="btn btn-secondary">
                <i class="fas fa-redo"></i> 重置
            </button>
        </div>
    </div>
    
    <!-- 高级筛选区域（可折叠） -->
    <div id="advancedFilters" class="hidden mt-3 pt-3 border-t border-gray-200">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <!-- 金额范围 -->
            <div class="flex items-center gap-2">
                <input type="number" placeholder="最小金额" class="form-input flex-1">
                <span class="text-gray-500">-</span>
                <input type="number" placeholder="最大金额" class="form-input flex-1">
            </div>
            <!-- 其他高级条件 -->
        </div>
    </div>
</div>
```

### 样式规范

```css
/* 查询输入框 */
.form-input {
    @apply px-3 py-2 border border-gray-300 rounded-lg text-sm;
    @apply focus:border-blue-500 focus:ring-1 focus:ring-blue-500;
    @apply transition-colors;
}

/* 查询按钮 */
.btn-search {
    @apply bg-blue-500 hover:bg-blue-600 text-white;
}

.btn-reset {
    @apply bg-gray-400 hover:bg-gray-500 text-white;
}

/* 快捷日期选择 */
.quick-date-btn {
    @apply px-2 py-1 text-xs border rounded hover:bg-gray-100;
}
```

---

## 🔧 功能特性

### 1. 快捷日期选择
```javascript
// 今天、昨天、本周、本月、上月
const quickDates = {
    today: () => [getToday(), getToday()],
    yesterday: () => [getYesterday(), getYesterday()],
    thisWeek: () => [getWeekStart(), getToday()],
    thisMonth: () => [getMonthStart(), getToday()],
    lastMonth: () => [getLastMonthStart(), getLastMonthEnd()]
};
```

### 2. 查询条件缓存
```javascript
// 保存查询条件到localStorage
function saveQueryParams(page, params) {
    localStorage.setItem(`query_${page}`, JSON.stringify(params));
}

// 恢复上次查询条件
function restoreQueryParams(page) {
    const saved = localStorage.getItem(`query_${page}`);
    return saved ? JSON.parse(saved) : {};
}
```

### 3. 搜索历史
```javascript
// 保存最近10次搜索
function addSearchHistory(keyword) {
    let history = JSON.parse(localStorage.getItem('search_history') || '[]');
    history.unshift(keyword);
    history = [...new Set(history)].slice(0, 10);
    localStorage.setItem('search_history', JSON.stringify(history));
}
```

### 4. 导出功能增强
- 根据当前查询条件导出
- 支持Excel、CSV格式
- 大数据量分批导出

---

## 📊 各页面详细配置

### 玩家列表
```javascript
{
    basic: ['username', 'user_id', 'status'],
    advanced: [
        'agent_id',        // 代理ID/名称
        'vip_level',       // VIP等级
        'register_date',   // 注册日期范围
        'balance_min',     // 最小余额
        'balance_max',     // 最大余额
        'last_login_date'  // 最后登录日期
    ],
    quickDates: true,
    export: true
}
```

### 交易流水
```javascript
{
    basic: ['order_no', 'username', 'type', 'status'],
    advanced: [
        'amount_min',      // 最小金额
        'amount_max',      // 最大金额
        'audit_status',    // 审核状态
        'admin_id'         // 操作人
    ],
    quickDates: true,
    dateRange: true,
    export: true
}
```

### 注单列表
```javascript
{
    basic: ['bet_id', 'username', 'game_type', 'status'],
    advanced: [
        'shoe_number',     // 靴号
        'round_number',    // 局号
        'bet_type',        // 投注类型
        'amount_min',      // 最小金额
        'amount_max',      // 最大金额
        'result'           // 结果
    ],
    quickDates: true,
    dateRange: true,
    realtime: true,     // 实时刷新
    export: true
}
```

### 洗码记录
```javascript
{
    basic: ['username', 'scheme_id', 'status'],
    advanced: [
        'amount_min',      // 最小金额
        'amount_max',      // 最大金额
        'valid_bet_min',   // 最小有效投注
        'valid_bet_max',   // 最大有效投注
        'issue_type'       // 发放方式（手动/自动）
    ],
    quickDates: true,
    dateRange: true,
    export: true
}
```

### 代理业绩
```javascript
{
    basic: ['agent_username', 'level'],
    advanced: [
        'player_count_min', // 最小玩家数
        'player_count_max', // 最大玩家数
        'bet_amount_min',   // 最小投注额
        'bet_amount_max',   // 最大投注额
        'sort_by'           // 排序方式
    ],
    quickDates: true,
    dateRange: true,
    export: true
}
```

### 风险预警
```javascript
{
    basic: ['username', 'alert_type', 'severity'],
    advanced: [
        'amount_min',       // 触发金额范围
        'amount_max',
        'handler',          // 处理人
        'handle_status',    // 处理状态
        'ip_address'        // IP地址
    ],
    quickDates: true,
    dateRange: true,
    export: false
}
```

---

## 🚀 实施步骤

1. ✅ 创建通用查询组件 `SearchForm`
2. ✅ 实现日期快捷选择功能
3. ✅ 实现查询条件缓存
4. ✅ 逐个优化各页面查询UI
5. ✅ 测试所有查询功能
6. ✅ 优化后端API支持新查询参数
7. ✅ 添加查询性能监控

---

## 📝 注意事项

1. **性能优化**
   - 日期范围限制（默认最多查询3个月）
   - 大数据量分页加载
   - 查询防抖（300ms）

2. **用户体验**
   - 保存上次查询条件
   - 快捷日期选择
   - 一键重置
   - 查询中状态显示

3. **安全性**
   - 输入验证和转义
   - SQL注入防护
   - 权限检查

4. **兼容性**
   - 响应式设计
   - 移动端适配
   - 浏览器兼容

---

**开始时间**: 2024-11-30  
**预计完成**: 2024-11-30  
**优先级**: 高
