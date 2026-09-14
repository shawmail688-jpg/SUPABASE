# -*- coding: utf-8 -*-
# fetch_raymond_photos.py — 从用户 Gmail 抓取雷蒙今天发来的照片附件
# 复用 auto-followup 的 OAuth 凭据（gmail.readonly scope）
import io, json, sys, os

CREDS = r'E:\项目\auto-followup\config\gmail-credentials.json'
TOKEN = r'E:\项目\auto-followup\state\gmail-token.json'
RAYMOND = 'nsubugaraymondkizito23@gmail.com'
OUT_DIR = r'E:\apps\survey-platform\sources\raymond'
QUERY = f'from:{RAYMOND} has:attachment newer_than:3d'

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

creds = Credentials.from_authorized_user_file(TOKEN, [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
])
if creds.expired:
    print('token 过期，自动刷新...')
    creds.refresh(Request())
    io.open(TOKEN, 'w', encoding='utf-8').write(creds.to_json())
svc = build('gmail', 'v1', credentials=creds)

resp = svc.users().messages().list(userId='me', q=QUERY, maxResults=20).execute()
msgs = resp.get('messages', [])
print(f'命中 {len(msgs)} 封带附件邮件（query: {QUERY}）')

os.makedirs(OUT_DIR, exist_ok=True)
index = []
for m in msgs:
    full = svc.users().messages().get(userId='me', id=m['id'], format='full').execute()
    headers = {h['name']: h['value'] for h in full['payload'].get('headers', [])}
    date = headers.get('Date', '')
    subject = headers.get('Subject', '(no subject)')
    frm = headers.get('From', '')
    print(f"\n=== {date}\n  From: {frm}\n  Subject: {subject}")
    parts = [full['payload']]
    stack = [full['payload']]
    while stack:
        p = stack.pop()
        stack.extend(p.get('parts', []))
    for p in parts:
        mime = p.get('mimeType', '')
        fn = p.get('filename')
        att = p.get('body', {}).get('attachmentId')
        if not fn and mime.startswith('image/'):
            fn = 'inline_' + (att or 'emb') + '.' + mime.split('/')[-1]
        if fn and (att or mime.startswith('image/')):
            meta = svc.users().messages().attachments().get(
                userId='me', messageId=m['id'], id=att).execute()
            import base64
            if att:
                meta = svc.users().messages().attachments().get(userId='me', messageId=m['id'], id=att).execute()
                data = base64.urlsafe_b64decode(meta['data'] + '===')
            else:
                data = base64.urlsafe_b64decode(p['body'].get('data', '') + '===')
            safe = fn.replace('/', '_').replace('\\', '_')
            out = os.path.join(OUT_DIR, safe)
            io.open(out, 'wb').write(data)
            print(f"  附件: {fn} ({len(data)} bytes) -> {out}")
            index.append({'message_id': m['id'], 'date': date, 'subject': subject,
                          'filename': fn, 'bytes': len(data), 'saved_to': out,
                          'body_snippet': (full.get('snippet') or '')[:200]})

io.open(os.path.join(OUT_DIR, '_index.json'), 'w', encoding='utf-8').write(
    json.dumps(index, ensure_ascii=False, indent=1))
print(f"\n共下载 {len(index)} 个附件 -> {OUT_DIR}")
