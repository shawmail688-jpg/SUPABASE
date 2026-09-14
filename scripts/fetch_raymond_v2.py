# -*- coding: utf-8 -*-
# fetch: 雷蒙 Gmail 附件下载（递归遍历版——已实证能走到 image/jpeg 节点）
import io, json, os, base64
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

CREDS = r'E:\项目\auto-followup\config\gmail-credentials.json'
TOKEN = r'E:\项目\auto-followup\state\gmail-token.json'
RAYMOND = 'nsubugaraymondkizito23@gmail.com'
OUT_DIR = r'E:\apps\survey-platform\sources\raymond'
os.makedirs(OUT_DIR, exist_ok=True)

creds = Credentials.from_authorized_user_file(TOKEN, [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send'])
if creds.expired:
    creds.refresh(Request())
    io.open(TOKEN, 'w', encoding='utf-8').write(creds.to_json())
svc = build('gmail', 'v1', credentials=creds)

resp = svc.users().messages().list(userId='me',
    q=f'from:{RAYMOND} has:attachment newer_than:3d', maxResults=20).execute()

index = []
def walk(p, msg_id, subject, depth=0):
    mime = p.get('mimeType', '')
    fn = p.get('filename')
    body = p.get('body', {})
    att = body.get('attachmentId')
    if mime.startswith('image/') and (att or fn):
        data = base64.urlsafe_b64decode(
            svc.users().messages().attachments().get(
                userId='me', messageId=msg_id, id=att).execute()['data'] + '===')
        safe = fn or f'inline_{depth}.jpg'
        out = os.path.join(OUT_DIR, safe)
        io.open(out, 'wb').write(data)
        print(f"  下载: {safe} ({len(data)} bytes) [{subject[:60]}]")
        index.append({'message_id': msg_id, 'subject': subject, 'filename': safe,
                      'bytes': len(data), 'saved_to': out})
    for sub in p.get('parts', []):
        walk(sub, msg_id, subject, depth + 1)

for m in resp.get('messages', []):
    full = svc.users().messages().get(userId='me', id=m['id'], format='full').execute()
    h = {x['name']: x['value'] for x in full['payload'].get('headers', [])}
    subject = h.get('Subject', '(no subject)')
    print('邮件:', subject)
    walk(full['payload'], m['id'], subject)

io.open(os.path.join(OUT_DIR, '_index.json'), 'w', encoding='utf-8').write(
    json.dumps(index, ensure_ascii=False, indent=1))
print(f'\n共下载 {len(index)} 张照片 -> {OUT_DIR}')
