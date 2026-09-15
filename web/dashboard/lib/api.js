(function () {
  "use strict";
  var cfg = window.DASHBOARD_CONFIG || {};
  function headers(jwt) {
    if (!cfg.key || !jwt) throw new Error("dashboard authentication required");
    return { apikey: cfg.key, Authorization: "Bearer " + jwt, "Content-Type": "application/json" };
  }
  function json(resp) { return resp.text().then(function (t) { var d; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
    if (!resp.ok) throw new Error((d && (d.message || d.msg)) || t || ("HTTP " + resp.status)); return d; }); }
  function request(jwt, path, options) { options = options || {}; options.headers = options.headers || headers(jwt); return fetch(cfg.url + path, options).then(json); }
  function signIn(email, password) { return fetch(cfg.url + "/auth/v1/token?grant_type=password", { method:"POST",
    headers:{ apikey: cfg.key, "Content-Type":"application/json" }, body: JSON.stringify({email:email,password:password}) }).then(json); }
  function session() { try { return JSON.parse(sessionStorage.getItem("dashboard_session") || "null"); } catch (e) { return null; } }
  function saveSession(data) { sessionStorage.setItem("dashboard_session", JSON.stringify(data)); }
  function clearSession() { sessionStorage.removeItem("dashboard_session"); }
  function loadRole(jwt, uid) { return request(jwt, "/app_user?id=eq." + encodeURIComponent(uid) + "&select=id,display_name,role,is_active")
    .then(function (rows) { if (!rows || !rows[0] || !rows[0].is_active) throw new Error("active user profile unavailable"); return rows[0]; }); }
  function listSites(jwt) { return request(jwt, "/site?project_id=eq." + encodeURIComponent(window.__PROJECT_ID || "") +
    "&status=neq.archived&select=id,code,name,grp,address,lat,lon,status,updated_at&order=updated_at.desc"); }
  function projectId(jwt) { return request(jwt, "/project?code=eq." + encodeURIComponent(cfg.project_code) + "&select=id")
    .then(function (rows) { if (!rows || !rows[0]) throw new Error("project unavailable"); return rows[0].id; }); }
  function listSurveys(jwt, siteId) { return request(jwt, "/survey_result?site_id=eq." + encodeURIComponent(siteId) + "&select=*&order=created_at.desc"); }
  function listPhotos(jwt, siteId) { return request(jwt, "/photo?site_id=eq." + encodeURIComponent(siteId) + "&select=*&order=created_at.desc"); }
  function listStatusLogs(jwt, siteId) { return request(jwt, "/site_status_log?site_id=eq." + encodeURIComponent(siteId) + "&select=*&order=at.desc"); }
  function rpc(jwt, name, body) { return request(jwt, "/rpc/" + name, {method:"POST", body:JSON.stringify(body || {})}); }
  function updateSite(jwt, id, patch) { return request(jwt, "/site?id=eq." + encodeURIComponent(id), {method:"PATCH", headers:Object.assign(headers(jwt), {Prefer:"return=representation"}), body:JSON.stringify(patch)}); }
  function signPhoto(jwt, path, expiresIn) { return request(jwt, "/storage/v1/object/sign/photos/" + path.split("/").map(encodeURIComponent).join("/"), {method:"POST", body:JSON.stringify({expiresIn:expiresIn || 300})}); }
  function listDetailed(jwt, sites) {
    return Promise.all((sites || []).map(function (site) {
      return Promise.all([listSurveys(jwt, site.id), listPhotos(jwt, site.id), listStatusLogs(jwt, site.id)])
        .then(function (parts) { site.survey_result = parts[0] || []; site.photo = parts[1] || []; site.status_log = parts[2] || []; return site; });
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
    signPhoto:signPhoto, latestSurvey:latestSurvey };
}());
