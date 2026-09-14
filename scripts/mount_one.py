# -*- coding: utf-8 -*-
# mount_one.py — 单张照片挂载：Storage 上传 + photo 表行（单事务批）
# 用法：py mount_one.py <图片路径> <site_code> [label]
import io, json, sys, hashlib, urllib.request, urllib.error

env = {}
for line in io.open('.env', encoding='utf-8-sig'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()

path, site_code = sys.argv[1], sys.argv[2]
label = sys.argv[3] if len(sys.argv) > 3 else ''
ref = env['SUPABASE_URL'].split('//')[1].split('.')[0]
SVC = '11111111-1111-1111-1111-111111111111'
secret = env['SUPABASE_SECRET_KEY']
data = io.open(path, 'rb').read()
sha = hashlib.sha1(data).hexdigest()
storage_path = f'uganda-showroom/{site_code}/{sha}.jpg'

# 1) Storage 上传（x-upsert 幂等；服务密钥双头）
req = urllib.request.Request(env['SUPABASE_URL'] + '/storage/v1/object/photos/' + storage_path,
    data=data, headers={'apikey': secret, 'Authorization': 'Bearer ' + secret,
                        'Content-Type': 'image/jpeg', 'x-upsert': 'true'}, method='POST')
r = urllib.request.urlopen(req, timeout=120)
print('Storage 上传 ->', r.status)

# 2) site_id
req = urllib.request.Request('https://api.supabase.com/v1/projects/%s/database/query' % ref,
    data=json.dumps({'query': "select id from public.site where code = '%s'" % site_code}).encode(),
    headers={'Authorization': 'Bearer ' + env['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'application/json'}, method='POST')
site_id = json.load(urllib.request.urlopen(req, timeout=30))[0]['id']

# 3) photo 行（单事务批；uuid5(sha1) 确定性 id）
import uuid as _u
pid = str(_u.uuid5(_u.NAMESPACE_URL, 'photo:' + sha))
raw = json.dumps({'label': label, 'source': 'raymond-email'}, ensure_ascii=False) if label else json.dumps({'source': 'raymond-email'})
tx = """begin;
select set_config('app.actor_uuid', '%s', true);
insert into public.photo (id, site_id, storage_path, sha1, kind, taken_at, uploaded_by)
values ('%s', '%s', '%s', '%s', 'normal', null, '%s')
on conflict (id) do nothing;
commit;""" % (SVC, pid, site_id, storage_path, sha, SVC)
req = urllib.request.Request('https://api.supabase.com/v1/projects/%s/database/query' % ref,
    data=json.dumps({'query': tx}).encode(),
    headers={'Authorization': 'Bearer ' + env['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'application/json'}, method='POST')
r = urllib.request.urlopen(req, timeout=60)
print('photo 行 ->', r.status, '| sha1:', sha[:12], '| path:', storage_path)
