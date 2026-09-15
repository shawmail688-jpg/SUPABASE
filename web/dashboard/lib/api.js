(function () {
  "use strict";
  var cfg = window.DASHBOARD_CONFIG || {};
  // Keep the project URL as the base for Auth/Storage and explicitly target
  // the PostgREST endpoint for table/RPC requests.  The dashboard config
  // stores the project URL (without /rest/v1), so concatenating table paths
  // directly to cfg.url produces requests to /app_user instead of
  // /rest/v1/app_user; browsers then report the failed preflight as a
  // misleading "Failed to fetch" error.
  var projectBase = String(cfg.url || "").replace(/\/$/, "");
  var restBase = String(cfg.rest_url || (projectBase + "/rest/v1")).replace(/\/$/, "");
  function headers(jwt) {
    if (!cfg.key || !jwt) throw new Error("dashboard authentication required");
    return { apikey: cfg.key, Authorization: "Bearer " + jwt, "Content-Type": "application/json" };
  }
  function json(resp) { return resp.text().then(function (t) { var d; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
    if (!resp.ok) throw new Error((d && (d.message || d.msg)) || t || ("HTTP " + resp.status)); return d; }); }
  function request(jwt, path, options) {
    options = options || {};
    options.headers = options.headers || headers(jwt);
    var base = path.indexOf("/storage/") === 0 ? projectBase : restBase;
    return fetch(base + path, options).then(json);
  }
  function signIn(email, password) { return fetch(cfg.url + "/auth/v1/token?grant_type=password", { method:"POST",
    headers:{ apikey: cfg.key, "Content-Type":"application/json" }, body: JSON.stringify({email:email,password:password}) }).then(json); }
  function session() { try { return JSON.parse(sessionStorage.getItem("dashboard_session") || "null"); } catch (e) { return null; } }
  function saveSession(data) { sessionStorage.setItem("dashboard_session", JSON.stringify(data)); }
  function clearSession() { sessionStorage.removeItem("dashboard_session"); }
  function loadRole(jwt, uid) { return request(jwt, "/app_user?id=eq." + encodeURIComponent(uid) + "&select=id,display_name,role,is_active")
    .then(function (rows) { if (!rows || !rows[0] || !rows[0].is_active) throw new Error("active user profile unavailable"); return rows[0]; }); }
  function listSites(jwt, includeArchived) { return request(jwt, "/site?project_id=eq." + encodeURIComponent(window.__PROJECT_ID || "") +
    (includeArchived ? "" : "&status=neq.hidden") + "&select=id,code,name,grp,address,lat,lon,status,updated_at&order=updated_at.desc"); }
  function projectId(jwt) { return request(jwt, "/project?code=eq." + encodeURIComponent(cfg.project_code) + "&select=id")
    .then(function (rows) { if (!rows || !rows[0]) throw new Error("project unavailable"); return rows[0].id; }); }
  function listSurveys(jwt, siteId) { return request(jwt, "/survey_result?site_id=eq." + encodeURIComponent(siteId) + "&select=*&order=created_at.desc"); }
  function listPhotos(jwt, siteId) { return request(jwt, "/photo?site_id=eq." + encodeURIComponent(siteId) + "&select=*&order=created_at.desc"); }
  function dedupePhotos(photos) {
    var excluded = ((window.PHOTO_DEDUP_CONFIG || {}).excludedSha1 || []).reduce(function (set, hash) { set[String(hash).toLowerCase()] = true; return set; }, {});
    var seen = {};
    return (photos || []).filter(function (photo) {
      var sha1 = String(photo && photo.sha1 || "").toLowerCase();
      var path = String(photo && photo.storage_path || "").toLowerCase();
      var key = sha1 || path;
      if (!key || excluded[sha1] || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function listFengshui(jwt, siteId) { return request(jwt, "/fengshui_eval?site_id=eq." + encodeURIComponent(siteId) + "&select=*&order=created_at.desc"); }
  function listStatusLogs(jwt, siteId) { return request(jwt, "/site_status_log?site_id=eq." + encodeURIComponent(siteId) + "&select=*&order=at.desc"); }
  function rpc(jwt, name, body) { return request(jwt, "/rpc/" + name, {method:"POST", body:JSON.stringify(body || {})}); }
  function updateSite(jwt, id, patch) { return request(jwt, "/site?id=eq." + encodeURIComponent(id), {method:"PATCH", headers:Object.assign(headers(jwt), {Prefer:"return=representation"}), body:JSON.stringify(patch)}); }
  function signPhoto(jwt, path, expiresIn) { return request(jwt, "/storage/v1/object/sign/photos/" + path.split("/").map(encodeURIComponent).join("/"), {method:"POST", body:JSON.stringify({expiresIn:expiresIn || 300})}); }
  function signPhotoUrl(jwt, path, expiresIn) {
    return signPhoto(jwt, path, expiresIn).then(function (data) {
      var url = data && (data.signedURL || data.signedUrl || data.signed_url);
      if (!url) throw new Error("photo link unavailable");
      if (/^https?:\/\//i.test(url)) return url;
      if (url.indexOf("/storage/v1/") === 0) return projectBase + url;
      return projectBase + "/storage/v1" + (url.charAt(0) === "/" ? url : "/" + url);
    });
  }
  function attachCoverPhotos(jwt, sites) {
    return Promise.all((sites || []).map(function (site) {
      var photo = site.photo && site.photo[0];
      if (!photo || !photo.storage_path) return site;
      return signPhotoUrl(jwt, photo.storage_path, 900).then(function (url) { site.cover_photo_url = url; return site; })
        .catch(function () { site.cover_photo_url = ""; return site; });
    }));
  }
  function listDetailed(jwt, sites) {
    return Promise.all((sites || []).map(function (site) {
      return Promise.all([listSurveys(jwt, site.id), listPhotos(jwt, site.id), listStatusLogs(jwt, site.id), listFengshui(jwt, site.id)])
        .then(function (parts) { site.survey_result = parts[0] || []; site.photo = dedupePhotos(parts[1] || []); site.status_log = parts[2] || []; site.fengshui_eval = parts[3] || []; site.fengshui = site.fengshui_eval[0] && site.fengshui_eval[0].raw || null; return site; });
    }));
  }
  function latestSurvey(site) {
    var rows = (site.survey_result || site.surveys || []).slice();
    rows.sort(function (a,b) { var at = (a.raw && a.raw.surveyed_at) || a.created_at || ""; var bt = (b.raw && b.raw.surveyed_at) || b.created_at || ""; return bt.localeCompare(at); });
    return rows[0] || null;
  }
  window.DashboardAPI = { headers:headers, request:request, signIn:signIn, session:session, saveSession:saveSession,
    clearSession:clearSession, loadRole:loadRole, projectId:projectId, listSites:listSites, listSurveys:listSurveys,
    listPhotos:listPhotos, listStatusLogs:listStatusLogs, listDetailed:listDetailed, rpc:rpc, updateSite:updateSite,
    listFengshui:listFengshui, signPhoto:signPhoto, signPhotoUrl:signPhotoUrl, attachCoverPhotos:attachCoverPhotos,
    dedupePhotos:dedupePhotos, latestSurvey:latestSurvey };
}());
