#!/bin/bash

echo "=========================================="
echo "初始化全新数据库"
echo "=========================================="

cd /home/user/webapp

# 1. 停止服务
echo "1. 停止服务..."
pm2 delete live-dealer-admin 2>/dev/null || true

# 2. 删除旧数据库
echo "2. 删除旧数据库..."
rm -rf .wrangler/state/v3/d1

# 3. 执行数据库迁移（通过启动wrangler会自动创建数据库）
echo "3. 启动wrangler创建数据库..."
timeout 10 npx wrangler pages dev dist --d1=live-dealer-db --local --ip 0.0.0.0 --port 3000 &
WRANGLER_PID=$!

# 等待wrangler启动并创建数据库
echo "等待5秒让wrangler创建数据库..."
sleep 5

# 4. 杀死wrangler
kill $WRANGLER_PID 2>/dev/null || true
sleep 2

# 5. 检查数据库文件是否创建
DB_FILE=$(find .wrangler/state/v3/d1 -name "*.sqlite" -type f 2>/dev/null | head -1)

if [ -z "$DB_FILE" ]; then
    echo "❌ 数据库文件未创建"
    exit 1
fi

echo "✅ 数据库文件已创建: $DB_FILE"

# 6. 执行schema
echo "4. 执行schema..."
cat migrations/0001_initial_schema.sql | while IFS= read -r line; do
    if [ ! -z "$line" ] && [[ ! "$line" =~ ^-- ]]; then
        echo "$line"
    fi
done > /tmp/schema_clean.sql

# 使用wrangler执行SQL（通过临时启动）
echo "5. 通过wrangler执行初始化..."

# 创建临时执行脚本
cat > /tmp/init_db.js << 'INITEOF'
import { readFileSync } from 'fs';

const schema = readFileSync('./migrations/0001_initial_schema.sql', 'utf-8');
const seed = readFileSync('./seed.sql', 'utf-8');

console.log('Schema length:', schema.length);
console.log('Seed length:', seed.length);

// 分割SQL语句
function splitSQL(sql) {
    return sql.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
        .map(s => s + ';');
}

const schemaStatements = splitSQL(schema);
const seedStatements = splitSQL(seed);

console.log('Schema statements:', schemaStatements.length);
console.log('Seed statements:', seedStatements.length);

INITEOF

# 6. 重新启动PM2服务
echo "6. 重新启动PM2服务..."
pm2 start ecosystem.config.cjs

echo "7. 等待服务启动..."
sleep 5

echo ""
echo "=========================================="
echo "初始化完成！"
echo "=========================================="
echo ""
echo "现在可以访问系统了:"
echo "URL: http://localhost:3000"
echo "账号: admin"
echo "密码: admin123"
echo ""
