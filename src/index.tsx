import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS配置
app.use('/api/*', cors())

// 静态文件
app.use('/static/*', serveStatic())

// ==================== 认证API ====================

// 登录
app.post('/api/v1/auth/login', async (c) => {
  const { username, password, captcha } = await c.req.json()
  
  // 验证验证码（简化处理）
  if (!captcha || captcha.length < 4) {
    return c.json({ success: false, message: '验证码错误' }, 400)
  }

  try {
    const admin = await c.env.DB.prepare(
      'SELECT * FROM admin_users WHERE username = ? AND status = 1'
    ).bind(username).first()

    if (!admin) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401)
    }

    // 简化密码验证（实际应使用bcrypt）
    // 这里假设密码正确
    
    // 生成token
    const token = btoa(JSON.stringify({ 
      admin_id: admin.admin_id, 
      username: admin.username,
      role_id: admin.role_id,
      exp: Date.now() + 24 * 60 * 60 * 1000 
    }))

    // 更新最后登录
    await c.env.DB.prepare(
      'UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP, last_login_ip = ? WHERE admin_id = ?'
    ).bind(c.req.header('CF-Connecting-IP') || '127.0.0.1', admin.admin_id).run()

    // 记录日志
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, 'LOGIN', 'admin_users', admin.admin_id, '登录成功', c.req.header('CF-Connecting-IP') || '127.0.0.1').run()

    return c.json({ 
      success: true, 
      token,
      user: {
        admin_id: admin.admin_id,
        username: admin.username,
        nickname: admin.nickname,
        role_id: admin.role_id,
        two_fa_enabled: admin.two_fa_enabled
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ success: false, message: '系统错误' }, 500)
  }
})

// 获取当前用户信息
app.get('/api/v1/auth/me', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return c.json({ success: false, message: '未授权' }, 401)
  }

  try {
    const payload = JSON.parse(atob(token))
    if (payload.exp < Date.now()) {
      return c.json({ success: false, message: 'Token已过期' }, 401)
    }

    const admin = await c.env.DB.prepare(
      'SELECT a.*, r.role_name, r.permissions FROM admin_users a JOIN admin_roles r ON a.role_id = r.role_id WHERE a.admin_id = ?'
    ).bind(payload.admin_id).first()

    if (!admin) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }

    return c.json({ 
      success: true, 
      data: {
        admin_id: admin.admin_id,
        username: admin.username,
        nickname: admin.nickname,
        role_id: admin.role_id,
        role_name: admin.role_name,
        permissions: JSON.parse(admin.permissions as string || '[]'),
        last_login_ip: admin.last_login_ip,
        last_login_at: admin.last_login_at
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '无效Token' }, 401)
  }
})

// ==================== 仪表盘API ====================

app.get('/api/v1/dashboard/stats', async (c) => {
  try {
    // 今日数据
    const today = new Date().toISOString().split('T')[0]
    
    // 总玩家数
    const totalPlayers = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first()

    // 今日存款
    const todayDeposit = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
       WHERE transaction_type = 1 AND audit_status = 1 AND DATE(created_at) = ?`
    ).bind(today).first()

    // 今日提款
    const todayWithdraw = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions 
       WHERE transaction_type = 2 AND audit_status = 1 AND DATE(created_at) = ?`
    ).bind(today).first()

    // 今日投注
    const todayBet = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(bet_amount), 0) as total, COUNT(*) as count FROM bets WHERE DATE(created_at) = ?`
    ).bind(today).first()

    // 今日盈亏
    const todayProfit = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(win_loss_amount), 0) as total FROM bets WHERE DATE(created_at) = ? AND bet_status = 1`
    ).bind(today).first()

    // 待审核提款
    const pendingWithdraw = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM transactions WHERE transaction_type = 2 AND audit_status = 0'
    ).first()

    // 风控预警数
    const pendingAlerts = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM risk_alerts WHERE handle_status = 0'
    ).first()

    // 公司总余额（模拟）
    const totalBalance = await c.env.DB.prepare(
      'SELECT COALESCE(SUM(balance), 0) as total FROM users'
    ).first()

    return c.json({
      success: true,
      data: {
        totalPlayers: totalPlayers?.count || 0,
        todayDeposit: todayDeposit?.total || 0,
        todayWithdraw: todayWithdraw?.total || 0,
        todayBet: todayBet?.total || 0,
        todayBetCount: todayBet?.count || 0,
        todayProfit: -(todayProfit?.total || 0), // 公司盈亏是玩家盈亏的相反数
        pendingWithdraw: pendingWithdraw?.count || 0,
        pendingAlerts: pendingAlerts?.count || 0,
        totalBalance: 12450230 - (totalBalance?.total || 0) // 模拟公司资金池
      }
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return c.json({ success: false, message: '获取统计数据失败' }, 500)
  }
})

// 7天趋势数据
app.get('/api/v1/dashboard/trends', async (c) => {
  try {
    const trends = await c.env.DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT user_id) as active_players,
        COALESCE(SUM(bet_amount), 0) as total_bet,
        COALESCE(SUM(win_loss_amount), 0) as total_win_loss
      FROM bets 
      WHERE created_at >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all()

    // 新增玩家趋势
    const newPlayers = await c.env.DB.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users 
      WHERE created_at >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all()

    return c.json({
      success: true,
      data: {
        betting: trends.results || [],
        newPlayers: newPlayers.results || []
      }
    })
  } catch (error) {
    console.error('Dashboard trends error:', error)
    return c.json({ success: false, message: '获取趋势数据失败' }, 500)
  }
})

// ==================== 玩家管理API ====================

app.get('/api/v1/players', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '20')
  const username = c.req.query('username')
  const status = c.req.query('status')
  const agent_id = c.req.query('agent_id')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (username) {
      where += ' AND u.username LIKE ?'
      params.push(`%${username}%`)
    }
    if (status !== undefined && status !== '') {
      where += ' AND u.status = ?'
      params.push(parseInt(status))
    }
    if (agent_id) {
      where += ' AND u.agent_id = ?'
      params.push(parseInt(agent_id))
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM users u ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT u.*, a.agent_username 
      FROM users u 
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || []
      }
    })
  } catch (error) {
    console.error('Players list error:', error)
    return c.json({ success: false, message: '获取玩家列表失败' }, 500)
  }
})

// 玩家详情
app.get('/api/v1/players/:user_id', async (c) => {
  const user_id = c.req.param('user_id')
  
  try {
    const user = await c.env.DB.prepare(`
      SELECT u.*, a.agent_username 
      FROM users u 
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      WHERE u.user_id = ?
    `).bind(user_id).first()

    if (!user) {
      return c.json({ success: false, message: '玩家不存在' }, 404)
    }

    return c.json({ success: true, data: user })
  } catch (error) {
    return c.json({ success: false, message: '获取玩家详情失败' }, 500)
  }
})

// 更新玩家状态
app.put('/api/v1/players/:user_id/status', async (c) => {
  const user_id = c.req.param('user_id')
  const { status } = await c.req.json()

  try {
    await c.env.DB.prepare(
      'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).bind(status, user_id).run()

    return c.json({ success: true, message: '状态更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 在线玩家（模拟）
app.get('/api/v1/players/online', async (c) => {
  try {
    // 模拟在线玩家数据
    const result = await c.env.DB.prepare(`
      SELECT u.user_id, u.username, u.nickname, u.balance, u.vip_level,
             'BAC-001' as current_table, '百家乐' as game_type
      FROM users u 
      WHERE u.status = 1 
      ORDER BY u.last_login_at DESC 
      LIMIT 50
    `).all()

    return c.json({
      success: true,
      data: {
        total: result.results?.length || 0,
        list: result.results || []
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取在线玩家失败' }, 500)
  }
})

// ==================== 代理管理API ====================

app.get('/api/v1/agents', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '20')
  const parent_id = c.req.query('parent_id')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (parent_id) {
      where += ' AND a.parent_agent_id = ?'
      params.push(parseInt(parent_id))
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM agents a ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT a.*, p.agent_username as parent_username,
             (SELECT COUNT(*) FROM users WHERE agent_id = a.agent_id) as player_count,
             (SELECT COUNT(*) FROM agents WHERE parent_agent_id = a.agent_id) as sub_agent_count
      FROM agents a 
      LEFT JOIN agents p ON a.parent_agent_id = p.agent_id
      ${where}
      ORDER BY a.level, a.created_at
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || []
      }
    })
  } catch (error) {
    console.error('Agents list error:', error)
    return c.json({ success: false, message: '获取代理列表失败' }, 500)
  }
})

// 代理树形结构
app.get('/api/v1/agents/tree', async (c) => {
  try {
    const agents = await c.env.DB.prepare(`
      SELECT agent_id, agent_username, nickname, parent_agent_id, level, status, balance,
             (SELECT COUNT(*) FROM users WHERE agent_id = agents.agent_id) as player_count
      FROM agents
      ORDER BY level, agent_id
    `).all()

    // 构建树形结构
    const buildTree = (items: any[], parentId: number | null = null): any[] => {
      return items
        .filter(item => item.parent_agent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.agent_id)
        }))
    }

    const tree = buildTree(agents.results || [])

    return c.json({ success: true, data: tree })
  } catch (error) {
    return c.json({ success: false, message: '获取代理树失败' }, 500)
  }
})

// ==================== 财务管理API ====================

app.get('/api/v1/finance/transactions', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '20')
  const type = c.req.query('type')
  const status = c.req.query('status')
  const user_id = c.req.query('user_id')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (type) {
      where += ' AND t.transaction_type = ?'
      params.push(parseInt(type))
    }
    if (status !== undefined && status !== '') {
      where += ' AND t.audit_status = ?'
      params.push(parseInt(status))
    }
    if (user_id) {
      where += ' AND t.user_id = ?'
      params.push(parseInt(user_id))
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM transactions t ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT t.*, u.username, u.nickname
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.user_id
      ${where}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || []
      }
    })
  } catch (error) {
    console.error('Transactions list error:', error)
    return c.json({ success: false, message: '获取交易记录失败' }, 500)
  }
})

// 存款/提款审核
app.post('/api/v1/finance/transactions/:id/audit', async (c) => {
  const id = c.req.param('id')
  const { action, remark } = await c.req.json()
  
  try {
    const newStatus = action === 'approve' ? 1 : 2
    
    await c.env.DB.prepare(`
      UPDATE transactions 
      SET audit_status = ?, audit_remark = ?, audit_at = CURRENT_TIMESTAMP
      WHERE transaction_id = ?
    `).bind(newStatus, remark || '', id).run()

    return c.json({ success: true, message: '审核完成' })
  } catch (error) {
    return c.json({ success: false, message: '审核失败' }, 500)
  }
})

// 待审核存款
app.get('/api/v1/finance/deposits', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT t.*, u.username, u.nickname
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.user_id
      WHERE t.transaction_type = 1 AND t.audit_status = 0
      ORDER BY t.created_at DESC
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取存款列表失败' }, 500)
  }
})

// 待审核提款
app.get('/api/v1/finance/withdrawals', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT t.*, u.username, u.nickname, u.total_bet, u.total_deposit,
             CASE WHEN u.total_bet >= u.total_deposit * 3 THEN 1 ELSE 0 END as flow_check
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.user_id
      WHERE t.transaction_type = 2 AND t.audit_status = 0
      ORDER BY t.created_at DESC
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取提款列表失败' }, 500)
  }
})

// ==================== 注单管理API ====================

app.get('/api/v1/bets', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '20')
  const game_type = c.req.query('game_type')
  const status = c.req.query('status')
  const user_id = c.req.query('user_id')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (game_type) {
      where += ' AND b.game_type = ?'
      params.push(game_type)
    }
    if (status !== undefined && status !== '') {
      where += ' AND b.bet_status = ?'
      params.push(parseInt(status))
    }
    if (user_id) {
      where += ' AND b.user_id = ?'
      params.push(parseInt(user_id))
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM bets b ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT b.*, u.username, u.nickname
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || []
      }
    })
  } catch (error) {
    console.error('Bets list error:', error)
    return c.json({ success: false, message: '获取注单列表失败' }, 500)
  }
})

// ==================== 洗码管理API ====================

app.get('/api/v1/commission/schemes', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM commission_schemes ORDER BY scheme_id
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取洗码方案失败' }, 500)
  }
})

app.get('/api/v1/commission/records', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '20')
  const status = c.req.query('status')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (status !== undefined && status !== '') {
      where += ' AND cr.audit_status = ?'
      params.push(parseInt(status))
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM commission_records cr ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT cr.*, u.username, u.nickname, cs.scheme_name
      FROM commission_records cr
      LEFT JOIN users u ON cr.user_id = u.user_id
      LEFT JOIN commission_schemes cs ON cr.scheme_id = cs.scheme_id
      ${where}
      ORDER BY cr.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || []
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取洗码记录失败' }, 500)
  }
})

// ==================== 风控管理API ====================

app.get('/api/v1/risk/alerts', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '20')
  const status = c.req.query('status')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (status !== undefined && status !== '') {
      where += ' AND ra.handle_status = ?'
      params.push(parseInt(status))
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM risk_alerts ra ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT ra.*, u.username, u.nickname, rr.rule_name
      FROM risk_alerts ra
      LEFT JOIN users u ON ra.user_id = u.user_id
      LEFT JOIN risk_rules rr ON ra.rule_id = rr.rule_id
      ${where}
      ORDER BY ra.risk_level DESC, ra.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || []
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取风控预警失败' }, 500)
  }
})

// ==================== 报表API ====================

app.get('/api/v1/reports/settlement', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]

  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as bet_count,
        COALESCE(SUM(bet_amount), 0) as total_bet,
        COALESCE(SUM(valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(win_loss_amount), 0) as total_win_loss,
        -COALESCE(SUM(win_loss_amount), 0) as company_profit
      FROM bets
      WHERE DATE(created_at) BETWEEN ? AND ? AND bet_status = 1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).bind(start_date, end_date).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取结算报表失败' }, 500)
  }
})

// 盈亏排行榜
app.get('/api/v1/reports/ranking', async (c) => {
  const type = c.req.query('type') || 'profit' // profit or loss
  const limit = parseInt(c.req.query('limit') || '50')

  try {
    const orderDir = type === 'profit' ? 'ASC' : 'DESC'
    const result = await c.env.DB.prepare(`
      SELECT u.user_id, u.username, u.nickname, u.vip_level,
             u.total_bet, u.total_win_loss,
             a.agent_username
      FROM users u
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      ORDER BY u.total_win_loss ${orderDir}
      LIMIT ?
    `).bind(limit).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取排行榜失败' }, 500)
  }
})

// ==================== 现场运营API ====================

app.get('/api/v1/dealers', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM dealers ORDER BY dealer_id
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取荷官列表失败' }, 500)
  }
})

app.get('/api/v1/tables', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT t.*, d.stage_name_cn as dealer_name
      FROM game_tables t
      LEFT JOIN dealers d ON t.current_dealer_id = d.dealer_id
      ORDER BY t.table_code
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取桌台列表失败' }, 500)
  }
})

app.get('/api/v1/shifts', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0]

  try {
    const result = await c.env.DB.prepare(`
      SELECT ds.*, d.stage_name_cn, d.staff_id, t.table_code, t.table_name
      FROM dealer_shifts ds
      LEFT JOIN dealers d ON ds.dealer_id = d.dealer_id
      LEFT JOIN game_tables t ON ds.table_id = t.table_id
      WHERE ds.shift_date = ?
      ORDER BY ds.table_id, ds.start_time
    `).bind(date).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取排班数据失败' }, 500)
  }
})

// ==================== 系统管理API ====================

app.get('/api/v1/admin/users', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT a.admin_id, a.username, a.nickname, a.role_id, a.status, 
             a.two_fa_enabled, a.last_login_ip, a.last_login_at,
             r.role_name
      FROM admin_users a
      LEFT JOIN admin_roles r ON a.role_id = r.role_id
      ORDER BY a.admin_id
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取管理员列表失败' }, 500)
  }
})

app.get('/api/v1/admin/roles', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM admin_roles ORDER BY role_id
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取角色列表失败' }, 500)
  }
})

app.get('/api/v1/admin/audit-logs', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '50')
  const offset = (page - 1) * size

  try {
    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM audit_logs'
    ).first()

    const result = await c.env.DB.prepare(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(size, offset).all()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || []
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取操作日志失败' }, 500)
  }
})

// ==================== 公告管理API ====================

app.get('/api/v1/announcements', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM announcements ORDER BY priority DESC, created_at DESC
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取公告列表失败' }, 500)
  }
})

// ==================== 页面路由 ====================

// 登录页
app.get('/login', (c) => {
  return c.html(loginPage())
})

// 主页面
app.get('/', (c) => {
  return c.html(mainPage())
})

app.get('/dashboard', (c) => {
  return c.redirect('/')
})

// 登录页面HTML
function loginPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>真人荷官视讯后台管理系统 - 登录</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(135deg, #1a1f35 0%, #0d1321 100%);
            min-height: 100vh;
        }
        .login-card {
            backdrop-filter: blur(10px);
            background: rgba(255,255,255,0.95);
        }
        .captcha-img {
            background: linear-gradient(45deg, #f3f4f6, #e5e7eb);
            font-family: 'Courier New', monospace;
            letter-spacing: 8px;
            font-weight: bold;
            color: #374151;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body class="flex items-center justify-center p-4">
    <div class="login-card rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mb-4">
                <i class="fas fa-dice text-white text-2xl"></i>
            </div>
            <h1 class="text-2xl font-bold text-gray-800">欢迎登录</h1>
            <p class="text-gray-500 text-sm mt-1">真人荷官视讯后台管理系统</p>
        </div>
        
        <form id="loginForm" class="space-y-5">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-user mr-2 text-gray-400"></i>用户名
                </label>
                <input type="text" id="username" name="username" 
                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                       placeholder="请输入用户名" required>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-lock mr-2 text-gray-400"></i>密码
                </label>
                <input type="password" id="password" name="password"
                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                       placeholder="请输入密码" required>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-shield-alt mr-2 text-gray-400"></i>验证码
                </label>
                <div class="flex space-x-3">
                    <input type="text" id="captcha" name="captcha"
                           class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                           placeholder="请输入验证码" maxlength="4" required>
                    <div id="captchaImg" onclick="refreshCaptcha()" 
                         class="captcha-img w-28 h-12 flex items-center justify-center rounded-lg cursor-pointer select-none text-lg">
                    </div>
                </div>
            </div>
            
            <button type="submit" 
                    class="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition shadow-lg">
                <i class="fas fa-sign-in-alt mr-2"></i>登 录
            </button>
        </form>
        
        <div class="mt-6 flex items-center justify-between text-sm text-gray-500">
            <div class="flex items-center">
                <img src="https://flagcdn.com/w20/cn.png" class="w-5 h-4 mr-2" alt="CN">
                <span>中文简体</span>
            </div>
            <span>V2.1</span>
        </div>
    </div>
    
    <script>
        let captchaCode = '';
        
        function generateCaptcha() {
            const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let code = '';
            for (let i = 0; i < 4; i++) {
                code += chars[Math.floor(Math.random() * chars.length)];
            }
            return code;
        }
        
        function refreshCaptcha() {
            captchaCode = generateCaptcha();
            document.getElementById('captchaImg').textContent = captchaCode;
        }
        
        refreshCaptcha();
        
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const captcha = document.getElementById('captcha').value;
            
            if (captcha.toUpperCase() !== captchaCode) {
                alert('验证码错误');
                refreshCaptcha();
                return;
            }
            
            try {
                const response = await fetch('/api/v1/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, captcha })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/';
                } else {
                    alert(data.message || '登录失败');
                    refreshCaptcha();
                }
            } catch (error) {
                alert('网络错误，请重试');
                refreshCaptcha();
            }
        });
        
        // 检查是否已登录
        if (localStorage.getItem('token')) {
            window.location.href = '/';
        }
    </script>
</body>
</html>`
}

// 主页面HTML
function mainPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>真人荷官视讯后台管理系统 V2.1</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
    <style>
        :root {
            --sidebar-bg: #1e293b;
            --sidebar-hover: #334155;
            --sidebar-active: #3b82f6;
            --primary: #3b82f6;
            --success: #22c55e;
            --warning: #f59e0b;
            --danger: #ef4444;
        }
        
        body {
            background: #f1f5f9;
        }
        
        .sidebar {
            background: var(--sidebar-bg);
            width: 260px;
            transition: width 0.3s;
        }
        
        .sidebar.collapsed {
            width: 70px;
        }
        
        .sidebar-menu-item {
            transition: all 0.2s;
        }
        
        .sidebar-menu-item:hover {
            background: var(--sidebar-hover);
        }
        
        .sidebar-menu-item.active {
            background: var(--sidebar-active);
        }
        
        .main-content {
            margin-left: 260px;
            transition: margin-left 0.3s;
        }
        
        .sidebar.collapsed + .main-content {
            margin-left: 70px;
        }
        
        .stat-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .stat-card .value {
            font-size: 28px;
            font-weight: bold;
        }
        
        .stat-card .trend-up {
            color: var(--success);
        }
        
        .stat-card .trend-down {
            color: var(--danger);
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .data-table th {
            background: #f8fafc;
            padding: 12px 16px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .data-table td {
            padding: 12px 16px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .data-table tr:hover {
            background: #f8fafc;
        }
        
        .badge {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-info { background: #dbeafe; color: #1e40af; }
        
        .btn {
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 500;
            transition: all 0.2s;
            cursor: pointer;
        }
        
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-success { background: var(--success); color: white; }
        .btn-danger { background: var(--danger); color: white; }
        .btn-outline { border: 1px solid #d1d5db; background: white; }
        .btn-outline:hover { background: #f3f4f6; }
        
        .card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .card-header {
            padding: 16px 20px;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 600;
        }
        
        .card-body {
            padding: 20px;
        }
        
        .tab-btn {
            padding: 10px 20px;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .tab-btn:hover {
            color: var(--primary);
        }
        
        .tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
        }
        
        .submenu {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }
        
        .submenu.open {
            max-height: 500px;
        }
        
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 40px;
        }
        
        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e2e8f0;
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .modal {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s;
        }
        
        .modal.active {
            opacity: 1;
            visibility: visible;
        }
        
        .modal-content {
            background: white;
            border-radius: 12px;
            max-width: 600px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            transform: scale(0.9);
            transition: transform 0.3s;
        }
        
        .modal.active .modal-content {
            transform: scale(1);
        }
    </style>
</head>
<body>
    <!-- 侧边栏 -->
    <aside id="sidebar" class="sidebar fixed left-0 top-0 h-full z-50 flex flex-col">
        <!-- Logo -->
        <div class="p-4 border-b border-slate-700">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                    <i class="fas fa-dice text-white text-lg"></i>
                </div>
                <div class="sidebar-text">
                    <h1 class="text-white font-bold">Di Hao</h1>
                    <p class="text-slate-400 text-xs">后台管理系统</p>
                </div>
            </div>
        </div>
        
        <!-- 导航菜单 -->
        <nav class="flex-1 overflow-y-auto py-4">
            <ul class="space-y-1 px-3">
                <!-- 仪表盘 -->
                <li>
                    <a href="#dashboard" data-page="dashboard" 
                       class="sidebar-menu-item active flex items-center px-4 py-3 text-white rounded-lg">
                        <i class="fas fa-chart-pie w-5 text-center"></i>
                        <span class="sidebar-text ml-3">1.0 DASHBOARD</span>
                    </a>
                </li>
                
                <!-- 玩家控端 -->
                <li>
                    <div class="sidebar-menu-item flex items-center justify-between px-4 py-3 text-slate-300 rounded-lg cursor-pointer"
                         onclick="toggleSubmenu(this)">
                        <div class="flex items-center">
                            <i class="fas fa-users w-5 text-center"></i>
                            <span class="sidebar-text ml-3">2.0 玩家控端</span>
                        </div>
                        <i class="fas fa-chevron-down sidebar-text text-xs transition-transform"></i>
                    </div>
                    <ul class="submenu pl-8 space-y-1 mt-1">
                        <li><a href="#players" data-page="players" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">2.1 玩家讯息</a></li>
                        <li><a href="#players-online" data-page="players-online" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">2.2 玩家在线</a></li>
                        <li><a href="#players-stats" data-page="players-stats" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">2.3 玩家统计</a></li>
                    </ul>
                </li>
                
                <!-- 层级控端 -->
                <li>
                    <div class="sidebar-menu-item flex items-center justify-between px-4 py-3 text-slate-300 rounded-lg cursor-pointer"
                         onclick="toggleSubmenu(this)">
                        <div class="flex items-center">
                            <i class="fas fa-sitemap w-5 text-center"></i>
                            <span class="sidebar-text ml-3">3.0 层级控端</span>
                        </div>
                        <i class="fas fa-chevron-down sidebar-text text-xs transition-transform"></i>
                    </div>
                    <ul class="submenu pl-8 space-y-1 mt-1">
                        <li><a href="#agents" data-page="agents" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">3.1 代理管理</a></li>
                        <li><a href="#agents-tree" data-page="agents-tree" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">3.2 层级结构</a></li>
                    </ul>
                </li>
                
                <!-- 财务控端 -->
                <li>
                    <div class="sidebar-menu-item flex items-center justify-between px-4 py-3 text-slate-300 rounded-lg cursor-pointer"
                         onclick="toggleSubmenu(this)">
                        <div class="flex items-center">
                            <i class="fas fa-wallet w-5 text-center"></i>
                            <span class="sidebar-text ml-3">4.0 财务控端</span>
                        </div>
                        <i class="fas fa-chevron-down sidebar-text text-xs transition-transform"></i>
                    </div>
                    <ul class="submenu pl-8 space-y-1 mt-1">
                        <li><a href="#finance-transactions" data-page="finance-transactions" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">4.1 账户明细</a></li>
                        <li><a href="#finance-deposits" data-page="finance-deposits" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">4.2 存款申请</a></li>
                        <li><a href="#finance-withdrawals" data-page="finance-withdrawals" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">4.3 取款申请</a></li>
                    </ul>
                </li>
                
                <!-- 注单控端 -->
                <li>
                    <div class="sidebar-menu-item flex items-center justify-between px-4 py-3 text-slate-300 rounded-lg cursor-pointer"
                         onclick="toggleSubmenu(this)">
                        <div class="flex items-center">
                            <i class="fas fa-receipt w-5 text-center"></i>
                            <span class="sidebar-text ml-3">5.0 注单控端</span>
                        </div>
                        <i class="fas fa-chevron-down sidebar-text text-xs transition-transform"></i>
                    </div>
                    <ul class="submenu pl-8 space-y-1 mt-1">
                        <li><a href="#bets" data-page="bets" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">5.1 注单列表</a></li>
                        <li><a href="#bets-results" data-page="bets-results" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">5.2 开奖结果</a></li>
                    </ul>
                </li>
                
                <!-- 红利控端 -->
                <li>
                    <div class="sidebar-menu-item flex items-center justify-between px-4 py-3 text-slate-300 rounded-lg cursor-pointer"
                         onclick="toggleSubmenu(this)">
                        <div class="flex items-center">
                            <i class="fas fa-gift w-5 text-center"></i>
                            <span class="sidebar-text ml-3">6.0 红利控端</span>
                        </div>
                        <i class="fas fa-chevron-down sidebar-text text-xs transition-transform"></i>
                    </div>
                    <ul class="submenu pl-8 space-y-1 mt-1">
                        <li><a href="#commission-schemes" data-page="commission-schemes" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">6.1 洗码方案</a></li>
                        <li><a href="#commission-records" data-page="commission-records" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">6.2 洗码记录</a></li>
                    </ul>
                </li>
                
                <!-- 风险控端 -->
                <li>
                    <div class="sidebar-menu-item flex items-center justify-between px-4 py-3 text-slate-300 rounded-lg cursor-pointer"
                         onclick="toggleSubmenu(this)">
                        <div class="flex items-center">
                            <i class="fas fa-shield-alt w-5 text-center"></i>
                            <span class="sidebar-text ml-3">7.0 风险控端</span>
                        </div>
                        <i class="fas fa-chevron-down sidebar-text text-xs transition-transform"></i>
                    </div>
                    <ul class="submenu pl-8 space-y-1 mt-1">
                        <li><a href="#risk-alerts" data-page="risk-alerts" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">7.1 风控预警</a></li>
                    </ul>
                </li>
                
                <!-- 报表中心 -->
                <li>
                    <div class="sidebar-menu-item flex items-center justify-between px-4 py-3 text-slate-300 rounded-lg cursor-pointer"
                         onclick="toggleSubmenu(this)">
                        <div class="flex items-center">
                            <i class="fas fa-chart-bar w-5 text-center"></i>
                            <span class="sidebar-text ml-3">8.0 报表控端</span>
                        </div>
                        <i class="fas fa-chevron-down sidebar-text text-xs transition-transform"></i>
                    </div>
                    <ul class="submenu pl-8 space-y-1 mt-1">
                        <li><a href="#reports-settlement" data-page="reports-settlement" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">8.1 结算报表</a></li>
                        <li><a href="#reports-ranking" data-page="reports-ranking" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">8.2 盈亏排行</a></li>
                    </ul>
                </li>
                
                <!-- 内容控端 -->
                <li>
                    <a href="#announcements" data-page="announcements" 
                       class="sidebar-menu-item flex items-center px-4 py-3 text-slate-300 rounded-lg">
                        <i class="fas fa-bullhorn w-5 text-center"></i>
                        <span class="sidebar-text ml-3">9.0 内容控端</span>
                    </a>
                </li>
                
                <!-- 系统控端 -->
                <li>
                    <div class="sidebar-menu-item flex items-center justify-between px-4 py-3 text-slate-300 rounded-lg cursor-pointer"
                         onclick="toggleSubmenu(this)">
                        <div class="flex items-center">
                            <i class="fas fa-cog w-5 text-center"></i>
                            <span class="sidebar-text ml-3">10.0 系统控端</span>
                        </div>
                        <i class="fas fa-chevron-down sidebar-text text-xs transition-transform"></i>
                    </div>
                    <ul class="submenu pl-8 space-y-1 mt-1">
                        <li><a href="#system-admins" data-page="system-admins" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">10.1 账号管理</a></li>
                        <li><a href="#system-logs" data-page="system-logs" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">10.2 操作日志</a></li>
                    </ul>
                </li>
                
                <!-- 现场运营 -->
                <li>
                    <div class="sidebar-menu-item flex items-center justify-between px-4 py-3 text-slate-300 rounded-lg cursor-pointer"
                         onclick="toggleSubmenu(this)">
                        <div class="flex items-center">
                            <i class="fas fa-video w-5 text-center"></i>
                            <span class="sidebar-text ml-3">11.0 现场运营</span>
                            <span class="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded">NEW</span>
                        </div>
                        <i class="fas fa-chevron-down sidebar-text text-xs transition-transform"></i>
                    </div>
                    <ul class="submenu pl-8 space-y-1 mt-1">
                        <li><a href="#studio-dealers" data-page="studio-dealers" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">11.1 荷官档案</a></li>
                        <li><a href="#studio-tables" data-page="studio-tables" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">11.2 桌台管理</a></li>
                        <li><a href="#studio-shifts" data-page="studio-shifts" class="block px-4 py-2 text-slate-400 hover:text-white text-sm">11.3 智能排班</a></li>
                    </ul>
                </li>
            </ul>
        </nav>
    </aside>
    
    <!-- 主内容区 -->
    <div class="main-content min-h-screen">
        <!-- 顶栏 -->
        <header class="bg-white shadow-sm sticky top-0 z-40">
            <div class="flex items-center justify-between px-6 py-3">
                <div class="flex items-center space-x-4">
                    <button onclick="toggleSidebar()" class="p-2 hover:bg-gray-100 rounded-lg">
                        <i class="fas fa-bars text-gray-600"></i>
                    </button>
                    <nav class="flex items-center space-x-2 text-sm">
                        <span class="text-gray-400">首页</span>
                        <span class="text-gray-400">/</span>
                        <span id="breadcrumb" class="text-gray-700 font-medium">DASHBOARD</span>
                    </nav>
                </div>
                
                <div class="flex items-center space-x-4">
                    <!-- 快捷操作 -->
                    <button class="p-2 hover:bg-gray-100 rounded-lg relative" title="客服">
                        <i class="fas fa-headset text-gray-600"></i>
                    </button>
                    <button class="p-2 hover:bg-gray-100 rounded-lg relative" title="上分">
                        <i class="fas fa-plus-circle text-green-500"></i>
                        <span class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">0</span>
                    </button>
                    <button class="p-2 hover:bg-gray-100 rounded-lg relative" title="下分">
                        <i class="fas fa-minus-circle text-orange-500"></i>
                        <span class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">0</span>
                    </button>
                    <button class="p-2 hover:bg-gray-100 rounded-lg relative" title="游戏">
                        <i class="fas fa-gamepad text-purple-500"></i>
                    </button>
                    
                    <!-- 语言 -->
                    <div class="flex items-center space-x-2 px-3 py-1 border rounded-lg">
                        <img src="https://flagcdn.com/w20/cn.png" class="w-5 h-4" alt="CN">
                        <span class="text-sm">中文简体</span>
                    </div>
                    
                    <!-- 用户信息 -->
                    <div class="flex items-center space-x-3 pl-4 border-l">
                        <div class="w-9 h-9 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <i class="fas fa-user text-white text-sm"></i>
                        </div>
                        <div>
                            <p id="currentUser" class="text-sm font-medium text-gray-700">Admin</p>
                            <p class="text-xs text-gray-500">超级管理员</p>
                        </div>
                        <button onclick="logout()" class="p-2 hover:bg-gray-100 rounded-lg" title="退出">
                            <i class="fas fa-sign-out-alt text-gray-400"></i>
                        </button>
                    </div>
                </div>
            </div>
        </header>
        
        <!-- 页面内容 -->
        <main id="pageContent" class="p-6">
            <!-- 动态内容区 -->
        </main>
    </div>
    
    <!-- 模态框 -->
    <div id="modal" class="modal">
        <div class="modal-content">
            <div id="modalContent"></div>
        </div>
    </div>
    
    <script src="/static/app.js"></script>
</body>
</html>`
}

export default app
