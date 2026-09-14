# -*- coding: utf-8 -*-
# set_db_pw.py — 交互式回填 SUPABASE_DB_URL 密码段（输入不回显，密码不进对话）
import getpass, io, re, sys

f = '.env'
s = io.open(f, encoding='utf-8-sig').read()
m = re.search(r'^(SUPABASE_DB_URL=postgresql://postgres:)([^@]+)(@.*)$', s, re.M)
if not m:
    print('未找到 SUPABASE_DB_URL 行或格式不符'); sys.exit(1)
if m.group(2) != '[YOUR-PASSWORD]':
    ans = input('密码段已存在（%d 字符），覆盖？y/N: ' % len(m.group(2)))
    if ans.strip().lower() != 'y':
        print('已取消'); sys.exit(0)
print('请输入新的数据库密码（输入不回显）:')
pw = getpass.getpass('> ')
if not pw.strip():
    print('密码为空，已取消'); sys.exit(1)
# URL 编码密码中的特殊字符（@ : / # ? 等）
from urllib.parse import quote
s = s[:m.start(2)] + quote(pw, safe='') + s[m.end(2):]
io.open(f, 'w', encoding='utf-8', newline='').write(s)
print('已回填 .env（密码已 URL 编码，文件已保存）')
