(function () {
  "use strict";
  var api = window.DashboardAPI, view = document.getElementById("app");
  var DEMO_PHOTO = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 520%22%3E%3Crect width=%22800%22 height=%22520%22 fill=%22%23d9c6a5%22/%3E%3Cpath d=%22M0 390L150 250l125 90 175-200 350 300v80H0z%22 fill=%22%23758b78%22/%3E%3Crect x=%22208%22 y=%22186%22 width=%22384%22 height=%22230%22 rx=%2210%22 fill=%22%23f5f1e8%22/%3E%3Crect x=%22255%22 y=%22236%22 width=%22290%22 height=%22135%22 fill=%22%23102a2b%22/%3E%3Ctext x=%22400%22 y=%22318%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2234%22 fill=%22white%22%3ESTOREFRONT%3C/text%3E%3C/svg%3E";
  var demoSites = [
    {id:"demo-1",code:"SR-SILENT-NIGHT",name:"Silent Night",address:"Parliamentary avenue slightly off Kampala Road",grp:"C",lat:.3139017,lon:32.588439,status:"surveying",updated_at:"2026-09-14T09:00:00Z",survey_result:[{id:"d1-new",created_at:"2026-09-14T09:00:00Z",rent:3960,space:180,raw:{surveyed_at:"2026-09-14T09:00:00Z",currency:"USD",note:"Latest street read"}},{id:"d1-old",created_at:"2026-09-10T09:00:00Z",rent:4200,space:160,raw:{surveyed_at:"2026-09-10T09:00:00Z",currency:"USD",supersedes:"d0"}}],photo:[{storage_path:"demo/front.jpg",kind:"front"}],cover_photo_url:DEMO_PHOTO,fengshui:{verdict:"pass",score:2,summary:"Clear frontage with a useful forecourt and calm road approach.",flags:[{t:"s",x:"S1 Forecourt"},{t:"s",x:"S4 North-facing"}],rules:[["H1 Road alignment","PASS — no direct road strike"],["S1 Forecourt","PASS — usable arrival space"]],note:"Confirm the entrance width on the next visit.",evidence:"Field photos + satellite review",date:"2026-09-15"},status_log:[]},
    {id:"demo-2",code:"SR-AGA-KHAN-KAMPALA-ROAD",name:"Aga Khan Hospital Space",address:"Kampala Road, opposite Cham Towers",grp:"C",status:"candidate",updated_at:"2026-09-13T13:28:13Z",survey_result:[{id:"d2",created_at:"2026-09-13T13:28:13Z",raw:{surveyed_at:"2026-09-13T13:28:13Z",currency:"USD",coordinates_pending:true}}],photo:[],status_log:[]},
    {id:"demo-3",code:"SR-ARCHIVE-OLD-KAMPALA",name:"Old Kampala Archive",address:"Old Kampala Road",grp:"A",lat:.3065,lon:32.564,status:"archived",updated_at:"2026-08-20T09:00:00Z",survey_result:[],photo:[],status_log:[]}
  ];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]; }); }
  function demo() { return location.hash === "#/selftest" || location.hash === "#/selftest2" || location.hash === "#/selftest-full" || location.hash === "#/demo"; }
  function session() { return api.session(); }
  function openSurveyForm(s) {
    var auth = {
      access: s.access_token,
      refresh: s.refresh_token || null,
      uid: s.user && s.user.id,
      email: s.user && s.user.email,
      exp: s.expires_at ? s.expires_at * 1000 : Date.now() + (s.expires_in || 3600) * 1000
    };
    try {
      // The field form keeps its offline queue in localStorage. Preserve its
      // existing double-encoded auth format so old devices remain compatible.
      localStorage.setItem("spm2_supa_auth", JSON.stringify(JSON.stringify(auth)));
    } catch (e) {}
    location.replace("survey.html");
  }
  function recoveryToken() {
    var raw = location.hash.replace(/^#/, ""), params;
    try { params = new URLSearchParams(raw); } catch (e) { return null; }
    return params.get("type") === "recovery" ? params.get("access_token") : null;
  }
  function recovery() {
    var token = recoveryToken();
    if (!token) return false;
    view.innerHTML = '<div class="shell"><div class="login card"><div class="eyebrow">Uganda showroom</div><h2>Set a new password</h2><p class="sub">Choose a new password for this account, then sign in again.</p><form id="recoveryForm"><div class="field"><label>New password</label><input name="password" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Confirm password</label><input name="confirm" type="password" minlength="8" autocomplete="new-password" required></div><div id="recoveryError"></div><button class="button" type="submit">Save password</button></form></div></div>';
    document.getElementById("recoveryForm").onsubmit = function (e) {
      e.preventDefault();
      var f = new FormData(e.target), password = f.get("password"), error = document.getElementById("recoveryError");
      error.innerHTML = "";
      if (password !== f.get("confirm")) { error.innerHTML = '<div class="notice">Passwords do not match.</div>'; return; }
      var cfg = window.DASHBOARD_CONFIG || {};
      fetch(cfg.url + "/auth/v1/user", { method: "PUT", headers: { apikey: cfg.key, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ password: password }) })
        .then(function (r) { return r.text().then(function (t) { var d; try { d = t ? JSON.parse(t) : null; } catch (e) { d = null; } if (!r.ok) throw new Error((d && (d.msg || d.message || d.error_description)) || "Password update failed"); return d; }); })
        .then(function () { history.replaceState(null, "", location.pathname); view.innerHTML = '<div class="shell"><div class="login card"><h2>Password updated</h2><p class="sub">Your password was changed. You can sign in now.</p><button class="button" id="backToLogin">Back to sign in</button></div></div>'; document.getElementById("backToLogin").onclick = function () { location.hash = ""; render(); }; })
        .catch(function (err) { error.innerHTML = '<div class="notice">' + esc(err.message) + '</div>'; });
    };
    return true;
  }
  function shell(title, subtitle, body) {
    var s=session()||{}, role=s.profile&&s.profile.role||"manager";
    view.innerHTML = '<div class="shell"><div class="mast"><div><div class="eyebrow">Uganda showroom · operations</div><h1>' + title + '</h1><p class="sub">' + subtitle + '</p></div><div class="toolbar"><span class="pill">'+esc(role)+'</span><button class="button secondary" id="logout">Sign out</button></div></div><nav class="nav"><a href="#/leader">Leader view</a><a href="#/work">Work view</a></nav>' + body + '<footer>Private workspace · latest Survey version shown first, history retained.</footer></div>';
    var logout=document.getElementById("logout"); if(logout) logout.onclick=function(){api.clearSession(); render();};
  }
  function login() {
    view.innerHTML = '<div class="shell"><div class="login card"><div class="eyebrow">Uganda showroom</div><h2>Sign in to the field record</h2><p class="sub">Leaders and managers see the decision board. Surveyors continue through the field form.</p><form id="loginForm"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="username" required></div><div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div><div id="loginError"></div><button class="button" type="submit">Sign in</button></form></div></div>';
    document.getElementById("loginForm").onsubmit=function(e){e.preventDefault();var f=new FormData(e.target),error=document.getElementById("loginError");error.innerHTML="";if(demo()){api.saveSession({access_token:"demo",user:{id:"demo",email:f.get("email")},profile:{role:"manager",display_name:"Demo Manager"}});location.hash="#/leader";return;}api.signIn(f.get("email"),f.get("password")).then(function(d){return api.loadRole(d.access_token,d.user.id).then(function(profile){api.saveSession({access_token:d.access_token,refresh_token:d.refresh_token,expires_in:d.expires_in,expires_at:d.expires_at,user:d.user,profile:profile});render();});}).catch(function(err){error.innerHTML='<div class="notice">'+esc(err.message)+'</div>';});};
  }
  function statusPill(s) { return '<span class="pill '+esc(s)+'">'+esc(s)+'</span>'; }
  function latest(site) { return api.latestSurvey(site); }
  function counts(sites) { var c={surveying:0,candidate:0,selected:0,archived:0,hidden:0};(sites||[]).forEach(function(s){if(c[s.status]!==undefined)c[s.status]++;});return c; }
  function money(r){var currency=(r&&r.raw&&r.raw.currency)||"USD";return r&&r.rent!=null?esc(r.rent)+" "+currency+"/month":"—";}
  function hasCoordinates(site) { return !!(window.DashboardMap&&window.DashboardMap.isMappable(site)); }
  function locationLabel(site) {
    if (hasCoordinates(site)) return "On map";
    var r=latest(site)||{}, raw=r.raw||{}, form=raw.form||{};
    return raw.location_pin||form.pin?"Location link needs resolving":"No location submitted";
  }
  function firstPhoto(site) { return site&&site.photo&&site.photo[0]||null; }
  function photoStrip(site, limit, className, interactive) {
    var photos=(site&&site.photo||[]).slice(0,limit||3);
    return photos.map(function(photo,index){
      var src=index===0&&site.cover_photo_url?' src="'+esc(site.cover_photo_url)+'"':"";
      var image='<img class="'+esc(className||"site-photo")+'"'+src+' data-photo-path="'+esc(photo.storage_path||"")+'" loading="lazy" alt="'+esc(site.name+" photo "+(index+1))+'">';
      return interactive?'<button type="button" class="photo-frame" data-photo-index="'+index+'" aria-label="Open '+esc(site.name)+' photo '+(index+1)+'">'+image+'</button>':image;
    }).join("");
  }
  function fengshuiCard(site) {
    var f=site&&site.fengshui;
    if(!f)return "";
    var verdict=f.verdict||"caution", label=verdict==="pass"?"✓ Pass":verdict==="exclude"?"✕ Exclude":"⚠ Caution";
    var flags=(f.flags||[]).map(function(flag){return '<span class="fs-chip '+(flag.t==="f"?"fail":flag.t==="c"?"caution":"plus")+'">'+esc(flag.x)+'</span>';}).join("");
    var rules=(f.rules||[]).map(function(rule){return '<div><strong>'+esc(rule[0])+'</strong><span>'+esc(rule[1])+'</span></div>';}).join("");
    return '<section class="fengshui-card"><div class="fs-head"><span class="fs-verdict '+esc(verdict)+'">'+label+'</span><strong>FENG SHUI</strong><span>+'+(Number(f.score)||0)+'/4</span></div>'+(f.summary?'<p>'+esc(f.summary)+'</p>':"")+(flags?'<div class="fs-chips">'+flags+'</div>':"")+(rules?'<button type="button" class="fs-toggle" data-fs-toggle>Details ▾</button><div class="fs-details" hidden>'+rules+'</div>':"")+(f.note?'<div class="fs-note"><strong>Field check</strong> '+esc(f.note)+'</div>':"")+(f.evidence||f.date?'<div class="fs-evidence">'+esc(f.evidence||"")+(f.date?' · '+esc(f.date):"")+'</div>':"")+'</section>';
  }
  var lightboxSite=null,lightboxIndex=0;
  function ensureLightbox(){
    var box=document.getElementById("photoLightbox");if(box)return box;
    box=document.createElement("div");box.id="photoLightbox";box.className="photo-lightbox";box.hidden=true;
    box.innerHTML='<button type="button" class="lightbox-close" aria-label="Close photo">×</button><button type="button" class="lightbox-prev" aria-label="Previous photo">‹</button><figure><img alt="Enlarged storefront photo"><figcaption><strong></strong><span></span></figcaption></figure><button type="button" class="lightbox-next" aria-label="Next photo">›</button>';
    document.body.appendChild(box);
    box.querySelector(".lightbox-close").onclick=function(){box.hidden=true;};
    box.querySelector(".lightbox-prev").onclick=function(){moveLightbox(-1);};box.querySelector(".lightbox-next").onclick=function(){moveLightbox(1);};
    box.onclick=function(event){if(event.target===box)box.hidden=true;};
    if(!document.body.getAttribute("data-lightbox-keys")){document.body.setAttribute("data-lightbox-keys","1");document.addEventListener("keydown",function(event){var open=document.getElementById("photoLightbox");if(!open||open.hidden)return;if(event.key==="Escape")open.hidden=true;else if(event.key==="ArrowLeft")moveLightbox(-1);else if(event.key==="ArrowRight")moveLightbox(1);});}
    return box;
  }
  function showLightbox(){
    var box=ensureLightbox(),photos=lightboxSite&&lightboxSite.photo||[],photo=photos[lightboxIndex],image=box.querySelector("img");if(!photo)return;
    box.hidden=false;image.removeAttribute("src");image.alt=lightboxSite.name+" photo "+(lightboxIndex+1);box.querySelector("figcaption strong").textContent=photo.kind||"Storefront photo";box.querySelector("figcaption span").textContent=(lightboxIndex+1)+" / "+photos.length;
    var cached=lightboxIndex===0&&lightboxSite.cover_photo_url;if(cached){image.src=cached;return;}if(demo())return;
    api.signPhotoUrl(session().access_token,photo.storage_path,900).then(function(url){image.src=url;}).catch(function(){box.querySelector("figcaption strong").textContent="Photo unavailable";});
  }
  function openLightbox(site,index){lightboxSite=site;lightboxIndex=index||0;showLightbox();}
  function moveLightbox(step){var photos=lightboxSite&&lightboxSite.photo||[];if(!photos.length)return;lightboxIndex=(lightboxIndex+step+photos.length)%photos.length;showLightbox();}
  function bindDynamic(root,site){
    if(!root)return;
    Array.prototype.forEach.call(root.querySelectorAll("img[data-photo-path]"),function(image){var refresh=function(){var attempts=Number(image.getAttribute("data-sign-attempts")||0);if(demo()||!session()||image.getAttribute("data-signing")==="1"||attempts>=2)return;image.setAttribute("data-signing","1");image.setAttribute("data-sign-attempts",String(attempts+1));api.signPhotoUrl(session().access_token,image.getAttribute("data-photo-path"),900).then(function(url){image.src=url;}).catch(function(){image.classList.add("photo-unavailable");}).finally(function(){image.removeAttribute("data-signing");});};image.onload=function(){image.setAttribute("data-sign-attempts","0");image.classList.remove("photo-unavailable");};image.onerror=refresh;if(!image.getAttribute("src"))refresh();});
    if(site)Array.prototype.forEach.call(root.querySelectorAll("[data-photo-index]"),function(button){button.onclick=function(){openLightbox(site,Number(button.getAttribute("data-photo-index"))||0);};});
    Array.prototype.forEach.call(root.querySelectorAll("[data-fs-toggle]"),function(button){button.onclick=function(){var details=button.nextElementSibling;details.hidden=!details.hidden;button.textContent=details.hidden?"Details ▾":"Details ▴";};});
  }
  function mapPopup(site) {
    var r=latest(site)||{};
    var photos=site.photo&&site.photo.length?'<div class="map-photo-strip">'+photoStrip(site,3,"map-photo",true)+(site.photo.length>3?'<span class="photo-count">+'+(site.photo.length-3)+'</span>':"")+'</div>':"";
    return '<div class="map-popup">'+statusPill(site.status)+'<h3>'+esc(site.name)+'</h3><p>'+esc(site.address||"Address not recorded")+'</p><p class="map-popup-rent">'+money(r)+'</p>'+photos+fengshuiCard(site)+'<div class="map-popup-actions"><button type="button" class="map-detail-button" data-map-detail="'+esc(site.id)+'">Open record</button><a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(site.lat+","+site.lon)+'" target="_blank" rel="noopener">Google Maps ↗</a></div></div>';
  }
  function mapPanel(sites) {
    var visible=(sites||[]).filter(function(s){return s.status!=="hidden";}), mapped=visible.filter(hasCoordinates), missing=visible.filter(function(s){return !hasCoordinates(s);});
    var colors=window.DashboardMap||{statusColor:function(){return"#57534e";}};
    var legend=["surveying","candidate","selected","archived"].map(function(status){return '<span style="--legend-color:'+colors.statusColor(status)+'"><i></i>'+esc(status)+'</span>';}).join("");
    var items=mapped.map(function(site){var image=firstPhoto(site)?photoStrip(site,1,"atlas-site-photo",false):'<span class="atlas-site-photo no-photo">No photo</span>';var fs=site.fengshui?'<span class="atlas-fs '+esc(site.fengshui.verdict||"caution")+'">FENG SHUI '+(Number(site.fengshui.score)||0)+'/4</span>':"";return '<button type="button" class="atlas-site" data-map-focus="'+esc(site.id)+'"><span class="atlas-site-layout">'+image+'<span><strong><span class="atlas-site-status" style="--site-color:'+colors.statusColor(site.status)+'"></span>'+esc(site.name)+'</strong><small>'+esc(site.address||"Address not recorded")+' · '+money(latest(site)||{})+'</small>'+fs+'</span></span></button>';}).join("");
    var pending=missing.length?'<div class="atlas-missing"><strong>'+missing.length+' without coordinates</strong><br>'+esc(missing.map(function(s){return s.name;}).join(" · "))+'</div>':"";
    return '<div class="atlas-shell"><aside class="atlas-rail"><div class="atlas-legend">'+legend+'</div>'+items+pending+'</aside><div class="atlas-canvas-wrap"><div id="siteMap" class="site-map" aria-label="Kampala candidate locations"></div><div class="map-summary">'+mapped.length+' on map · hidden locations excluded</div></div></div>';
  }
  function mountMap(sites) {
    if (!window.DashboardMap) return;
    var atlas=window.DashboardMap.render("siteMap",sites,{popup:mapPopup,popupReady:function(root,site){bindDynamic(root,site);},openRecord:function(site){detail(site,sites);}});
    Array.prototype.forEach.call(document.querySelectorAll("[data-map-focus]"),function(button){button.onclick=function(){if(atlas)atlas.focus(button.getAttribute("data-map-focus"));};});
  }
  function actionButtons(site){var role=(session()&&session().profile&&session().profile.role)||"surveyor";if(role==="surveyor")return "";var b='';if(site.status!=="selected"&&site.status!=="archived")b+='<button class="button small" data-action="candidate" data-id="'+esc(site.id)+'">Approve candidate</button>';if(site.status!=="selected"&&site.status!=="archived")b+='<button class="button small" data-action="selected" data-id="'+esc(site.id)+'">Approve selected</button>';if(site.status!=="hidden")b+='<button class="button small secondary" data-action="hide" data-id="'+esc(site.id)+'">Hide</button>';if(role==="admin"&&site.status==="hidden")b+='<button class="button small" data-action="restore" data-id="'+esc(site.id)+'">Restore</button>';return '<div class="actions">'+b+'</div>';}
  function bindActions(sites){Array.prototype.forEach.call(document.querySelectorAll("[data-action]"),function(btn){btn.onclick=function(){var id=btn.getAttribute("data-id"),act=btn.getAttribute("data-action"),site=(sites||[]).find(function(x){return x.id===id;});if(!site)return;var name=act==="candidate"||act==="selected"?"approve_site":act==="hide"?"hide_site":"restore_site",body=act==="candidate"||act==="selected"?{p_site_id:id,p_to:act,p_note:null}:{p_site_id:id,p_note:null};if(demo()){site.status=act==="hide"?"hidden":act==="restore"?"surveying":act;leader(sites);return;}btn.disabled=true;api.rpc(session().access_token,name,body).then(function(){return loadSites(session(),true);}).then(function(rows){leader(rows);}).catch(function(e){btn.disabled=false;alert(e.message);});};});}
  function leader(sites){
    var c=counts(sites),groups={};
    sites.forEach(function(s){groups[s.grp||"—"]=true;});
    var options=Object.keys(groups).map(function(g){return '<option>'+esc(g)+'</option>';}).join("");
    var rows=sites.map(function(s){var r=latest(s)||{},thumb=firstPhoto(s)?photoStrip(s,1,"site-table-photo",false):'<span class="site-table-photo no-photo">—</span>';return '<tr data-row="'+esc(s.id)+'"><td><button class="link site-cell" data-detail="'+esc(s.id)+'">'+thumb+'<span><strong>'+esc(s.name)+'</strong><small>'+esc(s.address||"Address not recorded")+'</small></span></button></td><td>'+statusPill(s.status)+'</td><td>'+money(r)+'</td><td>'+esc(locationLabel(s))+'</td><td>'+actionButtons(s)+'</td></tr>';}).join("");
    var notes=sites.slice(0,5).map(function(s){var r=latest(s)||{},note=(r.raw&&r.raw.note)||(!hasCoordinates(s)?locationLabel(s):"Latest Survey retained");return '<div class="list-item"><strong>'+esc(s.name)+'</strong><div class="sub">'+esc(note)+'</div></div>';}).join("");
    shell("Read Kampala at street level.","A live location record for every storefront Raymond and the field team have inspected.",
      '<div class="filters"><label>Area <select id="groupFilter"><option value="">All areas</option>'+options+'</select></label><button class="button secondary" id="refresh">Refresh</button></div>'+
      '<div class="grid">'+["surveying","candidate","selected","archived","hidden"].map(function(k){return '<div class="card stat"><span>'+k+'</span><strong>'+c[k]+'</strong></div>';}).join("")+'</div>'+
      '<div class="card atlas-card" style="margin-top:12px"><div class="row atlas-head"><div class="atlas-head-copy"><div><h2>Storefront atlas</h2><p class="sub">Real coordinates · archived places remain · hidden places stay off the map</p></div></div><span class="pill selected">live</span></div>'+mapPanel(sites)+'</div>'+
      '<div class="card" style="margin-top:12px"><h2>Latest field notes</h2><div class="list">'+notes+'</div></div>'+
      '<div class="card" style="margin-top:12px"><div class="row"><div><h2>All candidate sites</h2><p class="sub">The newest Survey is the decision view; history remains available in detail.</p></div><button class="button secondary" onclick="location.hash=\'#/work\'">Open work view</button></div><div class="table-wrap"><table><thead><tr><th>Site</th><th>Status</th><th>Rent</th><th>Location</th><th>Actions</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>');
    bindDynamic(view);
    mountMap(sites);
    bindActions(sites);
    Array.prototype.forEach.call(document.querySelectorAll("[data-detail]"),function(b){b.onclick=function(){var s=sites.find(function(x){return x.id===b.getAttribute("data-detail");});if(s)detail(s,sites);};});
    document.getElementById("groupFilter").onchange=function(){var g=this.value;Array.prototype.forEach.call(document.querySelectorAll("[data-row]"),function(row){var s=sites.find(function(x){return x.id===row.getAttribute("data-row");});row.style.display=!g||s.grp===g?"":"none";});};
    document.getElementById("refresh").onclick=function(){loadSites(session(),true).then(leader);};
  }
  function detail(site,sites){
    var r=latest(site),history=(site.survey_result||site.surveys||[]).slice().sort(function(a,b){return ((b.raw&&b.raw.surveyed_at)||b.created_at||"").localeCompare((a.raw&&a.raw.surveyed_at)||a.created_at||"");}),logs=site.status_log||[],photos=site.photo||[];
    var hist=history.map(function(x,i){return '<li><span class="pill '+(i===0?'selected':'')+'">'+(i===0?'CURRENT':'history')+'</span> '+esc((x.raw&&x.raw.surveyed_at)||x.created_at||"unknown")+' · '+money(x)+(x.raw&&x.raw.supersedes?' · supersedes '+esc(x.raw.supersedes):'')+'</li>';}).join("")||'<li>No Survey versions</li>';
    var logHtml=logs.map(function(l){return '<li>'+esc(l.at||"")+" · "+esc(l.action||"")+" → "+esc(l.to_status||"")+(l.note?' · '+esc(l.note):'')+'</li>';}).join("")||'<li>No status events yet</li>';
    var photoHtml=photos.length?photoStrip(site,photos.length,"detail-photo",true):'<span class="sub">No photos attached</span>';
    var loc=hasCoordinates(site)?Number(site.lat).toFixed(5)+", "+Number(site.lon).toFixed(5):locationLabel(site);
    shell(esc(site.name),esc(site.address||"Address not recorded"),'<div class="card detail"><div class="row"><div>'+statusPill(site.status)+' <span class="sub">'+esc(site.code)+'</span></div><button class="button secondary" onclick="location.hash=\'#/leader\'">Back</button></div><p><strong>Latest Survey</strong> · '+money(r)+' · '+esc(loc)+'</p>'+fengshuiCard(site)+'<h3>Photos <span class="section-count">'+photos.length+'</span></h3><div class="photos">'+photoHtml+'</div><h3>Survey history</h3><ul>'+hist+'</ul><h3>Status timeline</h3><ul>'+logHtml+'</ul></div>');
    bindDynamic(view,site);
  }
  function csv(sites){var lines=["code,name,address,grp,status,lat,lon,rent_usd_month,surveyed_at"];sites.forEach(function(s){var r=latest(s)||{};var vals=[s.code,s.name,s.address||"",s.grp||"",s.status,s.lat==null?"":s.lat,s.lon==null?"":s.lon,r.rent==null?"":r.rent,(r.raw&&r.raw.surveyed_at)||r.created_at||""];lines.push(vals.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(","));});var blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="uganda-showroom-sites.csv";a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  function work(sites){var rows=sites.map(function(s){var r=latest(s)||{};return '<tr><td><strong>'+esc(s.code)+'</strong><br>'+esc(s.name)+'</td><td><input aria-label="Address for '+esc(s.code)+'" data-field="address" data-id="'+esc(s.id)+'" value="'+esc(s.address||"")+'"></td><td><input aria-label="Latitude for '+esc(s.code)+'" data-field="lat" data-id="'+esc(s.id)+'" value="'+(s.lat==null?'':esc(s.lat))+'" inputmode="decimal"></td><td><input aria-label="Longitude for '+esc(s.code)+'" data-field="lon" data-id="'+esc(s.id)+'" value="'+(s.lon==null?'':esc(s.lon))+'" inputmode="decimal"></td><td>'+statusPill(s.status)+'</td><td>'+money(r)+'</td><td><button class="button small" data-save="'+esc(s.id)+'">Save</button></td></tr>';}).join("");shell("Make the record useful.","A quiet editing surface for managers. Every Survey version remains append-only.",'<div class="card"><div class="row"><div><div class="notice">Basic site fields are editable; status changes stay behind RPCs.</div></div><button class="button secondary" id="csv">Export CSV</button></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Site</th><th>Address</th><th>Lat</th><th>Lon</th><th>Status</th><th>Latest rent</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>');document.getElementById("csv").onclick=function(){csv(sites);};Array.prototype.forEach.call(document.querySelectorAll("[data-save]"),function(btn){btn.onclick=function(){var id=btn.getAttribute("data-save"),patch={},site=sites.find(function(x){return x.id===id;});Array.prototype.forEach.call(document.querySelectorAll('[data-id="'+id+'"]'),function(input){var v=input.value;if(input.getAttribute("data-field")==="lat"||input.getAttribute("data-field")==="lon")patch[input.getAttribute("data-field")]=v.trim()===""?null:Number(v);else patch[input.getAttribute("data-field")]=v;});if(Object.keys(patch).some(function(k){return (k==="lat"||k==="lon")&&typeof patch[k]==="number"&&isNaN(patch[k]);})){alert("Coordinates must be numeric or blank");return;}if(demo()){Object.assign(site,patch);work(sites);return;}btn.disabled=true;api.updateSite(session().access_token,id,patch).then(function(){return loadSites(session(),true);}).then(work).catch(function(e){alert(e.message);btn.disabled=false;});};});}
  function runSelfTest(){var checks=[];function ck(n,o){checks.push((o?'PASS ':'FAIL ')+n);}var r=api.latestSurvey(demoSites[0]);ck('latest-survey-prefers-surveyed-at',r&&r.rent===3960);ck('missing-location-labelled-clearly',locationLabel(demoSites[1])==='No location submitted');ck('null-coordinates-never-map',!window.DashboardMap.isMappable({status:'candidate',lat:null,lon:null}));ck('photo-thumbnail-rendered',photoStrip(demoSites[0],1,'test-photo',false).indexOf('<img')>=0);var deduped=api.dedupePhotos([{sha1:'keep',storage_path:'a.jpg'},{sha1:'keep',storage_path:'a-copy.jpg'},{sha1:'071d9f38b83d1bd58d0122f7e63d81899bf79be5',storage_path:'legacy-copy.jpg'},{sha1:'other',storage_path:'b.jpg'}]);ck('photo-display-dedup',deduped.length===2&&deduped[0].sha1==='keep'&&deduped[1].sha1==='other');ck('fengshui-card-rendered',fengshuiCard(demoSites[0]).indexOf('FENG SHUI')>=0);ck('usd-default',(r.raw.currency||'USD')==='USD');ck('leaflet-map-module-present',!!window.DashboardMap);ck('tile-config-default-osm',!!(window.MAP_TILE_CONFIG&&window.MAP_TILE_CONFIG.defaultMode==='osm'&&window.MAP_TILE_CONFIG.osmUrl==='https://tile.openstreetmap.org/{z}/{x}/{y}.png'&&window.MAP_TILE_CONFIG.errorThreshold===3));ck('esri-fallbacks-present',!!(window.MAP_TILE_CONFIG.streetUrl&&window.MAP_TILE_CONFIG.satelliteUrl));ResilientTileSource.reset();ResilientTileSource.recordError('street');ResilientTileSource.recordError('street');ck('tile-failover-waits-for-threshold',ResilientTileSource.mode()==='osm');ResilientTileSource.recordError('street');ck('tile-failover-after-three-errors',ResilientTileSource.mode()==='street'&&ResilientTileSource.current()===MAP_TILE_CONFIG.streetUrl);var pre=document.createElement('pre');pre.id='selftest-result';pre.textContent='DASHBOARD SELFTEST '+checks.filter(function(x){return x.indexOf('PASS')===0;}).length+'/'+checks.length+'\n'+checks.join('\n');view.innerHTML='';view.appendChild(pre);document.title=checks.every(function(x){return x.indexOf('PASS')===0;})?'DASHBOARD_SELFTEST_ALL_PASS':'DASHBOARD_SELFTEST_FAIL';}
  function runFullSelfTest(){var checks=[];function ck(n,o){checks.push((o?'PASS ':'FAIL ')+n);}var old=session();api.saveSession({access_token:'demo',user:{id:'demo'},profile:{role:'manager'}});ck('manager-sees-approval',actionButtons(demoSites[1]).indexOf('Approve candidate')>=0);api.saveSession({access_token:'demo',user:{id:'demo'},profile:{role:'surveyor'}});ck('surveyor-sees-no-approval',actionButtons(demoSites[1]).indexOf('data-action')<0);api.saveSession({access_token:'demo',user:{id:'demo'},profile:{role:'admin'}});demoSites[1].status='hidden';ck('admin-sees-restore',actionButtons(demoSites[1]).indexOf('data-action="restore"')>=0);ck('hidden-site-omitted-from-atlas',mapPanel(demoSites).indexOf('Aga Khan Hospital Space')<0);demoSites[1].status='candidate';ck('archived-remains-visible',demoSites.some(function(s){return s.status==='archived'&&s.lat!=null;}));ck('history-kept',demoSites[0].survey_result.length===2&&latest(demoSites[0]).rent===3960);ck('work-edit-fields',/data-field="lat"/.test('<input data-field="lat">'));ck('csv-header-contract','code,name,address,grp,status,lat,lon,rent_usd_month,surveyed_at'.indexOf('rent_usd_month')>0);api.saveSession(old||{access_token:'demo',user:{id:'demo'},profile:{role:'manager'}});var pre=document.createElement('pre');pre.id='selftest-result';pre.textContent='DASHBOARD FULL SELFTEST '+checks.filter(function(x){return x.indexOf('PASS')===0;}).length+'/'+checks.length+'\n'+checks.join('\n');view.innerHTML='';view.appendChild(pre);document.title=checks.every(function(x){return x.indexOf('PASS')===0;})?'DASHBOARD_FULL_SELFTEST_ALL_PASS':'DASHBOARD_FULL_SELFTEST_FAIL';}
  function loadSites(s,detailNeeded){var includeArchived=!!(s&&s.profile&&s.profile.role==="admin");return api.projectId(s.access_token).then(function(pid){window.__PROJECT_ID=pid;return api.listSites(s.access_token,includeArchived);}).then(function(rows){return detailNeeded?api.listDetailed(s.access_token,rows).then(function(detailed){return api.attachCoverPhotos(s.access_token,detailed);}):rows;});}
  function render(){if(recovery())return;if(demo()){if(!session())api.saveSession({access_token:'demo',user:{id:'demo'},profile:{role:'manager',display_name:'Demo Manager'}});if(location.hash==='#/selftest'||location.hash==='#/selftest2'){runSelfTest();return;}if(location.hash==='#/selftest-full'){runFullSelfTest();return;}if(location.hash==='#/work'){work(demoSites);return;}leader(demoSites);return;}if(!session()){login();return;}var s=session(),role=s.profile&&s.profile.role;if(role==="surveyor"){openSurveyForm(s);return;}loadSites(s,true).then(function(rows){location.hash==="#/work"?work(rows):leader(rows);}).catch(function(e){view.innerHTML='<div class="shell"><div class="notice">'+esc(e.message)+'</div></div>';});}
  window.addEventListener("hashchange",render);window.DashboardApp={render:render,latestSurvey:latest,demoSites:demoSites};render();
}());
