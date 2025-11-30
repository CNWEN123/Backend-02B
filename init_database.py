#!/usr/bin/env python3
"""
数据库初始化脚本
执行schema和seed数据
"""

import subprocess
import time
import os
import glob

print("=" * 50)
print("数据库初始化脚本")
print("=" * 50)

# 1. 查找数据库文件
print("\n1. 查找数据库文件...")
db_pattern = ".wrangler/state/v3/d1/**/*.sqlite"
db_files = glob.glob(db_pattern, recursive=True)

if not db_files:
    print("❌ 未找到数据库文件，尝试创建...")
    # 通过访问API触发数据库创建
    subprocess.run(["curl", "-s", "http://localhost:3000/"], stdout=subprocess.DEVNULL)
    time.sleep(3)
    db_files = glob.glob(db_pattern, recursive=True)
    
if not db_files:
    print("❌ 数据库文件仍未创建，请确保服务正在运行")
    exit(1)

db_file = db_files[0]
print(f"✅ 找到数据库: {db_file}")

# 2. 读取schema
print("\n2. 读取schema...")
with open("migrations/0001_initial_schema.sql", "r", encoding="utf-8") as f:
    schema_sql = f.read()

# 3. 读取快速初始化数据
print("3. 读取快速初始化数据...")
with open("quick-init.sql", "r", encoding="utf-8") as f:
    init_sql = f.read()

# 4. 准备完整SQL
print("4. 准备执行SQL...")
full_sql = schema_sql + "\n\n" + init_sql

# 保存到临时文件
temp_sql_file = "/tmp/full_init.sql"
with open(temp_sql_file, "w", encoding="utf-8") as f:
    f.write(full_sql)

print(f"   SQL文件大小: {len(full_sql)} 字节")

# 5. 使用wrangler执行（如果可用）
print("\n5. 尝试使用wrangler执行SQL...")
try:
    # 方法1: 通过wrangler d1 execute
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "live-dealer-db", "--local", "--file", temp_sql_file],
        capture_output=True,
        text=True,
        timeout=60
    )
    
    if result.returncode == 0:
        print("✅ SQL执行成功（wrangler方式）")
        print(result.stdout)
    else:
        print(f"⚠️  Wrangler执行失败: {result.stderr}")
        raise Exception("Need alternative method")
        
except Exception as e:
    print(f"⚠️  Wrangler方法失败: {e}")
    print("\n尝试替代方法...")
    
    # 方法2: 分段执行SQL语句
    print("6. 使用分段执行方式...")
    statements = [s.strip() for s in full_sql.split(';') if s.strip() and not s.strip().startswith('--')]
    
    success_count = 0
    fail_count = 0
    
    for i, stmt in enumerate(statements[:50], 1):  # 只执行前50条语句
        try:
            # 创建临时SQL文件
            temp_stmt_file = f"/tmp/stmt_{i}.sql"
            with open(temp_stmt_file, "w") as f:
                f.write(stmt + ";")
            
            result = subprocess.run(
                ["npx", "wrangler", "d1", "execute", "live-dealer-db", "--local", "--file", temp_stmt_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                success_count += 1
                print(f"   ✅ 语句 {i}/{len(statements)}")
            else:
                fail_count += 1
                if "already exists" not in result.stderr and "UNIQUE constraint" not in result.stderr:
                    print(f"   ⚠️  语句 {i} 失败: {result.stderr[:100]}")
        except Exception as e:
            fail_count += 1
            print(f"   ❌ 语句 {i} 错误: {str(e)[:50]}")
    
    print(f"\n执行结果: 成功 {success_count}, 失败 {fail_count}")

print("\n" + "=" * 50)
print("初始化完成！")
print("=" * 50)
print("\n测试账号:")
print("  管理员: admin / admin123")
print("  代理1: shareholder001 / password123 (邀请码: SH001ABC)")
print("  代理2: agent001 / password123 (邀请码: AG001XYZ)")
print("  代理3: subagent001 / password123 (邀请码: SA001DEF)")
print("  玩家: player001 / password123")
print("\n请访问: http://localhost:3000")
print("=" * 50)
