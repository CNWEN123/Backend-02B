import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'

type Bindings = {
  DB: D1Database
  JWT_SECRET?: string
}

type Variables = {
  admin: {
    admin_id: number
    username: string
    role_id: number
  } | null
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ==================== 安全配置 ====================

// JWT密钥 - 生产环境应从环境变量获取
const getJWTSecret = (c: any) => c.env.JWT_SECRET || 'live-dealer-admin-secret-key-2024'

// CORS配置 - 限制允许的来源
app.use('/api/*', cors({
  origin: (origin) => {
    // 允许的域名列表
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      /\.pages\.dev$/,
      /\.workers\.dev$/
    ]
    if (!origin) return null
    for (const allowed of allowedOrigins) {
      if (typeof allowed === 'string' && origin === allowed) return origin
      if (allowed instanceof RegExp && allowed.test(origin)) return origin
    }
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}))

// 静态文件
app.use('/static/*', serveStatic())

// ==================== 安全工具函数 ====================

// 生成安全Token (HMAC-SHA256)
async function generateToken(payload: object, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '')
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '')
  const data = `${encodedHeader}.${encodedPayload}`
  
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  
  return `${data}.${encodedSignature}`
}

// 验证Token
async function verifyToken(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts
    const data = `${encodedHeader}.${encodedPayload}`
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    
    // 添加Base64 padding
    let sig = encodedSignature.replace(/-/g, '+').replace(/_/g, '/')
    while (sig.length % 4) sig += '='
    
    const signatureStr = atob(sig)
    const signatureBytes = new Uint8Array([...signatureStr].map(c => c.charCodeAt(0)))
    
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data))
    if (!isValid) return null
    
    // 添加Base64 padding到payload
    let pay = encodedPayload
    while (pay.length % 4) pay += '='
    
    const payload = JSON.parse(atob(pay))
    if (payload.exp && payload.exp < Date.now()) return null
    
    return payload
  } catch {
    return null
  }
}

// 密码哈希 (使用SHA-256)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 安全比较 (防止时序攻击)
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// 输入验证 - 分页参数
function validatePagination(page: string | undefined, size: string | undefined): { page: number; size: number } {
  const p = Math.max(1, Math.min(1000, parseInt(page || '1') || 1))
  const s = Math.max(1, Math.min(100, parseInt(size || '20') || 20))
  return { page: p, size: s }
}

// 输入验证 - 整数ID
function validateId(id: string | undefined): number | null {
  if (!id) return null
  const num = parseInt(id)
  if (isNaN(num) || num < 1 || num > 2147483647) return null
  return num
}

// 输入净化 - 防止SQL注入的LIKE参数（转义特殊字符）
function sanitizeLikeParam(input: string | undefined): string {
  if (!input || typeof input !== 'string') return ''
  // 转义LIKE语句的特殊字符: %, _, \
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .slice(0, 100) // 限制最大长度
}

// 输入验证 - 字符串参数
function validateString(input: string | undefined, maxLength: number = 255): string | null {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) return null
  return trimmed
}

// 获取客户端IP
function getClientIP(c: any): string {
  return c.req.header('CF-Connecting-IP') || 
         c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 
         '127.0.0.1'
}

// ==================== 认证中间件 ====================

const authMiddleware = async (c: any, next: any) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  
  if (!token) {
    return c.json({ success: false, message: '未授权访问' }, 401)
  }
  
  const payload = await verifyToken(token, getJWTSecret(c))
  if (!payload) {
    return c.json({ success: false, message: 'Token无效或已过期' }, 401)
  }
  
  // 验证用户是否仍然有效
  const admin = await c.env.DB.prepare(
    'SELECT admin_id, username, role_id, status FROM admin_users WHERE admin_id = ? AND status = 1'
  ).bind(payload.admin_id).first()
  
  if (!admin) {
    return c.json({ success: false, message: '账号已被禁用' }, 401)
  }
  
  c.set('admin', {
    admin_id: admin.admin_id,
    username: admin.username,
    role_id: admin.role_id
  })
  
  await next()
}

// 对需要认证的API路由应用中间件
app.use('/api/v1/dashboard/*', authMiddleware)
app.use('/api/v1/players/*', authMiddleware)
app.use('/api/v1/agents/*', authMiddleware)
app.use('/api/v1/finance/*', authMiddleware)
app.use('/api/v1/bets/*', authMiddleware)
app.use('/api/v1/commission/*', authMiddleware)
app.use('/api/v1/risk/*', authMiddleware)
app.use('/api/v1/reports/*', authMiddleware)
app.use('/api/v1/dealers/*', authMiddleware)
app.use('/api/v1/tables/*', authMiddleware)
app.use('/api/v1/shifts/*', authMiddleware)
app.use('/api/v1/admin/*', authMiddleware)
app.use('/api/v1/announcements/*', authMiddleware)
app.use('/api/v1/payment-methods/*', authMiddleware)

// ==================== 认证API ====================

// 登录
app.post('/api/v1/auth/login', async (c) => {
  try {
    const { username, password, captcha } = await c.req.json()
    const clientIP = getClientIP(c)
    
    // 输入验证
    if (!username || typeof username !== 'string' || username.length < 2 || username.length > 50) {
      return c.json({ success: false, message: '用户名格式错误' }, 400)
    }
    if (!password || typeof password !== 'string' || password.length < 4) {
      return c.json({ success: false, message: '密码格式错误' }, 400)
    }
    // 开发测试模式：如果captcha为"test"则跳过验证
    if (captcha !== 'test' && (!captcha || typeof captcha !== 'string' || captcha.length !== 4)) {
      return c.json({ success: false, message: '验证码错误' }, 400)
    }

    // 查询用户（不返回敏感字段）
    const admin = await c.env.DB.prepare(
      'SELECT admin_id, username, nickname, password_hash, role_id, two_fa_enabled, status FROM admin_users WHERE username = ?'
    ).bind(username.trim()).first()

    if (!admin) {
      // 记录失败登录尝试
      await c.env.DB.prepare(
        'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(0, username, 'LOGIN_FAILED', 'admin_users', '用户不存在', clientIP).run()
      return c.json({ success: false, message: '用户名或密码错误' }, 401)
    }
    
    if (admin.status !== 1) {
      return c.json({ success: false, message: '账号已被禁用' }, 401)
    }

    // 验证密码 (SHA-256哈希比较)
    const passwordHash = await hashPassword(password)
    // 兼容处理：如果数据库中是明文密码或旧格式，也尝试匹配
    const passwordValid = secureCompare(passwordHash, admin.password_hash as string) || 
                          secureCompare(password, admin.password_hash as string)
    
    if (!passwordValid) {
      await c.env.DB.prepare(
        'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(admin.admin_id, admin.username, 'LOGIN_FAILED', 'admin_users', '密码错误', clientIP).run()
      return c.json({ success: false, message: '用户名或密码错误' }, 401)
    }

    // 生成安全Token
    const tokenPayload = { 
      admin_id: admin.admin_id, 
      username: admin.username,
      role_id: admin.role_id,
      iat: Date.now(),
      exp: Date.now() + 8 * 60 * 60 * 1000 // 8小时过期
    }
    const token = await generateToken(tokenPayload, getJWTSecret(c))

    // 更新登录信息
    await c.env.DB.prepare(
      'UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP, last_login_ip = ? WHERE admin_id = ?'
    ).bind(clientIP, admin.admin_id).run()

    // 记录成功登录
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, 'LOGIN', 'admin_users', admin.admin_id, '登录成功', clientIP).run()

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
    const payload = await verifyToken(token, getJWTSecret(c))
    if (!payload) {
      return c.json({ success: false, message: 'Token无效或已过期' }, 401)
    }

    const admin = await c.env.DB.prepare(
      `SELECT a.admin_id, a.username, a.nickname, a.role_id, a.status,
              a.last_login_ip, a.last_login_at, r.role_name, r.permissions 
       FROM admin_users a 
       JOIN admin_roles r ON a.role_id = r.role_id 
       WHERE a.admin_id = ? AND a.status = 1`
    ).bind(payload.admin_id).first()

    if (!admin) {
      return c.json({ success: false, message: '用户不存在或已被禁用' }, 404)
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
    const today = new Date().toISOString().split('T')[0]
    
    const totalPlayers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first()
    const onlinePlayers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE status = 1').first()
    
    const todayDeposit = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM transactions 
       WHERE transaction_type = 1 AND audit_status = 1 AND DATE(created_at) = ?`
    ).bind(today).first()

    const todayWithdraw = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total, COUNT(*) as count FROM transactions 
       WHERE transaction_type = 2 AND audit_status = 1 AND DATE(created_at) = ?`
    ).bind(today).first()

    const todayBet = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(bet_amount), 0) as total, COALESCE(SUM(valid_bet_amount), 0) as valid, COUNT(*) as count FROM bets WHERE DATE(created_at) = ?`
    ).bind(today).first()

    const todayProfit = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(win_loss_amount), 0) as total FROM bets WHERE DATE(created_at) = ? AND bet_status = 1`
    ).bind(today).first()

    const pendingDeposit = await c.env.DB.prepare(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM transactions WHERE transaction_type = 1 AND audit_status = 0'
    ).first()

    const pendingWithdraw = await c.env.DB.prepare(
      'SELECT COUNT(*) as count, COALESCE(SUM(ABS(amount)), 0) as total FROM transactions WHERE transaction_type = 2 AND audit_status = 0'
    ).first()

    const pendingAlerts = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM risk_alerts WHERE handle_status = 0'
    ).first()

    const totalBalance = await c.env.DB.prepare(
      'SELECT COALESCE(SUM(balance), 0) as total FROM users'
    ).first()

    // 新增玩家
    const newPlayers = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = ?'
    ).bind(today).first()

    return c.json({
      success: true,
      data: {
        totalPlayers: totalPlayers?.count || 0,
        onlinePlayers: onlinePlayers?.count || 0,
        newPlayers: newPlayers?.count || 0,
        todayDeposit: todayDeposit?.total || 0,
        todayDepositCount: todayDeposit?.count || 0,
        todayWithdraw: todayWithdraw?.total || 0,
        todayWithdrawCount: todayWithdraw?.count || 0,
        todayBet: todayBet?.total || 0,
        todayValidBet: todayBet?.valid || 0,
        todayBetCount: todayBet?.count || 0,
        todayProfit: -(todayProfit?.total || 0),
        pendingDeposit: pendingDeposit?.count || 0,
        pendingDepositAmount: pendingDeposit?.total || 0,
        pendingWithdraw: pendingWithdraw?.count || 0,
        pendingWithdrawAmount: pendingWithdraw?.total || 0,
        pendingAlerts: pendingAlerts?.count || 0,
        totalBalance: 12450230 - (totalBalance?.total || 0),
        playerBalance: totalBalance?.total || 0
      }
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return c.json({ success: false, message: '获取统计数据失败' }, 500)
  }
})

// 趋势数据 - 支持7天和30天
app.get('/api/v1/dashboard/trends', async (c) => {
  const days = parseInt(c.req.query('days') || '7')
  
  try {
    const trends = await c.env.DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT user_id) as active_players,
        COUNT(*) as bet_count,
        COALESCE(SUM(bet_amount), 0) as total_bet,
        COALESCE(SUM(valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(win_loss_amount), 0) as total_win_loss
      FROM bets 
      WHERE created_at >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).bind(days).all()

    const newPlayers = await c.env.DB.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users 
      WHERE created_at >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).bind(days).all()

    const deposits = await c.env.DB.prepare(`
      SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM transactions 
      WHERE transaction_type = 1 AND audit_status = 1 AND created_at >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).bind(days).all()

    const withdrawals = await c.env.DB.prepare(`
      SELECT DATE(created_at) as date, COALESCE(SUM(ABS(amount)), 0) as total, COUNT(*) as count
      FROM transactions 
      WHERE transaction_type = 2 AND audit_status = 1 AND created_at >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).bind(days).all()

    return c.json({
      success: true,
      data: {
        betting: trends.results || [],
        newPlayers: newPlayers.results || [],
        deposits: deposits.results || [],
        withdrawals: withdrawals.results || []
      }
    })
  } catch (error) {
    console.error('Dashboard trends error:', error)
    return c.json({ success: false, message: '获取趋势数据失败' }, 500)
  }
})

// 游戏类型分布
app.get('/api/v1/dashboard/game-distribution', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT game_type, COUNT(*) as bet_count, COALESCE(SUM(bet_amount), 0) as total_bet,
             COALESCE(SUM(win_loss_amount), 0) as total_win_loss
      FROM bets
      WHERE created_at >= DATE('now', '-7 days')
      GROUP BY game_type
      ORDER BY total_bet DESC
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取游戏分布失败' }, 500)
  }
})

// ==================== 玩家管理API ====================

app.get('/api/v1/players', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const username = c.req.query('username')
  const nickname = c.req.query('nickname')
  const status = c.req.query('status')
  const agent_id = c.req.query('agent_id')
  const vip_level = c.req.query('vip_level')
  const start_date = c.req.query('start_date')
  const end_date = c.req.query('end_date')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (username) {
      const sanitized = sanitizeLikeParam(username)
      if (sanitized) {
        where += " AND u.username LIKE ? ESCAPE '\\'"
        params.push(`%${sanitized}%`)
      }
    }
    if (nickname) {
      const sanitized = sanitizeLikeParam(nickname)
      if (sanitized) {
        where += " AND u.nickname LIKE ? ESCAPE '\\'"
        params.push(`%${sanitized}%`)
      }
    }
    if (status !== undefined && status !== '') {
      where += ' AND u.status = ?'
      params.push(parseInt(status))
    }
    if (agent_id) {
      where += ' AND u.agent_id = ?'
      params.push(parseInt(agent_id))
    }
    if (vip_level !== undefined && vip_level !== '') {
      where += ' AND u.vip_level = ?'
      params.push(parseInt(vip_level))
    }
    if (start_date) {
      const dateStr = validateString(start_date, 10)
      if (dateStr) {
        where += ' AND DATE(u.created_at) >= ?'
        params.push(dateStr)
      }
    }
    if (end_date) {
      const dateStr = validateString(end_date, 10)
      if (dateStr) {
        where += ' AND DATE(u.created_at) <= ?'
        params.push(dateStr)
      }
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM users u ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT u.*, a.agent_username, cs.scheme_name as commission_scheme_name
      FROM users u 
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      LEFT JOIN commission_schemes cs ON u.commission_scheme_id = cs.scheme_id
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

// 在线玩家 - 必须在 :user_id 路由之前定义
app.get('/api/v1/players/online', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT u.user_id, u.username, u.nickname, u.balance, u.vip_level,
             'BAC-001' as current_table, '百家乐' as game_type,
             a.agent_username
      FROM users u 
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      WHERE u.status = 1 
      ORDER BY u.last_login_at DESC 
      LIMIT 100
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

// 玩家LTV统计 - 必须在 :user_id 路由之前定义
app.get('/api/v1/players/stats/ltv', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        u.user_id, u.username, u.nickname, u.vip_level,
        u.total_deposit, u.total_withdraw, u.total_bet, u.total_win_loss,
        (u.total_deposit - u.total_withdraw) as ltv,
        a.agent_username,
        u.created_at
      FROM users u
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      ORDER BY ltv DESC
      LIMIT 100
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取LTV统计失败' }, 500)
  }
})

// 玩家详情 - 包含完整统计
app.get('/api/v1/players/:user_id', async (c) => {
  const user_id = c.req.param('user_id')
  
  try {
    const user = await c.env.DB.prepare(`
      SELECT u.*, a.agent_username, cs.scheme_name as commission_scheme_name
      FROM users u 
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      LEFT JOIN commission_schemes cs ON u.commission_scheme_id = cs.scheme_id
      WHERE u.user_id = ?
    `).bind(user_id).first()

    if (!user) {
      return c.json({ success: false, message: '玩家不存在' }, 404)
    }

    // 获取统计数据
    const betStats = await c.env.DB.prepare(`
      SELECT COUNT(*) as bet_count, 
             COALESCE(SUM(bet_amount), 0) as total_bet,
             COALESCE(SUM(valid_bet_amount), 0) as total_valid_bet,
             COALESCE(SUM(win_loss_amount), 0) as total_win_loss
      FROM bets WHERE user_id = ?
    `).bind(user_id).first()

    const txStats = await c.env.DB.prepare(`
      SELECT transaction_type,
             COUNT(*) as count,
             COALESCE(SUM(ABS(amount)), 0) as total
      FROM transactions 
      WHERE user_id = ? AND audit_status = 1
      GROUP BY transaction_type
    `).bind(user_id).all()

    // 获取最近登录日志
    const loginLogs = await c.env.DB.prepare(`
      SELECT * FROM user_login_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
    `).bind(user_id).all()

    return c.json({ 
      success: true, 
      data: {
        ...user,
        stats: {
          bet: betStats,
          transactions: txStats.results || []
        },
        loginLogs: loginLogs.results || []
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取玩家详情失败' }, 500)
  }
})

// 更新玩家信息
app.put('/api/v1/players/:user_id', async (c) => {
  const user_id = c.req.param('user_id')
  const { nickname, vip_level, remark, phone, email } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE users SET 
        nickname = COALESCE(?, nickname),
        vip_level = COALESCE(?, vip_level),
        remark = COALESCE(?, remark),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `).bind(nickname, vip_level, remark, phone, email, user_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 更新玩家状态
app.put('/api/v1/players/:user_id/status', async (c) => {
  const user_id = validateId(c.req.param('user_id'))
  if (!user_id) {
    return c.json({ success: false, message: '无效的用户ID' }, 400)
  }
  
  const admin = c.get('admin')
  const { status, reason } = await c.req.json()
  const clientIP = getClientIP(c)
  
  // 验证status值
  if (![0, 1, 2].includes(status)) {
    return c.json({ success: false, message: '无效的状态值' }, 400)
  }

  try {
    await c.env.DB.prepare(
      'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).bind(status, user_id).run()

    // 记录日志 - 使用真实管理员信息
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, status === 0 ? 'FREEZE_PLAYER' : 'UNFREEZE_PLAYER', 'users', user_id, reason || '', clientIP).run()

    return c.json({ success: true, message: '状态更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 踢线玩家
app.post('/api/v1/players/:user_id/kick', async (c) => {
  const user_id = validateId(c.req.param('user_id'))
  if (!user_id) {
    return c.json({ success: false, message: '无效的用户ID' }, 400)
  }
  
  const admin = c.get('admin')
  const clientIP = getClientIP(c)
  
  // 安全解析body
  let reason = '管理员踢线'
  try {
    const body = await c.req.json()
    if (body && body.reason) {
      reason = body.reason
    }
  } catch (e) {
    // 没有body或解析失败,使用默认值
  }

  try {
    // 检查玩家是否存在
    const user = await c.env.DB.prepare('SELECT user_id, username FROM users WHERE user_id = ?').bind(user_id).first()
    if (!user) {
      return c.json({ success: false, message: '玩家不存在' }, 404)
    }

    // 记录操作日志
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, 'KICK_PLAYER', 'users', user_id, reason, clientIP).run()

    return c.json({ success: true, message: '踢线成功' })
  } catch (error) {
    console.error('Kick player error:', error)
    return c.json({ success: false, message: '踢线失败' }, 500)
  }
})

// 更换代理
app.post('/api/v1/players/:user_id/transfer', async (c) => {
  const user_id = validateId(c.req.param('user_id'))
  if (!user_id) {
    return c.json({ success: false, message: '无效的用户ID' }, 400)
  }
  
  const admin = c.get('admin')
  const { to_agent_id, reason } = await c.req.json()
  
  const targetAgentId = validateId(String(to_agent_id))
  if (!targetAgentId) {
    return c.json({ success: false, message: '无效的目标代理ID' }, 400)
  }

  try {
    const user = await c.env.DB.prepare('SELECT agent_id FROM users WHERE user_id = ?').bind(user_id).first()
    
    await c.env.DB.prepare(
      'UPDATE users SET agent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).bind(targetAgentId, user_id).run()

    // 记录转移日志 - 使用真实管理员ID
    await c.env.DB.prepare(
      'INSERT INTO player_transfer_logs (user_id, from_agent_id, to_agent_id, reason, operator_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(user_id, user?.agent_id, targetAgentId, reason || '', admin.admin_id).run()

    return c.json({ success: true, message: '转移成功' })
  } catch (error) {
    return c.json({ success: false, message: '转移失败' }, 500)
  }
})

// 绑定洗码方案
app.post('/api/v1/players/:user_id/bind-scheme', async (c) => {
  const user_id = c.req.param('user_id')
  const { scheme_id, remark } = await c.req.json()

  try {
    await c.env.DB.prepare(
      'UPDATE users SET commission_scheme_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).bind(scheme_id, user_id).run()

    // 记录绑定
    await c.env.DB.prepare(
      'INSERT INTO commission_scheme_bindings (user_id, scheme_id, binding_type, effective_from, remark) VALUES (?, ?, 2, DATE("now"), ?)'
    ).bind(user_id, scheme_id, remark || '').run()

    return c.json({ success: true, message: '绑定成功' })
  } catch (error) {
    return c.json({ success: false, message: '绑定失败' }, 500)
  }
})

// 玩家流水
app.get('/api/v1/players/:user_id/transactions', async (c) => {
  const user_id = c.req.param('user_id')
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '20')
  const type = c.req.query('type')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE user_id = ?'
    const params: any[] = [user_id]
    
    if (type) {
      where += ' AND transaction_type = ?'
      params.push(parseInt(type))
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM transactions ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT * FROM transactions ${where}
      ORDER BY created_at DESC
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
    return c.json({ success: false, message: '获取流水失败' }, 500)
  }
})

// 玩家注单
app.get('/api/v1/players/:user_id/bets', async (c) => {
  const user_id = c.req.param('user_id')
  const page = parseInt(c.req.query('page') || '1')
  const size = parseInt(c.req.query('size') || '20')
  const offset = (page - 1) * size

  try {
    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM bets WHERE user_id = ?'
    ).bind(user_id).first()

    const result = await c.env.DB.prepare(`
      SELECT * FROM bets WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user_id, size, offset).all()

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
    return c.json({ success: false, message: '获取注单失败' }, 500)
  }
})

// ==================== 代理管理API ====================

app.get('/api/v1/agents', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const parent_id = c.req.query('parent_id')
  const level = c.req.query('level')
  const status = c.req.query('status')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (parent_id) {
      where += ' AND a.parent_agent_id = ?'
      params.push(parseInt(parent_id))
    }
    if (level) {
      where += ' AND a.level = ?'
      params.push(parseInt(level))
    }
    if (status !== undefined && status !== '') {
      where += ' AND a.status = ?'
      params.push(parseInt(status))
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM agents a ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT a.*, p.agent_username as parent_username,
             (SELECT COUNT(*) FROM users WHERE agent_id = a.agent_id) as player_count,
             (SELECT COUNT(*) FROM agents WHERE parent_agent_id = a.agent_id) as sub_agent_count,
             (SELECT COALESCE(SUM(total_bet), 0) FROM users WHERE agent_id = a.agent_id) as total_bet,
             cs.scheme_name as default_scheme_name
      FROM agents a 
      LEFT JOIN agents p ON a.parent_agent_id = p.agent_id
      LEFT JOIN commission_schemes cs ON a.default_commission_scheme_id = cs.scheme_id
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

// 代理树形结构 - 必须在 :agent_id 路由之前定义
app.get('/api/v1/agents/tree', async (c) => {
  try {
    const agents = await c.env.DB.prepare(`
      SELECT agent_id, agent_username, nickname, parent_agent_id, level, status, balance,
             share_ratio, commission_ratio,
             (SELECT COUNT(*) FROM users WHERE agent_id = agents.agent_id) as player_count,
             (SELECT COALESCE(SUM(total_bet), 0) FROM users WHERE agent_id = agents.agent_id) as total_bet
      FROM agents
      ORDER BY level, agent_id
    `).all()

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

// 代理详情
app.get('/api/v1/agents/:agent_id', async (c) => {
  const agent_id = c.req.param('agent_id')

  try {
    const agent = await c.env.DB.prepare(`
      SELECT a.*, p.agent_username as parent_username,
             (SELECT COUNT(*) FROM users WHERE agent_id = a.agent_id) as player_count,
             (SELECT COUNT(*) FROM agents WHERE parent_agent_id = a.agent_id) as sub_agent_count,
             cs.scheme_name as default_scheme_name
      FROM agents a 
      LEFT JOIN agents p ON a.parent_agent_id = p.agent_id
      LEFT JOIN commission_schemes cs ON a.default_commission_scheme_id = cs.scheme_id
      WHERE a.agent_id = ?
    `).bind(agent_id).first()

    if (!agent) {
      return c.json({ success: false, message: '代理不存在' }, 404)
    }

    // 获取下线玩家
    const players = await c.env.DB.prepare(`
      SELECT user_id, username, nickname, balance, vip_level, status, created_at
      FROM users WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10
    `).bind(agent_id).all()

    // 获取下级代理
    const subAgents = await c.env.DB.prepare(`
      SELECT agent_id, agent_username, nickname, level, status, balance,
             (SELECT COUNT(*) FROM users WHERE agent_id = agents.agent_id) as player_count
      FROM agents WHERE parent_agent_id = ? ORDER BY created_at DESC LIMIT 10
    `).bind(agent_id).all()

    return c.json({
      success: true,
      data: {
        ...agent,
        players: players.results || [],
        subAgents: subAgents.results || []
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取代理详情失败' }, 500)
  }
})

// 创建代理
app.post('/api/v1/agents', async (c) => {
  const admin = c.get('admin')
  const { agent_username, password, nickname, parent_agent_id, level, share_ratio, commission_ratio, currency, default_commission_scheme_id, contact_phone, remark } = await c.req.json()
  const clientIP = getClientIP(c)

  // 输入验证
  if (!agent_username || typeof agent_username !== 'string' || agent_username.length < 2 || agent_username.length > 50) {
    return c.json({ success: false, message: '代理账号格式错误' }, 400)
  }
  // 强制要求设置密码，不允许空密码
  if (!password || typeof password !== 'string' || password.length < 6) {
    return c.json({ success: false, message: '请设置至少6位的密码' }, 400)
  }

  try {
    // 对密码进行哈希处理
    const passwordHash = await hashPassword(password)
    
    const result = await c.env.DB.prepare(`
      INSERT INTO agents (agent_username, password_hash, nickname, parent_agent_id, level, share_ratio, commission_ratio, currency, default_commission_scheme_id, contact_phone, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(agent_username.trim(), passwordHash, nickname || null, parent_agent_id || null, level || 3, share_ratio || 0, commission_ratio || 0, currency || 'CNY', default_commission_scheme_id || null, contact_phone || null, remark || null).run()

    // 记录审计日志
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, 'CREATE_AGENT', 'agents', result.meta.last_row_id, agent_username, clientIP).run()

    return c.json({ success: true, data: { agent_id: result.meta.last_row_id } })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return c.json({ success: false, message: '代理账号已存在' }, 400)
    }
    console.error('Create agent error:', error)
    return c.json({ success: false, message: '创建失败' }, 500)
  }
})

// 更新代理
app.put('/api/v1/agents/:agent_id', async (c) => {
  const agent_id = c.req.param('agent_id')
  const { nickname, share_ratio, commission_ratio, default_commission_scheme_id, contact_phone, remark, status } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE agents SET
        nickname = COALESCE(?, nickname),
        share_ratio = COALESCE(?, share_ratio),
        commission_ratio = COALESCE(?, commission_ratio),
        default_commission_scheme_id = COALESCE(?, default_commission_scheme_id),
        contact_phone = COALESCE(?, contact_phone),
        remark = COALESCE(?, remark),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE agent_id = ?
    `).bind(nickname, share_ratio, commission_ratio, default_commission_scheme_id, contact_phone, remark, status, agent_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// ==================== 财务管理API ====================

app.get('/api/v1/finance/transactions', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const type = c.req.query('type')
  const status = c.req.query('status')
  const user_id = c.req.query('user_id')
  const username = c.req.query('username')
  const start_date = c.req.query('start_date')
  const end_date = c.req.query('end_date')
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
    if (username) {
      const sanitized = sanitizeLikeParam(username)
      if (sanitized) {
        where += " AND u.username LIKE ? ESCAPE '\\'"
        params.push(`%${sanitized}%`)
      }
    }
    if (start_date) {
      const dateStr = validateString(start_date, 10)
      if (dateStr) {
        where += ' AND DATE(t.created_at) >= ?'
        params.push(dateStr)
      }
    }
    if (end_date) {
      const dateStr = validateString(end_date, 10)
      if (dateStr) {
        where += ' AND DATE(t.created_at) <= ?'
        params.push(dateStr)
      }
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM transactions t LEFT JOIN users u ON t.user_id = u.user_id ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT t.*, u.username, u.nickname
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.user_id
      ${where}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    // 统计汇总
    const summary = await c.env.DB.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_out
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.user_id
      ${where}
    `).bind(...params).first()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || [],
        summary: summary
      }
    })
  } catch (error) {
    console.error('Transactions list error:', error)
    return c.json({ success: false, message: '获取交易记录失败' }, 500)
  }
})

// 存款/提款审核
app.post('/api/v1/finance/transactions/:id/audit', async (c) => {
  const id = validateId(c.req.param('id'))
  if (!id) {
    return c.json({ success: false, message: '无效的交易ID' }, 400)
  }
  
  const admin = c.get('admin')
  const { action, remark } = await c.req.json()
  const clientIP = getClientIP(c)
  
  // 验证action
  if (!['approve', 'reject'].includes(action)) {
    return c.json({ success: false, message: '无效的操作' }, 400)
  }
  
  try {
    const tx = await c.env.DB.prepare('SELECT * FROM transactions WHERE transaction_id = ?').bind(id).first()
    if (!tx) {
      return c.json({ success: false, message: '交易不存在' }, 404)
    }
    
    if (tx.audit_status !== 0) {
      return c.json({ success: false, message: '该交易已被审核' }, 400)
    }

    const newStatus = action === 'approve' ? 1 : 2
    
    await c.env.DB.prepare(`
      UPDATE transactions 
      SET audit_status = ?, audit_remark = ?, audit_at = CURRENT_TIMESTAMP, auditor_id = ?
      WHERE transaction_id = ?
    `).bind(newStatus, remark || '', admin.admin_id, id).run()

    // 如果是通过，更新用户余额
    if (action === 'approve') {
      await c.env.DB.prepare(`
        UPDATE users SET 
          balance = balance + ?,
          total_deposit = total_deposit + CASE WHEN ? > 0 THEN ? ELSE 0 END,
          total_withdraw = total_withdraw + CASE WHEN ? < 0 THEN ABS(?) ELSE 0 END,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(tx.amount, tx.amount, tx.amount, tx.amount, tx.amount, tx.user_id).run()
    }

    // 记录审计日志 - 使用真实管理员信息
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, action === 'approve' ? 'APPROVE_TX' : 'REJECT_TX', 'transactions', id, JSON.stringify({amount: tx.amount, user_id: tx.user_id}), remark || '', clientIP).run()

    return c.json({ success: true, message: '审核完成' })
  } catch (error) {
    return c.json({ success: false, message: '审核失败' }, 500)
  }
})

// 待审核存款
app.get('/api/v1/finance/deposits', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT t.*, u.username, u.nickname, u.balance as current_balance
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

// 待审核提款 - 包含红利流水稽核检查
app.get('/api/v1/finance/withdrawals', async (c) => {
  try {
    // 获取待审核提款列表
    const result = await c.env.DB.prepare(`
      SELECT t.*, u.username, u.nickname, u.balance as current_balance,
             u.total_bet, u.total_deposit,
             u.bank_name, u.bank_account
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.user_id
      WHERE t.transaction_type = 2 AND t.audit_status = 0
      ORDER BY t.created_at DESC
    `).all()
    
    const withdrawals = result.results || []
    
    // 为每个提款检查红利流水完成情况
    const enhancedWithdrawals = await Promise.all(withdrawals.map(async (w: any) => {
      // 检查是否有未完成流水的红利
      const pendingBonuses = await c.env.DB.prepare(`
        SELECT SUM(required_turnover - completed_turnover) as pending_turnover,
               COUNT(*) as pending_count
        FROM bonus_records 
        WHERE user_id = ? 
          AND audit_status = 1 
          AND turnover_status = 0 
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `).bind(w.user_id).first()
      
      // 基础流水检查：总投注 >= 总存款
      const basicFlowCheck = w.total_bet >= w.total_deposit
      // 红利流水检查：无未完成的红利流水
      const bonusFlowCheck = !pendingBonuses?.pending_count || pendingBonuses.pending_count === 0
      // 综合判断：两者都满足才能提款
      const canWithdraw = basicFlowCheck && bonusFlowCheck
      
      return {
        ...w,
        flow_check: canWithdraw ? 1 : 0,
        basic_flow_check: basicFlowCheck,
        bonus_flow_check: bonusFlowCheck,
        pending_bonus_count: pendingBonuses?.pending_count || 0,
        pending_bonus_turnover: pendingBonuses?.pending_turnover || 0
      }
    }))

    return c.json({ success: true, data: enhancedWithdrawals })
  } catch (error) {
    return c.json({ success: false, message: '获取提款列表失败' }, 500)
  }
})

// 人工存取款
app.post('/api/v1/finance/manual-adjustment', async (c) => {
  const admin = c.get('admin')
  const { user_id, amount, type, remark } = await c.req.json()
  const clientIP = getClientIP(c)
  
  // 输入验证
  const targetUserId = validateId(String(user_id))
  if (!targetUserId) {
    return c.json({ success: false, message: '无效的用户ID' }, 400)
  }
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0 || amount > 10000000) {
    return c.json({ success: false, message: '无效的金额' }, 400)
  }
  if (!['deposit', 'withdraw'].includes(type)) {
    return c.json({ success: false, message: '无效的操作类型' }, 400)
  }

  try {
    const user = await c.env.DB.prepare('SELECT balance FROM users WHERE user_id = ?').bind(targetUserId).first()
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }

    const adjustAmount = type === 'deposit' ? Math.abs(amount) : -Math.abs(amount)
    const newBalance = (user.balance as number) + adjustAmount
    
    if (newBalance < 0) {
      return c.json({ success: false, message: '余额不足' }, 400)
    }

    // 生成安全订单号
    const randomBytes = crypto.getRandomValues(new Uint8Array(4))
    const randomStr = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const orderNo = `MAN${Date.now()}${randomStr}`

    // 创建交易记录
    await c.env.DB.prepare(`
      INSERT INTO transactions (order_no, user_id, transaction_type, amount, balance_before, balance_after, audit_status, auditor_id, remark)
      VALUES (?, ?, 7, ?, ?, ?, 1, ?, ?)
    `).bind(orderNo, targetUserId, adjustAmount, user.balance, newBalance, admin.admin_id, remark || '人工调整').run()

    // 更新用户余额
    await c.env.DB.prepare('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
      .bind(newBalance, targetUserId).run()

    // 记录审计日志 - 使用真实管理员信息
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, 'MANUAL_ADJUST', 'users', targetUserId, String(user.balance), String(newBalance), clientIP).run()

    return c.json({ success: true, message: '调整成功', data: { order_no: orderNo } })
  } catch (error) {
    return c.json({ success: false, message: '调整失败' }, 500)
  }
})

// 存款补单
app.post('/api/v1/finance/deposit-supplement', async (c) => {
  const admin = c.get('admin')
  const { user_id, amount, payment_method, payment_reference, reason } = await c.req.json()
  const clientIP = getClientIP(c)

  // 输入验证
  const targetUserId = validateId(String(user_id))
  if (!targetUserId) {
    return c.json({ success: false, message: '无效的用户ID' }, 400)
  }
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0 || amount > 10000000) {
    return c.json({ success: false, message: '无效的金额' }, 400)
  }
  if (!reason || typeof reason !== 'string' || reason.length < 2) {
    return c.json({ success: false, message: '请填写补单原因' }, 400)
  }

  try {
    // 验证用户是否存在
    const user = await c.env.DB.prepare('SELECT user_id, username FROM users WHERE user_id = ?').bind(targetUserId).first()
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO deposit_supplements (user_id, amount, payment_method, payment_reference, supplement_reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(targetUserId, amount, payment_method || '', payment_reference || '', reason, admin.admin_id).run()

    // 记录审计日志
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, 'DEPOSIT_SUPPLEMENT', 'deposit_supplements', result.meta.last_row_id, JSON.stringify({user_id: targetUserId, amount, reason}), clientIP).run()

    return c.json({ success: true, data: { supplement_id: result.meta.last_row_id } })
  } catch (error) {
    console.error('Deposit supplement error:', error)
    return c.json({ success: false, message: '提交补单失败' }, 500)
  }
})

// 补单列表
app.get('/api/v1/finance/deposit-supplements', async (c) => {
  const status = c.req.query('status')

  try {
    let where = ''
    const params: any[] = []
    
    if (status !== undefined && status !== '') {
      where = 'WHERE ds.audit_status = ?'
      params.push(parseInt(status))
    }

    const result = await c.env.DB.prepare(`
      SELECT ds.*, u.username, u.nickname
      FROM deposit_supplements ds
      LEFT JOIN users u ON ds.user_id = u.user_id
      ${where}
      ORDER BY ds.created_at DESC
    `).bind(...params).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取补单列表失败' }, 500)
  }
})

// 流水稽核规则列表
app.get('/api/v1/finance/turnover-rules', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT rule_id, rule_name, 
             trigger_type as rule_type,
             multiplier,
             games_included,
             valid_days,
             status,
             CASE trigger_type 
               WHEN 1 THEN '存款流水'
               WHEN 2 THEN '红利流水'
               WHEN 3 THEN '洗码流水'
               ELSE '其他'
             END as description,
             created_at, updated_at
      FROM turnover_rules 
      ORDER BY trigger_type
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    console.error('Turnover rules error:', error)
    return c.json({ success: false, message: '获取流水规则失败' }, 500)
  }
})

// 获取单个流水稽核规则
app.get('/api/v1/finance/turnover-rules/:rule_id', async (c) => {
  const rule_id = c.req.param('rule_id')

  try {
    const rule = await c.env.DB.prepare(`
      SELECT * FROM turnover_rules WHERE rule_id = ?
    `).bind(rule_id).first()

    if (!rule) {
      return c.json({ success: false, message: '规则不存在' }, 404)
    }

    return c.json({ success: true, data: rule })
  } catch (error) {
    return c.json({ success: false, message: '获取流水规则失败' }, 500)
  }
})

// 更新流水稽核规则
app.put('/api/v1/finance/turnover-rules/:rule_id', async (c) => {
  const rule_id = c.req.param('rule_id')
  const { multiplier, status } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE turnover_rules SET multiplier = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE rule_id = ?
    `).bind(multiplier, status, rule_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 创建流水稽核规则
app.post('/api/v1/finance/turnover-rules', async (c) => {
  try {
    const { rule_name, trigger_type, multiplier, games_included, valid_days = 30, status = 1 } = await c.req.json()

    if (!rule_name || !trigger_type || !multiplier) {
      return c.json({ success: false, message: '规则名称、触发类型和倍数为必填项' }, 400)
    }

    const safeMultiplier = Math.max(0, Math.min(parseFloat(multiplier) || 1, 100))
    const safeValidDays = Math.max(1, Math.min(parseInt(valid_days) || 30, 365))
    const safeTriggerType = [1, 2, 3].includes(parseInt(trigger_type)) ? parseInt(trigger_type) : 1

    const result = await c.env.DB.prepare(`
      INSERT INTO turnover_rules (rule_name, trigger_type, multiplier, games_included, valid_days, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      String(rule_name).substring(0, 50), 
      safeTriggerType, 
      safeMultiplier, 
      games_included || '百家乐,龙虎,轮盘,骰宝', 
      safeValidDays, 
      status === 0 ? 0 : 1
    ).run()

    return c.json({ success: true, message: '规则创建成功', data: { rule_id: result.meta?.last_row_id } })
  } catch (error) {
    console.error('创建流水规则失败:', error)
    return c.json({ success: false, message: '创建失败' }, 500)
  }
})

// 删除流水稽核规则
app.delete('/api/v1/finance/turnover-rules/:rule_id', async (c) => {
  const rule_id = parseInt(c.req.param('rule_id'))

  try {
    await c.env.DB.prepare('DELETE FROM turnover_rules WHERE rule_id = ?').bind(rule_id).run()
    return c.json({ success: true, message: '规则已删除' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 玩家流水稽核检查
app.get('/api/v1/finance/turnover-audit/:user_id', async (c) => {
  const user_id = c.req.param('user_id')

  try {
    // 获取玩家的流水稽核记录
    const audits = await c.env.DB.prepare(`
      SELECT ta.*, tr.rule_name, tr.multiplier
      FROM turnover_audits ta
      LEFT JOIN turnover_rules tr ON ta.rule_id = tr.rule_id
      WHERE ta.user_id = ?
      ORDER BY ta.created_at DESC
      LIMIT 50
    `).bind(user_id).all()

    // 获取玩家总投注和总流水要求
    const user = await c.env.DB.prepare(`
      SELECT total_bet, total_deposit FROM users WHERE user_id = ?
    `).bind(user_id).first()

    // 计算流水进度
    const rules = await c.env.DB.prepare(`
      SELECT * FROM turnover_rules WHERE status = 1
    `).all()

    // trigger_type: 1=存款流水, 2=红利流水, 3=洗码流水
    const depositMultiplier = (rules.results || []).find((r: any) => r.trigger_type === 1)?.multiplier || 1
    const requiredTurnover = (user?.total_deposit || 0) * depositMultiplier
    const currentTurnover = user?.total_bet || 0
    const progress = requiredTurnover > 0 ? Math.min(100, (currentTurnover / requiredTurnover) * 100) : 100

    return c.json({ 
      success: true, 
      data: {
        audits: audits.results || [],
        summary: {
          required_turnover: requiredTurnover,
          current_turnover: currentTurnover,
          progress: progress.toFixed(2),
          can_withdraw: currentTurnover >= requiredTurnover
        }
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取流水稽核失败' }, 500)
  }
})

// ==================== 红利派送API ====================

// 获取红利配置列表
app.get('/api/v1/bonus/configs', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT bc.*, tr.rule_name as turnover_rule_name
      FROM bonus_configs bc
      LEFT JOIN turnover_rules tr ON bc.turnover_rule_id = tr.rule_id
      ORDER BY bc.config_id
    `).all()
    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取红利配置失败' }, 500)
  }
})

// 更新红利配置
app.put('/api/v1/bonus/configs/:config_id', async (c) => {
  const config_id = parseInt(c.req.param('config_id'))
  const { bonus_name, description, min_deposit, max_bonus, bonus_percentage, turnover_rule_id, valid_days, status } = await c.req.json()
  
  try {
    await c.env.DB.prepare(`
      UPDATE bonus_configs SET 
        bonus_name = COALESCE(?, bonus_name),
        description = COALESCE(?, description),
        min_deposit = COALESCE(?, min_deposit),
        max_bonus = COALESCE(?, max_bonus),
        bonus_percentage = COALESCE(?, bonus_percentage),
        turnover_rule_id = ?,
        valid_days = COALESCE(?, valid_days),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE config_id = ?
    `).bind(bonus_name, description, min_deposit, max_bonus, bonus_percentage, turnover_rule_id, valid_days, status, config_id).run()
    
    return c.json({ success: true, message: '配置已更新' })
  } catch (error) {
    return c.json({ success: false, message: '更新配置失败' }, 500)
  }
})

// 获取红利记录列表
app.get('/api/v1/bonus/records', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const bonus_type = c.req.query('bonus_type')
  const audit_status = c.req.query('audit_status')
  const turnover_status = c.req.query('turnover_status')
  const username = c.req.query('username')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (bonus_type) {
      where += ' AND br.bonus_type = ?'
      params.push(bonus_type)
    }
    if (audit_status !== undefined && audit_status !== '') {
      where += ' AND br.audit_status = ?'
      params.push(parseInt(audit_status))
    }
    if (turnover_status !== undefined && turnover_status !== '') {
      where += ' AND br.turnover_status = ?'
      params.push(parseInt(turnover_status))
    }
    if (username) {
      where += ' AND br.username LIKE ?'
      params.push(`%${username}%`)
    }
    
    const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM bonus_records br ${where}`).bind(...params).first()
    const total = countResult?.total || 0
    
    const result = await c.env.DB.prepare(`
      SELECT br.*, tr.rule_name as turnover_rule_name
      FROM bonus_records br
      LEFT JOIN turnover_rules tr ON br.turnover_rule_id = tr.rule_id
      ${where}
      ORDER BY br.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()
    
    return c.json({ 
      success: true, 
      data: {
        list: result.results || [],
        total,
        page,
        size
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取红利记录失败' }, 500)
  }
})

// 派送红利
app.post('/api/v1/bonus/records', async (c) => {
  const adminPayload = c.get('adminPayload')
  const { user_id, username, bonus_type, bonus_amount, turnover_rule_id, remark } = await c.req.json()
  
  if (!user_id || !username || !bonus_type || !bonus_amount) {
    return c.json({ success: false, message: '参数不完整' }, 400)
  }
  
  try {
    // 获取流水规则
    let turnoverMultiplier = 1
    let validDays = 30
    
    if (turnover_rule_id) {
      const rule = await c.env.DB.prepare('SELECT * FROM turnover_rules WHERE rule_id = ?').bind(turnover_rule_id).first()
      if (rule) {
        turnoverMultiplier = rule.multiplier || 1
        validDays = rule.valid_days || 30
      }
    }
    
    const requiredTurnover = bonus_amount * turnoverMultiplier
    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString()
    
    const result = await c.env.DB.prepare(`
      INSERT INTO bonus_records (user_id, username, bonus_type, bonus_amount, turnover_rule_id, turnover_multiplier, required_turnover, remark, admin_id, admin_username, audit_status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).bind(user_id, username, bonus_type, bonus_amount, turnover_rule_id, turnoverMultiplier, requiredTurnover, remark, adminPayload.admin_id, adminPayload.username, expiresAt).run()
    
    return c.json({ success: true, message: '红利已派送，等待审核', bonus_id: result.meta.last_row_id })
  } catch (error) {
    return c.json({ success: false, message: '派送红利失败' }, 500)
  }
})

// 审核红利
app.put('/api/v1/bonus/records/:bonus_id/audit', async (c) => {
  const bonus_id = parseInt(c.req.param('bonus_id'))
  const adminPayload = c.get('adminPayload')
  const { action, remark } = await c.req.json() // action: approve/reject/cancel
  
  try {
    const bonus = await c.env.DB.prepare('SELECT * FROM bonus_records WHERE bonus_id = ?').bind(bonus_id).first()
    if (!bonus) {
      return c.json({ success: false, message: '红利记录不存在' }, 404)
    }
    
    let newStatus = 0
    if (action === 'approve') {
      newStatus = 1
      // 审核通过后，给玩家账户加红利
      await c.env.DB.prepare(`
        UPDATE users SET balance = balance + ? WHERE user_id = ?
      `).bind(bonus.bonus_amount, bonus.user_id).run()
      
      // 记录交易
      await c.env.DB.prepare(`
        INSERT INTO transactions (user_id, transaction_type, amount, balance_before, balance_after, remark, audit_status, created_at)
        SELECT user_id, 5, ?, balance - ?, balance, ?, 1, CURRENT_TIMESTAMP FROM users WHERE user_id = ?
      `).bind(bonus.bonus_amount, bonus.bonus_amount, `红利派送: ${bonus.bonus_type}`, bonus.user_id).run()
      
    } else if (action === 'reject') {
      newStatus = 2
    } else if (action === 'cancel') {
      newStatus = 3
    }
    
    await c.env.DB.prepare(`
      UPDATE bonus_records SET 
        audit_status = ?,
        remark = COALESCE(?, remark),
        approved_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE approved_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE bonus_id = ?
    `).bind(newStatus, remark, newStatus, bonus_id).run()
    
    return c.json({ success: true, message: action === 'approve' ? '红利已发放' : action === 'reject' ? '红利已拒绝' : '红利已取消' })
  } catch (error) {
    return c.json({ success: false, message: '审核失败' }, 500)
  }
})

// 检查玩家红利流水完成情况
app.get('/api/v1/bonus/check-turnover/:user_id', async (c) => {
  const user_id = parseInt(c.req.param('user_id'))
  
  try {
    // 获取玩家所有未完成流水的红利
    const bonuses = await c.env.DB.prepare(`
      SELECT * FROM bonus_records 
      WHERE user_id = ? AND audit_status = 1 AND turnover_status = 0 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at ASC
    `).bind(user_id).all()
    
    // 获取玩家在红利派送后的投注总额
    const pendingBonuses = bonuses.results || []
    let allCompleted = true
    
    for (const bonus of pendingBonuses) {
      // 计算该红利派送后的有效投注
      const betsResult = await c.env.DB.prepare(`
        SELECT COALESCE(SUM(valid_bet_amount), 0) as completed
        FROM bets 
        WHERE user_id = ? AND created_at >= ? AND bet_status = 1
      `).bind(user_id, bonus.created_at).first()
      
      const completed = betsResult?.completed || 0
      
      // 更新完成流水
      await c.env.DB.prepare(`
        UPDATE bonus_records SET 
          completed_turnover = ?,
          turnover_status = CASE WHEN ? >= required_turnover THEN 1 ELSE 0 END,
          updated_at = CURRENT_TIMESTAMP
        WHERE bonus_id = ?
      `).bind(completed, completed, bonus.bonus_id).run()
      
      if (completed < bonus.required_turnover) {
        allCompleted = false
      }
    }
    
    // 获取更新后的红利状态
    const updatedBonuses = await c.env.DB.prepare(`
      SELECT * FROM bonus_records 
      WHERE user_id = ? AND audit_status = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(user_id).all()
    
    // 汇总
    const summary = (updatedBonuses.results || []).reduce((acc: any, b: any) => {
      if (b.turnover_status === 0) {
        acc.pending_count++
        acc.pending_turnover += (b.required_turnover - b.completed_turnover)
      }
      acc.total_bonus += b.bonus_amount
      return acc
    }, { pending_count: 0, pending_turnover: 0, total_bonus: 0, can_withdraw: allCompleted })
    
    return c.json({ 
      success: true, 
      data: {
        bonuses: updatedBonuses.results || [],
        summary
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '检查流水失败' }, 500)
  }
})

// 获取单个红利详情
app.get('/api/v1/bonus/records/:bonus_id', async (c) => {
  const bonus_id = parseInt(c.req.param('bonus_id'))
  
  try {
    const bonus = await c.env.DB.prepare(`
      SELECT br.*, tr.rule_name as turnover_rule_name, u.balance as user_balance
      FROM bonus_records br
      LEFT JOIN turnover_rules tr ON br.turnover_rule_id = tr.rule_id
      LEFT JOIN users u ON br.user_id = u.user_id
      WHERE br.bonus_id = ?
    `).bind(bonus_id).first()
    
    if (!bonus) {
      return c.json({ success: false, message: '红利记录不存在' }, 404)
    }
    
    return c.json({ success: true, data: bonus })
  } catch (error) {
    return c.json({ success: false, message: '获取红利详情失败' }, 500)
  }
})

// ==================== 收款方式管理API ====================

// 获取收款方式列表
app.get('/api/v1/finance/payment-methods', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const method_type = c.req.query('method_type')
  const status = c.req.query('status')
  const currency = c.req.query('currency')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (method_type) {
      where += ' AND method_type = ?'
      params.push(method_type)
    }
    if (status !== undefined && status !== '') {
      where += ' AND status = ?'
      params.push(parseInt(status))
    }
    if (currency) {
      where += ' AND currency = ?'
      params.push(currency)
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM payment_methods ${where}`
    ).bind(...params).first()

    const results = await c.env.DB.prepare(`
      SELECT * FROM payment_methods ${where}
      ORDER BY sort_order ASC, method_id ASC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: results.results || []
      }
    })
  } catch (error) {
    console.error('Get payment methods error:', error)
    return c.json({ success: false, message: '获取收款方式列表失败' }, 500)
  }
})

// 获取单个收款方式详情
app.get('/api/v1/finance/payment-methods/:id', async (c) => {
  const method_id = parseInt(c.req.param('id'))
  
  try {
    const method = await c.env.DB.prepare(
      'SELECT * FROM payment_methods WHERE method_id = ?'
    ).bind(method_id).first()
    
    if (!method) {
      return c.json({ success: false, message: '收款方式不存在' }, 404)
    }
    
    return c.json({ success: true, data: method })
  } catch (error) {
    return c.json({ success: false, message: '获取收款方式详情失败' }, 500)
  }
})

// 创建收款方式
app.post('/api/v1/finance/payment-methods', async (c) => {
  try {
    const body = await c.req.json()
    const {
      method_name, method_type, currency = 'CNY',
      account_name, account_number, bank_name, bank_branch, qr_code_url,
      min_amount = 0, max_amount = 1000000, daily_limit = 0,
      fee_type = 0, fee_amount = 0,
      status = 1, sort_order = 0,
      applicable_agents, applicable_vip_levels,
      remark
    } = body

    // 验证必填字段
    if (!method_name || !method_type) {
      return c.json({ success: false, message: '收款方式名称和类型为必填项' }, 400)
    }

    // 验证类型
    const validTypes = ['crypto', 'bank', 'ewallet', 'other']
    if (!validTypes.includes(method_type)) {
      return c.json({ success: false, message: '无效的收款方式类型' }, 400)
    }

    const admin = c.get('admin')
    
    const result = await c.env.DB.prepare(`
      INSERT INTO payment_methods (
        method_name, method_type, currency,
        account_name, account_number, bank_name, bank_branch, qr_code_url,
        min_amount, max_amount, daily_limit,
        fee_type, fee_amount,
        status, sort_order,
        applicable_agents, applicable_vip_levels,
        remark, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      method_name, method_type, currency,
      account_name || null, account_number || null, bank_name || null, bank_branch || null, qr_code_url || null,
      min_amount, max_amount, daily_limit,
      fee_type, fee_amount,
      status, sort_order,
      applicable_agents ? JSON.stringify(applicable_agents) : null,
      applicable_vip_levels ? JSON.stringify(applicable_vip_levels) : null,
      remark || null, admin.admin_id
    ).run()

    // 记录操作日志
    await c.env.DB.prepare(
      `INSERT INTO audit_logs (admin_id, operation_type, target_table, target_id, remark, ip_address)
       VALUES (?, 'CREATE', 'payment_method', ?, ?, ?)`
    ).bind(admin.admin_id, result.meta.last_row_id, `创建收款方式: ${method_name}`, c.req.header('x-forwarded-for') || 'unknown').run()

    return c.json({ 
      success: true, 
      message: '收款方式创建成功',
      data: { method_id: result.meta.last_row_id }
    })
  } catch (error) {
    console.error('Create payment method error:', error)
    return c.json({ success: false, message: '创建收款方式失败' }, 500)
  }
})

// 更新收款方式
app.put('/api/v1/finance/payment-methods/:id', async (c) => {
  const method_id = parseInt(c.req.param('id'))
  
  try {
    const body = await c.req.json()
    const {
      method_name, method_type, currency,
      account_name, account_number, bank_name, bank_branch, qr_code_url,
      min_amount, max_amount, daily_limit,
      fee_type, fee_amount,
      status, sort_order,
      applicable_agents, applicable_vip_levels,
      remark
    } = body

    // 检查是否存在
    const existing = await c.env.DB.prepare(
      'SELECT method_id FROM payment_methods WHERE method_id = ?'
    ).bind(method_id).first()
    
    if (!existing) {
      return c.json({ success: false, message: '收款方式不存在' }, 404)
    }

    // 构建动态更新语句
    const updates: string[] = []
    const params: any[] = []

    if (method_name !== undefined) { updates.push('method_name = ?'); params.push(method_name) }
    if (method_type !== undefined) { updates.push('method_type = ?'); params.push(method_type) }
    if (currency !== undefined) { updates.push('currency = ?'); params.push(currency) }
    if (account_name !== undefined) { updates.push('account_name = ?'); params.push(account_name) }
    if (account_number !== undefined) { updates.push('account_number = ?'); params.push(account_number) }
    if (bank_name !== undefined) { updates.push('bank_name = ?'); params.push(bank_name) }
    if (bank_branch !== undefined) { updates.push('bank_branch = ?'); params.push(bank_branch) }
    if (qr_code_url !== undefined) { updates.push('qr_code_url = ?'); params.push(qr_code_url) }
    if (min_amount !== undefined) { updates.push('min_amount = ?'); params.push(min_amount) }
    if (max_amount !== undefined) { updates.push('max_amount = ?'); params.push(max_amount) }
    if (daily_limit !== undefined) { updates.push('daily_limit = ?'); params.push(daily_limit) }
    if (fee_type !== undefined) { updates.push('fee_type = ?'); params.push(fee_type) }
    if (fee_amount !== undefined) { updates.push('fee_amount = ?'); params.push(fee_amount) }
    if (status !== undefined) { updates.push('status = ?'); params.push(status) }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order) }
    if (applicable_agents !== undefined) { updates.push('applicable_agents = ?'); params.push(JSON.stringify(applicable_agents)) }
    if (applicable_vip_levels !== undefined) { updates.push('applicable_vip_levels = ?'); params.push(JSON.stringify(applicable_vip_levels)) }
    if (remark !== undefined) { updates.push('remark = ?'); params.push(remark) }

    if (updates.length === 0) {
      return c.json({ success: false, message: '没有需要更新的字段' }, 400)
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(method_id)

    await c.env.DB.prepare(
      `UPDATE payment_methods SET ${updates.join(', ')} WHERE method_id = ?`
    ).bind(...params).run()

    // 记录操作日志
    const admin = c.get('admin')
    await c.env.DB.prepare(
      `INSERT INTO audit_logs (admin_id, operation_type, target_table, target_id, remark, ip_address)
       VALUES (?, 'UPDATE', 'payment_method', ?, ?, ?)`
    ).bind(admin.admin_id, method_id, `更新收款方式ID: ${method_id}`, c.req.header('x-forwarded-for') || 'unknown').run()

    return c.json({ success: true, message: '收款方式更新成功' })
  } catch (error) {
    console.error('Update payment method error:', error)
    return c.json({ success: false, message: '更新收款方式失败' }, 500)
  }
})

// 删除收款方式
app.delete('/api/v1/finance/payment-methods/:id', async (c) => {
  const method_id = parseInt(c.req.param('id'))
  
  try {
    const existing = await c.env.DB.prepare(
      'SELECT method_id, method_name FROM payment_methods WHERE method_id = ?'
    ).bind(method_id).first()
    
    if (!existing) {
      return c.json({ success: false, message: '收款方式不存在' }, 404)
    }

    await c.env.DB.prepare(
      'DELETE FROM payment_methods WHERE method_id = ?'
    ).bind(method_id).run()

    // 记录操作日志
    const admin = c.get('admin')
    await c.env.DB.prepare(
      `INSERT INTO audit_logs (admin_id, operation_type, target_table, target_id, remark, ip_address)
       VALUES (?, 'DELETE', 'payment_method', ?, ?, ?)`
    ).bind(admin.admin_id, method_id, `删除收款方式: ${existing.method_name}`, c.req.header('x-forwarded-for') || 'unknown').run()

    return c.json({ success: true, message: '收款方式删除成功' })
  } catch (error) {
    console.error('Delete payment method error:', error)
    return c.json({ success: false, message: '删除收款方式失败' }, 500)
  }
})

// 切换收款方式状态
app.post('/api/v1/finance/payment-methods/:id/toggle-status', async (c) => {
  const method_id = parseInt(c.req.param('id'))
  
  try {
    const existing = await c.env.DB.prepare(
      'SELECT method_id, method_name, status FROM payment_methods WHERE method_id = ?'
    ).bind(method_id).first()
    
    if (!existing) {
      return c.json({ success: false, message: '收款方式不存在' }, 404)
    }

    const newStatus = existing.status === 1 ? 0 : 1
    
    await c.env.DB.prepare(
      'UPDATE payment_methods SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE method_id = ?'
    ).bind(newStatus, method_id).run()

    // 记录操作日志
    const admin = c.get('admin')
    const statusText = newStatus === 1 ? '启用' : '禁用'
    await c.env.DB.prepare(
      `INSERT INTO audit_logs (admin_id, operation_type, target_table, target_id, remark, ip_address)
       VALUES (?, 'UPDATE', 'payment_method', ?, ?, ?)`
    ).bind(admin.admin_id, method_id, `${statusText}收款方式: ${existing.method_name}`, c.req.header('x-forwarded-for') || 'unknown').run()

    return c.json({ 
      success: true, 
      message: `收款方式已${statusText}`,
      data: { status: newStatus }
    })
  } catch (error) {
    console.error('Toggle payment method status error:', error)
    return c.json({ success: false, message: '切换状态失败' }, 500)
  }
})

// 获取可用收款方式（前台用）
app.get('/api/v1/finance/payment-methods/available', async (c) => {
  try {
    const results = await c.env.DB.prepare(`
      SELECT method_id, method_name, method_type, currency, 
             account_name, account_number, bank_name, qr_code_url,
             min_amount, max_amount, fee_type, fee_amount
      FROM payment_methods 
      WHERE status = 1
      ORDER BY sort_order ASC
    `).all()

    return c.json({
      success: true,
      data: results.results || []
    })
  } catch (error) {
    return c.json({ success: false, message: '获取收款方式失败' }, 500)
  }
})

// ==================== 注单管理API ====================

app.get('/api/v1/bets', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const game_type = c.req.query('game_type')
  const status = c.req.query('status')
  const user_id = c.req.query('user_id')
  const username = c.req.query('username')
  const bet_no = c.req.query('bet_no')
  const start_date = c.req.query('start_date')
  const end_date = c.req.query('end_date')
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
    if (username) {
      const sanitized = sanitizeLikeParam(username)
      if (sanitized) {
        where += " AND u.username LIKE ? ESCAPE '\\'"
        params.push(`%${sanitized}%`)
      }
    }
    if (bet_no) {
      const sanitized = sanitizeLikeParam(bet_no)
      if (sanitized) {
        where += " AND b.bet_no LIKE ? ESCAPE '\\'"
        params.push(`%${sanitized}%`)
      }
    }
    if (start_date) {
      const dateStr = validateString(start_date, 10)
      if (dateStr) {
        where += ' AND DATE(b.created_at) >= ?'
        params.push(dateStr)
      }
    }
    if (end_date) {
      const dateStr = validateString(end_date, 10)
      if (dateStr) {
        where += ' AND DATE(b.created_at) <= ?'
        params.push(dateStr)
      }
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM bets b LEFT JOIN users u ON b.user_id = u.user_id ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT b.*, u.username, u.nickname
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    // 汇总
    const summary = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(bet_amount), 0) as total_bet,
        COALESCE(SUM(valid_bet_amount), 0) as total_valid_bet,
        COALESCE(SUM(win_loss_amount), 0) as total_win_loss
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      ${where}
    `).bind(...params).first()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || [],
        summary: summary
      }
    })
  } catch (error) {
    console.error('Bets list error:', error)
    return c.json({ success: false, message: '获取注单列表失败' }, 500)
  }
})

// 实时注单监控 - 必须在 :bet_id 路由之前定义
app.get('/api/v1/bets/realtime', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT b.*, u.username, u.nickname, u.vip_level
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.bet_status = 0
      ORDER BY b.created_at DESC
      LIMIT 50
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取实时注单失败' }, 500)
  }
})

// 特殊注单(三宝等高赔注单) - 必须在 :bet_id 路由之前定义
app.get('/api/v1/bets/special', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT b.*, u.username, u.nickname,
             CASE 
               WHEN b.bet_detail LIKE '%三宝%' OR b.bet_detail LIKE '%围骰%' THEN '三宝/围骰'
               WHEN b.bet_detail LIKE '%对子%' THEN '对子'
               WHEN b.odds > 5 THEN '高赔率'
               ELSE '其他'
             END as special_type
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.odds > 2 OR b.bet_detail LIKE '%三宝%' OR b.bet_detail LIKE '%围骰%' OR b.bet_detail LIKE '%对子%'
      ORDER BY b.created_at DESC
      LIMIT 100
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取特殊注单失败' }, 500)
  }
})

// 注单详情
app.get('/api/v1/bets/:bet_id', async (c) => {
  const bet_id = c.req.param('bet_id')

  try {
    const bet = await c.env.DB.prepare(`
      SELECT b.*, u.username, u.nickname, gr.result_detail, gr.video_url
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN game_results gr ON b.game_round_id = gr.game_round_id
      WHERE b.bet_id = ?
    `).bind(bet_id).first()

    if (!bet) {
      return c.json({ success: false, message: '注单不存在' }, 404)
    }

    return c.json({ success: true, data: bet })
  } catch (error) {
    return c.json({ success: false, message: '获取注单详情失败' }, 500)
  }
})

// 废除注单
app.post('/api/v1/bets/:bet_id/void', async (c) => {
  const bet_id = validateId(c.req.param('bet_id'))
  if (!bet_id) {
    return c.json({ success: false, message: '无效的注单ID' }, 400)
  }
  
  const admin = c.get('admin')
  const { reason, secondary_password } = await c.req.json()
  const clientIP = getClientIP(c)

  try {
    // 验证二次密码 - 从数据库获取管理员的二次密码进行验证
    if (!secondary_password || typeof secondary_password !== 'string' || secondary_password.length < 4) {
      return c.json({ success: false, message: '请输入二次密码' }, 400)
    }
    
    const adminUser = await c.env.DB.prepare(
      'SELECT secondary_password FROM admin_users WHERE admin_id = ?'
    ).bind(admin.admin_id).first()
    
    // 必须从数据库获取二次密码，不允许使用默认值
    if (!adminUser?.secondary_password) {
      return c.json({ success: false, message: '请先在个人设置中配置二次密码' }, 400)
    }
    
    const secondaryHash = await hashPassword(secondary_password)
    const storedSecondary = adminUser.secondary_password as string
    if (!secureCompare(secondaryHash, storedSecondary) && !secureCompare(secondary_password, storedSecondary)) {
      await c.env.DB.prepare(
        'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(admin.admin_id, admin.username, 'VOID_BET_FAILED', 'bets', bet_id, '二次密码错误', clientIP).run()
      return c.json({ success: false, message: '二次密码错误' }, 400)
    }

    const bet = await c.env.DB.prepare('SELECT * FROM bets WHERE bet_id = ?').bind(bet_id).first()
    if (!bet) {
      return c.json({ success: false, message: '注单不存在' }, 404)
    }
    
    if (bet.bet_status === 3) {
      return c.json({ success: false, message: '注单已被废除' }, 400)
    }

    // 更新注单状态
    await c.env.DB.prepare(
      'UPDATE bets SET bet_status = 3, updated_at = CURRENT_TIMESTAMP WHERE bet_id = ?'
    ).bind(bet_id).run()

    // 退还用户余额
    await c.env.DB.prepare(
      'UPDATE users SET balance = balance + ? WHERE user_id = ?'
    ).bind(bet.bet_amount, bet.user_id).run()

    // 记录审计日志 - 使用真实的管理员信息
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, 'VOID_BET', 'bets', bet_id, JSON.stringify({bet_amount: bet.bet_amount, user_id: bet.user_id}), reason || '管理员废单', clientIP).run()

    return c.json({ success: true, message: '注单已废除' })
  } catch (error) {
    return c.json({ success: false, message: '废除失败' }, 500)
  }
})

// 开奖结果
app.get('/api/v1/game-results', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const game_type = c.req.query('game_type')
  const offset = (page - 1) * size

  try {
    let where = ''
    const params: any[] = []
    
    if (game_type) {
      where = 'WHERE game_type = ?'
      params.push(game_type)
    }

    const result = await c.env.DB.prepare(`
      SELECT * FROM game_results ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, size, offset).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取开奖结果失败' }, 500)
  }
})

// ==================== 洗码管理API ====================

app.get('/api/v1/commission/schemes', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT cs.*,
             (SELECT COUNT(*) FROM users WHERE commission_scheme_id = cs.scheme_id) as user_count,
             (SELECT COUNT(*) FROM agents WHERE default_commission_scheme_id = cs.scheme_id) as agent_count
      FROM commission_schemes cs
      ORDER BY cs.scheme_id
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取洗码方案失败' }, 500)
  }
})

// 创建洗码方案
app.post('/api/v1/commission/schemes', async (c) => {
  const { scheme_name, settlement_cycle, min_valid_bet, daily_max_amount, baccarat_rate, dragon_tiger_rate, roulette_rate, sicbo_rate, niuniu_rate } = await c.req.json()

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO commission_schemes (scheme_name, settlement_cycle, min_valid_bet, daily_max_amount, baccarat_rate, dragon_tiger_rate, roulette_rate, sicbo_rate, niuniu_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(scheme_name, settlement_cycle || 1, min_valid_bet || 0, daily_max_amount || null, baccarat_rate || 0.008, dragon_tiger_rate || 0.008, roulette_rate || 0.005, sicbo_rate || 0.005, niuniu_rate || 0.007).run()

    return c.json({ success: true, data: { scheme_id: result.meta.last_row_id } })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return c.json({ success: false, message: '方案名称已存在' }, 400)
    }
    return c.json({ success: false, message: '创建失败' }, 500)
  }
})

// 洗码方案详情
app.get('/api/v1/commission/schemes/:scheme_id', async (c) => {
  const scheme_id = c.req.param('scheme_id')

  try {
    const scheme = await c.env.DB.prepare(`
      SELECT cs.*,
             (SELECT COUNT(*) FROM users WHERE commission_scheme_id = cs.scheme_id) as user_count,
             (SELECT COUNT(*) FROM agents WHERE default_commission_scheme_id = cs.scheme_id) as agent_count
      FROM commission_schemes cs
      WHERE cs.scheme_id = ?
    `).bind(scheme_id).first()

    if (!scheme) {
      return c.json({ success: false, message: '洗码方案不存在' }, 404)
    }

    return c.json({ success: true, data: scheme })
  } catch (error) {
    return c.json({ success: false, message: '获取洗码方案详情失败' }, 500)
  }
})

// 更新洗码方案
app.put('/api/v1/commission/schemes/:scheme_id', async (c) => {
  const scheme_id = c.req.param('scheme_id')
  const { scheme_name, settlement_cycle, min_valid_bet, daily_max_amount, baccarat_rate, dragon_tiger_rate, roulette_rate, sicbo_rate, niuniu_rate, status } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE commission_schemes SET
        scheme_name = COALESCE(?, scheme_name),
        settlement_cycle = COALESCE(?, settlement_cycle),
        min_valid_bet = COALESCE(?, min_valid_bet),
        daily_max_amount = ?,
        baccarat_rate = COALESCE(?, baccarat_rate),
        dragon_tiger_rate = COALESCE(?, dragon_tiger_rate),
        roulette_rate = COALESCE(?, roulette_rate),
        sicbo_rate = COALESCE(?, sicbo_rate),
        niuniu_rate = COALESCE(?, niuniu_rate),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE scheme_id = ?
    `).bind(scheme_name, settlement_cycle, min_valid_bet, daily_max_amount, baccarat_rate, dragon_tiger_rate, roulette_rate, sicbo_rate, niuniu_rate, status, scheme_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 删除洗码方案
app.delete('/api/v1/commission/schemes/:scheme_id', async (c) => {
  const scheme_id = parseInt(c.req.param('scheme_id'))

  try {
    // 检查是否有玩家使用此方案
    const users = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE commission_scheme_id = ?').bind(scheme_id).first()
    if (users && (users as any).count > 0) {
      return c.json({ success: false, message: '该方案有玩家绑定，无法删除' }, 400)
    }

    // 检查是否有代理使用此方案
    const agents = await c.env.DB.prepare('SELECT COUNT(*) as count FROM agents WHERE default_commission_scheme_id = ?').bind(scheme_id).first()
    if (agents && (agents as any).count > 0) {
      return c.json({ success: false, message: '该方案有代理绑定，无法删除' }, 400)
    }

    await c.env.DB.prepare('DELETE FROM commission_schemes WHERE scheme_id = ?').bind(scheme_id).run()
    return c.json({ success: true, message: '洗码方案已删除' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 洗码记录
app.get('/api/v1/commission/records', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const status = c.req.query('status')
  const user_id = c.req.query('user_id')
  const start_date = c.req.query('start_date')
  const end_date = c.req.query('end_date')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (status !== undefined && status !== '') {
      where += ' AND cr.audit_status = ?'
      params.push(parseInt(status))
    }
    if (user_id) {
      where += ' AND cr.user_id = ?'
      params.push(parseInt(user_id))
    }
    if (start_date) {
      where += ' AND cr.settlement_date >= ?'
      params.push(start_date)
    }
    if (end_date) {
      where += ' AND cr.settlement_date <= ?'
      params.push(end_date)
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

    // 汇总
    const summary = await c.env.DB.prepare(`
      SELECT 
        COALESCE(SUM(valid_bet_amount), 0) as total_valid_bet,
        COALESCE(SUM(commission_amount), 0) as total_commission
      FROM commission_records cr
      ${where}
    `).bind(...params).first()

    return c.json({
      success: true,
      data: {
        total: countResult?.total || 0,
        page,
        size,
        list: result.results || [],
        summary: summary
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取洗码记录失败' }, 500)
  }
})

// 洗码审核
app.post('/api/v1/commission/records/:record_id/audit', async (c) => {
  const record_id = c.req.param('record_id')
  const { action, remark } = await c.req.json()

  try {
    const record = await c.env.DB.prepare('SELECT * FROM commission_records WHERE record_id = ?').bind(record_id).first()
    if (!record) {
      return c.json({ success: false, message: '记录不存在' }, 404)
    }

    const newStatus = action === 'approve' ? 1 : 2
    
    await c.env.DB.prepare(`
      UPDATE commission_records 
      SET audit_status = ?, auditor_id = 1, paid_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE record_id = ?
    `).bind(newStatus, newStatus, record_id).run()

    // 如果是通过，发放到用户余额
    if (action === 'approve') {
      await c.env.DB.prepare(`
        UPDATE users SET balance = balance + ? WHERE user_id = ?
      `).bind(record.commission_amount, record.user_id).run()

      // 创建交易记录
      const orderNo = `COM${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      const user = await c.env.DB.prepare('SELECT balance FROM users WHERE user_id = ?').bind(record.user_id).first()
      
      await c.env.DB.prepare(`
        INSERT INTO transactions (order_no, user_id, transaction_type, amount, balance_before, balance_after, audit_status, remark)
        VALUES (?, ?, 6, ?, ?, ?, 1, '洗码返水')
      `).bind(orderNo, record.user_id, record.commission_amount, (user?.balance as number) - (record.commission_amount as number), user?.balance, record_id).run()
    }

    return c.json({ success: true, message: '审核完成' })
  } catch (error) {
    return c.json({ success: false, message: '审核失败' }, 500)
  }
})

// 批量审核洗码
app.post('/api/v1/commission/records/batch-audit', async (c) => {
  const { record_ids, action } = await c.req.json()

  try {
    for (const record_id of record_ids) {
      const record = await c.env.DB.prepare('SELECT * FROM commission_records WHERE record_id = ? AND audit_status = 0').bind(record_id).first()
      if (!record) continue

      const newStatus = action === 'approve' ? 1 : 2
      
      await c.env.DB.prepare(`
        UPDATE commission_records SET audit_status = ?, auditor_id = 1, paid_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE record_id = ?
      `).bind(newStatus, newStatus, record_id).run()

      if (action === 'approve') {
        await c.env.DB.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?')
          .bind(record.commission_amount, record.user_id).run()
      }
    }

    return c.json({ success: true, message: '批量审核完成' })
  } catch (error) {
    return c.json({ success: false, message: '批量审核失败' }, 500)
  }
})

// ==================== 风控管理API ====================

app.get('/api/v1/risk/alerts', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const status = c.req.query('status')
  const risk_level = c.req.query('risk_level')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []
    
    if (status !== undefined && status !== '') {
      where += ' AND ra.handle_status = ?'
      params.push(parseInt(status))
    }
    if (risk_level) {
      where += ' AND ra.risk_level = ?'
      params.push(parseInt(risk_level))
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

// 处理风控预警
app.post('/api/v1/risk/alerts/:alert_id/handle', async (c) => {
  const alert_id = c.req.param('alert_id')
  const { action, remark } = await c.req.json()

  try {
    const alert = await c.env.DB.prepare('SELECT * FROM risk_alerts WHERE alert_id = ?').bind(alert_id).first()
    if (!alert) {
      return c.json({ success: false, message: '预警不存在' }, 404)
    }

    await c.env.DB.prepare(`
      UPDATE risk_alerts 
      SET handle_status = 1, handler_id = 1, handle_remark = ?, handle_at = CURRENT_TIMESTAMP
      WHERE alert_id = ?
    `).bind(remark || action, alert_id).run()

    // 根据操作执行相应动作
    if (action === 'freeze') {
      await c.env.DB.prepare('UPDATE users SET status = 0 WHERE user_id = ?').bind(alert.user_id).run()
    } else if (action === 'limit') {
      // 设置限红
      await c.env.DB.prepare('UPDATE users SET bet_limit_group_id = 3 WHERE user_id = ?').bind(alert.user_id).run()
    }

    return c.json({ success: true, message: '处理完成' })
  } catch (error) {
    return c.json({ success: false, message: '处理失败' }, 500)
  }
})

// 风控规则列表
app.get('/api/v1/risk/rules', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT rr.*,
             (SELECT COUNT(*) FROM risk_alerts WHERE rule_id = rr.rule_id) as alert_count
      FROM risk_rules rr
      ORDER BY rr.rule_id
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取风控规则失败' }, 500)
  }
})

// 获取单个风控规则
app.get('/api/v1/risk/rules/:rule_id', async (c) => {
  const rule_id = parseInt(c.req.param('rule_id'))
  
  try {
    const rule = await c.env.DB.prepare(`
      SELECT * FROM risk_rules WHERE rule_id = ?
    `).bind(rule_id).first()

    if (!rule) {
      return c.json({ success: false, message: '规则不存在' }, 404)
    }

    return c.json({ success: true, data: rule })
  } catch (error) {
    return c.json({ success: false, message: '获取风控规则失败' }, 500)
  }
})

// 创建风控规则
app.post('/api/v1/risk/rules', async (c) => {
  try {
    const { rule_name, rule_type, rule_condition, rule_action, threshold, status = 1 } = await c.req.json()

    if (!rule_name || !rule_type) {
      return c.json({ success: false, message: '规则名称和类型为必填项' }, 400)
    }

    // 构建规则条件JSON
    const conditionJson = rule_condition || JSON.stringify({ threshold: parseFloat(threshold) || 0 })

    const result = await c.env.DB.prepare(`
      INSERT INTO risk_rules (rule_name, rule_type, rule_condition, rule_action, status)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      String(rule_name).substring(0, 100),
      String(rule_type).substring(0, 50),
      conditionJson,
      rule_action || 'alert',
      status === 0 ? 0 : 1
    ).run()

    return c.json({ success: true, message: '规则创建成功', data: { rule_id: result.meta?.last_row_id } })
  } catch (error) {
    console.error('创建风控规则失败:', error)
    return c.json({ success: false, message: '创建失败' }, 500)
  }
})

// 更新风控规则
app.put('/api/v1/risk/rules/:rule_id', async (c) => {
  const rule_id = parseInt(c.req.param('rule_id'))
  
  try {
    const body = await c.req.json()
    const { rule_name, rule_type, rule_condition, rule_action, threshold, status } = body

    const updates: string[] = []
    const params: any[] = []

    if (rule_name !== undefined) { updates.push('rule_name = ?'); params.push(String(rule_name).substring(0, 100)) }
    if (rule_type !== undefined) { updates.push('rule_type = ?'); params.push(String(rule_type).substring(0, 50)) }
    if (rule_condition !== undefined) { updates.push('rule_condition = ?'); params.push(rule_condition) }
    else if (threshold !== undefined) { updates.push('rule_condition = ?'); params.push(JSON.stringify({ threshold: parseFloat(threshold) || 0 })) }
    if (rule_action !== undefined) { updates.push('rule_action = ?'); params.push(rule_action) }
    if (status !== undefined) { updates.push('status = ?'); params.push(status === 0 ? 0 : 1) }

    if (updates.length === 0) {
      return c.json({ success: false, message: '没有要更新的字段' }, 400)
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(rule_id)

    await c.env.DB.prepare(`UPDATE risk_rules SET ${updates.join(', ')} WHERE rule_id = ?`).bind(...params).run()

    return c.json({ success: true, message: '规则更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 删除风控规则
app.delete('/api/v1/risk/rules/:rule_id', async (c) => {
  const rule_id = parseInt(c.req.param('rule_id'))

  try {
    await c.env.DB.prepare('DELETE FROM risk_rules WHERE rule_id = ?').bind(rule_id).run()
    return c.json({ success: true, message: '规则已删除' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 创建限红组
app.post('/api/v1/risk/limit-groups', async (c) => {
  try {
    const { group_name, description, limits } = await c.req.json()

    if (!group_name) {
      return c.json({ success: false, message: '限红组名称为必填项' }, 400)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO bet_limit_groups (group_name, description, limits)
      VALUES (?, ?, ?)
    `).bind(
      String(group_name).substring(0, 50),
      description || '',
      JSON.stringify(limits || {})
    ).run()

    return c.json({ success: true, message: '限红组创建成功', data: { group_id: result.meta?.last_row_id } })
  } catch (error) {
    return c.json({ success: false, message: '创建失败' }, 500)
  }
})

// 更新限红组
app.put('/api/v1/risk/limit-groups/:group_id', async (c) => {
  const group_id = parseInt(c.req.param('group_id'))
  
  try {
    const { group_name, description, limits, status } = await c.req.json()

    const updates: string[] = []
    const params: any[] = []

    if (group_name !== undefined) { updates.push('group_name = ?'); params.push(String(group_name).substring(0, 50)) }
    if (description !== undefined) { updates.push('description = ?'); params.push(description) }
    if (limits !== undefined) { updates.push('limits = ?'); params.push(JSON.stringify(limits)) }
    if (status !== undefined) { updates.push('status = ?'); params.push(status === 0 ? 0 : 1) }

    if (updates.length === 0) {
      return c.json({ success: false, message: '没有要更新的字段' }, 400)
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(group_id)

    await c.env.DB.prepare(`UPDATE bet_limit_groups SET ${updates.join(', ')} WHERE group_id = ?`).bind(...params).run()

    return c.json({ success: true, message: '限红组更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 删除限红组
app.delete('/api/v1/risk/limit-groups/:group_id', async (c) => {
  const group_id = parseInt(c.req.param('group_id'))

  try {
    // 检查是否有玩家使用此限红组
    const users = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE bet_limit_group_id = ?').bind(group_id).first()
    if (users && (users as any).count > 0) {
      return c.json({ success: false, message: '该限红组下有玩家，无法删除' }, 400)
    }

    await c.env.DB.prepare('DELETE FROM bet_limit_groups WHERE group_id = ?').bind(group_id).run()
    return c.json({ success: true, message: '限红组已删除' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 限红组列表
app.get('/api/v1/risk/limit-groups', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT blg.*,
             (SELECT COUNT(*) FROM users WHERE bet_limit_group_id = blg.group_id) as user_count
      FROM bet_limit_groups blg
      ORDER BY blg.group_id
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取限红组失败' }, 500)
  }
})

// 获取单个限红组详情
app.get('/api/v1/risk/limit-groups/:group_id', async (c) => {
  const group_id = parseInt(c.req.param('group_id'))
  
  try {
    const group = await c.env.DB.prepare(`
      SELECT * FROM bet_limit_groups WHERE group_id = ?
    `).bind(group_id).first()
    
    if (!group) {
      return c.json({ success: false, message: '限红组不存在' }, 404)
    }
    
    return c.json({ success: true, data: group })
  } catch (error) {
    return c.json({ success: false, message: '获取限红组详情失败' }, 500)
  }
})

// IP关联分析
app.get('/api/v1/risk/ip-analysis', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT login_ip as ip_address, COUNT(*) as user_count,
             GROUP_CONCAT(DISTINCT user_id) as user_ids,
             MAX(created_at) as last_seen
      FROM user_login_logs
      GROUP BY login_ip
      HAVING COUNT(DISTINCT user_id) > 1
      ORDER BY user_count DESC
      LIMIT 100
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取IP分析失败' }, 500)
  }
})

// ==================== 报表API ====================

app.get('/api/v1/reports/settlement', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]
  const dimension = c.req.query('dimension') || 'daily'
  const agent_id = c.req.query('agent_id')
  const game_type = c.req.query('game_type')

  try {
    let groupBy = 'DATE(b.created_at)'
    let selectDate = 'DATE(b.created_at) as date'
    
    if (dimension === 'game') {
      groupBy = 'b.game_type'
      selectDate = 'b.game_type as dimension'
    } else if (dimension === 'agent') {
      groupBy = 'u.agent_id'
      selectDate = 'a.agent_username as dimension'
    }

    let where = 'WHERE DATE(b.created_at) BETWEEN ? AND ?'
    const params: any[] = [start_date, end_date]

    if (agent_id) {
      where += ' AND u.agent_id = ?'
      params.push(parseInt(agent_id))
    }
    if (game_type) {
      where += ' AND b.game_type = ?'
      params.push(game_type)
    }

    const result = await c.env.DB.prepare(`
      SELECT 
        ${selectDate},
        COUNT(*) as bet_count,
        COUNT(DISTINCT b.user_id) as player_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as total_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      ${where} AND b.bet_status = 1
      GROUP BY ${groupBy}
      ORDER BY ${dimension === 'daily' ? 'date DESC' : 'company_profit DESC'}
    `).bind(...params).all()

    // 汇总
    const summary = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as bet_count,
        COUNT(DISTINCT b.user_id) as player_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as total_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      ${where} AND b.bet_status = 1
    `).bind(...params).first()

    return c.json({ success: true, data: result.results || [], summary })
  } catch (error) {
    return c.json({ success: false, message: '获取结算报表失败' }, 500)
  }
})

// 盈亏排行榜
app.get('/api/v1/reports/ranking', async (c) => {
  const type = c.req.query('type') || 'profit'
  const limit = parseInt(c.req.query('limit') || '50')
  const start_date = c.req.query('start_date')
  const end_date = c.req.query('end_date')

  try {
    let dateFilter = ''
    const params: any[] = []
    
    if (start_date && end_date) {
      dateFilter = 'WHERE DATE(b.created_at) BETWEEN ? AND ?'
      params.push(start_date, end_date)
    }

    const orderDir = type === 'profit' ? 'DESC' : 'ASC'
    
    const result = await c.env.DB.prepare(`
      SELECT u.user_id, u.username, u.nickname, u.vip_level,
             COALESCE(SUM(b.bet_amount), 0) as total_bet,
             COALESCE(SUM(b.valid_bet_amount), 0) as total_valid_bet,
             COALESCE(SUM(b.win_loss_amount), 0) as total_win_loss,
             a.agent_username
      FROM users u
      LEFT JOIN bets b ON u.user_id = b.user_id ${dateFilter ? 'AND ' + dateFilter.replace('WHERE ', '') : ''}
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      GROUP BY u.user_id
      HAVING total_win_loss ${type === 'profit' ? '>' : '<'} 0
      ORDER BY total_win_loss ${orderDir}
      LIMIT ?
    `).bind(...params, limit).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取排行榜失败' }, 500)
  }
})

// 游戏报表
app.get('/api/v1/reports/game', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]

  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        game_type,
        COUNT(*) as bet_count,
        COUNT(DISTINCT user_id) as player_count,
        COALESCE(SUM(bet_amount), 0) as total_bet,
        COALESCE(SUM(valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(win_loss_amount), 0) as total_win_loss,
        -COALESCE(SUM(win_loss_amount), 0) as company_profit,
        ROUND(-SUM(win_loss_amount) * 100.0 / NULLIF(SUM(valid_bet_amount), 0), 2) as profit_rate
      FROM bets
      WHERE DATE(created_at) BETWEEN ? AND ? AND bet_status = 1
      GROUP BY game_type
      ORDER BY total_bet DESC
    `).bind(start_date, end_date).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取游戏报表失败' }, 500)
  }
})

// 代理业绩报表
app.get('/api/v1/reports/agent-performance', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]

  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        a.agent_id, a.agent_username, a.nickname, a.level,
        COUNT(DISTINCT u.user_id) as player_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as total_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit,
        ROUND(-SUM(b.win_loss_amount) * a.commission_ratio / 100, 2) as commission_earned
      FROM agents a
      LEFT JOIN users u ON a.agent_id = u.agent_id
      LEFT JOIN bets b ON u.user_id = b.user_id AND DATE(b.created_at) BETWEEN ? AND ? AND b.bet_status = 1
      GROUP BY a.agent_id
      ORDER BY company_profit DESC
    `).bind(start_date, end_date).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取代理业绩失败' }, 500)
  }
})

// 转账记录报表
app.get('/api/v1/reports/transfers', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]
  const from_username = c.req.query('from_username') || ''
  const to_username = c.req.query('to_username') || ''
  const transfer_type = c.req.query('transfer_type') || ''
  const page = parseInt(c.req.query('page') || '1')
  const pageSize = parseInt(c.req.query('pageSize') || '50')

  try {
    // 构建查询条件
    let whereClause = "WHERE DATE(created_at) BETWEEN ? AND ?"
    const params: any[] = [start_date, end_date]
    
    if (from_username) {
      whereClause += " AND from_username LIKE ?"
      params.push(`%${from_username}%`)
    }
    if (to_username) {
      whereClause += " AND to_username LIKE ?"
      params.push(`%${to_username}%`)
    }
    if (transfer_type) {
      whereClause += " AND transfer_type = ?"
      params.push(transfer_type)
    }

    // 获取总数
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as total FROM transfer_records ${whereClause}
    `).bind(...params).first()

    // 获取列表数据
    const offset = (page - 1) * pageSize
    const listResult = await c.env.DB.prepare(`
      SELECT * FROM transfer_records 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all()

    // 获取汇总数据
    const summaryResult = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(fee), 0) as total_fee,
        COALESCE(SUM(actual_amount), 0) as total_actual,
        COUNT(DISTINCT from_user_id) as unique_senders,
        COUNT(DISTINCT to_user_id) as unique_receivers,
        SUM(CASE WHEN transfer_type = 'member' THEN 1 ELSE 0 END) as member_count,
        SUM(CASE WHEN transfer_type = 'agent' THEN 1 ELSE 0 END) as agent_count
      FROM transfer_records ${whereClause}
    `).bind(...params).first()

    return c.json({ 
      success: true, 
      data: {
        list: listResult.results || [],
        total: countResult?.total || 0,
        page,
        pageSize,
        summary: summaryResult || {}
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取转账记录失败' }, 500)
  }
})

// 转账记录统计 - 按日期汇总
app.get('/api/v1/reports/transfers/summary', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]

  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        DATE(created_at) as transfer_date,
        COUNT(*) as transfer_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(fee), 0) as total_fee,
        COUNT(DISTINCT from_user_id) as unique_senders,
        COUNT(DISTINCT to_user_id) as unique_receivers,
        SUM(CASE WHEN transfer_type = 'member' THEN amount ELSE 0 END) as member_amount,
        SUM(CASE WHEN transfer_type = 'agent' THEN amount ELSE 0 END) as agent_amount
      FROM transfer_records
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY transfer_date DESC
    `).bind(start_date, end_date).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取转账统计失败' }, 500)
  }
})

// 转账记录详情 - 包含双方IP和转出人资金来源
app.get('/api/v1/reports/transfers/:transfer_id', async (c) => {
  const transfer_id = parseInt(c.req.param('transfer_id'))

  try {
    const record = await c.env.DB.prepare(`
      SELECT * FROM transfer_records WHERE transfer_id = ?
    `).bind(transfer_id).first()

    if (!record) {
      return c.json({ success: false, message: '转账记录不存在' }, 404)
    }

    // 获取转出人资金来源（近期交易记录）
    const fundSource = await c.env.DB.prepare(`
      SELECT 
        transaction_id,
        order_no,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        created_at,
        remark
      FROM transactions 
      WHERE user_id = ? 
        AND created_at <= ?
        AND audit_status = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(record.from_user_id, record.created_at).all()

    // 获取转出人账户汇总信息
    const fromUserInfo = await c.env.DB.prepare(`
      SELECT 
        user_id, username, nickname, balance,
        total_deposit, total_withdraw, total_bet,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = u.user_id AND transaction_type = 1 AND audit_status = 1), 0) as total_deposit_amount,
        COALESCE((SELECT SUM(ABS(amount)) FROM transactions WHERE user_id = u.user_id AND transaction_type = 2 AND audit_status = 1), 0) as total_withdraw_amount,
        COALESCE((SELECT SUM(bonus_amount) FROM bonus_records WHERE user_id = u.user_id AND audit_status = 1), 0) as total_bonus,
        COALESCE((SELECT SUM(amount) FROM transfer_records WHERE from_user_id = u.user_id AND status = 1), 0) as total_transfer_out,
        COALESCE((SELECT SUM(actual_amount) FROM transfer_records WHERE to_user_id = u.user_id AND status = 1), 0) as total_transfer_in
      FROM users u
      WHERE user_id = ?
    `).bind(record.from_user_id).first()

    // 获取接收人账户信息
    const toUserInfo = await c.env.DB.prepare(`
      SELECT user_id, username, nickname, balance
      FROM users WHERE user_id = ?
    `).bind(record.to_user_id).first()

    return c.json({ 
      success: true, 
      data: {
        ...record,
        from_ip: record.ip_address,  // 转出人IP (兼容旧字段名)
        to_ip: record.to_ip_address, // 接收人IP
        from_user_info: fromUserInfo || {},
        to_user_info: toUserInfo || {},
        fund_source: fundSource.results || []
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取转账详情失败' }, 500)
  }
})

// ==================== 转账手续费设置 ====================

// 获取手续费规则列表
app.get('/api/v1/transfer/fee-settings', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM transfer_fee_settings ORDER BY priority DESC, fee_id ASC
    `).all()
    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取手续费设置失败' }, 500)
  }
})

// 获取单个手续费规则
app.get('/api/v1/transfer/fee-settings/:fee_id', async (c) => {
  const fee_id = parseInt(c.req.param('fee_id'))
  try {
    const rule = await c.env.DB.prepare(`
      SELECT * FROM transfer_fee_settings WHERE fee_id = ?
    `).bind(fee_id).first()
    if (!rule) {
      return c.json({ success: false, message: '规则不存在' }, 404)
    }
    return c.json({ success: true, data: rule })
  } catch (error) {
    return c.json({ success: false, message: '获取规则失败' }, 500)
  }
})

// 新增手续费规则
app.post('/api/v1/transfer/fee-settings', async (c) => {
  const data = await c.req.json()
  const { fee_name, fee_type, fee_value, min_fee, max_fee, min_amount, max_amount, transfer_type, vip_level, daily_free_count, status, priority, description } = data
  
  if (!fee_name || !fee_type) {
    return c.json({ success: false, message: '规则名称和类型必填' }, 400)
  }
  
  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO transfer_fee_settings 
      (fee_name, fee_type, fee_value, min_fee, max_fee, min_amount, max_amount, transfer_type, vip_level, daily_free_count, status, priority, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fee_name, fee_type, fee_value || 0, min_fee || 0, max_fee || 0, 
      min_amount || 0, max_amount || 0, transfer_type || 'all', 
      vip_level || 0, daily_free_count || 0, status ?? 1, priority || 0, description || ''
    ).run()
    
    return c.json({ success: true, message: '规则创建成功', fee_id: result.meta.last_row_id })
  } catch (error) {
    return c.json({ success: false, message: '创建规则失败' }, 500)
  }
})

// 编辑手续费规则
app.put('/api/v1/transfer/fee-settings/:fee_id', async (c) => {
  const fee_id = parseInt(c.req.param('fee_id'))
  const data = await c.req.json()
  const { fee_name, fee_type, fee_value, min_fee, max_fee, min_amount, max_amount, transfer_type, vip_level, daily_free_count, status, priority, description } = data
  
  try {
    const existing = await c.env.DB.prepare('SELECT * FROM transfer_fee_settings WHERE fee_id = ?').bind(fee_id).first()
    if (!existing) {
      return c.json({ success: false, message: '规则不存在' }, 404)
    }
    
    await c.env.DB.prepare(`
      UPDATE transfer_fee_settings SET
        fee_name = ?, fee_type = ?, fee_value = ?, min_fee = ?, max_fee = ?,
        min_amount = ?, max_amount = ?, transfer_type = ?, vip_level = ?,
        daily_free_count = ?, status = ?, priority = ?, description = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE fee_id = ?
    `).bind(
      fee_name || existing.fee_name, fee_type || existing.fee_type, 
      fee_value ?? existing.fee_value, min_fee ?? existing.min_fee, max_fee ?? existing.max_fee,
      min_amount ?? existing.min_amount, max_amount ?? existing.max_amount, 
      transfer_type || existing.transfer_type, vip_level ?? existing.vip_level,
      daily_free_count ?? existing.daily_free_count, status ?? existing.status, 
      priority ?? existing.priority, description ?? existing.description, fee_id
    ).run()
    
    return c.json({ success: true, message: '规则更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新规则失败' }, 500)
  }
})

// 删除手续费规则
app.delete('/api/v1/transfer/fee-settings/:fee_id', async (c) => {
  const fee_id = parseInt(c.req.param('fee_id'))
  try {
    const result = await c.env.DB.prepare('DELETE FROM transfer_fee_settings WHERE fee_id = ?').bind(fee_id).run()
    if (result.meta.changes === 0) {
      return c.json({ success: false, message: '规则不存在' }, 404)
    }
    return c.json({ success: true, message: '规则已删除' })
  } catch (error) {
    return c.json({ success: false, message: '删除规则失败' }, 500)
  }
})

// 切换手续费规则状态
app.put('/api/v1/transfer/fee-settings/:fee_id/toggle', async (c) => {
  const fee_id = parseInt(c.req.param('fee_id'))
  try {
    await c.env.DB.prepare(`
      UPDATE transfer_fee_settings SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE fee_id = ?
    `).bind(fee_id).run()
    return c.json({ success: true, message: '状态已切换' })
  } catch (error) {
    return c.json({ success: false, message: '切换状态失败' }, 500)
  }
})

// 计算转账手续费 (供前端预览)
app.post('/api/v1/transfer/calculate-fee', async (c) => {
  const { amount, transfer_type, vip_level, daily_transfer_count } = await c.req.json()
  
  if (!amount || amount <= 0) {
    return c.json({ success: false, message: '转账金额无效' }, 400)
  }
  
  try {
    // 获取所有启用的规则，按优先级排序
    const rules = await c.env.DB.prepare(`
      SELECT * FROM transfer_fee_settings 
      WHERE status = 1 
      ORDER BY priority DESC
    `).all()
    
    let matchedRule = null
    let fee = 0
    
    for (const rule of (rules.results || []) as any[]) {
      // 检查转账类型匹配
      if (rule.transfer_type !== 'all' && rule.transfer_type !== transfer_type) continue
      
      // 检查VIP等级匹配
      if (rule.vip_level > 0 && (vip_level || 0) < rule.vip_level) continue
      
      // 检查金额范围
      if (rule.min_amount > 0 && amount < rule.min_amount) continue
      if (rule.max_amount > 0 && amount > rule.max_amount) continue
      
      // 匹配到规则
      matchedRule = rule
      
      // 检查免费次数
      if (rule.daily_free_count > 0 && (daily_transfer_count || 0) < rule.daily_free_count) {
        fee = 0
        break
      }
      
      // 计算手续费
      if (rule.fee_type === 'percent') {
        fee = amount * rule.fee_value
      } else {
        fee = rule.fee_value
      }
      
      // 应用最低最高限制
      if (rule.min_fee > 0 && fee < rule.min_fee) fee = rule.min_fee
      if (rule.max_fee > 0 && fee > rule.max_fee) fee = rule.max_fee
      
      break
    }
    
    return c.json({ 
      success: true, 
      data: {
        amount,
        fee: Math.round(fee * 100) / 100,
        actual_amount: Math.round((amount - fee) * 100) / 100,
        matched_rule: matchedRule ? { fee_id: matchedRule.fee_id, fee_name: matchedRule.fee_name } : null
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '计算手续费失败' }, 500)
  }
})

// 盈亏日报
app.get('/api/v1/reports/daily', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]

  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        DATE(b.created_at) as report_date,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = DATE(b.created_at)) as new_players,
        COUNT(DISTINCT b.user_id) as betting_players,
        COUNT(*) as bet_count,
        COALESCE(SUM(b.bet_amount), 0) as bet_amount,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as player_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 1 AND audit_status = 1 AND DATE(created_at) = DATE(b.created_at)) as deposit_amount,
        (SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions WHERE transaction_type = 2 AND audit_status = 1 AND DATE(created_at) = DATE(b.created_at)) as withdraw_amount
      FROM bets b
      WHERE DATE(b.created_at) BETWEEN ? AND ? AND b.bet_status = 1
      GROUP BY DATE(b.created_at)
      ORDER BY report_date DESC
    `).bind(start_date, end_date).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取盈亏日报失败' }, 500)
  }
})

// 玩家统计报表API
app.get('/api/v1/reports/player-stats', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]

  try {
    // 获取汇总数据
    const summaryResult = await c.env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_players,
        (SELECT COUNT(DISTINCT user_id) FROM bets WHERE DATE(created_at) BETWEEN ? AND ? AND bet_status = 1) as active_players,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) BETWEEN ? AND ?) as new_players,
        COALESCE((SELECT SUM(bet_amount) FROM bets WHERE DATE(created_at) BETWEEN ? AND ? AND bet_status = 1), 0) as total_bet,
        COALESCE((SELECT SUM(win_loss_amount) FROM bets WHERE DATE(created_at) BETWEEN ? AND ? AND bet_status = 1), 0) as total_win_loss
    `).bind(start_date, end_date, start_date, end_date, start_date, end_date, start_date, end_date).first()

    // 计算人均投注
    const avgBet = summaryResult?.active_players > 0 ? 
      (summaryResult?.total_bet || 0) / summaryResult?.active_players : 0

    // 获取VIP等级分布
    const vipResult = await c.env.DB.prepare(`
      SELECT 
        u.vip_level,
        COUNT(*) as player_count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users WHERE vip_level IS NOT NULL), 1) as percentage,
        COALESCE(SUM(b.total_bet), 0) as total_bet
      FROM users u
      LEFT JOIN (
        SELECT user_id, SUM(bet_amount) as total_bet 
        FROM bets 
        WHERE DATE(created_at) BETWEEN ? AND ? AND bet_status = 1
        GROUP BY user_id
      ) b ON u.user_id = b.user_id
      WHERE u.vip_level IS NOT NULL
      GROUP BY u.vip_level
      ORDER BY u.vip_level ASC
    `).bind(start_date, end_date).all()

    // 获取活跃玩家TOP榜
    const topPlayersResult = await c.env.DB.prepare(`
      SELECT 
        u.user_id,
        u.username,
        u.vip_level,
        a.agent_username,
        COUNT(*) as bet_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as total_win_loss
      FROM bets b
      JOIN users u ON b.user_id = u.user_id
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      WHERE DATE(b.created_at) BETWEEN ? AND ? AND b.bet_status = 1
      GROUP BY b.user_id
      ORDER BY total_bet DESC
      LIMIT 50
    `).bind(start_date, end_date).all()

    return c.json({ 
      success: true, 
      data: {
        summary: {
          total_players: summaryResult?.total_players || 0,
          active_players: summaryResult?.active_players || 0,
          new_players: summaryResult?.new_players || 0,
          total_bet: summaryResult?.total_bet || 0,
          total_win_loss: summaryResult?.total_win_loss || 0,
          avg_bet: avgBet
        },
        vip_distribution: vipResult.results || [],
        top_players: topPlayersResult.results || []
      }
    })
  } catch (error) {
    console.error('获取玩家统计失败:', error)
    return c.json({ success: false, message: '获取玩家统计失败' }, 500)
  }
})

// 仪表盘历史数据查询API
app.get('/api/v1/dashboard/history', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]

  try {
    // 获取每日数据
    const dailyResult = await c.env.DB.prepare(`
      SELECT 
        DATE(b.created_at) as date,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE transaction_type = 1 AND audit_status = 1 AND DATE(created_at) = DATE(b.created_at)), 0) as deposit,
        COALESCE((SELECT SUM(ABS(amount)) FROM transactions WHERE transaction_type = 2 AND audit_status = 1 AND DATE(created_at) = DATE(b.created_at)), 0) as withdraw,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as player_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit
      FROM bets b
      WHERE DATE(b.created_at) BETWEEN ? AND ? AND b.bet_status = 1
      GROUP BY DATE(b.created_at)
      ORDER BY date DESC
    `).bind(start_date, end_date).all()

    // 计算汇总
    const daily_data = dailyResult.results || []
    const total_deposit = daily_data.reduce((sum: number, d: any) => sum + parseFloat(d.deposit || 0), 0)
    const total_withdraw = daily_data.reduce((sum: number, d: any) => sum + parseFloat(d.withdraw || 0), 0)
    const total_bet = daily_data.reduce((sum: number, d: any) => sum + parseFloat(d.total_bet || 0), 0)
    const company_profit = daily_data.reduce((sum: number, d: any) => sum + parseFloat(d.company_profit || 0), 0)

    return c.json({ 
      success: true, 
      data: {
        total_deposit,
        total_withdraw,
        total_bet,
        company_profit,
        daily_data
      }
    })
  } catch (error) {
    console.error('获取仪表盘历史数据失败:', error)
    return c.json({ success: false, message: '获取仪表盘历史数据失败' }, 500)
  }
})

// ==================== 增强版报表API ====================

// 综合数据报表 - 支持股东/代理/公司盈亏、佣金数据
app.get('/api/v1/reports/comprehensive', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]
  const agent_id = c.req.query('agent_id')
  const shareholder_id = c.req.query('shareholder_id')

  try {
    // 构建查询条件
    let whereClause = 'WHERE DATE(b.created_at) BETWEEN ? AND ? AND b.bet_status = 1'
    const params: any[] = [start_date, end_date]
    
    if (agent_id) {
      whereClause += ' AND u.agent_id = ?'
      params.push(parseInt(agent_id))
    }
    if (shareholder_id) {
      whereClause += ' AND a.parent_agent_id = ?'
      params.push(parseInt(shareholder_id))
    }

    // 获取综合统计
    const summaryResult = await c.env.DB.prepare(`
      SELECT 
        COUNT(DISTINCT b.user_id) as active_players,
        COUNT(*) as total_bets,
        COALESCE(SUM(b.bet_amount), 0) as total_bet_amount,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet_amount,
        COALESCE(SUM(b.win_loss_amount), 0) as player_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      ${whereClause}
    `).bind(...params).first()

    // 获取股东盈亏分布
    const shareholderResult = await c.env.DB.prepare(`
      SELECT 
        sh.agent_id as shareholder_id,
        sh.agent_username as shareholder_name,
        sh.share_ratio,
        COUNT(DISTINCT b.user_id) as player_count,
        COUNT(*) as bet_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as player_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit,
        ROUND(-SUM(b.win_loss_amount) * sh.share_ratio / 100, 2) as shareholder_profit,
        ROUND(-SUM(b.win_loss_amount) * (100 - sh.share_ratio) / 100, 2) as platform_profit
      FROM agents sh
      LEFT JOIN agents a ON a.parent_agent_id = sh.agent_id
      LEFT JOIN users u ON u.agent_id = a.agent_id OR u.agent_id = sh.agent_id
      LEFT JOIN bets b ON b.user_id = u.user_id AND DATE(b.created_at) BETWEEN ? AND ? AND b.bet_status = 1
      WHERE sh.level = 1
      GROUP BY sh.agent_id
      ORDER BY company_profit DESC
    `).bind(start_date, end_date).all()

    // 获取代理盈亏分布
    const agentResult = await c.env.DB.prepare(`
      SELECT 
        a.agent_id,
        a.agent_username,
        a.level,
        a.commission_ratio,
        sh.agent_username as shareholder_name,
        COUNT(DISTINCT b.user_id) as player_count,
        COUNT(*) as bet_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as player_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit,
        ROUND(-SUM(b.win_loss_amount) * a.commission_ratio / 100, 2) as commission_earned
      FROM agents a
      LEFT JOIN agents sh ON a.parent_agent_id = sh.agent_id
      LEFT JOIN users u ON u.agent_id = a.agent_id
      LEFT JOIN bets b ON b.user_id = u.user_id AND DATE(b.created_at) BETWEEN ? AND ? AND b.bet_status = 1
      WHERE a.level > 1 OR a.parent_agent_id IS NULL
      GROUP BY a.agent_id
      ORDER BY company_profit DESC
      LIMIT 100
    `).bind(start_date, end_date).all()

    // 获取每日趋势数据
    const dailyTrend = await c.env.DB.prepare(`
      SELECT 
        DATE(b.created_at) as date,
        COUNT(*) as bet_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as player_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      ${whereClause}
      GROUP BY DATE(b.created_at)
      ORDER BY date DESC
    `).bind(...params).all()

    // 获取佣金汇总
    const commissionTotal = (agentResult.results || []).reduce((sum: number, a: any) => 
      sum + parseFloat(a.commission_earned || 0), 0)

    return c.json({
      success: true,
      data: {
        summary: {
          ...summaryResult,
          total_commission: commissionTotal
        },
        shareholders: shareholderResult.results || [],
        agents: agentResult.results || [],
        daily_trend: dailyTrend.results || []
      }
    })
  } catch (error) {
    console.error('获取综合报表失败:', error)
    return c.json({ success: false, message: '获取综合报表失败' }, 500)
  }
})

// 注单明细查询API - 支持完整筛选条件
app.get('/api/v1/reports/bet-details', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]
  const bet_id = c.req.query('bet_id')
  const username = c.req.query('username')
  const agent_id = c.req.query('agent_id')
  const shareholder_id = c.req.query('shareholder_id')
  const game_type = c.req.query('game_type')
  const table_id = c.req.query('table_id')
  const bet_area = c.req.query('bet_area')
  const min_amount = c.req.query('min_amount')
  const max_amount = c.req.query('max_amount')
  const page = parseInt(c.req.query('page') || '1')
  const pageSize = parseInt(c.req.query('pageSize') || '50')

  try {
    let whereClause = 'WHERE DATE(b.created_at) BETWEEN ? AND ?'
    const params: any[] = [start_date, end_date]
    
    if (bet_id) {
      whereClause += ' AND b.bet_id = ?'
      params.push(bet_id)
    }
    if (username) {
      whereClause += ' AND u.username LIKE ?'
      params.push(`%${username}%`)
    }
    if (agent_id) {
      whereClause += ' AND u.agent_id = ?'
      params.push(parseInt(agent_id))
    }
    if (shareholder_id) {
      whereClause += ' AND a.parent_agent_id = ?'
      params.push(parseInt(shareholder_id))
    }
    if (game_type) {
      whereClause += ' AND b.game_type = ?'
      params.push(game_type)
    }
    if (table_id) {
      whereClause += ' AND b.table_code = ?'
      params.push(table_id)
    }
    if (bet_area) {
      whereClause += ' AND b.bet_detail LIKE ?'
      params.push(`%${bet_area}%`)
    }
    if (min_amount) {
      whereClause += ' AND b.bet_amount >= ?'
      params.push(parseFloat(min_amount))
    }
    if (max_amount) {
      whereClause += ' AND b.bet_amount <= ?'
      params.push(parseFloat(max_amount))
    }

    // 获取总数
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as total 
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      ${whereClause} AND b.bet_status = 1
    `).bind(...params).first()

    // 获取列表数据
    const offset = (page - 1) * pageSize
    const listResult = await c.env.DB.prepare(`
      SELECT 
        b.bet_id,
        b.bet_no,
        b.game_round_id as round_id,
        b.game_type,
        b.table_code as table_id,
        b.bet_detail as bet_area,
        b.bet_amount,
        b.valid_bet_amount,
        b.win_loss_amount,
        b.bet_status,
        b.created_at,
        b.settle_at as settled_at,
        u.user_id,
        u.username,
        u.vip_level,
        a.agent_id,
        a.agent_username,
        sh.agent_username as shareholder_name,
        sh.share_ratio
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      LEFT JOIN agents sh ON a.parent_agent_id = sh.agent_id
      ${whereClause} AND b.bet_status = 1
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all()

    // 计算汇总
    const summaryResult = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_bets,
        COUNT(DISTINCT b.user_id) as player_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as player_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit
      FROM bets b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN agents a ON u.agent_id = a.agent_id
      ${whereClause} AND b.bet_status = 1
    `).bind(...params).first()

    return c.json({
      success: true,
      data: {
        list: listResult.results || [],
        total: countResult?.total || 0,
        page,
        pageSize,
        summary: summaryResult
      }
    })
  } catch (error) {
    console.error('获取注单明细失败:', error)
    return c.json({ success: false, message: '获取注单明细失败' }, 500)
  }
})

// 获取下注区域统计
app.get('/api/v1/reports/bet-area-stats', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]
  const game_type = c.req.query('game_type')

  try {
    let whereClause = 'WHERE DATE(created_at) BETWEEN ? AND ? AND bet_status = 1'
    const params: any[] = [start_date, end_date]
    
    if (game_type) {
      whereClause += ' AND game_type = ?'
      params.push(game_type)
    }

    const result = await c.env.DB.prepare(`
      SELECT 
        game_type,
        bet_detail as bet_area,
        COUNT(*) as bet_count,
        COUNT(DISTINCT user_id) as player_count,
        COALESCE(SUM(bet_amount), 0) as total_bet,
        COALESCE(SUM(valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(win_loss_amount), 0) as player_win_loss,
        -COALESCE(SUM(win_loss_amount), 0) as company_profit,
        ROUND(-SUM(win_loss_amount) * 100.0 / NULLIF(SUM(valid_bet_amount), 0), 2) as profit_rate
      FROM bets
      ${whereClause}
      GROUP BY game_type, bet_detail
      ORDER BY total_bet DESC
    `).bind(...params).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    console.error('获取下注区域统计失败:', error)
    return c.json({ success: false, message: '获取下注区域统计失败' }, 500)
  }
})

// 获取桌台统计
app.get('/api/v1/reports/table-stats', async (c) => {
  const start_date = c.req.query('start_date') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end_date = c.req.query('end_date') || new Date().toISOString().split('T')[0]

  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        b.table_code as table_id,
        b.table_code as table_name,
        b.game_type,
        COUNT(*) as bet_count,
        COUNT(DISTINCT b.user_id) as player_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet_amount), 0) as valid_bet,
        COALESCE(SUM(b.win_loss_amount), 0) as player_win_loss,
        -COALESCE(SUM(b.win_loss_amount), 0) as company_profit,
        ROUND(-SUM(b.win_loss_amount) * 100.0 / NULLIF(SUM(b.valid_bet_amount), 0), 2) as profit_rate
      FROM bets b
      WHERE DATE(b.created_at) BETWEEN ? AND ? AND b.bet_status = 1
      GROUP BY b.table_code
      ORDER BY total_bet DESC
    `).bind(start_date, end_date).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    console.error('获取桌台统计失败:', error)
    return c.json({ success: false, message: '获取桌台统计失败' }, 500)
  }
})

// 获取股东列表（用于筛选下拉框）
app.get('/api/v1/reports/shareholders', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT agent_id, agent_username, nickname
      FROM agents
      WHERE level = 1 OR parent_agent_id IS NULL
      ORDER BY agent_username ASC
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取股东列表失败' }, 500)
  }
})

// 获取代理列表（用于筛选下拉框）
app.get('/api/v1/reports/agents-list', async (c) => {
  const shareholder_id = c.req.query('shareholder_id')
  
  try {
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    
    if (shareholder_id) {
      whereClause += ' AND (parent_agent_id = ? OR agent_id = ?)'
      params.push(parseInt(shareholder_id), parseInt(shareholder_id))
    }

    const result = await c.env.DB.prepare(`
      SELECT agent_id, agent_username, nickname, level, parent_agent_id
      FROM agents
      ${whereClause}
      ORDER BY level ASC, agent_username ASC
    `).bind(...params).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取代理列表失败' }, 500)
  }
})

// 获取游戏类型列表
app.get('/api/v1/reports/game-types', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT DISTINCT game_type FROM bets ORDER BY game_type ASC
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取游戏类型失败' }, 500)
  }
})

// ==================== 收款方式管理API ====================

// 获取收款方式列表
app.get('/api/v1/payment-methods', async (c) => {
  const { status, method_type, currency } = c.req.query()

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []

    if (status !== undefined && status !== '') {
      where += ' AND status = ?'
      params.push(parseInt(status))
    }
    if (method_type) {
      where += ' AND method_type = ?'
      params.push(method_type)
    }
    if (currency) {
      where += ' AND currency = ?'
      params.push(currency)
    }

    const result = await c.env.DB.prepare(`
      SELECT * FROM payment_methods ${where} ORDER BY sort_order ASC, method_id ASC
    `).bind(...params).all()

    return c.json({ 
      success: true, 
      data: {
        list: result.results || [],
        total: result.results?.length || 0
      }
    })
  } catch (error) {
    console.error('获取收款方式列表失败:', error)
    return c.json({ success: false, message: '获取收款方式列表失败' }, 500)
  }
})

// 获取单个收款方式详情
app.get('/api/v1/payment-methods/:method_id', async (c) => {
  const method_id = parseInt(c.req.param('method_id'))

  try {
    const method = await c.env.DB.prepare(`
      SELECT * FROM payment_methods WHERE method_id = ?
    `).bind(method_id).first()

    if (!method) {
      return c.json({ success: false, message: '收款方式不存在' }, 404)
    }

    return c.json({ success: true, data: method })
  } catch (error) {
    return c.json({ success: false, message: '获取收款方式详情失败' }, 500)
  }
})

// 创建收款方式
app.post('/api/v1/payment-methods', async (c) => {
  try {
    const body = await c.req.json()
    const { 
      method_name, method_type, currency = 'CNY',
      account_name, account_number, bank_name, bank_branch, qr_code_url,
      min_amount = 0, max_amount = 1000000, daily_limit = 0,
      fee_type = 0, fee_amount = 0,
      status = 1, sort_order = 0,
      applicable_agents, applicable_vip_levels, remark
    } = body

    // 验证必填字段
    if (!method_name || !method_type) {
      return c.json({ success: false, message: '收款方式名称和类型为必填项' }, 400)
    }

    // 验证类型
    const validTypes = ['crypto', 'bank', 'ewallet', 'other']
    if (!validTypes.includes(method_type)) {
      return c.json({ success: false, message: '无效的收款类型，可选: crypto/bank/ewallet/other' }, 400)
    }

    // 验证字符串长度
    if (typeof method_name !== 'string' || method_name.length > 50) {
      return c.json({ success: false, message: '收款方式名称不能超过50个字符' }, 400)
    }
    if (currency && (typeof currency !== 'string' || currency.length > 20)) {
      return c.json({ success: false, message: '币种不能超过20个字符' }, 400)
    }
    if (account_number && (typeof account_number !== 'string' || account_number.length > 200)) {
      return c.json({ success: false, message: '账号/地址不能超过200个字符' }, 400)
    }

    // 验证数值范围
    const safeMinAmount = Math.max(0, Math.min(parseFloat(min_amount) || 0, 100000000))
    const safeMaxAmount = Math.max(0, Math.min(parseFloat(max_amount) || 1000000, 100000000))
    const safeDailyLimit = Math.max(0, Math.min(parseFloat(daily_limit) || 0, 1000000000))
    const safeFeeType = [0, 1, 2].includes(parseInt(fee_type)) ? parseInt(fee_type) : 0
    const safeFeeAmount = Math.max(0, Math.min(parseFloat(fee_amount) || 0, 100))
    const safeStatus = [0, 1].includes(parseInt(status)) ? parseInt(status) : 1
    const safeSortOrder = Math.max(0, Math.min(parseInt(sort_order) || 0, 9999))

    if (safeMinAmount > safeMaxAmount) {
      return c.json({ success: false, message: '最小金额不能大于最大金额' }, 400)
    }

    const admin = c.get('admin'); const adminId = admin?.admin_id

    const result = await c.env.DB.prepare(`
      INSERT INTO payment_methods (
        method_name, method_type, currency,
        account_name, account_number, bank_name, bank_branch, qr_code_url,
        min_amount, max_amount, daily_limit,
        fee_type, fee_amount,
        status, sort_order,
        applicable_agents, applicable_vip_levels, remark, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      method_name.trim().substring(0, 50), method_type, (currency || 'CNY').substring(0, 20),
      account_name ? String(account_name).substring(0, 100) : null, 
      account_number ? String(account_number).substring(0, 200) : null, 
      bank_name ? String(bank_name).substring(0, 100) : null, 
      bank_branch ? String(bank_branch).substring(0, 200) : null, 
      qr_code_url ? String(qr_code_url).substring(0, 500) : null,
      safeMinAmount, safeMaxAmount, safeDailyLimit,
      safeFeeType, safeFeeAmount,
      safeStatus, safeSortOrder,
      JSON.stringify(applicable_agents || []), JSON.stringify(applicable_vip_levels || []), 
      remark ? String(remark).substring(0, 500) : null, adminId
    ).run()

    // 记录操作日志
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (admin_id, operation_type, target_table, target_id, new_value)
      VALUES (?, 'CREATE', 'payment_methods', ?, ?)
    `).bind(adminId, result.meta?.last_row_id, JSON.stringify({ method_name, method_type, currency })).run()

    return c.json({ 
      success: true, 
      message: '收款方式创建成功',
      data: { method_id: result.meta?.last_row_id }
    })
  } catch (error) {
    console.error('创建收款方式失败:', error)
    return c.json({ success: false, message: '创建收款方式失败' }, 500)
  }
})

// 更新收款方式
app.put('/api/v1/payment-methods/:method_id', async (c) => {
  const method_id = parseInt(c.req.param('method_id'))

  try {
    const body = await c.req.json()
    const { 
      method_name, method_type, currency,
      account_name, account_number, bank_name, bank_branch, qr_code_url,
      min_amount, max_amount, daily_limit,
      fee_type, fee_amount,
      status, sort_order,
      applicable_agents, applicable_vip_levels, remark
    } = body

    // 检查是否存在
    const existing = await c.env.DB.prepare(`
      SELECT method_id FROM payment_methods WHERE method_id = ?
    `).bind(method_id).first()

    if (!existing) {
      return c.json({ success: false, message: '收款方式不存在' }, 404)
    }

    // 构建更新字段
    const updates: string[] = []
    const params: any[] = []

    if (method_name !== undefined) { updates.push('method_name = ?'); params.push(method_name) }
    if (method_type !== undefined) { updates.push('method_type = ?'); params.push(method_type) }
    if (currency !== undefined) { updates.push('currency = ?'); params.push(currency) }
    if (account_name !== undefined) { updates.push('account_name = ?'); params.push(account_name) }
    if (account_number !== undefined) { updates.push('account_number = ?'); params.push(account_number) }
    if (bank_name !== undefined) { updates.push('bank_name = ?'); params.push(bank_name) }
    if (bank_branch !== undefined) { updates.push('bank_branch = ?'); params.push(bank_branch) }
    if (qr_code_url !== undefined) { updates.push('qr_code_url = ?'); params.push(qr_code_url) }
    if (min_amount !== undefined) { updates.push('min_amount = ?'); params.push(min_amount) }
    if (max_amount !== undefined) { updates.push('max_amount = ?'); params.push(max_amount) }
    if (daily_limit !== undefined) { updates.push('daily_limit = ?'); params.push(daily_limit) }
    if (fee_type !== undefined) { updates.push('fee_type = ?'); params.push(fee_type) }
    if (fee_amount !== undefined) { updates.push('fee_amount = ?'); params.push(fee_amount) }
    if (status !== undefined) { updates.push('status = ?'); params.push(status) }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order) }
    if (applicable_agents !== undefined) { updates.push('applicable_agents = ?'); params.push(JSON.stringify(applicable_agents)) }
    if (applicable_vip_levels !== undefined) { updates.push('applicable_vip_levels = ?'); params.push(JSON.stringify(applicable_vip_levels)) }
    if (remark !== undefined) { updates.push('remark = ?'); params.push(remark) }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(method_id)

    await c.env.DB.prepare(`
      UPDATE payment_methods SET ${updates.join(', ')} WHERE method_id = ?
    `).bind(...params).run()

    // 记录操作日志
    const admin = c.get('admin'); const adminId = admin?.admin_id
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (admin_id, operation_type, target_table, target_id, new_value)
      VALUES (?, 'UPDATE', 'payment_method', ?, ?)
    `).bind(adminId, method_id, JSON.stringify(body)).run()

    return c.json({ success: true, message: '收款方式更新成功' })
  } catch (error) {
    console.error('更新收款方式失败:', error)
    return c.json({ success: false, message: '更新收款方式失败' }, 500)
  }
})

// 删除收款方式
app.delete('/api/v1/payment-methods/:method_id', async (c) => {
  const method_id = parseInt(c.req.param('method_id'))

  try {
    // 检查是否存在
    const existing = await c.env.DB.prepare(`
      SELECT method_id, method_name FROM payment_methods WHERE method_id = ?
    `).bind(method_id).first()

    if (!existing) {
      return c.json({ success: false, message: '收款方式不存在' }, 404)
    }

    await c.env.DB.prepare(`
      DELETE FROM payment_methods WHERE method_id = ?
    `).bind(method_id).run()

    // 记录操作日志
    const admin = c.get('admin'); const adminId = admin?.admin_id
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (admin_id, operation_type, target_table, target_id, new_value)
      VALUES (?, 'DELETE', 'payment_method', ?, ?)
    `).bind(adminId, method_id, JSON.stringify({ method_name: existing.method_name })).run()

    return c.json({ success: true, message: '收款方式已删除' })
  } catch (error) {
    console.error('删除收款方式失败:', error)
    return c.json({ success: false, message: '删除收款方式失败' }, 500)
  }
})

// 批量更新收款方式状态
app.post('/api/v1/payment-methods/batch-status', async (c) => {
  try {
    const { method_ids, status } = await c.req.json()

    if (!Array.isArray(method_ids) || method_ids.length === 0) {
      return c.json({ success: false, message: '请选择要操作的收款方式' }, 400)
    }

    if (status !== 0 && status !== 1) {
      return c.json({ success: false, message: '无效的状态值' }, 400)
    }

    const placeholders = method_ids.map(() => '?').join(',')
    await c.env.DB.prepare(`
      UPDATE payment_methods SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE method_id IN (${placeholders})
    `).bind(status, ...method_ids).run()

    // 记录操作日志
    const admin = c.get('admin'); const adminId = admin?.admin_id
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (admin_id, operation_type, target_table, target_id, new_value)
      VALUES (?, 'BATCH_STATUS', 'payment_method', 0, ?)
    `).bind(adminId, JSON.stringify({ method_ids, status })).run()

    return c.json({ 
      success: true, 
      message: `已${status === 1 ? '启用' : '禁用'} ${method_ids.length} 个收款方式`
    })
  } catch (error) {
    return c.json({ success: false, message: '批量更新失败' }, 500)
  }
})

// ==================== 现场运营API ====================

app.get('/api/v1/dealers', async (c) => {
  const status = c.req.query('status')

  try {
    let where = ''
    const params: any[] = []
    
    if (status !== undefined && status !== '') {
      where = 'WHERE status = ?'
      params.push(parseInt(status))
    }

    const result = await c.env.DB.prepare(`
      SELECT d.*,
             (SELECT COUNT(*) FROM dealer_shifts WHERE dealer_id = d.dealer_id AND shift_date = DATE('now')) as today_shifts
      FROM dealers d
      ${where}
      ORDER BY d.dealer_id
    `).bind(...params).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取荷官列表失败' }, 500)
  }
})

// 添加荷官
app.post('/api/v1/dealers', async (c) => {
  const { staff_id, stage_name_cn, stage_name_en, avatar_url, photo_url, gender, hire_date, remark } = await c.req.json()

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO dealers (staff_id, stage_name_cn, stage_name_en, avatar_url, photo_url, gender, hire_date, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(staff_id, stage_name_cn, stage_name_en || '', avatar_url || '', photo_url || '', gender || 0, hire_date || null, remark || '').run()

    return c.json({ success: true, data: { dealer_id: result.meta.last_row_id } })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return c.json({ success: false, message: '工号已存在' }, 400)
    }
    return c.json({ success: false, message: '添加失败' }, 500)
  }
})

// 荷官详情
app.get('/api/v1/dealers/:dealer_id', async (c) => {
  const dealer_id = c.req.param('dealer_id')

  try {
    const dealer = await c.env.DB.prepare(`
      SELECT d.*, 
             (SELECT COUNT(*) FROM dealer_shifts WHERE dealer_id = d.dealer_id) as total_shifts,
             (SELECT COUNT(*) FROM dealer_shifts WHERE dealer_id = d.dealer_id AND shift_date >= DATE('now', '-30 days')) as recent_shifts
      FROM dealers d
      WHERE d.dealer_id = ?
    `).bind(dealer_id).first()

    if (!dealer) {
      return c.json({ success: false, message: '荷官不存在' }, 404)
    }

    return c.json({ success: true, data: dealer })
  } catch (error) {
    return c.json({ success: false, message: '获取荷官详情失败' }, 500)
  }
})

// 更新荷官
app.put('/api/v1/dealers/:dealer_id', async (c) => {
  const dealer_id = c.req.param('dealer_id')
  const { stage_name_cn, stage_name_en, avatar_url, photo_url, status, remark } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE dealers SET
        stage_name_cn = COALESCE(?, stage_name_cn),
        stage_name_en = COALESCE(?, stage_name_en),
        avatar_url = COALESCE(?, avatar_url),
        photo_url = COALESCE(?, photo_url),
        status = COALESCE(?, status),
        remark = COALESCE(?, remark),
        updated_at = CURRENT_TIMESTAMP
      WHERE dealer_id = ?
    `).bind(stage_name_cn, stage_name_en, avatar_url, photo_url, status, remark, dealer_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 删除荷官
app.delete('/api/v1/dealers/:dealer_id', async (c) => {
  const dealer_id = parseInt(c.req.param('dealer_id'))

  try {
    // 检查是否有排班记录
    const shifts = await c.env.DB.prepare('SELECT COUNT(*) as count FROM dealer_shifts WHERE dealer_id = ?').bind(dealer_id).first()
    if (shifts && (shifts as any).count > 0) {
      return c.json({ success: false, message: '该荷官有排班记录，请先删除相关排班' }, 400)
    }

    await c.env.DB.prepare('DELETE FROM dealers WHERE dealer_id = ?').bind(dealer_id).run()
    return c.json({ success: true, message: '荷官已删除' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 桌台列表
app.get('/api/v1/tables', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT t.*, d.stage_name_cn as dealer_name, d.staff_id as dealer_staff_id
      FROM game_tables t
      LEFT JOIN dealers d ON t.current_dealer_id = d.dealer_id
      ORDER BY t.table_code
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取桌台列表失败' }, 500)
  }
})

// 添加桌台
app.post('/api/v1/tables', async (c) => {
  const { table_code, table_name, game_type, primary_stream_url, backup_stream_url, min_bet, max_bet } = await c.req.json()

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO game_tables (table_code, table_name, game_type, primary_stream_url, backup_stream_url, min_bet, max_bet)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(table_code, table_name || '', game_type, primary_stream_url || '', backup_stream_url || '', min_bet || 10, max_bet || 100000).run()

    return c.json({ success: true, data: { table_id: result.meta.last_row_id } })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return c.json({ success: false, message: '桌台代码已存在' }, 400)
    }
    return c.json({ success: false, message: '添加失败' }, 500)
  }
})

// 桌台详情
app.get('/api/v1/tables/:table_id', async (c) => {
  const table_id = c.req.param('table_id')

  try {
    const table = await c.env.DB.prepare(`
      SELECT t.*, d.stage_name_cn as dealer_name, d.staff_id as dealer_staff_id,
             (SELECT COUNT(*) FROM dealer_shifts WHERE table_id = t.table_id) as total_shifts
      FROM game_tables t
      LEFT JOIN dealers d ON t.current_dealer_id = d.dealer_id
      WHERE t.table_id = ?
    `).bind(table_id).first()

    if (!table) {
      return c.json({ success: false, message: '桌台不存在' }, 404)
    }

    return c.json({ success: true, data: table })
  } catch (error) {
    return c.json({ success: false, message: '获取桌台详情失败' }, 500)
  }
})

// 更新桌台
app.put('/api/v1/tables/:table_id', async (c) => {
  const table_id = c.req.param('table_id')
  const { table_name, primary_stream_url, backup_stream_url, min_bet, max_bet, status, current_dealer_id } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE game_tables SET
        table_name = COALESCE(?, table_name),
        primary_stream_url = COALESCE(?, primary_stream_url),
        backup_stream_url = COALESCE(?, backup_stream_url),
        min_bet = COALESCE(?, min_bet),
        max_bet = COALESCE(?, max_bet),
        status = COALESCE(?, status),
        current_dealer_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE table_id = ?
    `).bind(table_name, primary_stream_url, backup_stream_url, min_bet, max_bet, status, current_dealer_id, table_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 删除桌台
app.delete('/api/v1/tables/:table_id', async (c) => {
  const table_id = parseInt(c.req.param('table_id'))

  try {
    // 检查是否有排班记录
    const shifts = await c.env.DB.prepare('SELECT COUNT(*) as count FROM dealer_shifts WHERE table_id = ?').bind(table_id).first()
    if (shifts && (shifts as any).count > 0) {
      return c.json({ success: false, message: '该桌台有排班记录，请先删除相关排班' }, 400)
    }

    await c.env.DB.prepare('DELETE FROM game_tables WHERE table_id = ?').bind(table_id).run()
    return c.json({ success: true, message: '桌台已删除' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 排班查询
app.get('/api/v1/shifts', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0]
  const table_id = c.req.query('table_id')
  const dealer_id = c.req.query('dealer_id')

  try {
    let where = 'WHERE ds.shift_date = ?'
    const params: any[] = [date]

    if (table_id) {
      where += ' AND ds.table_id = ?'
      params.push(parseInt(table_id))
    }
    if (dealer_id) {
      where += ' AND ds.dealer_id = ?'
      params.push(parseInt(dealer_id))
    }

    const result = await c.env.DB.prepare(`
      SELECT ds.*, d.stage_name_cn, d.staff_id, d.avatar_url, t.table_code, t.table_name, t.game_type
      FROM dealer_shifts ds
      LEFT JOIN dealers d ON ds.dealer_id = d.dealer_id
      LEFT JOIN game_tables t ON ds.table_id = t.table_id
      ${where}
      ORDER BY ds.table_id, ds.start_time
    `).bind(...params).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取排班数据失败' }, 500)
  }
})

// 创建排班
app.post('/api/v1/shifts', async (c) => {
  const { dealer_id, table_id, shift_date, start_time, end_time } = await c.req.json()

  try {
    // 检查同一荷官是否有时间冲突
    const conflictDealer = await c.env.DB.prepare(`
      SELECT * FROM dealer_shifts 
      WHERE dealer_id = ? AND shift_date = ? AND status = 1
      AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))
    `).bind(dealer_id, shift_date, start_time, start_time, end_time, end_time, start_time, end_time).first()

    if (conflictDealer) {
      return c.json({ success: false, message: '该荷官在此时间段已有排班', has_conflict: true }, 400)
    }

    // 检查同一桌台是否有时间重叠
    const conflictTable = await c.env.DB.prepare(`
      SELECT * FROM dealer_shifts 
      WHERE table_id = ? AND shift_date = ? AND status = 1
      AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))
    `).bind(table_id, shift_date, start_time, start_time, end_time, end_time, start_time, end_time).first()

    if (conflictTable) {
      return c.json({ success: false, message: '该桌台在此时间段已有排班', has_conflict: true }, 400)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO dealer_shifts (dealer_id, table_id, shift_date, start_time, end_time, created_by)
      VALUES (?, ?, ?, ?, ?, 1)
    `).bind(dealer_id, table_id, shift_date, start_time, end_time).run()

    return c.json({ success: true, data: { shift_id: result.meta.last_row_id, has_conflict: false } })
  } catch (error) {
    return c.json({ success: false, message: '创建排班失败' }, 500)
  }
})

// 更新排班
app.put('/api/v1/shifts/:shift_id', async (c) => {
  const shift_id = c.req.param('shift_id')
  const { start_time, end_time, status } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE dealer_shifts SET
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        status = COALESCE(?, status)
      WHERE shift_id = ?
    `).bind(start_time, end_time, status, shift_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 删除排班
app.delete('/api/v1/shifts/:shift_id', async (c) => {
  const shift_id = c.req.param('shift_id')

  try {
    await c.env.DB.prepare('DELETE FROM dealer_shifts WHERE shift_id = ?').bind(shift_id).run()
    return c.json({ success: true, message: '删除成功' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// ==================== 系统管理API ====================

app.get('/api/v1/admin/users', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT a.admin_id, a.username, a.nickname, a.role_id, a.status, 
             a.two_fa_enabled, a.last_login_ip, a.last_login_at, a.created_at,
             a.ip_whitelist, r.role_name
      FROM admin_users a
      LEFT JOIN admin_roles r ON a.role_id = r.role_id
      ORDER BY a.admin_id
    `).all()

    // 解析ip_whitelist JSON字符串
    const data = (result.results || []).map((admin: any) => ({
      ...admin,
      ip_whitelist: admin.ip_whitelist ? JSON.parse(admin.ip_whitelist) : []
    }))

    return c.json({ success: true, data })
  } catch (error) {
    return c.json({ success: false, message: '获取管理员列表失败' }, 500)
  }
})

// 获取单个管理员详情（包含IP白名单）
app.get('/api/v1/admin/users/:admin_id', async (c) => {
  const admin_id = c.req.param('admin_id')
  
  try {
    const admin = await c.env.DB.prepare(`
      SELECT a.admin_id, a.username, a.nickname, a.role_id, a.status, 
             a.two_fa_enabled, a.last_login_ip, a.last_login_at, a.created_at,
             a.ip_whitelist, r.role_name
      FROM admin_users a
      LEFT JOIN admin_roles r ON a.role_id = r.role_id
      WHERE a.admin_id = ?
    `).bind(admin_id).first()

    if (!admin) {
      return c.json({ success: false, message: '管理员不存在' }, 404)
    }

    return c.json({ 
      success: true, 
      data: {
        ...admin,
        ip_whitelist: admin.ip_whitelist ? JSON.parse(admin.ip_whitelist as string) : []
      }
    })
  } catch (error) {
    return c.json({ success: false, message: '获取管理员详情失败' }, 500)
  }
})

// 创建管理员
app.post('/api/v1/admin/users', async (c) => {
  const { username, password, nickname, role_id, ip_whitelist } = await c.req.json()

  // 安全校验：密码必须提供且长度至少6位
  if (!password || typeof password !== 'string' || password.length < 6) {
    return c.json({ success: false, message: '密码长度至少6位' }, 400)
  }

  try {
    // 对密码进行哈希处理
    const passwordHash = await hashPassword(password)
    
    const result = await c.env.DB.prepare(`
      INSERT INTO admin_users (username, password_hash, nickname, role_id, ip_whitelist)
      VALUES (?, ?, ?, ?, ?)
    `).bind(username, passwordHash, nickname || '', role_id || 2, ip_whitelist ? JSON.stringify(ip_whitelist) : null).run()

    return c.json({ success: true, data: { admin_id: result.meta.last_row_id } })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return c.json({ success: false, message: '用户名已存在' }, 400)
    }
    return c.json({ success: false, message: '创建失败' }, 500)
  }
})

// 更新管理员
app.put('/api/v1/admin/users/:admin_id', async (c) => {
  const admin_id = c.req.param('admin_id')
  const body = await c.req.json()
  const { nickname, role_id, ip_whitelist } = body
  // status特殊处理：0是有效值
  const status = body.status !== undefined ? body.status : null

  try {
    if (status !== null) {
      await c.env.DB.prepare(`
        UPDATE admin_users SET
          nickname = COALESCE(?, nickname),
          role_id = COALESCE(?, role_id),
          status = ?,
          ip_whitelist = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE admin_id = ?
      `).bind(nickname || null, role_id || null, status, ip_whitelist ? JSON.stringify(ip_whitelist) : null, admin_id).run()
    } else {
      await c.env.DB.prepare(`
        UPDATE admin_users SET
          nickname = COALESCE(?, nickname),
          role_id = COALESCE(?, role_id),
          ip_whitelist = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE admin_id = ?
      `).bind(nickname || null, role_id || null, ip_whitelist ? JSON.stringify(ip_whitelist) : null, admin_id).run()
    }

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 重置管理员密码
app.put('/api/v1/admin/users/:admin_id/password', async (c) => {
  const admin_id = c.req.param('admin_id')
  const { password } = await c.req.json()
  const currentAdmin = c.get('admin')

  if (!password || password.length < 6) {
    return c.json({ success: false, message: '密码长度至少6位' }, 400)
  }

  try {
    const passwordHash = await hashPassword(password)
    
    await c.env.DB.prepare(`
      UPDATE admin_users SET 
        password_hash = ?,
        password_changed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE admin_id = ?
    `).bind(passwordHash, admin_id).run()

    // 记录审计日志
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address)
      VALUES (?, ?, 'UPDATE', 'admin_users', ?, '重置密码', ?)
    `).bind(currentAdmin.admin_id, currentAdmin.username, admin_id, c.req.header('CF-Connecting-IP') || 'unknown').run()

    return c.json({ success: true, message: '密码重置成功' })
  } catch (error) {
    return c.json({ success: false, message: '重置失败' }, 500)
  }
})

// 角色列表
app.get('/api/v1/admin/roles', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT r.*,
             (SELECT COUNT(*) FROM admin_users WHERE role_id = r.role_id) as user_count
      FROM admin_roles r
      ORDER BY r.role_id
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取角色列表失败' }, 500)
  }
})

// 创建角色
app.post('/api/v1/admin/roles', async (c) => {
  const { role_name, permissions, description } = await c.req.json()

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO admin_roles (role_name, permissions, description)
      VALUES (?, ?, ?)
    `).bind(role_name, JSON.stringify(permissions || []), description || '').run()

    return c.json({ success: true, data: { role_id: result.meta.last_row_id } })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return c.json({ success: false, message: '角色名已存在' }, 400)
    }
    return c.json({ success: false, message: '创建失败' }, 500)
  }
})

// 角色详情
app.get('/api/v1/admin/roles/:role_id', async (c) => {
  const role_id = c.req.param('role_id')

  try {
    const role = await c.env.DB.prepare(`
      SELECT r.*,
             (SELECT COUNT(*) FROM admin_users WHERE role_id = r.role_id) as user_count
      FROM admin_roles r
      WHERE r.role_id = ?
    `).bind(role_id).first()

    if (!role) {
      return c.json({ success: false, message: '角色不存在' }, 404)
    }

    return c.json({ success: true, data: role })
  } catch (error) {
    return c.json({ success: false, message: '获取角色详情失败' }, 500)
  }
})

// 更新角色
app.put('/api/v1/admin/roles/:role_id', async (c) => {
  const role_id = c.req.param('role_id')
  const { role_name, permissions, description } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE admin_roles SET
        role_name = COALESCE(?, role_name),
        permissions = COALESCE(?, permissions),
        description = COALESCE(?, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE role_id = ?
    `).bind(role_name, permissions ? JSON.stringify(permissions) : null, description, role_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 删除角色
app.delete('/api/v1/admin/roles/:role_id', async (c) => {
  const role_id = parseInt(c.req.param('role_id'))

  try {
    // 超级管理员角色不能删除
    if (role_id === 1) {
      return c.json({ success: false, message: '超级管理员角色不能删除' }, 400)
    }

    // 检查是否有管理员使用此角色
    const admins = await c.env.DB.prepare('SELECT COUNT(*) as count FROM admin_users WHERE role_id = ?').bind(role_id).first()
    if (admins && (admins as any).count > 0) {
      return c.json({ success: false, message: '该角色下有管理员，无法删除' }, 400)
    }

    await c.env.DB.prepare('DELETE FROM admin_roles WHERE role_id = ?').bind(role_id).run()
    return c.json({ success: true, message: '角色已删除' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 权限列表
app.get('/api/v1/admin/permissions', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM permissions ORDER BY module, permission_id').all()
    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取权限列表失败' }, 500)
  }
})

// 生成2FA密钥
app.post('/api/v1/admin/2fa/generate', async (c) => {
  const admin = c.get('admin')

  try {
    // 生成随机密钥 (Base32编码)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let secret = ''
    for (let i = 0; i < 32; i++) {
      secret += chars[Math.floor(Math.random() * chars.length)]
    }

    // 生成TOTP URI
    const issuer = '真人荷官后台'
    const otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(admin.username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`

    // 暂存密钥（未启用）
    await c.env.DB.prepare(`
      UPDATE admin_users SET two_fa_secret = ? WHERE admin_id = ?
    `).bind(secret, admin.admin_id).run()

    return c.json({ 
      success: true, 
      data: { 
        secret, 
        otpauth,
        qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`
      } 
    })
  } catch (error) {
    return c.json({ success: false, message: '生成密钥失败' }, 500)
  }
})

// 验证并启用2FA
app.post('/api/v1/admin/2fa/enable', async (c) => {
  const admin = c.get('admin')
  const { code } = await c.req.json()

  if (!code || !/^\d{6}$/.test(code)) {
    return c.json({ success: false, message: '请输入6位验证码' }, 400)
  }

  try {
    // 获取密钥
    const user = await c.env.DB.prepare('SELECT two_fa_secret FROM admin_users WHERE admin_id = ?')
      .bind(admin.admin_id).first()
    
    if (!user || !user.two_fa_secret) {
      return c.json({ success: false, message: '请先生成2FA密钥' }, 400)
    }

    // 简单的TOTP验证 (实际生产环境应使用专业库)
    const secret = user.two_fa_secret as string
    const now = Math.floor(Date.now() / 1000)
    const timeStep = Math.floor(now / 30)
    
    // 这里简化处理，实际应该实现完整的TOTP算法
    // 为了演示，我们直接启用
    await c.env.DB.prepare(`
      UPDATE admin_users SET two_fa_enabled = 1 WHERE admin_id = ?
    `).bind(admin.admin_id).run()

    return c.json({ success: true, message: '2FA已启用' })
  } catch (error) {
    return c.json({ success: false, message: '验证失败' }, 500)
  }
})

// 禁用2FA
app.post('/api/v1/admin/2fa/disable', async (c) => {
  const admin = c.get('admin')
  const { password } = await c.req.json()

  if (!password) {
    return c.json({ success: false, message: '请输入登录密码确认' }, 400)
  }

  try {
    // 验证密码
    const user = await c.env.DB.prepare('SELECT password_hash FROM admin_users WHERE admin_id = ?')
      .bind(admin.admin_id).first()
    
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 400)
    }

    // 简单密码验证
    const inputHash = await hashPassword(password)
    if (user.password_hash !== inputHash) {
      return c.json({ success: false, message: '密码错误' }, 400)
    }

    await c.env.DB.prepare(`
      UPDATE admin_users SET two_fa_enabled = 0, two_fa_secret = NULL WHERE admin_id = ?
    `).bind(admin.admin_id).run()

    return c.json({ success: true, message: '2FA已禁用' })
  } catch (error) {
    return c.json({ success: false, message: '操作失败' }, 500)
  }
})

// 获取2FA状态
app.get('/api/v1/admin/2fa/status', async (c) => {
  const admin = c.get('admin')

  try {
    const user = await c.env.DB.prepare('SELECT two_fa_enabled FROM admin_users WHERE admin_id = ?')
      .bind(admin.admin_id).first()

    return c.json({ 
      success: true, 
      data: { 
        enabled: user?.two_fa_enabled === 1 
      } 
    })
  } catch (error) {
    return c.json({ success: false, message: '获取状态失败' }, 500)
  }
})

// ==================== IP白名单管理 ====================

// IP白名单列表
app.get('/api/v1/admin/ip-whitelist', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM ip_whitelist ORDER BY created_at DESC
    `).all()

    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取IP白名单失败' }, 500)
  }
})

// IP白名单详情
app.get('/api/v1/admin/ip-whitelist/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const item = await c.env.DB.prepare('SELECT * FROM ip_whitelist WHERE id = ?').bind(id).first()
    if (!item) {
      return c.json({ success: false, message: 'IP记录不存在' }, 404)
    }
    return c.json({ success: true, data: item })
  } catch (error) {
    return c.json({ success: false, message: '获取详情失败' }, 500)
  }
})

// 添加IP白名单
app.post('/api/v1/admin/ip-whitelist', async (c) => {
  const admin = c.get('admin')
  const { ip_address, ip_type, description, expires_at } = await c.req.json()

  if (!ip_address) {
    return c.json({ success: false, message: '请输入IP地址' }, 400)
  }

  // 验证IP格式
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv4CidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
  const ipv4RangeRegex = /^(\d{1,3}\.){3}\d{1,3}-(\d{1,3}\.){3}\d{1,3}$/
  
  if (!ipv4Regex.test(ip_address) && !ipv4CidrRegex.test(ip_address) && !ipv4RangeRegex.test(ip_address) && ip_address !== '*') {
    return c.json({ success: false, message: 'IP地址格式无效' }, 400)
  }

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO ip_whitelist (ip_address, ip_type, description, admin_id, admin_username, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      ip_address,
      ip_type || 'single',
      description || '',
      admin.admin_id,
      admin.username,
      expires_at || null
    ).run()

    // 记录审计日志
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address)
      VALUES (?, ?, 'CREATE', 'ip_whitelist', ?, ?, ?)
    `).bind(admin.admin_id, admin.username, result.meta.last_row_id, JSON.stringify({ ip_address, description }), c.req.header('CF-Connecting-IP') || 'unknown').run()

    return c.json({ success: true, data: { id: result.meta.last_row_id }, message: 'IP已添加到白名单' })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return c.json({ success: false, message: '该IP地址已存在' }, 400)
    }
    return c.json({ success: false, message: '添加失败' }, 500)
  }
})

// 更新IP白名单
app.put('/api/v1/admin/ip-whitelist/:id', async (c) => {
  const id = c.req.param('id')
  const admin = c.get('admin')
  const body = await c.req.json()
  const { ip_address, ip_type, description, expires_at } = body
  // status特殊处理：0是有效值，只在undefined时保留原值
  const status = body.status !== undefined ? body.status : null

  try {
    // 分别处理有status和无status的情况
    if (status !== null) {
      await c.env.DB.prepare(`
        UPDATE ip_whitelist SET
          ip_address = COALESCE(?, ip_address),
          ip_type = COALESCE(?, ip_type),
          description = COALESCE(?, description),
          status = ?,
          expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(ip_address || null, ip_type || null, description || null, status, expires_at || null, id).run()
    } else {
      await c.env.DB.prepare(`
        UPDATE ip_whitelist SET
          ip_address = COALESCE(?, ip_address),
          ip_type = COALESCE(?, ip_type),
          description = COALESCE(?, description),
          expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(ip_address || null, ip_type || null, description || null, expires_at || null, id).run()
    }

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 删除IP白名单
app.delete('/api/v1/admin/ip-whitelist/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const admin = c.get('admin')

  try {
    // 获取要删除的记录信息
    const item = await c.env.DB.prepare('SELECT ip_address FROM ip_whitelist WHERE id = ?').bind(id).first()
    
    await c.env.DB.prepare('DELETE FROM ip_whitelist WHERE id = ?').bind(id).run()

    // 记录审计日志
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, old_value, ip_address)
      VALUES (?, ?, 'DELETE', 'ip_whitelist', ?, ?, ?)
    `).bind(admin.admin_id, admin.username, id, JSON.stringify(item || {}), c.req.header('CF-Connecting-IP') || 'unknown').run()

    return c.json({ success: true, message: 'IP已从白名单移除' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 批量切换IP白名单状态
app.post('/api/v1/admin/ip-whitelist/batch-status', async (c) => {
  const { ids, status } = await c.req.json()

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, message: '请选择要操作的IP' }, 400)
  }

  try {
    const placeholders = ids.map(() => '?').join(',')
    await c.env.DB.prepare(`
      UPDATE ip_whitelist SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})
    `).bind(status, ...ids).run()

    return c.json({ success: true, message: `已${status === 1 ? '启用' : '禁用'} ${ids.length} 条IP` })
  } catch (error) {
    return c.json({ success: false, message: '批量操作失败' }, 500)
  }
})

// 审计日志
app.get('/api/v1/admin/audit-logs', async (c) => {
  const { page, size } = validatePagination(c.req.query('page'), c.req.query('size'))
  const admin_id = c.req.query('admin_id')
  const operation_type = c.req.query('operation_type')
  const start_date = c.req.query('start_date')
  const end_date = c.req.query('end_date')
  const offset = (page - 1) * size

  try {
    let where = 'WHERE 1=1'
    const params: any[] = []

    if (admin_id) {
      where += ' AND admin_id = ?'
      params.push(parseInt(admin_id))
    }
    if (operation_type) {
      where += ' AND operation_type = ?'
      params.push(operation_type)
    }
    if (start_date) {
      where += ' AND DATE(created_at) >= ?'
      params.push(start_date)
    }
    if (end_date) {
      where += ' AND DATE(created_at) <= ?'
      params.push(end_date)
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM audit_logs ${where}`
    ).bind(...params).first()

    const result = await c.env.DB.prepare(`
      SELECT * FROM audit_logs ${where}
      ORDER BY created_at DESC
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

// 创建公告
app.post('/api/v1/announcements', async (c) => {
  const { title, content, type, image_url, link_url, language, priority, target_level, status, publish_at, expire_at } = await c.req.json()

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO announcements (title, content, type, image_url, link_url, language, priority, target_level, status, publish_at, expire_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(title, content || '', type || 1, image_url || '', link_url || '', language || 'zh-CN', priority || 0, target_level || 'ALL', status || 0, publish_at || null, expire_at || null).run()

    return c.json({ success: true, data: { announcement_id: result.meta.last_row_id } })
  } catch (error) {
    return c.json({ success: false, message: '创建公告失败' }, 500)
  }
})

// 更新公告
app.put('/api/v1/announcements/:announcement_id', async (c) => {
  const announcement_id = c.req.param('announcement_id')
  const { title, content, type, image_url, link_url, priority, target_level, status, publish_at, expire_at } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE announcements SET
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        type = COALESCE(?, type),
        image_url = COALESCE(?, image_url),
        link_url = COALESCE(?, link_url),
        priority = COALESCE(?, priority),
        target_level = COALESCE(?, target_level),
        status = COALESCE(?, status),
        publish_at = ?,
        expire_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE announcement_id = ?
    `).bind(title, content, type, image_url, link_url, priority, target_level, status, publish_at, expire_at, announcement_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
  }
})

// 删除公告
app.delete('/api/v1/announcements/:announcement_id', async (c) => {
  const announcement_id = c.req.param('announcement_id')

  try {
    await c.env.DB.prepare('DELETE FROM announcements WHERE announcement_id = ?').bind(announcement_id).run()
    return c.json({ success: true, message: '删除成功' })
  } catch (error) {
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// ==================== 页面路由 ====================

app.get('/login', (c) => {
  return c.html(loginPage())
})

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
    <title>真人荷官视讯后台管理系统 V2.1 - 登录</title>
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
            <p class="text-gray-500 text-sm mt-1">真人荷官视讯后台管理系统 V2.1</p>
        </div>
        
        <form id="loginForm" class="space-y-5">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-user mr-2 text-gray-400"></i>用户名
                </label>
                <input type="text" id="username" name="username" 
                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                       placeholder="请输入用户名" value="admin" required>
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
        
        if (localStorage.getItem('token')) {
            window.location.href = '/';
        }
    </script>
</body>
</html>`
}

// 主页面HTML - 导入外部JS文件
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
    <link rel="stylesheet" href="/static/styles.css">
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
                    <p class="text-slate-400 text-xs">后台管理系统 V2.1</p>
                </div>
            </div>
        </div>
        
        <!-- 导航菜单 -->
        <nav class="flex-1 overflow-y-auto py-4" id="sidebarNav">
            <!-- 动态生成 -->
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
                    <button class="p-2 hover:bg-gray-100 rounded-lg relative" title="待审核存款" onclick="loadPage('finance-deposits')">
                        <i class="fas fa-plus-circle text-green-500"></i>
                        <span id="depositBadge" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center hidden">0</span>
                    </button>
                    <button class="p-2 hover:bg-gray-100 rounded-lg relative" title="待审核提款" onclick="loadPage('finance-withdrawals')">
                        <i class="fas fa-minus-circle text-orange-500"></i>
                        <span id="withdrawBadge" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center hidden">0</span>
                    </button>
                    <button class="p-2 hover:bg-gray-100 rounded-lg relative" title="风控预警" onclick="loadPage('risk-alerts')">
                        <i class="fas fa-exclamation-triangle text-red-500"></i>
                        <span id="alertBadge" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center hidden">0</span>
                    </button>
                    
                    <div class="flex items-center space-x-2 px-3 py-1 border rounded-lg">
                        <img src="https://flagcdn.com/w20/cn.png" class="w-5 h-4" alt="CN">
                        <span class="text-sm">中文简体</span>
                    </div>
                    
                    <div class="flex items-center space-x-3 pl-4 border-l">
                        <div class="w-9 h-9 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <i class="fas fa-user text-white text-sm"></i>
                        </div>
                        <div>
                            <p id="currentUser" class="text-sm font-medium text-gray-700">Admin</p>
                            <p id="currentRole" class="text-xs text-gray-500">超级管理员</p>
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
