/* Onglet « Calendrier » : matchs et classements des ligues LEC, LCK, LPL, LCS, LFL.
   Données : Leaguepedia (lol.fandom.com, API publique « cargo »), gardées quelques minutes dans le navigateur.
   Liens vers lolesports.com (Riot) pour regarder les matchs et voir la ligue. */
(function(){
var LEAGUES = [
  {k: "LEC", name: "LoL EMEA Championship", slug: "lec"},
  {k: "LCK", name: "LoL Champions Korea", slug: "lck"},
  {k: "LPL", name: "Tencent LoL Pro League", slug: "lpl"},
  {k: "LCS", name: "League of Legends Championship Series", slug: "lcs"},
  {k: "LFL", name: "La Ligue Française", slug: "lfl"}
];
var BY_NAME = {}; LEAGUES.forEach(function(l){ BY_NAME[l.name] = l; });
var API = "https://lol.fandom.com/api.php";
var root = document.createElement("div"); root.className = "cal";
var st = {lg: lsGet("cal.lg") || "all", tour: {}, loading: 0, err: ""};
var data = {tours: null, matches: {}, standings: {}, teams: {}, upcoming: null};

function lsGet(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function e(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
function en(){ return !!(window.I18N && I18N.lang === "en"); }
function loc(){ return en() ? "en-GB" : "fr-FR"; }
function sq(s){ return "'" + String(s).replace(/'/g, "''") + "'"; }
function utc(s){ return s ? new Date(s.replace(" ", "T") + "Z") : null; }
function ymd(d){ return d.toISOString().slice(0, 10); }

/* cargo query with a small cache (key = the query), ttl in minutes */
function cargo(p, ttl){
  var qs = "action=cargoquery&format=json&origin=*&" + Object.keys(p).map(function(k){ return k + "=" + encodeURIComponent(p[k]); }).join("&");
  var cache = lsGet("cal.c") || {}, hit = cache[qs];
  if (hit && Date.now() - hit.t < ttl * 60000) return Promise.resolve(hit.d);
  return fetch(API + "?" + qs).then(function(r){ return r.json(); }).then(function(j){
    if (j.error) throw new Error(j.error.info || "erreur");
    var d = (j.cargoquery || []).map(function(x){ return x.title; });
    cache = lsGet("cal.c") || {};
    Object.keys(cache).forEach(function(k){ if (Date.now() - cache[k].t > 86400000) delete cache[k]; });
    cache[qs] = {t: Date.now(), d: d}; lsSet("cal.c", cache);
    return d;
  }).catch(function(err){ if (hit) return hit.d; throw err; });
}
function load(p){ st.loading++; draw(); return p.then(function(x){ st.loading--; return x; }, function(err){ st.loading--; st.err = "Impossible de récupérer les matchs pour l’instant (Leaguepedia ne répond pas). Réessaie dans un moment."; draw(); throw err; }); }

/* ---- the tournaments of the five leagues over the last year and a bit ---- */
function getTours(){
  if (data.tours) return Promise.resolve(data.tours);
  var since = ymd(new Date(Date.now() - 420 * 86400000));
  return load(cargo({tables: "Tournaments", fields: "Name,OverviewPage,League,DateStart,Date,Split,TournamentLevel,IsQualifier",
    where: "DateStart >= '" + since + "' AND League IN (" + LEAGUES.map(function(l){ return sq(l.name); }).join(",") + ") AND (TournamentLevel IS NULL OR TournamentLevel != 'Showmatch')",
    order_by: "DateStart", limit: "200"}, 360)).then(function(rows){
    data.tours = rows.filter(function(t){ return BY_NAME[t.League] && t.IsQualifier !== "1" && !/showmatch/i.test(t.Name); });
    return data.tours;
  });
}
function toursOf(k){ return (data.tours || []).filter(function(t){ return BY_NAME[t.League].k === k; }); }
function day(s){ return s ? new Date(s + "T00:00:00") : null; }
/* the tournament to show by default: the one being played, else the last one that started */
function curTour(k){
  var ts = toursOf(k), now = new Date(), live = null, last = null;
  ts.forEach(function(t){ var a = day(t.DateStart), b = day(t.Date); if (a && a <= now) { last = t; if (!b || b.getTime() + 86400000 >= now.getTime()) live = t; } });
  return live || last || ts[0] || null;
}
function nextTour(k){ var now = new Date(); return toursOf(k).filter(function(t){ return day(t.DateStart) > now; })[0] || null; }

function getMatches(op){
  if (data.matches[op]) return Promise.resolve(data.matches[op]);
  return load(cargo({tables: "MatchSchedule", fields: "Team1,Team2,Team1Score,Team2Score,Winner,DateTime_UTC,BestOf,Tab,FF,OverviewPage",
    where: "OverviewPage=" + sq(op), order_by: "DateTime_UTC", limit: "500"}, 5)).then(function(rows){ data.matches[op] = rows; return rows; });
}
/* the regular season a playoffs stage comes from (same league, same split, started before, has « Playoffs » removed from the name) */
function seasonOf(op){
  var T = (data.tours || []).filter(function(t){ return t.OverviewPage === op; })[0];
  if (!T || !/playoffs|play-in|finals|road to/i.test(T.Name)) return null;
  var base = T.Name.replace(/\s*(Playoffs|Play-In|Season Play-In|Grand Finals|Road to MSI)\s*$/i, "").trim();
  var c = (data.tours || []).filter(function(t){ return t.League === T.League && t.OverviewPage !== op && t.DateStart <= T.DateStart && !/playoffs|play-in|finals|road to/i.test(t.Name) && (t.Name === base || (T.Split && t.Split === T.Split)); });
  return c.length ? c[c.length - 1] : null;
}
function getStandings(op){
  if (data.standings[op]) return Promise.resolve(data.standings[op]);
  return load(cargo({tables: "Standings", fields: "Team,Place,WinSeries,LossSeries,WinGames,LossGames,Streak,StreakDirection",
    where: "OverviewPage=" + sq(op), order_by: "Place", limit: "60"}, 10)).then(function(rows){ rows.sort(function(a, b){ return (+a.Place || 99) - (+b.Place || 99); }); data.standings[op] = rows; return rows; });
}
/* matches of every league from 2 days ago to 10 days ahead */
function getUpcoming(){
  if (data.upcoming) return Promise.resolve(data.upcoming);
  var a = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 16).replace("T", " "), b = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 16).replace("T", " ");
  var ops = (data.tours || []).filter(function(t){ var s = day(t.DateStart), f = day(t.Date); return s && s.getTime() <= Date.now() + 10 * 86400000 && (!f || f.getTime() >= Date.now() - 3 * 86400000); }).map(function(t){ return t.OverviewPage; });
  if (!ops.length) { data.upcoming = []; return Promise.resolve([]); }
  return load(cargo({tables: "MatchSchedule", fields: "Team1,Team2,Team1Score,Team2Score,Winner,DateTime_UTC,BestOf,Tab,FF,OverviewPage",
    where: "DateTime_UTC >= '" + a + "' AND DateTime_UTC <= '" + b + "' AND OverviewPage IN (" + ops.map(sq).join(",") + ")", order_by: "DateTime_UTC", limit: "300"}, 5))
    .then(function(rows){ data.upcoming = rows; return rows; });
}
/* short names and logos of the teams */
function getTeams(names){
  var want = names.filter(function(n){ return n && n !== "TBD" && !(n in data.teams); });
  want = want.filter(function(n, i){ return want.indexOf(n) === i; });
  if (!want.length) return Promise.resolve();
  var cache = lsGet("cal.teams") || {}, miss = [];
  var noUrl = [];
  want.forEach(function(n){ if (cache[n] && Date.now() - cache[n].t < 7 * 86400000) { data.teams[n] = cache[n]; if (cache[n].img && !cache[n].url) noUrl.push(n); } else miss.push(n); });
  if (!miss.length) return noUrl.length ? getLogos(noUrl) : Promise.resolve();
  var parts = []; for (var i = 0; i < miss.length; i += 40) parts.push(miss.slice(i, i + 40));
  return Promise.all(parts.map(function(p){ return cargo({tables: "Teams", fields: "Name,Short,Image", where: "Name IN (" + p.map(sq).join(",") + ")", limit: "60"}, 1440); }))
    .then(function(rs){
      cache = lsGet("cal.teams") || {};
      miss.forEach(function(n){ data.teams[n] = cache[n] = {s: "", img: "", t: Date.now()}; });
      rs.forEach(function(rows){ rows.forEach(function(r){ data.teams[r.Name] = cache[r.Name] = {s: r.Short || "", img: r.Image || "", t: Date.now()}; }); });
      lsSet("cal.teams", cache);
      return getLogos(miss);
    }).catch(function(){});
}
/* the logo files' addresses (64 px), asked to the wiki 50 at a time */
function getLogos(names){
  var files = names.map(function(n){ return data.teams[n] && data.teams[n].img; }).filter(function(f){ return f; });
  if (!files.length) return Promise.resolve();
  var parts = []; for (var i = 0; i < files.length; i += 50) parts.push(files.slice(i, i + 50));
  return Promise.all(parts.map(function(p){
    return fetch(API + "?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&iiurlwidth=64&titles=" + encodeURIComponent(p.map(function(f){ return "File:" + f; }).join("|")))
      .then(function(r){ return r.json(); }).then(function(j){
        var norm = {}; ((j.query && j.query.normalized) || []).forEach(function(x){ norm[x.to] = x.from; });
        var pages = (j.query && j.query.pages) || {}, url = {};
        Object.keys(pages).forEach(function(k){ var pg = pages[k], ii = pg.imageinfo && pg.imageinfo[0]; if (ii) url[(norm[pg.title] || pg.title).replace(/^File:/, "").replace(/_/g, " ")] = ii.thumburl || ii.url; });
        return url;
      }).catch(function(){ return {}; });
  })).then(function(rs){
    var cache = lsGet("cal.teams") || {};
    rs.forEach(function(url){ names.forEach(function(n){ var t = data.teams[n]; if (t && t.img && url[t.img.replace(/_/g, " ")]) { t.url = url[t.img.replace(/_/g, " ")]; if (cache[n]) cache[n].url = t.url; } }); });
    lsSet("cal.teams", cache);
  });
}

/* ---- drawing ---- */
function logo(n){ var t = data.teams[n]; return t && t.url ? '<img class="cal-lg" src="' + e(t.url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">' : '<span class="cal-lg"></span>'; }
function short(n){ var t = data.teams[n]; return t && t.s ? t.s : n || "?"; }
function leagueOfOp(op){ var t = (data.tours || []).filter(function(x){ return x.OverviewPage === op; })[0]; return t ? BY_NAME[t.League] : null; }
function tabName(s){ if (!s || en()) return s || ""; return String(s).replace(/^Week (\d+)/, "Semaine $1").replace(/^Day (\d+)/, "Jour $1").replace(/^Round (\d+)/, "Tour $1"); }
function hhmm(d){ return d.toLocaleTimeString(loc(), {hour: "2-digit", minute: "2-digit"}); }
function dayTitle(d){ var s = d.toLocaleDateString(loc(), {weekday: "long", day: "numeric", month: "long"}); var t = new Date(); var y = new Date(Date.now() - 86400000), tm = new Date(Date.now() + 86400000);
  if (d.toDateString() === t.toDateString()) return (en() ? "Today" : "Aujourd’hui") + " · " + s;
  if (d.toDateString() === tm.toDateString()) return (en() ? "Tomorrow" : "Demain") + " · " + s;
  if (d.toDateString() === y.toDateString()) return (en() ? "Yesterday" : "Hier") + " · " + s;
  return s.charAt(0).toUpperCase() + s.slice(1); }
function matchHTML(m, showLeague){
  var d = utc(m.DateTime_UTC || m["DateTime UTC"]), done = m.Winner === "1" || m.Winner === "2", w = m.Winner;
  var lg = showLeague ? leagueOfOp(m.OverviewPage) : null, bo = +m.BestOf || 1;
  var live = !done && d && Date.now() >= d.getTime() && Date.now() < d.getTime() + bo * 3600000 + 1800000;
  var lgSlug = (lg || leagueOfOp(m.OverviewPage) || {}).slug;
  var mid = done || (m.Team1Score !== "" && m.Team1Score != null && (+m.Team1Score || +m.Team2Score))
    ? '<span class="cal-sc"><b'+(w === "1" ? ' class="w"' : "")+'>'+e(m.Team1Score || 0)+'</b>–<b'+(w === "2" ? ' class="w"' : "")+'>'+e(m.Team2Score || 0)+'</b></span>'
    : '<span class="cal-sc vs">vs</span>';
  return '<div class="cal-m'+(done ? " done" : "")+(live ? " live" : "")+'">' +
    '<span class="cal-t">'+(d ? hhmm(d) : "")+'</span>' +
    (showLeague ? '<span class="cal-lgk">'+e(lg ? lg.k : "")+'</span>' : "") +
    '<span class="cal-tm a'+(w === "1" ? " w" : w === "2" ? " l" : "")+'" title="'+e(m.Team1)+'"><span class="nm">'+e(short(m.Team1))+'</span>'+logo(m.Team1)+'</span>' + mid +
    '<span class="cal-tm b'+(w === "2" ? " w" : w === "1" ? " l" : "")+'" title="'+e(m.Team2)+'">'+logo(m.Team2)+'<span class="nm">'+e(short(m.Team2))+'</span></span>' +
    '<span class="cal-bo">'+(live && lgSlug ? '<a class="cal-live" href="https://lolesports.com/'+(en() ? "en-GB" : "fr-FR")+'/live/'+lgSlug+'" target="_blank" rel="noopener">● En direct</a>' : "BO" + bo)+'</span></div>';
}
function byDay(ms, showLeague){
  var out = "", cur = "";
  ms.forEach(function(m){ var d = utc(m.DateTime_UTC || m["DateTime UTC"]); var k = d ? d.toDateString() : "";
    if (k !== cur) { if (cur) out += '</div>'; cur = k; out += '<div class="cal-day"><h3>'+e(d ? dayTitle(d) : "")+'</h3>'; }
    out += matchHTML(m, showLeague); });
  return out + (cur ? '</div>' : "");
}
function chips(){
  return '<div class="chips cal-chips" role="group" aria-label="Ligues">' +
    '<button class="chip" data-cal="lg" data-v="all" aria-pressed="'+(st.lg === "all")+'">Toutes</button>' +
    LEAGUES.map(function(l){ return '<button class="chip" data-cal="lg" data-v="'+l.k+'" aria-pressed="'+(st.lg === l.k)+'">'+l.k+'</button>'; }).join("") + '</div>';
}
function standingsHTML(rows){
  if (!rows || !rows.length) return "";
  return '<div class="cal-st"><table><thead><tr><th>#</th><th>Équipe</th><th title="Victoires – défaites (matchs)">V – D</th><th title="Parties gagnées – perdues" class="g">Parties</th><th class="g">Série</th></tr></thead><tbody>' +
    rows.map(function(r){ var gd = (+r.WinGames || 0) - (+r.LossGames || 0);
      return '<tr><td class="pl">'+e(r.Place)+'</td><td><div class="tm">'+logo(r.Team)+'<span class="nm" title="'+e(r.Team)+'">'+e(short(r.Team))+'</span><span class="full">'+e(r.Team)+'</span></div></td>' +
        '<td><b>'+e(r.WinSeries || 0)+' – '+e(r.LossSeries || 0)+'</b></td><td class="g">'+e(r.WinGames || 0)+' – '+e(r.LossGames || 0)+' <span class="gd'+(gd > 0 ? " p" : gd < 0 ? " n" : "")+'">('+(gd > 0 ? "+" : "")+gd+')</span></td>' +
        '<td class="g">'+(r.Streak ? '<span class="sk '+(r.StreakDirection === "W" ? "p" : "n")+'">'+e(r.Streak)+(r.StreakDirection === "W" ? (en() ? "W" : "V") : (en() ? "L" : "D"))+'</span>' : "")+'</td></tr>'; }).join("") +
    '</tbody></table></div>';
}

function draw(){
  var h = chips(), lgs = st.lg === "all" ? null : LEAGUES.filter(function(l){ return l.k === st.lg; })[0];
  if (st.err) h += '<p class="cal-err">'+e(st.err)+'</p>';
  if (!data.tours) { root.innerHTML = h + '<p class="cal-note">Chargement…</p>'; return; }
  if (!lgs) {
    var ups = (data.upcoming || []).slice(), now = Date.now();
    var past = ups.filter(function(m){ var d = utc(m.DateTime_UTC || m["DateTime UTC"]); return m.Winner === "1" || m.Winner === "2" || (d && d.getTime() < now - 4 * 3600000); });
    var next = ups.filter(function(m){ return past.indexOf(m) < 0; });
    h += '<div class="prodle-head"><h2>Prochains matchs</h2><span style="flex:1"></span><a class="ghost cal-ext" href="https://lolesports.com/'+(en() ? "en-GB" : "fr-FR")+'/schedule" target="_blank" rel="noopener">lolesports.com ↗</a></div>';
    if (!data.upcoming) h += '<p class="cal-note">Chargement…</p>';
    else if (next.length) h += byDay(next, true);
    else {
      var rs = LEAGUES.map(function(l){ var t = nextTour(l.k); return t ? '<li><b>'+l.k+'</b> · '+e(t.Name)+' — '+e(day(t.DateStart).toLocaleDateString(loc(), {day: "numeric", month: "long", year: "numeric"}))+'</li>' : ""; }).join("");
      h += '<p class="cal-note">Pas de match prévu dans les 10 prochains jours'+(rs ? ' : c’est l’intersaison. Reprises :' : '.')+'</p>' + (rs ? '<ul class="cal-next">'+rs+'</ul>' : "");
    }
    if (past.length) h += '<h2 class="cal-h2">Derniers résultats</h2>' + byDay(past.reverse(), true);
    root.innerHTML = h; return;
  }
  var ts = toursOf(lgs.k).slice().reverse(), op = st.tour[lgs.k] || (curTour(lgs.k) || {}).OverviewPage, T = ts.filter(function(t){ return t.OverviewPage === op; })[0];
  h += '<div class="prodle-head"><h2>'+e(T ? T.Name : lgs.k)+'</h2><span style="flex:1"></span>' +
    (ts.length ? '<select class="cal-sel" aria-label="Compétition">' + ts.map(function(t){ return '<option value="'+e(t.OverviewPage)+'"'+(t.OverviewPage === op ? " selected" : "")+'>'+e(t.Name)+'</option>'; }).join("") + '</select>' : "") +
    '<a class="ghost cal-ext" href="https://lolesports.com/'+(en() ? "en-GB" : "fr-FR")+'/leagues/'+lgs.slug+'" target="_blank" rel="noopener">'+lgs.k+' sur lolesports.com ↗</a></div>';
  var nt = nextTour(lgs.k); if (nt && (!T || nt.OverviewPage !== T.OverviewPage)) h += '<p class="cal-note">Prochaine compétition : <b>'+e(nt.Name)+'</b>, à partir du '+e(day(nt.DateStart).toLocaleDateString(loc(), {day: "numeric", month: "long", year: "numeric"}))+'.</p>';
  if (!op) { root.innerHTML = h + '<p class="cal-note">Aucune compétition trouvée.</p>'; return; }
  var ms = data.matches[op], sd = data.standings[op], rs = seasonOf(op), sd2 = rs ? data.standings[rs.OverviewPage] : null;
  if (!ms || !sd || (rs && !sd2)) { root.innerHTML = h + '<p class="cal-note">Chargement…</p>'; return; }
  var cols = '<div class="cal-cols">';
  if (sd.length) cols += '<section class="cal-sec"><h2 class="cal-h2">Classement</h2>' + standingsHTML(sd) + '</section>';
  else if (sd2 && sd2.length) cols += '<section class="cal-sec"><h2 class="cal-h2">Classement</h2><p class="cal-note cal-sub">Saison régulière · '+e(rs.Name)+'</p>' + standingsHTML(sd2) + '</section>';
  /* matches: upcoming first (from today), then the results, most recent first */
  var now = Date.now(), up = ms.filter(function(m){ return !(m.Winner === "1" || m.Winner === "2") && utc(m.DateTime_UTC || m["DateTime UTC"]) && utc(m.DateTime_UTC || m["DateTime UTC"]).getTime() > now - 6 * 3600000; }),
      res = ms.filter(function(m){ return up.indexOf(m) < 0; }).reverse();
  cols += '<section class="cal-sec">' + (up.length ? '<h2 class="cal-h2">À venir</h2>' + byDay(up, false) : "") + (res.length ? '<h2 class="cal-h2">Résultats</h2>' + byDay(res, false) : "") +
    (!ms.length ? '<p class="cal-note">Pas encore de match annoncé pour cette compétition.</p>' : "") + '</section></div>';
  root.innerHTML = h + cols;
}

function refresh(){
  st.err = "";
  getTours().then(function(){
    if (st.lg === "all") return getUpcoming().then(function(ms){ return getTeams([].concat.apply([], ms.map(function(m){ return [m.Team1, m.Team2]; }))); });
    var t = st.tour[st.lg] || (curTour(st.lg) || {}).OverviewPage; if (!t) return;
    var rs = seasonOf(t);
    return Promise.all([getMatches(t), getStandings(t), rs ? getStandings(rs.OverviewPage) : Promise.resolve([])]).then(function(r){
      return getTeams([].concat.apply([], r[0].map(function(m){ return [m.Team1, m.Team2]; })).concat(r[1].concat(r[2]).map(function(s){ return s.Team; })));
    });
  }).then(draw, function(){ draw(); });
}

root.addEventListener("click", function(ev){
  var b = ev.target.closest("[data-cal]"); if (!b) return;
  if (b.getAttribute("data-cal") === "lg") { st.lg = b.getAttribute("data-v"); lsSet("cal.lg", st.lg); draw(); refresh(); }
});
root.addEventListener("change", function(ev){
  if (ev.target.classList.contains("cal-sel")) { st.tour[st.lg] = ev.target.value; draw(); refresh(); }
});

var lastRefresh = 0;
window.CAL = {
  attach: function(){
    var slot = document.getElementById("cal-slot"); if (!slot) return;
    if (root.parentNode !== slot) slot.appendChild(root);
    if (Date.now() - lastRefresh > 60000) { lastRefresh = Date.now(); data.upcoming = null; data.matches = {}; draw(); refresh(); }
  }
};
})();
