#!/bin/bash

# 测试代理API的脚本

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "测试代理分享链接功能"
echo "=========================================="
echo ""

# 1. 登录获取token
echo "1. 登录获取token..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","captcha":"1234"}')

echo "登录响应: $LOGIN_RESPONSE"
echo ""

# 提取token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败，无法获取token"
    exit 1
fi

echo "✅ 获取token成功: ${TOKEN:0:20}..."
echo ""

# 2. 创建测试代理
echo "2. 创建测试代理..."
CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/agents" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=$TOKEN" \
  -d '{
    "agent_username": "testagent001",
    "password": "password123",
    "nickname": "测试代理",
    "level": 3,
    "custom_domain": "test.agent.example.com"
  }')

echo "创建响应: $CREATE_RESPONSE"
echo ""

# 提取agent_id和invite_code
AGENT_ID=$(echo $CREATE_RESPONSE | grep -o '"agent_id":[0-9]*' | cut -d':' -f2)
INVITE_CODE=$(echo $CREATE_RESPONSE | grep -o '"invite_code":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$AGENT_ID" ]; then
    echo "✅ 代理创建成功！"
    echo "   代理ID: $AGENT_ID"
    echo "   邀请码: $INVITE_CODE"
    echo ""
else
    echo "❌ 代理创建失败"
    exit 1
fi

# 3. 获取代理列表
echo "3. 获取代理列表..."
LIST_RESPONSE=$(curl -s "${BASE_URL}/api/v1/agents?page=1&size=10" \
  -H "Cookie: auth_token=$TOKEN")

echo "代理列表响应: $LIST_RESPONSE" | head -c 500
echo "..."
echo ""

# 检查是否包含invite_code
if echo "$LIST_RESPONSE" | grep -q "invite_code"; then
    echo "✅ 代理列表包含 invite_code 字段"
else
    echo "❌ 代理列表不包含 invite_code 字段"
fi

if echo "$LIST_RESPONSE" | grep -q "custom_domain"; then
    echo "✅ 代理列表包含 custom_domain 字段"
else
    echo "❌ 代理列表不包含 custom_domain 字段"
fi
echo ""

# 4. 获取代理详情
echo "4. 获取代理详情 (ID: $AGENT_ID)..."
DETAIL_RESPONSE=$(curl -s "${BASE_URL}/api/v1/agents/${AGENT_ID}" \
  -H "Cookie: auth_token=$TOKEN")

echo "代理详情响应: $DETAIL_RESPONSE"
echo ""

# 5. 测试公开API验证邀请码
echo "5. 测试公开API验证邀请码 ($INVITE_CODE)..."
PUBLIC_RESPONSE=$(curl -s "${BASE_URL}/api/v1/public/agent-by-invite/${INVITE_CODE}")

echo "公开API响应: $PUBLIC_RESPONSE"
echo ""

if echo "$PUBLIC_RESPONSE" | grep -q "\"success\":true"; then
    echo "✅ 邀请码验证成功"
else
    echo "❌ 邀请码验证失败"
fi

# 6. 测试重新生成邀请码
echo ""
echo "6. 测试重新生成邀请码..."
REGEN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/agents/${AGENT_ID}/generate-invite-code" \
  -H "Cookie: auth_token=$TOKEN")

echo "重新生成响应: $REGEN_RESPONSE"
echo ""

NEW_INVITE_CODE=$(echo $REGEN_RESPONSE | grep -o '"invite_code":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$NEW_INVITE_CODE" ]; then
    echo "✅ 邀请码重新生成成功: $NEW_INVITE_CODE"
else
    echo "❌ 邀请码重新生成失败"
fi

echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
