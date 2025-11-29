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
    if (!captcha || typeof captcha !== 'string' || captcha.length !== 4) {
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
  const { reason } = await c.req.json()
  const clientIP = getClientIP(c)

  try {
    // 记录操作日志
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (admin_id, admin_username, operation_type, target_table, target_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(admin.admin_id, admin.username, 'KICK_PLAYER', 'users', user_id, reason || '管理员踢线', clientIP).run()

    return c.json({ success: true, message: '踢线成功' })
  } catch (error) {
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

// 待审核提款
app.get('/api/v1/finance/withdrawals', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT t.*, u.username, u.nickname, u.balance as current_balance,
             u.total_bet, u.total_deposit,
             CASE WHEN u.total_bet >= u.total_deposit * 1 THEN 1 ELSE 0 END as flow_check,
             u.bank_name, u.bank_account
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

// 创建风控规则
app.post('/api/v1/risk/rules', async (c) => {
  const { rule_name, rule_type, rule_condition, rule_action } = await c.req.json()

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO risk_rules (rule_name, rule_type, rule_condition, rule_action)
      VALUES (?, ?, ?, ?)
    `).bind(rule_name, rule_type, JSON.stringify(rule_condition), rule_action).run()

    return c.json({ success: true, data: { rule_id: result.meta.last_row_id } })
  } catch (error) {
    return c.json({ success: false, message: '创建失败' }, 500)
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
  const { nickname, role_id, status, ip_whitelist } = await c.req.json()

  try {
    await c.env.DB.prepare(`
      UPDATE admin_users SET
        nickname = COALESCE(?, nickname),
        role_id = COALESCE(?, role_id),
        status = COALESCE(?, status),
        ip_whitelist = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE admin_id = ?
    `).bind(nickname, role_id, status, ip_whitelist ? JSON.stringify(ip_whitelist) : null, admin_id).run()

    return c.json({ success: true, message: '更新成功' })
  } catch (error) {
    return c.json({ success: false, message: '更新失败' }, 500)
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

// 权限列表
app.get('/api/v1/admin/permissions', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM permissions ORDER BY module, permission_id').all()
    return c.json({ success: true, data: result.results || [] })
  } catch (error) {
    return c.json({ success: false, message: '获取权限列表失败' }, 500)
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
                       placeholder="请输入密码" value="123456" required>
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
