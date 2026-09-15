# -*- coding: utf-8 -*-
# build_webapp.py — M2b 表单换靶构建
# 用法：
#   py build_webapp.py --patch   对 webapp/survey_form.html 应用适配器补丁（幂等，已打则跳过）
#   py build_webapp.py --inject  从 .env 注入真实 SUPABASE url/publishable key（生成 E2E 用构建）
# 补丁内容（字段/交互变更已由用户通过 CR-004 明确批准）：
#   ①SUPA 配置块（BLD 注入区）②登录卡（无会话时显示）③supa 适配器（auth+resolve-or-create+队列）
#   ④sendToOffice 靶切换 ⑤record/point 预编码 uuid ⑥#/selftest2 supabase 判分
import io, json, re, sys

FORM = 'webapp/survey_form.html'

# ---------- load ----------
s = io.open(FORM, encoding='utf-8').read()

def must_replace(old, new, tag, count=1):
    global s
    if new in s:
        print(f'{tag}: 已应用，跳过')
        return
    assert old in s, f'{tag}: anchor not found'
    s = s.replace(old, new, count)
    print(f'{tag}: OK')

# ---------- ① BLD 配置区：注入 SUPABASE_CONFIG 占位 ----------
m = re.search(r'(<!--BLD:CONFIG:START-->)(.*?)(<!--BLD:CONFIG:END-->)', s, re.S)
assert m, 'BLD:CONFIG block not found'
if 'window.SUPABASE_CONFIG' not in s:
    block = m.group(2)
    block = block.replace('</script>',
        'window.SUPABASE_CONFIG={url:"",key:"",target:"supabase",project_code:"uganda-showroom"};</script>')
    s = s[:m.start(2)] + block + s[m.end(2):]
    print('① SUPABASE_CONFIG 占位注入 OK')

# ---------- ② SUPA 适配器（auth + resolve-or-create + 队列）注入在 WEBAPP_URL 之后 ----------
ADAPTER = r'''
/* ---------- v2.8 supabase adapter (M2b: 双靶抽象，appscript 路径原样保留) ---------- */
var SUPA = window.SUPABASE_CONFIG || null;
function supaOn() { return !!(SUPA && SUPA.url && SUPA.key && SUPA.target === "supabase"); }
function supaAuth() {
  try { return JSON.parse(lsGet("spm2_supa_auth", "") || "null"); } catch (e) { return null; }
}
function supaAuthSave(a) { lsSet("spm2_supa_auth", JSON.stringify(a)); }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function supaAuthClear() { lsDel("spm2_supa_auth"); }
function supaHeaders(jwt, prefer) {
  var h = { apikey: SUPA.key, Authorization: "Bearer " + (jwt || SUPA.key), "Content-Type": "application/json" };
  if (prefer) h.Prefer = prefer;
  return h;
}
function supaSignIn(email, pw, cb) {
  fetch(SUPA.url + "/auth/v1/token?grant_type=password", {
    method: "POST", headers: { apikey: SUPA.key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: pw })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (!d.access_token) { cb({ ok: false, error: d.error_description || d.msg || "signin failed" }); return; }
    supaAuthSave({ access: d.access_token, refresh: d.refresh_token, uid: d.user.id,
      email: d.user.email, exp: Date.now() + (d.expires_in || 3600) * 1000 });
    cb({ ok: true, email: d.user.email });
  }).catch(function (e) { cb({ ok: false, error: String(e) }); });
}
function supaRefresh(cb) {   // 过期自动续期；失败=登出态（记录留在队列）
  var a = supaAuth();
  if (!a || !a.refresh) { cb(null); return; }
  fetch(SUPA.url + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST", headers: { apikey: SUPA.key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: a.refresh })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (!d.access_token) { supaAuthClear(); cb(null); return; }
    supaAuthSave({ access: d.access_token, refresh: d.refresh_token, uid: d.user.id,
      email: d.user.email, exp: Date.now() + (d.expires_in || 3600) * 1000 });
    cb(d.access_token);
  }).catch(function () { cb(null); });
}
function supaJwt() {
  var a = supaAuth();
  if (!a) return null;
  if (Date.now() < (a.exp || 0) - 60000) return a.access;
  return null;   // 过期：调用方走 supaRefresh 后重试
}
var _projId = null;
function supaProjectId(jwt) {   // project uuid 解析（缓存会话级）
  if (_projId) return Promise.resolve(_projId);
  return fetch(SUPA.url + "/rest/v1/project?code=eq." + SUPA.project_code + "&select=id",
    { headers: supaHeaders(jwt) })
    .then(function (r) { return r.json(); })
    .then(function (rows) { _projId = rows[0].id; return _projId; });
}
function supaResolveSite(jwt, pid, code, name, grp) {   // resolve-or-create（code=幂等键）
  return fetch(SUPA.url + "/rest/v1/site?project_id=eq." + pid + "&code=eq." + encodeURIComponent(code) + "&select=id",
    { headers: supaHeaders(jwt) })
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      if (rows.length) return { id: rows[0].id, created: false };
      return fetch(SUPA.url + "/rest/v1/site", {
        method: "POST", headers: supaHeaders(jwt, "return=representation"),
        body: JSON.stringify({ project_id: pid, code: code, name: name, grp: grp || null, status: "surveying" })
      }).then(function (r) { return r.json(); }).then(function (rows2) {
        return { id: rows2[0].id, created: true };
      });
    });
}
function supaSend(spId) {   // 三步契约 v1（无照片帧）：site upsert → survey_result → 标 sent
  var a = supaAuth();
  if (!a) { flag("sign in to send — records kept"); return; }
  var jwt = supaJwt();
  if (!jwt) { supaRefresh(function (t) { if (t) { supaSend(spId); } else { flag("session expired — sign in again; records kept"); } }); return; }
  var ids = spId ? [spId] : POINTS.map(function (p) { return p.id; });
  var b = collectUnsent(ids);
  if (!b.owners.length) { flag("nothing new to send"); return; }
  flag("sending (supabase)...");
  supaProjectId(jwt).then(function (pid) {
    var chain = Promise.resolve({ sent: 0, fail: 0 });
    b.owners.forEach(function (o) {
      chain = chain.then(function (acc) {
        var id = o[0], r = o[1];
        var code = r.site_code || fieldSiteCode(id, r); // 同一真实店面沿用稳定 code
        var sname = (r.type === "L") ? r.bld : (r.aname || (byId(id) ? byId(id).name : id));
        var defPt = byId(id);
        return supaResolveSite(jwt, pid, code, sname, defPt ? defPt.group : null)
          .then(function (site) {
            var sr = {
              id: r.uid || uuid4(), site_id: site.id, source: "form",
              added_date: r.added_date || dateFromTs(r.ts), created_at: new Date(r.ts || Date.now()).toISOString(),
              rent: r.refused ? null : (r.rent === "" ? null : parseFloat(r.rent) || null),
              space: r.area === "" ? null : parseFloat(r.area) || null,
              contact: ((r.contact || "") + " " + (r.phone || "")).trim() || null,
              surveyor_name: r.surveyor_name || (surveyorEl.value || "").trim() || null,
              raw: { row: resultsRow(id, r), type: r.type, note: r.note || "", photos: r.photos || "none",
                currency: recordCurrency(r), surveyed_at: new Date(r.ts || Date.now()).toISOString(),
                supersedes: r.supersedes || null, site_code: code, form: surveyRaw(r) },
            };
            return fetch(SUPA.url + "/rest/v1/survey_result", {
              method: "POST", headers: supaHeaders(jwt, "resolution=ignore-duplicates,return=minimal"),
              body: JSON.stringify(sr)
            }).then(function (resp) {
              if (resp.status === 201 || resp.status === 200 || resp.status === 204) { acc.sent++; r.sent = 1; return acc; }
              acc.fail++; return acc;
            });
          });
      });
    });
    return chain;
  }).then(function (acc) {
    save();
    if (acc.fail) flag(acc.sent ? "partial fail — send again" : "send failed — records kept");
    else flag("sent ✓ (supabase)");
    route();
  }).catch(function (e) { flag("send error: " + e); });
}
function uuid4() {   // file:// 无 secure context，crypto.randomUUID 不可用时的 v4 兜底
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
    return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
  });
}
'''
adapter_marker = '/* ---------- v2.8 supabase adapter (M2b: 双靶抽象，appscript 路径原样保留) ---------- */'
adapter_start = s.find(adapter_marker)
adapter_end = s.find('var GROUP_COLORS', adapter_start) if adapter_start >= 0 else -1
if adapter_start >= 0 and adapter_end > adapter_start:
    s = s[:adapter_start] + ADAPTER.strip() + '\n\n' + s[adapter_end:]
    print('② SUPA 适配器规范化 OK')
else:
    must_replace('var WEBAPP_URL = window.WEBAPP_URL || "";',
                 'var WEBAPP_URL = window.WEBAPP_URL || "";\n' + ADAPTER,
                 '② SUPA 适配器注入')

# ---------- ③ sendToOffice 靶切换 ----------
must_replace('''function sendToOffice(spId) {
  if (!WEBAPP_URL) { flag("office link not configured — use Copy"); showExport(spId); return; }''',
'''function sendToOffice(spId) {
  if (supaOn()) { supaSend(spId); return; }   // M2b：supabase 靶（外审通过后 appscript 退役）
  if (!WEBAPP_URL) { flag("office link not configured — use Copy"); showExport(spId); return; }''',
             '③ sendToOffice 靶切换')

# ---------- ④ record/point 预编码 uuid（幂等键）----------
# CR-004's record-time guard also persists immediately. Treat either form as
# satisfying this build step so repeated builds cannot stack duplicate guards.
if re.search(r'if \(!r\.uid\)[^\n]*\n\s*owners\.push\(\[id, r\]\)', s):
    print('④ record 预编码 uuid: 已应用，跳过')
else:
    must_replace('''      owners.push([id, r]);
      if (r.type === "L") showroom.push(showroomRow(r));
      results.push(resultsRow(id, r));   // V / L / A 全进明细表''',
'''      if (!r.uid) { r.uid = uuid4(); }   // 预编码 uuid：重试/重放幂等键（M2b）
      owners.push([id, r]);
      if (r.type === "L") showroom.push(showroomRow(r));
      results.push(resultsRow(id, r));   // V / L / A 全进明细表''',
                 '④ record 预编码 uuid')

# ---------- ⑤ 登录卡（无会话时显示；SPA 外常驻条）----------
AUTHBAR = '''
<!--BLD:AUTHBAR:START--><div id="supaAuthBar" style="display:none;position:sticky;top:0;z-index:99;background:#1c1917;color:#fafaf9;padding:8px 12px;font-size:14px;">
  <span id="supaAuthMsg">Sign in to sync</span>
  <input id="supaEmail" placeholder="email" style="margin-left:8px;width:180px;">
  <input id="supaPw" type="password" placeholder="password" style="margin-left:6px;width:140px;">
  <button id="supaGo" style="margin-left:6px;">Sign in</button>
  <span id="supaWho" style="margin-left:8px;color:#a8a29e;"></span>
</div>
<script>
(function () {
  function refresh() {
    if (!window.supaOn || !supaOn()) return;
    var bar = document.getElementById("supaAuthBar"); if (!bar) return;
    var a = supaAuth();
    bar.style.display = a ? "none" : "block";
    if (a) document.getElementById("supaWho").textContent = "signed in: " + a.email;
  }
  window.addEventListener("load", refresh);
  window.addEventListener("hashchange", refresh);
  window.setInterval(refresh, 1500);
  document.addEventListener("click", function (ev) {
    if (ev.target && ev.target.id === "supaGo") {
      document.getElementById("supaGo").textContent = "...";
      supaSignIn(document.getElementById("supaEmail").value.trim(),
                 document.getElementById("supaPw").value, function (res) {
        document.getElementById("supaGo").textContent = res.ok ? "Sign in" : "retry";
        refresh();
      });
    }
  });
})();
</script><!--BLD:AUTHBAR:END-->'''
must_replace('</body>', AUTHBAR + '\n</body>', '⑤ 登录卡注入')

# ---------- ⑥ selftest2：supabase 适配器判分（stub fetch，零真实请求）----------
ST2 = r'''
if (location.hash === "#/selftest2") {
  (function () {
    var out2 = [];
    function ck2(name, ok, detail) { out2.push((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); }
    window.SUPABASE_CONFIG = { url: "https://stub.supabase.co", key: "sb_publishable_test",
      target: "supabase", project_code: "uganda-showroom" };
    // 会话：svy1
    supaAuthSave({ access: "test.jwt.token", refresh: "r", uid: "aaaaaaaa-0000-0000-0000-000000000003",
      email: "svy1-test@survey.local", exp: Date.now() + 3600000 });
    var calls = [];
    window.fetch = function (u, o) {
      calls.push({ u: u, m: (o && o.method) || "GET", b: (o && o.body) || "",
        h: (o && o.headers) || {} });
      if (u.indexOf("/rest/v1/site?") >= 0) return Promise.resolve({ status: 200,
        json: function () { return Promise.resolve([]); } });
      return Promise.resolve({ status: 201, json: function () {
        return Promise.resolve([{ id: "generated" }]); } });
    };
    location.hash = "#/sp/SP-11"; route();
    var form = document.querySelector("form");
    form.querySelector("[name=rent]").value = "123";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    supaSend("SP-11");
    setTimeout(function () {
      var siteCall = calls.filter(function (c) { return c.u.indexOf("/rest/v1/site?") >= 0; });
      var srCall = calls.filter(function (c) { return c.u.indexOf("/rest/v1/survey_result") >= 0 && c.m === "POST"; });
      ck2("T-a site resolve-or-create 调用", siteCall.length >= 1,
          "u=" + (siteCall[0] ? siteCall[0].u.slice(0, 90) : "∅"));
      ck2("T-b survey_result POST 调用", srCall.length >= 1);
      ck2("T-c Authorization Bearer", srCall.length && srCall[0].h.Authorization === "Bearer test.jwt.token");
      ck2("T-d payload 幂等键", srCall.length && srCall[0].b.indexOf('"id"') >= 0 &&
          JSON.parse(srCall[0].b).id.length === 36);
      var sentPayload = srCall.length ? JSON.parse(srCall[0].b) : {};
      ck2("T-d2 CR-004 修订元数据", sentPayload.raw && sentPayload.raw.currency === "USD" &&
          !!sentPayload.raw.surveyed_at && sentPayload.raw.site_code === "SP-11" && !!sentPayload.created_at);
      var rec = recs("SP-11").filter(function (r) { return r.type === "L"; })[0];
      ck2("T-e record uid 预编码", rec && !!rec.uid && rec.uid.length === 36);
      // 无会话 → 队列不发送
      supaAuthClear();
      var rec2 = recs("SP-11")[0]; rec2.sent = 0;
      var callsBefore = calls.length;
      supaSend("SP-11");
      ck2("T-f 无会话入队不发送", calls.length === callsBefore && rec2.sent === 0);
      var pass = out2.filter(function (o) { return o.indexOf("PASS") === 0; }).length;
      var el = document.createElement("pre"); el.id = "selftest2-result";
      el.textContent = "SELFTEST2 " + pass + "/" + out2.length + "\n" + out2.join("\n");
      document.body.appendChild(el);
      document.title = "SELFTEST2 " + (pass === out2.length ? "ALL_PASS" : "FAIL") + " " + pass + "/" + out2.length;
    }, 300);
  })();
}
'''
anchor2 = s.find('/* ---------- offline map (embedded OSM tiles + Leaflet) ---------- */')
assert anchor2 > 0, 'offline map anchor not found'
if '#/selftest2' not in s:
    s = s[:anchor2] + ST2 + '\n\n' + s[anchor2:]
    print('⑥ selftest2 注入 OK')

# ---------- ⑦ --inject：只注入可公开的 URL/publishable key ----------
if '--inject' in sys.argv:
    env = {}
    for line in io.open('.env', encoding='utf-8-sig'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env[key.strip()] = value.strip()
    required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']
    missing = [key for key in required if not env.get(key)]
    assert not missing, 'missing .env keys: ' + ', '.join(missing)
    cfg = {
        'url': env['SUPABASE_URL'],
        'key': env['SUPABASE_PUBLISHABLE_KEY'],
        'target': env.get('FORM_TARGET', 'supabase'),
        'project_code': 'uganda-showroom',
    }
    # Dual-write needs its own durable retry queue and is not yet implemented.
    # Refuse the value instead of silently treating it as App Script-only.
    assert cfg['target'] in ('appscript', 'supabase'), 'FORM_TARGET invalid or not implemented'
    replacement = 'window.SUPABASE_CONFIG=' + json.dumps(cfg, separators=(',', ':')) + ';'
    s, changed = re.subn(r'window\.SUPABASE_CONFIG=\{.*?\};', replacement, s, count=1)
    assert changed == 1, 'SUPABASE_CONFIG block not found for --inject'
    secret = env.get('SUPABASE_SECRET_KEY', '')
    assert not secret or secret not in s, 'secret key leaked into web artifact'
    print('⑦ public Supabase config injected OK (secret excluded)')

# ---------- 保存 ----------
io.open(FORM, 'w', encoding='utf-8', newline='').write(s)
print('build_webapp --patch 完成，总行数:', len(s.split('\n')))
