/**
 * 查询条件辅助函数库
 * 为所有数据/报表页面提供统一的查询条件功能
 */

// 快捷日期范围计算
function getQuickDateRange(type) {
    const today = new Date();
    let start, end;
    
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    switch(type) {
        case 'today':
            start = end = formatDate(today);
            break;
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            start = end = formatDate(yesterday);
            break;
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay() + 1); // 周一
            start = formatDate(weekStart);
            end = formatDate(today);
            break;
        case 'month':
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            start = formatDate(monthStart);
            end = formatDate(today);
            break;
        case 'last7':
            const last7 = new Date(today);
            last7.setDate(today.getDate() - 6);
            start = formatDate(last7);
            end = formatDate(today);
            break;
        case 'last30':
            const last30 = new Date(today);
            last30.setDate(today.getDate() - 29);
            start = formatDate(last30);
            end = formatDate(today);
            break;
        default:
            start = end = formatDate(today);
    }
    
    return { start, end };
}

// 查询缓存管理
const QueryCache = {
    save(page, params) {
        try {
            sessionStorage.setItem(`query_${page}`, JSON.stringify(params));
        } catch (e) {
            console.warn('Failed to save query cache:', e);
        }
    },
    
    restore(page) {
        try {
            const saved = sessionStorage.getItem(`query_${page}`);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.warn('Failed to restore query cache:', e);
            return {};
        }
    },
    
    clear(page) {
        try {
            sessionStorage.removeItem(`query_${page}`);
        } catch (e) {
            console.warn('Failed to clear query cache:', e);
        }
    }
};

// 通用查询条件配置
const QueryFieldConfigs = {
    // 财务管理 - 账户明细
    transactions: {
        fields: [
            { name: 'start_date', type: 'date', placeholder: '开始日期' },
            { name: 'end_date', type: 'date', placeholder: '结束日期' },
            {
                name: 'type',
                type: 'select',
                placeholder: '全部类型',
                options: [
                    { value: '1', label: '存款' },
                    { value: '2', label: '取款' },
                    { value: '3', label: '投注' },
                    { value: '4', label: '派彩' },
                    { value: '5', label: '红利' },
                    { value: '6', label: '洗码' }
                ]
            },
            {
                name: 'status',
                type: 'select',
                placeholder: '全部状态',
                options: [
                    { value: '0', label: '待审核' },
                    { value: '1', label: '已通过' },
                    { value: '2', label: '已拒绝' }
                ]
            }
        ],
        advanced: [
            { name: 'order_no', type: 'text', placeholder: '订单号' },
            { name: 'username', type: 'text', placeholder: '会员账号' },
            { name: 'user_id', type: 'number', placeholder: '用户ID' },
            { name: 'amount_min', type: 'number', placeholder: '最小金额' },
            { name: 'amount_max', type: 'number', placeholder: '最大金额' }
        ]
    },
    
    // 注单管理 - 注单列表
    bets: {
        fields: [
            { name: 'start_date', type: 'date', placeholder: '开始日期' },
            { name: 'end_date', type: 'date', placeholder: '结束日期' },
            {
                name: 'game_type',
                type: 'select',
                placeholder: '全部游戏',
                options: [
                    { value: '百家乐', label: '百家乐' },
                    { value: '龙虎', label: '龙虎' },
                    { value: '轮盘', label: '轮盘' },
                    { value: '骰宝', label: '骰宝' },
                    { value: '牛牛', label: '牛牛' }
                ]
            },
            {
                name: 'status',
                type: 'select',
                placeholder: '全部状态',
                options: [
                    { value: '0', label: '未结算' },
                    { value: '1', label: '已结算' },
                    { value: '2', label: '已取消' },
                    { value: '3', label: '废单' }
                ]
            }
        ],
        advanced: [
            { name: 'bet_no', type: 'text', placeholder: '注单号' },
            { name: 'username', type: 'text', placeholder: '玩家账号' },
            { name: 'user_id', type: 'number', placeholder: '用户ID' },
            { name: 'bet_amount_min', type: 'number', placeholder: '最小投注金额' },
            { name: 'bet_amount_max', type: 'number', placeholder: '最大投注金额' }
        ]
    },
    
    // 会员管理 - 玩家讯息
    players: {
        fields: [
            { name: 'username', type: 'text', placeholder: '玩家账号/昵称' },
            { name: 'user_id', type: 'number', placeholder: '用户ID' },
            {
                name: 'status',
                type: 'select',
                placeholder: '全部状态',
                options: [
                    { value: '1', label: '正常' },
                    { value: '0', label: '冻结' },
                    { value: '2', label: '锁定' }
                ]
            },
            {
                name: 'vip_level',
                type: 'select',
                placeholder: 'VIP等级',
                options: [
                    { value: '0', label: 'VIP0' },
                    { value: '1', label: 'VIP1' },
                    { value: '2', label: 'VIP2' },
                    { value: '3', label: 'VIP3' },
                    { value: '4', label: 'VIP4' },
                    { value: '5', label: 'VIP5' },
                    { value: '6', label: 'VIP6' }
                ]
            }
        ],
        advanced: [
            { name: 'agent_username', type: 'text', placeholder: '所属代理' },
            { name: 'balance_min', type: 'number', placeholder: '最小余额' },
            { name: 'balance_max', type: 'number', placeholder: '最大余额' },
            { name: 'register_start', type: 'date', label: '注册开始日期' },
            { name: 'register_end', type: 'date', label: '注册结束日期' }
        ]
    },
    
    // 佣金管理 - 佣金记录
    commission_records: {
        fields: [
            { name: 'start_date', type: 'date', placeholder: '开始日期' },
            { name: 'end_date', type: 'date', placeholder: '结束日期' },
            {
                name: 'claim_status',
                type: 'select',
                placeholder: '领取状态',
                options: [
                    { value: '0', label: '待领取' },
                    { value: '1', label: '已领取' },
                    { value: '2', label: '已过期' },
                    { value: '3', label: '自动到账' }
                ]
            },
            {
                name: 'audit_status',
                type: 'select',
                placeholder: '审核状态',
                options: [
                    { value: '0', label: '待审核' },
                    { value: '1', label: '已通过' },
                    { value: '2', label: '已拒绝' }
                ]
            }
        ],
        advanced: [
            { name: 'username', type: 'text', placeholder: '会员账号' },
            { name: 'user_id', type: 'number', placeholder: '用户ID' },
            { name: 'commission_min', type: 'number', placeholder: '最小佣金金额' },
            { name: 'commission_max', type: 'number', placeholder: '最大佣金金额' }
        ]
    },
    
    // 财务管理 - 存款申请
    deposits: {
        fields: [
            { name: 'start_date', type: 'date', placeholder: '开始日期' },
            { name: 'end_date', type: 'date', placeholder: '结束日期' },
            {
                name: 'status',
                type: 'select',
                placeholder: '全部状态',
                options: [
                    { value: '0', label: '待审核' },
                    { value: '1', label: '已通过' },
                    { value: '2', label: '已拒绝' }
                ]
            }
        ],
        advanced: [
            { name: 'order_no', type: 'text', placeholder: '订单号' },
            { name: 'username', type: 'text', placeholder: '会员账号' },
            { name: 'amount_min', type: 'number', placeholder: '最小金额' },
            { name: 'amount_max', type: 'number', placeholder: '最大金额' }
        ]
    },
    
    // 财务管理 - 取款申请
    withdrawals: {
        fields: [
            { name: 'start_date', type: 'date', placeholder: '开始日期' },
            { name: 'end_date', type: 'date', placeholder: '结束日期' },
            {
                name: 'status',
                type: 'select',
                placeholder: '全部状态',
                options: [
                    { value: '0', label: '待审核' },
                    { value: '1', label: '已通过' },
                    { value: '2', label: '已拒绝' }
                ]
            }
        ],
        advanced: [
            { name: 'order_no', type: 'text', placeholder: '订单号' },
            { name: 'username', type: 'text', placeholder: '会员账号' },
            { name: 'amount_min', type: 'number', placeholder: '最小金额' },
            { name: 'amount_max', type: 'number', placeholder: '最大金额' }
        ]
    },
    
    // 风控管理 - 风险预警
    risk_alerts: {
        fields: [
            { name: 'start_date', type: 'date', placeholder: '开始日期' },
            { name: 'end_date', type: 'date', placeholder: '结束日期' },
            {
                name: 'alert_type',
                type: 'select',
                placeholder: '预警类型',
                options: [
                    { value: 'high_win_rate', label: '高胜率' },
                    { value: 'large_bet', label: '大额投注' },
                    { value: 'suspicious_pattern', label: '可疑模式' }
                ]
            },
            {
                name: 'severity',
                type: 'select',
                placeholder: '严重级别',
                options: [
                    { value: '1', label: '低' },
                    { value: '2', label: '中' },
                    { value: '3', label: '高' },
                    { value: '4', label: '严重' }
                ]
            }
        ],
        advanced: [
            { name: 'username', type: 'text', placeholder: '玩家账号' },
            { name: 'user_id', type: 'number', placeholder: '用户ID' },
            {
                name: 'handle_status',
                type: 'select',
                placeholder: '处理状态',
                options: [
                    { value: '0', label: '未处理' },
                    { value: '1', label: '处理中' },
                    { value: '2', label: '已处理' }
                ]
            }
        ]
    }
};

// 导出查询配置（用于其他页面）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getQuickDateRange,
        QueryCache,
        QueryFieldConfigs
    };
}
