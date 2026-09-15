/* ---------- v2.8 supabase adapter (M2b: 双靶抽象，appscript 路径原样保留) ---------- */
/* v2.9 source: durable target states, photo pipeline, 401 replay and archived defence. */
var SUPA = window.SUPABASE_CONFIG || null;
var PHOTO_DEFAULT = { maxEdge: 1800, quality: 0.80, capBytes: 1000000, kind: "normal" };
var PHOTO_DETAIL = { maxEdge: 2400, quality: 0.90, capBytes: 2500000, kind: "detail" };
var _projId = null, _supaBusy = false, _appBusy = false;

function supaTarget() { return SUPA && SUPA.target ? SUPA.target : "appscript"; }
function supaOn() { return !!(SUPA && SUPA.url && SUPA.key && (supaTarget() === "supabase" || supaTarget() === "dual")); }
function targetDone(r, target) { return !!(r.sent || (r.sentTargets && r.sentTargets[target])); }
function targetState(r, target, state, error) {
  r.sync = r.sync || {}; r.sentTargets = r.sentTargets || {};
  r.sync[target] = { state: state, at: Date.now(), error: error || null };
  if (state === "sent") r.sentTargets[target] = 1;
  var required = Object.keys(r.sync).filter(function (t) { return t === "appscript" || t === "supabase"; });
  if (!required.length) required = supaTarget() === "dual" ? ["appscript", "supabase"] : [supaTarget()];
  r.sent = required.every(function (t) { return !!r.sentTargets[t]; }) ? 1 : 0;
  save();
}
function queueForTargets(r) {
  var targets = supaTarget() === "dual" ? ["appscript", "supabase"] : [supaTarget()];
  targets.forEach(function (t) { targetState(r, t, "queued", null); });
}

function supaAuth() { try { return JSON.parse(lsGet("spm2_supa_auth", "") || "null"); } catch (e) { return null; } }
function supaAuthSave(a) { lsSet("spm2_supa_auth", JSON.stringify(a)); }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function supaAuthClear() { lsDel("spm2_supa_auth"); }
function supaHeaders(jwt, prefer, contentType) {
  if (!jwt) throw new Error("authenticated access token required");
  var h = { apikey: SUPA.key, Authorization: "Bearer " + jwt };
  if (contentType !== false) h["Content-Type"] = contentType || "application/json";
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
    setTimeout(function () { flushQueue(); }, 0);
  }).catch(function (e) { cb({ ok: false, error: String(e) }); });
}
function supaRefresh(cb) {
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
function supaRefreshP() { return new Promise(function (resolve) { supaRefresh(resolve); }); }
function supaJwt() {
  var a = supaAuth();
  return a && Date.now() < (a.exp || 0) - 60000 ? a.access : null;
}
function supaFetch(jwt, path, options, retried) {
  options = options || {}; options.headers = options.headers || supaHeaders(jwt);
  return fetch(SUPA.url + path, options).then(function (resp) {
    if (resp.status !== 401 || retried) return resp;
    return supaRefreshP().then(function (fresh) {
      if (!fresh) return resp;
      options.headers = Object.assign({}, options.headers, { Authorization: "Bearer " + fresh });
      return supaFetch(fresh, path, options, true);
    });
  });
}
function responseJson(resp) {
  return resp.text().then(function (text) {
    var data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
    if (!resp.ok) { var err = new Error((data && (data.message || data.msg)) || text || ("HTTP " + resp.status)); err.status = resp.status; throw err; }
    return data;
  });
}
function supaProjectId(jwt) {
  if (_projId) return Promise.resolve(_projId);
  return supaFetch(jwt, "/rest/v1/project?code=eq." + encodeURIComponent(SUPA.project_code) + "&select=id", { headers: supaHeaders(jwt) })
    .then(responseJson).then(function (rows) { if (!rows || !rows[0]) throw new Error("project unavailable"); _projId = rows[0].id; return _projId; });
}
function supaResolveSite(jwt, code, name, grp, address) {
  return supaFetch(jwt, "/rest/v1/rpc/resolve_form_site", {
    method: "POST", headers: supaHeaders(jwt), body: JSON.stringify({ p_project_code: SUPA.project_code,
      p_site_code: code, p_name: name, p_group: grp || null, p_address: address || null })
  }).then(responseJson).then(function (rows) {
    var site = rows && rows[0]; if (!site) throw new Error("site resolution failed");
    if (site.site_status === "archived") { var err = new Error("This store is hidden. Contact an administrator to restore it."); err.code = "ARCHIVED"; throw err; }
    return { id: site.site_id, status: site.site_status, created: site.created };
  });
}

function photoDb() {
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) { reject(new Error("photo storage unavailable")); return; }
    var req = indexedDB.open("spm2_photos", 1);
    req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains("blobs")) req.result.createObjectStore("blobs"); };
    req.onsuccess = function () { resolve(req.result); }; req.onerror = function () { reject(req.error); };
  });
}
function photoPut(id, blob) { return photoDb().then(function (db) { return new Promise(function (resolve, reject) {
  var tx = db.transaction("blobs", "readwrite"); tx.objectStore("blobs").put(blob, id);
  tx.oncomplete = function () { db.close(); resolve(); }; tx.onerror = function () { db.close(); reject(tx.error); };
}); }); }
function photoGet(id) { return photoDb().then(function (db) { return new Promise(function (resolve, reject) {
  var tx = db.transaction("blobs", "readonly"), req = tx.objectStore("blobs").get(id);
  req.onsuccess = function () { db.close(); resolve(req.result || null); }; req.onerror = function () { db.close(); reject(req.error); };
}); }); }
function photoDelete(id) { return photoDb().then(function (db) { return new Promise(function (resolve, reject) {
  var tx = db.transaction("blobs", "readwrite"); tx.objectStore("blobs").delete(id);
  tx.oncomplete = function () { db.close(); resolve(); }; tx.onerror = function () { db.close(); reject(tx.error); };
}); }); }
function blobSha1(blob) { return blob.arrayBuffer().then(function (buf) { return crypto.subtle.digest("SHA-1", buf); }).then(function (hash) {
  return Array.prototype.map.call(new Uint8Array(hash), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}); }
function canvasBlob(canvas, quality) { return new Promise(function (resolve, reject) {
  canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("JPEG compression failed")); }, "image/jpeg", quality);
}); }
function canvasBlobWithinCap(canvas, cfg, quality, attempt) {
  return canvasBlob(canvas, quality).then(function (blob) {
    if (blob.size <= cfg.capBytes) return blob;
    if (attempt >= 4) throw new Error("compressed photo exceeds profile size limit");
    return canvasBlobWithinCap(canvas, cfg, Math.max(0.52, quality - 0.08), attempt + 1);
  });
}
function compressDrawable(image, inputWidth, inputHeight, cfg) {
  var scale = Math.min(1, cfg.maxEdge / Math.max(inputWidth, inputHeight));
  var width = Math.max(1, Math.round(inputWidth * scale)), height = Math.max(1, Math.round(inputHeight * scale));
  var canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, width, height);
  return canvasBlobWithinCap(canvas, { capBytes: cfg.capBytes || (cfg.kind === "detail" ? 2500000 : 1000000) }, cfg.quality, 0)
    .then(function (blob) { return { blob: blob, width: width, height: height }; });
}
function compressPhoto(file, detail) {
  var cfg = detail ? PHOTO_DETAIL : PHOTO_DEFAULT;
  return createImageBitmap(file).then(function (image) {
    return compressDrawable(image, image.width, image.height, cfg).then(function (result) { if (image.close) image.close();
      return blobSha1(result.blob).then(function (sha1) {
      var id = uuid4(); return photoPut(id, result.blob).then(function () { return { id: id, sha1: sha1, kind: cfg.kind,
        mime: "image/jpeg", width: result.width, height: result.height, bytes: result.blob.size, taken_at: new Date().toISOString() }; });
    }); });
  });
}
function capturePhotos(form) {
  var detail = !!form.querySelector('[name="photo_detail"]:checked'), selected = [];
  ["p1","p2","p3","p4"].forEach(function (slot) {
    var input = form.querySelector('[name="photo_' + slot + '"]');
    if (input && input.files && input.files[0]) selected.push({ slot: slot.toUpperCase(), file: input.files[0] });
  });
  if (supaTarget() === "appscript") return Promise.resolve(selected.map(function (x) { return { slot: x.slot, appscript_only: true }; }));
  if (selected.length) flag("compressing photos...");
  var staged = [];
  return selected.reduce(function (chain, item) { return chain.then(function () {
    return compressPhoto(item.file, detail).then(function (p) { p.slot = item.slot; staged.push(p); });
  }); }, Promise.resolve()).then(function () { return staged; }).catch(function (err) {
    return Promise.all(staged.map(function (p) { return photoDelete(p.id).catch(function () {}); })).then(function () { throw err; });
  });
}
function withCapturedPhotos(form, done, failed) {
  var hasFile = ["p1","p2","p3","p4"].some(function (slot) {
    var input = form.querySelector('[name="photo_' + slot + '"]'); return !!(input && input.files && input.files[0]);
  });
  if (!hasFile) { done([]); return; }
  capturePhotos(form).then(done).catch(failed);
}
function supaUploadPhoto(jwt, code, meta) {
  return photoGet(meta.id).then(function (blob) {
    if (!blob) throw new Error("queued photo is missing on this device");
    var path = SUPA.project_code + "/" + code + "/" + meta.sha1 + ".jpg"; meta.storage_path = path;
    return supaFetch(jwt, "/storage/v1/object/photos/" + path, {
      method: "POST", headers: Object.assign(supaHeaders(jwt, null, false), { "Content-Type": "image/jpeg", "x-upsert": "false" }), body: blob
    }).then(function (resp) { if (resp.ok || resp.status === 409) return meta; return responseJson(resp); });
  });
}
function supaFindPhotoBySha(jwt, sha1) {
  return supaFetch(jwt, "/rest/v1/photo?sha1=eq." + sha1 + "&select=id,site_id,survey_result_id,storage_path", { headers: supaHeaders(jwt) })
    .then(responseJson).then(function (rows) { return rows && rows[0] ? rows[0] : null; });
}
function supaPreparePhoto(jwt, siteId, code, meta) {
  return supaFindPhotoBySha(jwt, meta.sha1).then(function (existing) {
    if (!existing) return supaUploadPhoto(jwt, code, meta);
    if (existing.site_id !== siteId) throw new Error("photo content already belongs to another store");
    meta.remote_existing = true; meta.storage_path = existing.storage_path; return meta;
  });
}
function supaInsertSurvey(jwt, siteId, id, r, code) {
  var sr = { id: r.uid, site_id: siteId, source: "form", added_date: r.added_date || dateFromTs(r.ts),
    created_at: new Date(r.ts || Date.now()).toISOString(), rent: r.refused ? null : (r.rent === "" ? null : Number(r.rent)),
    space: r.area === "" ? null : Number(r.area), contact: ((r.contact || "") + " " + (r.phone || "")).trim() || null,
    surveyor_name: r.surveyor_name || null, raw: { row: resultsRow(id, r), type: r.type, currency: recordCurrency(r),
      surveyed_at: new Date(r.ts || Date.now()).toISOString(), supersedes: r.supersedes || null, site_code: code, form: surveyRaw(r) } };
  return supaFetch(jwt, "/rest/v1/survey_result?on_conflict=id", { method: "POST",
    headers: supaHeaders(jwt, "resolution=ignore-duplicates,return=minimal"), body: JSON.stringify(sr) })
    .then(function (resp) { if (resp.ok || resp.status === 409) return; return responseJson(resp); });
}
function supaInsertPhotoMeta(jwt, siteId, surveyId, meta) {
  if (meta.remote_existing) return Promise.resolve();
  var row = { id: meta.id, site_id: siteId, survey_result_id: surveyId, storage_path: meta.storage_path,
    sha1: meta.sha1, kind: meta.kind, taken_at: meta.taken_at || null };
  return supaFetch(jwt, "/rest/v1/photo?on_conflict=id", { method: "POST",
    headers: supaHeaders(jwt, "resolution=ignore-duplicates,return=minimal"), body: JSON.stringify(row) })
    .then(function (resp) {
      if (resp.ok) return;
      if (resp.status !== 409) return responseJson(resp);
      return supaFindPhotoBySha(jwt, meta.sha1).then(function (existing) {
        if (!existing || existing.site_id !== siteId) throw new Error("photo metadata conflict was not safely resolved");
        meta.remote_existing = true; meta.storage_path = existing.storage_path;
      });
    });
}
function pendingOwners(spId, target) {
  var ids = spId ? [spId] : POINTS.map(function (p) { return p.id; }), out = [];
  ids.forEach(function (id) { recs(id).forEach(function (r) {
    var hasSnapshot = r.sync && Object.keys(r.sync).length;
    if ((!hasSnapshot || r.sync[target]) && !targetDone(r, target)) out.push([id, r]);
  }); });
  return out;
}
function sendOneSupabase(jwt, item) {
  var id = item[0], r = item[1], defPt = byId(id), code = r.site_code || fieldSiteCode(id, r);
  r.site_code = code; if (!r.uid) r.uid = uuid4(); targetState(r, "supabase", "sending", null);
  var name = r.type === "L" ? r.bld : (r.aname || (defPt ? defPt.name : id));
  return supaResolveSite(jwt, code, name, defPt ? defPt.group : null, r.road || (defPt ? defPt.roads : null))
    .then(function (site) { var photos = r.photo_refs || [];
      return photos.reduce(function (p, meta) { return p.then(function () { return supaPreparePhoto(jwt, site.id, code, meta); }); }, Promise.resolve())
        .then(function () { return supaInsertSurvey(jwt, site.id, id, r, code); })
        .then(function () { return photos.reduce(function (p, meta) { return p.then(function () { return supaInsertPhotoMeta(jwt, site.id, r.uid, meta); }); }, Promise.resolve()); });
    }).then(function () {
      targetState(r, "supabase", "sent", null);
      return Promise.all((r.photo_refs || []).filter(function (p) { return p.id; }).map(function (p) { return photoDelete(p.id); }))
        .then(function () { r.sync.supabase.cleanup_pending = false; save(); return true; })
        .catch(function () { r.sync.supabase.cleanup_pending = true; save(); return true; });
    });
}
function supaSend(spId) {
  if (_supaBusy) return Promise.resolve(false);
  var a = supaAuth(); if (!a) { pendingOwners(spId, "supabase").forEach(function (o) { targetState(o[1], "supabase", "queued", "sign in required"); }); flag("sign in to send — records queued"); return Promise.resolve(false); }
  if (navigator.onLine === false) { pendingOwners(spId, "supabase").forEach(function (o) { targetState(o[1], "supabase", "queued", "offline"); }); flag("offline — records queued"); return Promise.resolve(false); }
  _supaBusy = true;
  var tokenP = supaJwt() ? Promise.resolve(supaJwt()) : supaRefreshP();
  return tokenP.then(function (jwt) {
    if (!jwt) throw new Error("session expired — sign in again");
    var owners = pendingOwners(spId, "supabase"), result = { sent: 0, fail: 0, archived: 0 };
    return owners.reduce(function (chain, item) { return chain.then(function () {
      return sendOneSupabase(jwt, item).then(function () { result.sent++; }).catch(function (err) {
        result.fail++; if (err.code === "ARCHIVED") result.archived++; targetState(item[1], "supabase", "queued", String(err.message || err));
      });
    }); }, Promise.resolve()).then(function () { return result; });
  }).then(function (result) {
    if (result.archived) flag("该店已隐藏，联系管理员恢复");
    else if (result.fail) flag(result.sent ? "partial failure — queued for retry" : "send failed — queued for retry");
    else flag(result.sent ? "sent ✓ (supabase)" : "nothing new to send");
    route(); return !result.fail;
  }).catch(function (err) { flag(String(err.message || err) + " — records queued"); return false; })
    .then(function (ok) { _supaBusy = false; return ok; }, function (err) { _supaBusy = false; throw err; });
}
function hasPendingTarget(target) { return POINTS.some(function (p) { return pendingOwners(p.id, target).length; }); }
function cleanupSentPhotoBlobs() {
  POINTS.forEach(function (p) { recs(p.id).forEach(function (r) {
    if (!r.sentTargets || !r.sentTargets.supabase || !r.photo_refs) return;
    Promise.all(r.photo_refs.filter(function (m) { return m.id; }).map(function (m) { return photoDelete(m.id); }))
      .then(function () { if (r.sync && r.sync.supabase) r.sync.supabase.cleanup_pending = false; save(); })
      .catch(function () { if (r.sync && r.sync.supabase) r.sync.supabase.cleanup_pending = true; save(); });
  }); });
}
function flushQueue() {
  cleanupSentPhotoBlobs();
  if (navigator.onLine === false) return Promise.resolve(false);
  if (hasPendingTarget("appscript") && typeof appscriptSend === "function") appscriptSend(null);
  if (supaOn() && supaAuth() && hasPendingTarget("supabase")) return supaSend(null);
  return Promise.resolve(false);
}
window.addEventListener("online", function () { flushQueue(); });

function uuid4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
    return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
  });
}
