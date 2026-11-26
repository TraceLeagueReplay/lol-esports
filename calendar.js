/* Onglet « Calendrier » : matchs et classements des ligues LEC, LCK, LPL, LCS, LFL.
   Données : Leaguepedia (lol.fandom.com, API publique « cargo »), gardées quelques minutes dans le navigateur.
   Liens vers lolesports.com (Riot) pour regarder les matchs et voir la ligue. */
(function(){
var LEAGUES = [
  {k: "LEC", name: "LoL EMEA Championship", slug: "lec"},
  {k: "LCK", name: "LoL Champions Korea", slug: "lck"},
  {k: "LPL", name: "Tencent LoL Pro League", slug: "lpl"},
  {k: "LCS", name: "League of Legends Championship Series", slug: "lcs"},
  {k: "LFL", name: "La Ligue Française", slug: "lfl"},
  /* international tournaments: Worlds, MSI, First Stand (one chip; the lolesports link depends on the tournament) */
  {k: "INTL", label: "International", names: ["World Championship", "Mid-Season Invitational", "First Stand"], slug: "worlds", only: /^(Worlds|MSI|First Stand)\b/}
];
var INTL_SLUG = {"World Championship": "worlds", "Mid-Season Invitational": "msi", "First Stand": "first_stand"};
var BY_NAME = {}; LEAGUES.forEach(function(l){ (l.names || [l.name]).forEach(function(n){ BY_NAME[n] = l; }); });
function allNames(){ return [].concat.apply([], LEAGUES.map(function(l){ return l.names || [l.name]; })); }
function label(l){ return l.label || l.k; }
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
/* Answers are kept in three places, from fastest to slowest:
   1. this browser (localStorage), shown right away even when a bit old (then refreshed behind the scenes);
   2. the site's database (Firestore « calcache »), shared by everybody: one person asks the wiki, the others reuse the answer;
   3. the wiki itself (Leaguepedia), which limits how many questions one person asks per minute. */
function qhash(s){ var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); }
function fsReady(){
  return new Promise(function(res){ var n = 0; (function wait(){ var A = window.__app, F = A && A.F && A.F(); if (F) return res(F); if (++n > 30) return res(null); setTimeout(wait, 100); })(); });
}
function fromWiki(qs, retry){
  return fetch(API + "?" + qs).then(function(r){ return r.json(); }).then(function(j){
    if (j.error) {
      if ((retry || 0) < 2 && /rate limit/i.test(j.error.info || "")) return new Promise(function(res){ setTimeout(res, retry ? 15000 : 5000); }).then(function(){ return fromWiki(qs, (retry || 0) + 1); });
      throw new Error(j.error.info || "erreur");
    }
    return (j.cargoquery || []).map(function(x){ return x.title; });
  });
}
function keep(qs, d, t){
  var cache = lsGet("cal.c") || {};
  Object.keys(cache).forEach(function(k){ if (Date.now() - cache[k].t > 7 * 86400000) delete cache[k]; });
  cache[qs] = {t: t || Date.now(), d: d}; lsSet("cal.c", cache);
}
/* ask the shared copy, then the wiki; the wiki's answer is shared for the next people */
function fetchFresh(qs, ttl, produce){
  var key = "calcache/" + qhash(qs);
  produce = produce || function(){ return fromWiki(qs); };
  return fsReady().then(function(F){
    var get = F ? F.getDoc(F.doc(F.db, key)).then(function(s){ var v = s.exists() ? s.data() : null; return v && v.q === qs ? v : null; }).catch(function(){ return null; }) : Promise.resolve(null);
    return get.then(function(v){
      if (v && Date.now() - v.t < ttl * 60000) { var d = JSON.parse(v.d); keep(qs, d, v.t); return d; }
      return produce().then(function(d){
        keep(qs, d);
        if (F) F.setDoc(F.doc(F.db, key), {q: qs, d: JSON.stringify(d), t: Date.now()}).catch(function(){});
        return d;
      }, function(err){ if (v) { var d = JSON.parse(v.d); keep(qs, d, v.t); return d; } throw err; });
    });
  });
}
var bg = {}, bgT = null;
function cargo(p, ttl){
  var qs = "action=cargoquery&format=json&origin=*&" + Object.keys(p).map(function(k){ return k + "=" + encodeURIComponent(p[k]); }).join("&");
  var hit = (lsGet("cal.c") || {})[qs];
  if (hit && Date.now() - hit.t < ttl * 60000) return Promise.resolve(hit.d);
  if (hit) {
    /* old answer: show it now, get the new one behind the scenes and redraw when it comes */
    if (!bg[qs]) { bg[qs] = 1; fetchFresh(qs, ttl).then(function(d){ delete bg[qs]; if (JSON.stringify(d) !== JSON.stringify(hit.d)) { clearTimeout(bgT); bgT = setTimeout(reload, 300); } }, function(){ delete bg[qs]; }); }
    return Promise.resolve(hit.d);
  }
  return fetchFresh(qs, ttl);
}
function load(p){ st.loading++; draw(); return p.then(function(x){ st.loading--; st.err = ""; return x; }, function(err){ st.loading--; st.err = "Impossible de récupérer les matchs pour l’instant (Leaguepedia ne répond pas). Réessaie dans un moment."; draw(); throw err; }); }

/* ---- the tournaments of the five leagues over the last year and a bit ---- */
function getTours(){
  if (data.tours) return Promise.resolve(data.tours);
  var since = ymd(new Date(Date.now() - 420 * 86400000));
  return load(cargo({tables: "Tournaments", fields: "Name,OverviewPage,League,DateStart,Date,Split,TournamentLevel,IsQualifier",
    where: "DateStart >= '" + since + "' AND League IN (" + allNames().map(sq).join(",") + ") AND (TournamentLevel IS NULL OR TournamentLevel != 'Showmatch')",
    order_by: "DateStart", limit: "200"}, 360)).then(function(rows){
    var ok = rows.filter(function(t){ var L = BY_NAME[t.League]; return L && t.IsQualifier !== "1" && !/showmatch/i.test(t.Name) && (!L.only || L.only.test(t.Name)); });
    /* a tournament split in stages (Worlds = Play-In + Main Event): keep the stages, drop the page that only groups them */
    data.tours = ok.filter(function(t){ return !ok.some(function(u){ return u !== t && u.OverviewPage.indexOf(t.OverviewPage + "/") === 0; }); });
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
  if (!T || !/playoffs|play-in|finals|road to/i.test(T.Name) || (BY_NAME[T.League] || {}).k === "INTL") return null;
  var base = T.Name.replace(/\s*(Playoffs|Play-In|Season Play-In|Grand Finals|Road to MSI)\s*$/i, "").trim();
  var c = (data.tours || []).filter(function(t){ return t.League === T.League && t.OverviewPage !== op && t.DateStart <= T.DateStart && !/playoffs|play-in|finals|road to/i.test(t.Name) && (t.Name === base || (T.Split && t.Split === T.Split)); });
  return c.length ? c[c.length - 1] : null;
}
function getStandings(op){
  if (data.standings[op]) return Promise.resolve(data.standings[op]);
  return load(cargo({tables: "Standings", fields: "Team,Place,WinSeries,LossSeries,WinGames,LossGames,Streak,StreakDirection",
    where: "OverviewPage=" + sq(op), order_by: "Place", limit: "60"}, 10)).then(function(rows){
      rows.sort(function(a, b){ return (+a.Place || 99) - (+b.Place || 99); });
      /* the same place twice: the stage is played in groups (LCK Legend / Rise…): ask which team is in which group */
      var seen = {}, dup = rows.some(function(r){ if (seen[r.Place]) return true; seen[r.Place] = 1; return false; });
      if (!dup) { data.standings[op] = rows; return rows; }
      return cargo({tables: "TournamentGroups", fields: "GroupName,Team", where: "OverviewPage=" + sq(op), limit: "80"}, 60).then(function(gs){
        var g = {}; gs.forEach(function(x){ g[x.Team] = x.GroupName; });
        rows.forEach(function(r){ r.group = g[r.Team] || ""; });
        data.standings[op] = rows; return rows;
      }, function(){ data.standings[op] = rows; return rows; });
    });
}
/* matches of every league from 2 days ago to 10 days ahead */
function getUpcoming(){
  if (data.upcoming) return Promise.resolve(data.upcoming);
  var a = ymd(new Date(Date.now() - 2 * 86400000)) + " 00:00", b = ymd(new Date(Date.now() + 11 * 86400000)) + " 00:00";
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
  var A = window.__app;
  want = want.filter(function(n){ var sh = ""; try { sh = A && A.teamShort ? A.teamShort(n) : ""; } catch(x){} if (sh) { data.teams[n] = {s: sh, img: "", t: Date.now(), site: 1}; return false; } return true; });
  if (!want.length) return Promise.resolve();
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
    var u = "action=query&format=json&origin=*&prop=imageinfo&iiprop=url&iiurlwidth=64&titles=" + encodeURIComponent(p.map(function(f){ return "File:" + f; }).join("|"));
    var hit = (lsGet("cal.c") || {})[u];
    return (hit && Date.now() - hit.t < 7 * 86400000 ? Promise.resolve(hit.d) : fetchFresh(u, 7 * 1440, function(){ return fetch(API + "?" + u).then(function(r){ return r.json(); }).then(function(j){ if (j.error) throw new Error(j.error.info); return j; }); }))
      .then(function(j){
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
/* the team's logo: the one used in Rosters when the team is there (light and dark versions), else the wiki's */
function logo(n, lg){
  var t = data.teams[n], A = window.__app, h = "";
  try { h = A && A.teamLogo ? A.teamLogo(n, t && t.s, lg) : ""; } catch(x){}
  if (h) return '<span class="cal-lg cal-site logo">' + h + '</span>';
  return t && t.url ? '<img class="cal-lg" src="' + e(t.url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">' : '<span class="cal-lg"></span>'; }
function cleanName(n){ return String(n || "").replace(/\s*\([^)]*\)/g, "").trim(); }
function short(n){ var t = data.teams[n]; return t && t.s ? t.s : cleanName(n) || "?"; }
function tourOf(op){ return (data.tours || []).filter(function(x){ return x.OverviewPage === op; })[0] || null; }
/* lolesports.com page of a league (international: Worlds, MSI or First Stand depending on the tournament) */
function slugOf(L, T){ return L && L.k === "INTL" ? (T && INTL_SLUG[T.League]) || "worlds" : L && L.slug; }
function tagOf(L, T){ if (!L) return ""; if (L.k !== "INTL") return L.k; var n = T ? T.Name : ""; return /^MSI/.test(n) ? "MSI" : /^First Stand/.test(n) ? "FS" : "Worlds"; }
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
  var LG = lg || leagueOfOp(m.OverviewPage) || {}, lgSlug = slugOf(LG, tourOf(m.OverviewPage));
  var mid = done || (m.Team1Score !== "" && m.Team1Score != null && (+m.Team1Score || +m.Team2Score))
    ? '<span class="cal-sc"><b'+(w === "1" ? ' class="w"' : "")+'>'+e(m.Team1Score || 0)+'</b>–<b'+(w === "2" ? ' class="w"' : "")+'>'+e(m.Team2Score || 0)+'</b></span>'
    : '<span class="cal-sc vs">vs</span>';
  return '<div class="cal-m'+(done ? " done" : "")+(live ? " live" : "")+'">' +
    '<span class="cal-t">'+(d ? hhmm(d) : "")+'</span>' +
    (showLeague ? '<span class="cal-lgk">'+e(tagOf(lg, tourOf(m.OverviewPage)))+'</span>' : "") +
    '<span class="cal-tm a'+(w === "1" ? " w" : w === "2" ? " l" : "")+'" title="'+e(m.Team1)+'"><span class="nm">'+e(short(m.Team1))+'</span>'+logo(m.Team1, LG.k)+'</span>' + mid +
    '<span class="cal-tm b'+(w === "2" ? " w" : w === "1" ? " l" : "")+'" title="'+e(m.Team2)+'">'+logo(m.Team2, LG.k)+'<span class="nm">'+e(short(m.Team2))+'</span></span>' +
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
    LEAGUES.map(function(l){ return '<button class="chip" data-cal="lg" data-v="'+l.k+'" aria-pressed="'+(st.lg === l.k)+'">'+label(l)+'</button>'; }).join("") + '</div>';
}
function standingsHTML(rows, lg, zs){
  if (!rows || !rows.length) return "";
  if (rows.some(function(r){ return r.group; })) {
    var order = [], by = {};
    rows.forEach(function(r){ var k = r.group || ""; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(r); });
    return order.map(function(k){ return (k ? '<h3 class="cal-grp">'+e(k)+'</h3>' : "") + standingsHTML(by[k].map(function(r){ var c = {}; for (var x in r) c[x] = r[x]; c.group = ""; return c; }), lg); }).join("");
  }
  return '<div class="cal-st"><table><thead><tr><th>#</th><th>Équipe</th><th title="Victoires – défaites (matchs)">V – D</th><th title="Parties gagnées – perdues" class="g">Parties</th><th class="g">Série</th></tr></thead><tbody>' +
    rows.map(function(r){ var gd = (+r.WinGames || 0) - (+r.LossGames || 0), played = rows.some(function(x){ return +x.WinSeries || +x.LossSeries; });
      var z = zs && zs[r.Team], zc = z ? ' class="z'+(z.sure ? " sure" : "")+(z.z === "out" && z.sure ? " gone" : "")+'" style="--z:'+ZONES[z.z].c+'" title="'+e((en() ? ZONES[z.z].en : ZONES[z.z].fr) + (z.sure ? "" : en() ? " (not decided yet)" : " (pas encore décidé)"))+'"' : "";
      return '<tr'+zc+'><td class="cal-pl">'+(played ? e(r.Place) : "–")+'</td><td><div class="tm">'+logo(r.Team, lg)+'<span class="nm" title="'+e(r.Team)+'">'+e(short(r.Team))+'</span></div></td>' +
        /* scores in small fixed columns (wins on the right, losses on the left of the dash), so every « – » lines up */
        '<td><span class="sc2 b"><i>'+e(r.WinSeries || 0)+'</i><i>–</i><i>'+e(r.LossSeries || 0)+'</i></span></td>' +
        '<td class="g"><span class="sc2 gm"><i>'+e(r.WinGames || 0)+'</i><i>–</i><i>'+e(r.LossGames || 0)+'</i><i class="gd'+(gd > 0 ? " p" : gd < 0 ? " n" : "")+'">('+(gd > 0 ? "+" : "")+gd+')</i></span></td>' +
        '<td class="g">'+(+r.Streak ? '<span class="sk '+(r.StreakDirection === "W" ? "p" : "n")+'">'+e(r.Streak)+(r.StreakDirection === "W" ? (en() ? "W" : "V") : (en() ? "L" : "D"))+'</span>' : "")+'</td></tr>'; }).join("") +
    '</tbody></table></div>';
}

/* ---- bracket (« arbre ») of a playoffs stage or of the knockout stage of an international tournament ---- */
function isBracket(m, T){
  var tab = String(m.Tab || "");
  /* a stage that is all knockout (playoffs, grand finals, road to MSI…): every match is in the bracket */
  if (T && /playoffs|finals|knockout|bracket|road to|regional/i.test(T.Name) && (BY_NAME[T.League] || {}).k !== "INTL") return true;
  if (/^(Bracket|Upper|Lower|Quarter|Semi|Grand Final|Finals?$|Round of|Knockout|Playoffs?\b)/i.test(tab)) return true;
  return !!(T && /playoffs/i.test(T.Name) && /^(Round \d+|Finals?)$/i.test(tab));
}
function brTab(s){ if (en()) return s; return String(s).replace(/^Bracket /, "").replace(/^Round (\d+)$/, "Tour $1").replace(/^Quarterfinals?$/i, "Quarts de finale").replace(/^Semifinals?$/i, "Demi-finales").replace(/^Grand Finals?$/i, "Grande finale").replace(/^Finals?$/i, "Finale").replace(/^Upper /, "").replace(/^Lower /, ""); }
/* order the matches of a bracket and tell for each one: upper, lower or final */
function lanesOf(ms){
  var list = ms.slice().sort(function(a, b){ return String(a.DateTime_UTC || a["DateTime UTC"]).localeCompare(String(b.DateTime_UTC || b["DateTime UTC"])) || (+a.N_MatchInTab || +a["N MatchInTab"] || 0) - (+b.N_MatchInTab || +b["N MatchInTab"] || 0); });
  var tabs = []; list.forEach(function(m){ if (tabs.indexOf(m.Tab) < 0) tabs.push(m.Tab); });
  var lastTab = tabs[tabs.length - 1], loss = {}, lane = {};
  /* upper or lower bracket: a team that already lost in this bracket, or already played in the lower one (some teams start there), plays in the lower one */
  list.forEach(function(m){
    var t1 = m.Team1, t2 = m.Team2, known = function(t){ return t && t !== "TBD"; };
    if (/final/i.test(m.Tab) && m.Tab === lastTab) lane[m.Tab + "|" + list.indexOf(m)] = "final";
    else if (/^lower/i.test(m.Tab)) lane[m.Tab + "|" + list.indexOf(m)] = "lower";
    else if (/^upper/i.test(m.Tab)) lane[m.Tab + "|" + list.indexOf(m)] = "upper";
    else lane[m.Tab + "|" + list.indexOf(m)] = (known(t1) && loss[t1]) || (known(t2) && loss[t2]) ? "lower" : (known(t1) || known(t2)) ? "upper" : "?";
    if (lane[m.Tab + "|" + list.indexOf(m)] === "lower") { if (known(t1)) loss[t1] = loss[t1] || 0.5; if (known(t2)) loss[t2] = loss[t2] || 0.5; }
    if (m.Winner === "1" && known(t2)) loss[t2] = (loss[t2] || 0) + 1;
    if (m.Winner === "2" && known(t1)) loss[t1] = (loss[t1] || 0) + 1;
  });
  /* matches with two unknown teams: same bracket as the others of their round, if they are all in one */
  list.forEach(function(m, i){ var k = m.Tab + "|" + i; if (lane[k] !== "?") return;
    var others = list.map(function(x, j){ return x.Tab === m.Tab ? lane[x.Tab + "|" + j] : null; }).filter(function(v){ return v && v !== "?"; });
    lane[k] = others.length && others.every(function(v){ return v === others[0]; }) ? others[0] : "upper"; });
  return {list: list, lane: function(i){ return lane[list[i].Tab + "|" + i]; }};
}
function bracketHTML(ms, lgK){
  var L = lanesOf(ms), list = L.list, lane = {};
  list.forEach(function(m, i){ lane[m.Tab + "|" + i] = L.lane(i); });
  var lanes = {upper: [], lower: [], final: []};
  list.forEach(function(m, i){ lanes[lane[m.Tab + "|" + i]].push(m); });
  function team(m, n){ var t = m["Team" + n], w = m.Winner === String(n), l = m.Winner === String(3 - n), sc = m["Team" + n + "Score"];
    return '<div class="br-t'+(w ? " w" : l ? " l" : "")+'" title="'+e(t)+'">'+(t && t !== "TBD" ? logo(t, lgK) : '<span class="cal-lg"></span>')+'<span class="nm">'+e(t && t !== "TBD" ? short(t) : (en() ? "TBD" : "À définir"))+'</span><b>'+e(sc === "" || sc == null ? "" : sc)+'</b></div>'; }
  function card(m){ var d = utc(m.DateTime_UTC || m["DateTime UTC"]);
    return '<div class="br-m">'+team(m, 1)+team(m, 2)+'<div class="br-d">'+(d ? e(d.toLocaleDateString(loc(), {day: "numeric", month: "short"}) + " · " + hhmm(d)) : "")+'</div></div>'; }
  function cols(ms2){ var tb = []; ms2.forEach(function(m){ if (tb.indexOf(m.Tab) < 0) tb.push(m.Tab); });
    return tb.map(function(t){ return '<div class="br-col"><div class="br-h">'+e(brTab(t))+'</div><div class="br-ms">'+ms2.filter(function(m){ return m.Tab === t; }).map(card).join("")+'</div></div>'; }).join(""); }
  var dbl = lanes.lower.length > 0;
  return '<div class="br">' +
    '<div class="br-lanes">' + (dbl ? '<div class="br-lt">Upper bracket</div>' : "") + '<div class="br-lane">' + cols(lanes.upper) + '</div>' +
      (dbl ? '<div class="br-lt">Lower bracket</div><div class="br-lane">' + cols(lanes.lower) + '</div>' : "") + '</div>' +
    (lanes.final.length ? '<div class="br-fin">' + cols(lanes.final) + '</div>' : "") + '</div>';
}

/* ---- who goes where after the regular season: colours of the standings ---- */
var ZONES = {
  /* colours: Leaguepedia's own (standings-upwith2bye, -upwithbye, -up, -stayup, -stay), light and dark theme, see index.html --lp-* */
  bye:    {c: "var(--lp-upwith2bye)", fr: "Playoffs, exempté du 1er tour", en: "Playoffs, first-round bye", r: 0},
  upper:  {c: "var(--lp-upwithbye)", fr: "Playoffs · upper bracket", en: "Playoffs · upper bracket", r: 1},
  po:     {c: "var(--lp-up)", fr: "Qualifié en playoffs", en: "Qualified for playoffs", r: 1},
  lower:  {c: "var(--lp-up)", fr: "Playoffs · lower bracket", en: "Playoffs · lower bracket", r: 2},
  playin: {c: "var(--lp-stayup)", fr: "Play-in / repêchage", en: "Play-in / last chance", r: 3},
  out:    {c: "var(--lp-stay)", fr: "Éliminé", en: "Eliminated", r: 4}
};
function isKnockout(T){ return !!(T && /playoffs|play-in|finals|knockout|road to|knight/i.test(T.Name) && (BY_NAME[T.League] || {}).k !== "INTL"); }
/* the stages played right after a regular season (playoffs, play-in, grand finals…) */
function nextStages(T){
  if (!T || isKnockout(T)) return [];
  var end = day(T.Date) || day(T.DateStart), lim = end ? end.getTime() + 45 * 86400000 : 0;
  var after = (data.tours || []).filter(function(t){ return t.League === T.League && t !== T && t.DateStart >= T.DateStart && day(t.DateStart).getTime() <= lim; });
  var nextReg = after.filter(function(t){ return !isKnockout(t); })[0];
  return after.filter(function(t){ return isKnockout(t) && (!nextReg || t.DateStart < nextReg.DateStart); });
}
/* the same season a year before (same split), else the previous regular season: its outcome tells how many teams go where */
function refSeason(T){
  var prev = (data.tours || []).filter(function(t){ return t.League === T.League && t !== T && t.DateStart < T.DateStart && !isKnockout(t); });
  var same = prev.filter(function(t){ return T.Split && t.Split === T.Split; });
  var c = (same.length ? same : prev).filter(function(t){ return nextStages(t).length; });
  return c.length ? c[c.length - 1] : null;
}
/* from the stages that followed: zone of every team of the season (null if those stages are not known yet) */
function outcome(T){
  var st2 = nextStages(T); if (!st2.length) return null;
  var z = {}, any = false;
  st2.forEach(function(S){
    var ms = data.matches[S.OverviewPage]; if (!ms) return;
    var known = function(t){ return t && t !== "TBD"; };
    if (/play-in/i.test(S.Name) && !/playoffs/i.test(S.Name)) { ms.forEach(function(m){ [m.Team1, m.Team2].forEach(function(t){ if (known(t)) { z[t] = "playin"; any = true; } }); }); return; }
    var L = lanesOf(ms), list = L.list, main = list.filter(function(m){ return !/knight|qualif|play-?in/i.test(m.Tab); }), first = main.length ? main[0].Tab : "";
    var dbl = list.some(function(m, i){ return L.lane(i) === "lower"; });
    list.forEach(function(m, i){ [m.Team1, m.Team2].forEach(function(t){
      if (!known(t) || (z[t] && z[t] !== "playin" && !/knight|qualif|play-?in/i.test(m.Tab))) return;
      if (z[t]) return;
      any = true;
      if (/knight|qualif|play-?in/i.test(m.Tab)) z[t] = "playin";
      else if (L.lane(i) === "lower") z[t] = "lower";
      else if (m.Tab !== first) z[t] = "bye";
      else z[t] = dbl ? "upper" : "po";
    }); });
  });
  return any ? z : null;
}
function played(ms){ return ms.filter(function(m){ return m.Winner === "1" || m.Winner === "2"; }).length; }
/* zone of each team of the standings: final when the next stages are known, else worked out from the results so far
   (« sûr » when no result left can change it) */
function zonesFor(T, rows){
  if (!T || isKnockout(T) || !rows || !rows.length || rows.some(function(r){ return r.group; })) return null;
  if (!rows.some(function(r){ return +r.WinSeries || +r.LossSeries; })) return null;
  var ms = data.matches[T.OverviewPage] || [], left = ms.filter(function(m){ return !(m.Winner === "1" || m.Winner === "2") && m.Team1 && m.Team2; });
  var fin = outcome(T), res = {};
  if (fin && !left.length) { rows.forEach(function(r){ res[r.Team] = {z: fin[r.Team] || "out", sure: true}; }); return res; }
  var ref = refSeason(T), rz = ref && outcome(ref), rrows = ref && data.standings[ref.OverviewPage];
  if (!rz || !rrows || !rrows.length) return null;
  /* how many places lead to each zone, as last time */
  var seq = rrows.slice().sort(function(a, b){ return (+a.Place || 99) - (+b.Place || 99); }).map(function(r){ return rz[r.Team] || "out"; });
  if (seq.length !== rows.length) return null;
  var upto = {}; Object.keys(ZONES).forEach(function(k){ upto[k] = seq.filter(function(z){ return ZONES[z].r <= ZONES[k].r; }).length; });
  var W = {}, MAX = {};
  rows.forEach(function(r){ W[r.Team] = +r.WinSeries || 0; MAX[r.Team] = W[r.Team]; });
  left.forEach(function(m){ if (m.Team1 in MAX) MAX[m.Team1]++; if (m.Team2 in MAX) MAX[m.Team2]++; });
  var sorted = rows.slice().sort(function(a, b){ return (+a.Place || 99) - (+b.Place || 99); });
  sorted.forEach(function(r, idx){
    var t = r.Team, others = rows.filter(function(x){ return x.Team !== t; });
    var canPass = others.filter(function(x){ return MAX[x.Team] >= W[t]; }).length;      /* teams that can still finish above (ties count against) */
    var surelyAbove = others.filter(function(x){ return W[x.Team] > MAX[t]; }).length;    /* teams already out of reach */
    var best = null, cur = seq[idx] || "out";
    ["bye", "upper", "po", "lower", "playin"].forEach(function(k){ if (best == null && seq.indexOf(k) >= 0 && canPass < upto[k]) best = k; });
    if (best) res[t] = {z: best, sure: true};
    else if (surelyAbove >= upto.playin) res[t] = {z: "out", sure: true};     /* (upto.playin = every place that is not « out ») */
    else res[t] = {z: cur, sure: false};
  });
  return res;
}
/* ---- head to head: every result between two teams of the season (row team's score first) ---- */
function h2hHTML(ms, rows, lgK){
  var teams = rows.map(function(r){ return r.Team; });
  if (teams.length < 3) return "";
  var idx = {}; teams.forEach(function(t, i){ idx[t] = i; });
  var cell = {}, tot = {};
  teams.forEach(function(t){ tot[t] = [0, 0]; });
  ms.forEach(function(m){
    if (!(m.Winner === "1" || m.Winner === "2") || !(m.Team1 in idx) || !(m.Team2 in idx)) return;
    var a = m.Team1, b = m.Team2, sa = +m.Team1Score || (m.Winner === "1" ? 1 : 0), sb = +m.Team2Score || (m.Winner === "2" ? 1 : 0);
    (cell[a + "|" + b] = cell[a + "|" + b] || []).push([sa, sb, m.Winner === "1"]);
    (cell[b + "|" + a] = cell[b + "|" + a] || []).push([sb, sa, m.Winner === "2"]);
    tot[a][m.Winner === "1" ? 0 : 1]++; tot[b][m.Winner === "2" ? 0 : 1]++;
  });
  var head = '<tr><th></th>' + teams.map(function(t){ return '<th title="'+e(t)+'">'+logo(t, lgK)+'</th>'; }).join("") + '<th class="tot">Total</th></tr>';
  var body = teams.map(function(a){
    return '<tr><th title="'+e(a)+'">'+logo(a, lgK)+'</th>' + teams.map(function(b){
      if (a === b) return '<td class="self"></td>';
      var rs = cell[a + "|" + b];
      if (!rs) return '<td class="none">·</td>';
      var w = rs.filter(function(x){ return x[2]; }).length, cls = w === rs.length ? "won" : w === 0 ? "lost" : "split";
      return '<td class="'+cls+'" title="'+e(short(a)+" – "+short(b))+'">' + rs.map(function(x){ return x[0] + "-" + x[1]; }).join("<br>") + '</td>';
    }).join("") + '<td class="tot '+(tot[a][0] > tot[a][1] ? "won" : tot[a][0] < tot[a][1] ? "lost" : "split")+'">'+tot[a][0]+" - "+tot[a][1]+'</td></tr>';
  }).join("");
  return '<section class="cal-h2h"><h2 class="cal-h2">Face-à-face</h2><div class="h2h-wrap"><table class="h2h">' + head + body + '</table></div></section>';
}
/* ---- Swiss stage (Worlds…): for each team, the opponent of every round, green when won, red when lost ---- */
function swissRounds(ms){ var r = []; ms.forEach(function(m){ var x = /^Round (\d+)$/i.exec(m.Tab || ""); if (x && r.indexOf(+x[1]) < 0) r.push(+x[1]); }); return r.sort(function(a, b){ return a - b; }); }
function swissHTML(ms, rows, lgK, T){
  var rounds = swissRounds(ms); if (rounds.length < 3) return "";
  var teams = rows.length ? rows.map(function(r){ return r.Team; }) : [];
  ms.forEach(function(m){ [m.Team1, m.Team2].forEach(function(t){ if (t && t !== "TBD" && teams.indexOf(t) < 0 && /^Round \d+$/i.test(m.Tab)) teams.push(t); }); });
  var at = {}, rec = {};
  teams.forEach(function(t){ rec[t] = [0, 0]; });
  ms.forEach(function(m){ var x = /^Round (\d+)$/i.exec(m.Tab || ""); if (!x) return; var r = +x[1], done = m.Winner === "1" || m.Winner === "2";
    [[m.Team1, m.Team2, "1"], [m.Team2, m.Team1, "2"]].forEach(function(p){ if (!(p[0] in rec)) return;
      at[p[0] + "|" + r] = {op: p[1], res: done ? (m.Winner === p[2] ? "won" : "lost") : "", sc: done ? (p[2] === "1" ? m.Team1Score + "-" + m.Team2Score : m.Team2Score + "-" + m.Team1Score) : ""};
      if (done) rec[p[0]][m.Winner === p[2] ? 0 : 1]++; }); });
  var head = '<tr><th>'+(en() ? "Team" : "Équipe")+'</th>' + rounds.map(function(r){ return '<th>'+(en() ? "Round " : "Tour ")+r+'</th>'; }).join("") + '<th class="tot">'+(en() ? "Record" : "Bilan")+'</th></tr>';
  var body = teams.map(function(t){
    var q = rec[t][0] >= 3 ? "won" : rec[t][1] >= 3 ? "lost" : "";
    return '<tr><th class="'+q+'" title="'+e(t)+'">'+logo(t, lgK)+'<span class="nm">'+e(short(t))+'</span></th>' + rounds.map(function(r){
      var c = at[t + "|" + r]; if (!c) return '<td class="none"></td>';
      return '<td class="'+(c.res || "todo")+'" title="'+e(short(t)+" – "+short(c.op)+(c.sc && c.sc !== "-" ? " · " + c.sc : ""))+'">'+(c.op && c.op !== "TBD" ? logo(c.op, lgK) : "?")+'</td>';
    }).join("") + '<td class="tot '+q+'">'+rec[t][0]+" - "+rec[t][1]+'</td></tr>';
  }).join("");
  return '<section class="cal-h2h"><h2 class="cal-h2">'+(en() ? "Swiss stage" : "Phase suisse")+'</h2><div class="h2h-wrap"><table class="h2h swiss">' + head + body + '</table></div>' +
    '<div class="cal-leg"><span><i style="background:var(--lp-win)"></i>'+(en() ? "Won · 3 wins = qualified" : "Gagné · 3 victoires = qualifié")+'</span><span><i style="background:var(--lp-loss)"></i>'+(en() ? "Lost · 3 losses = eliminated" : "Perdu · 3 défaites = éliminé")+'</span></div></section>';
}
function legendHTML(zs){
  var used = {}; Object.keys(zs).forEach(function(t){ used[zs[t].z] = 1; });
  var anyOpen = Object.keys(zs).some(function(t){ return !zs[t].sure; });
  return '<div class="cal-leg">' + Object.keys(ZONES).filter(function(k){ return used[k]; }).map(function(k){ return '<span><i style="background:'+ZONES[k].c+'"></i>'+e(en() ? ZONES[k].en : ZONES[k].fr)+'</span>'; }).join("") +
    (anyOpen ? '<span class="open"><i></i>'+(en() ? "Not decided yet (current place)" : "Pas encore décidé (place actuelle)")+'</span>' : "") + '</div>';
}

function draw(){
  var h = chips(), lgs = st.lg === "all" ? null : LEAGUES.filter(function(l){ return l.k === st.lg; })[0];
  if (st.err) h += '<p class="cal-err">'+e(st.err)+'</p>';
  if (!data.tours) { root.innerHTML = h + '<p class="cal-note">Chargement…</p>'; return; }
  if (!lgs) {
    var ups = (data.upcoming || []).slice(), now = Date.now();
    var past = ups.filter(function(m){ var d = utc(m.DateTime_UTC || m["DateTime UTC"]); return m.Winner === "1" || m.Winner === "2" || (d && d.getTime() < now - 4 * 3600000); });
    var next = ups.filter(function(m){ return past.indexOf(m) < 0; });
    h += '<div class="prodle-head"><h2>Prochains matchs</h2></div>';
    if (!data.upcoming) h += '<p class="cal-note">Chargement…</p>';
    else if (next.length) h += byDay(next, true);
    else {
      var rs = LEAGUES.map(function(l){ var t = nextTour(l.k); return t ? '<li><b>'+label(l)+'</b> · '+e(t.Name)+' — '+e(day(t.DateStart).toLocaleDateString(loc(), {day: "numeric", month: "long", year: "numeric"}))+'</li>' : ""; }).join("");
      h += '<p class="cal-note">Pas de match prévu dans les 10 prochains jours'+(rs ? ' : c’est l’intersaison. Reprises :' : '.')+'</p>' + (rs ? '<ul class="cal-next">'+rs+'</ul>' : "");
    }
    if (past.length) h += '<h2 class="cal-h2">Derniers résultats</h2>' + byDay(past.reverse(), true);
    root.innerHTML = h; return;
  }
  var ts = toursOf(lgs.k).slice().reverse(), op = st.tour[lgs.k] || (curTour(lgs.k) || {}).OverviewPage, T = ts.filter(function(t){ return t.OverviewPage === op; })[0];
  h += '<div class="prodle-head"><h2>'+e(T ? T.Name : lgs.k)+'</h2><span style="flex:1"></span>' +
    (ts.length ? '<select class="cal-sel" aria-label="Compétition">' + ts.map(function(t){ return '<option value="'+e(t.OverviewPage)+'"'+(t.OverviewPage === op ? " selected" : "")+'>'+e(t.Name)+'</option>'; }).join("") + '</select>' : "") + '</div>';
  var nt = nextTour(lgs.k); if (nt && (!T || nt.OverviewPage !== T.OverviewPage)) h += '<p class="cal-note">Prochaine compétition : <b>'+e(nt.Name)+'</b>, à partir du '+e(day(nt.DateStart).toLocaleDateString(loc(), {day: "numeric", month: "long", year: "numeric"}))+'.</p>';
  if (!op) { root.innerHTML = h + '<p class="cal-note">Aucune compétition trouvée.</p>'; return; }
  var ms = data.matches[op], sd = isKnockout(T) ? [] : data.standings[op];
  if (!ms || !sd) { root.innerHTML = h + '<p class="cal-note">Chargement…</p>'; return; }
  var bms = ms.filter(function(m){ return isBracket(m, T); });
  if (bms.length >= 2) h += '<section class="cal-brs"><h2 class="cal-h2">Arbre</h2>' + bracketHTML(bms, lgs.k) + '</section>';
  /* a playoffs stage: the bracket says it all */
  if (isKnockout(T) && bms.length >= 2) { root.innerHTML = h; return; }
  var srt = sd.slice().sort(function(a, b){ return (+a.Place || 99) - (+b.Place || 99); });
  /* Swiss stage (Worlds): the round-by-round progression; else the head to head */
  var swiss = swissRounds(ms).length >= 3 && lgs.k === "INTL";
  /* layout — left: the standings (Swiss stage: its round-by-round table, which already gives each record); right: head to head, then the matches */
  var cols = '<div class="cal-cols'+(swiss ? " swiss" : "")+'">', h2h = "";
  if (swiss) cols += '<section class="cal-sec">' + swissHTML(ms, srt, lgs.k, T) + '</section>';
  else if (sd.length) { var zs = zonesFor(T, sd); cols += '<section class="cal-sec"><h2 class="cal-h2">Classement</h2>' + standingsHTML(sd, lgs.k, zs) + (zs ? legendHTML(zs) : "") + '</section>'; h2h = isKnockout(T) ? "" : h2hHTML(ms, srt, lgs.k); }
  /* matches: upcoming first (from today), then the results, most recent first */
  var now = Date.now(), up = ms.filter(function(m){ return !(m.Winner === "1" || m.Winner === "2") && utc(m.DateTime_UTC || m["DateTime UTC"]) && utc(m.DateTime_UTC || m["DateTime UTC"]).getTime() > now - 6 * 3600000; }),
      res = ms.filter(function(m){ return up.indexOf(m) < 0; }).reverse();
  /* right column: the head to head on top, then the matches */
  cols += '<section class="cal-sec">' + h2h + (up.length ? '<h2 class="cal-h2">À venir</h2>' + byDay(up, false) : "") + (res.length ? '<h2 class="cal-h2">Résultats</h2>' + byDay(res, false) : "") +
    (!ms.length ? '<p class="cal-note">Pas encore de match annoncé pour cette compétition.</p>' : "") + '</section></div>';
  root.innerHTML = h + cols;
}

function refresh(){
  st.err = "";
  getTours().then(function(){
    if (st.lg === "all") return getUpcoming().then(function(ms){ return getTeams([].concat.apply([], ms.map(function(m){ return [m.Team1, m.Team2]; }))); });
    var t = st.tour[st.lg] || (curTour(st.lg) || {}).OverviewPage; if (!t) return;
    var T = tourOf(t), extra = [];
    if (T && !isKnockout(T)) {
      nextStages(T).forEach(function(S){ extra.push(getMatches(S.OverviewPage)); });
      var ref = refSeason(T);
      if (ref) { extra.push(getStandings(ref.OverviewPage)); nextStages(ref).forEach(function(S){ extra.push(getMatches(S.OverviewPage)); }); }
    }
    return Promise.all([getMatches(t), T && isKnockout(T) ? Promise.resolve([]) : getStandings(t)].concat(extra.map(function(p){ return p.catch(function(){ return []; }); }))).then(function(r){
      return getTeams([].concat.apply([], r[0].map(function(m){ return [m.Team1, m.Team2]; })).concat(r[1].map(function(s){ return s.Team; })));
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
/* newer answers arrived behind the scenes: forget what was read and draw again (from the browser's copy, instantly) */
function reload(){ data.tours = null; data.upcoming = null; data.matches = {}; data.standings = {}; refresh(); }
window.CAL = {
  attach: function(){
    var slot = document.getElementById("cal-slot"); if (!slot) return;
    if (root.parentNode !== slot) slot.appendChild(root);
    if (Date.now() - lastRefresh > 60000) { lastRefresh = Date.now(); data.upcoming = null; data.matches = {}; draw(); refresh(); }
  }
};
})();
