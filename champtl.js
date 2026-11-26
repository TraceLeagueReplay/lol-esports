/* Tier lists « Champions »: every League of Legends champion as an icon, to drop into tiers.
   Stored in Firestore: ctl/<list id> {name, t}   ctlp/<list id>__<person key> {tl, name, r:{"0":[ids],…}, t}
   Each person ranks the champions in their own tier list; the others are shown read-only. */
(function(){
var DATA = {"v":"16.23.1","c":[["Aatrox","Aatrox"],["Ahri","Ahri"],["Akali","Akali"],["Akshan","Akshan"],["Alistar","Alistar"],["Ambessa","Ambessa"],["Amumu","Amumu"],["Anivia","Anivia"],["Annie","Annie"],["Aphelios","Aphelios"],["Ashe","Ashe"],["AurelionSol","Aurelion Sol"],["Aurora","Aurora"],["Azir","Azir"],["Bard","Bard"],["Belveth","Bel'Veth"],["Blitzcrank","Blitzcrank"],["Brand","Brand"],["Braum","Braum"],["Briar","Briar"],["Caitlyn","Caitlyn"],["Camille","Camille"],["Cassiopeia","Cassiopeia"],["Chogath","Cho'Gath"],["Corki","Corki"],["Darius","Darius"],["Diana","Diana"],["Draven","Draven"],["DrMundo","Dr. Mundo"],["Ekko","Ekko"],["Elise","Elise"],["Evelynn","Evelynn"],["Ezreal","Ezreal"],["Fiddlesticks","Fiddlesticks"],["Fiora","Fiora"],["Fizz","Fizz"],["Galio","Galio"],["Gangplank","Gangplank"],["Garen","Garen"],["Gnar","Gnar"],["Gragas","Gragas"],["Graves","Graves"],["Gwen","Gwen"],["Hecarim","Hecarim"],["Heimerdinger","Heimerdinger"],["Hwei","Hwei"],["Illaoi","Illaoi"],["Irelia","Irelia"],["Ivern","Ivern"],["Janna","Janna"],["JarvanIV","Jarvan IV"],["Jax","Jax"],["Jayce","Jayce"],["Jhin","Jhin"],["Jinx","Jinx"],["Kaisa","Kai'Sa"],["Kalista","Kalista"],["Karma","Karma"],["Karthus","Karthus"],["Kassadin","Kassadin"],["Katarina","Katarina"],["Kayle","Kayle"],["Kayn","Kayn"],["Kennen","Kennen"],["Khazix","Kha'Zix"],["Kindred","Kindred"],["Kled","Kled"],["KogMaw","Kog'Maw"],["KSante","K'Santé","K'Sante"],["Leblanc","LeBlanc"],["LeeSin","Lee Sin"],["Leona","Leona"],["Lillia","Lillia"],["Lissandra","Lissandra"],["Locke","Locke"],["Lucian","Lucian"],["Lulu","Lulu"],["Lux","Lux"],["Malphite","Malphite"],["Malzahar","Malzahar"],["Maokai","Maokai"],["MasterYi","Maître Yi","Master Yi"],["Mel","Mel"],["Milio","Milio"],["MissFortune","Miss Fortune"],["MonkeyKing","Wukong"],["Mordekaiser","Mordekaiser"],["Morgana","Morgana"],["Naafiri","Naafiri"],["Nami","Nami"],["Nasus","Nasus"],["Nautilus","Nautilus"],["Neeko","Neeko"],["Nidalee","Nidalee"],["Nilah","Nilah"],["Nocturne","Nocturne"],["Nunu","Nunu et Willump","Nunu & Willump"],["Olaf","Olaf"],["Orianna","Orianna"],["Ornn","Ornn"],["Pantheon","Pantheon"],["Poppy","Poppy"],["Pyke","Pyke"],["Qiyana","Qiyana"],["Quinn","Quinn"],["Rakan","Rakan"],["Rammus","Rammus"],["RekSai","Rek'Sai"],["Rell","Rell"],["Renata","Renata Glasc"],["Renekton","Renekton"],["Rengar","Rengar"],["Riven","Riven"],["Rumble","Rumble"],["Ryze","Ryze"],["Samira","Samira"],["Sejuani","Sejuani"],["Senna","Senna"],["Seraphine","Séraphine","Seraphine"],["Sett","Sett"],["Shaco","Shaco"],["Shen","Shen"],["Shyvana","Shyvana"],["Singed","Singed"],["Sion","Sion"],["Sivir","Sivir"],["Skarner","Skarner"],["Smolder","Smolder"],["Sona","Sona"],["Soraka","Soraka"],["Swain","Swain"],["Sylas","Sylas"],["Syndra","Syndra"],["TahmKench","Tahm Kench"],["Taliyah","Taliyah"],["Talon","Talon"],["Taric","Taric"],["Teemo","Teemo"],["Thresh","Thresh"],["Tristana","Tristana"],["Trundle","Trundle"],["Tryndamere","Tryndamere"],["TwistedFate","Twisted Fate"],["Twitch","Twitch"],["Udyr","Udyr"],["Urgot","Urgot"],["Varus","Varus"],["Vayne","Vayne"],["Veigar","Veigar"],["Velkoz","Vel'Koz"],["Vex","Vex"],["Vi","Vi"],["Viego","Viego"],["Viktor","Viktor"],["Vladimir","Vladimir"],["Volibear","Volibear"],["Warwick","Warwick"],["Xayah","Xayah"],["Xerath","Xerath"],["XinZhao","Xin Zhao"],["Yasuo","Yasuo"],["Yone","Yone"],["Yorick","Yorick"],["Yunara","Yunara"],["Yuumi","Yuumi"],["Zaahen","Zaahen"],["Zac","Zac"],["Zed","Zed"],["Zeri","Zeri"],["Ziggs","Ziggs"],["Zilean","Zilean"],["Zoe","Zoé","Zoe"],["Zyra","Zyra"]]};
var VER = DATA.v, CH = {}, ORDER = [];
DATA.c.forEach(function(x){ CH[x[0]] = {fr:x[1], en:x[2] || x[1]}; ORDER.push(x[0]); });
/* default tiers; each list can change them (name, colour, order, add, remove): ctl/<id>.tiers = [{id, n, c}].
   A ranking keeps champions per tier id, so renaming or moving a tier keeps its champions; removing one sends them back to « À classer ». */
var TIERS_DEF = [["S+","#ff8a00"],["S","#ffff00"],["A","#00ff00"],["B","#a4c2f4"],["C","#4a86e8"],["D","#c9a0dc"],["F","#d5a6bd"]].map(function(t, i){ return {id: String(i), n: t[0], c: t[1]}; });
function tiers(){ var L = lists[cur]; return L && L.tiers && L.tiers.length ? L.tiers : TIERS_DEF; }
function en(){ try { return window.I18N && I18N.lang === "en"; } catch(e){ return false; } }
function nm(id){ var c = CH[id]; return c ? (en() ? c.en : c.fr) : id; }
function src(id){ return "https://ddragon.leagueoflegends.com/cdn/" + VER + "/img/champion/" + id + ".png"; }
function e(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
function fold(s){ return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function fg(hex){ var n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; return (r*299 + g*587 + b*114) / 1000 > 140 ? "#111" : "#fff"; }
var A = function(){ return window.__app || null; };
function Fb(){ var a = A(); return a ? a.F() : null; }
function me(){ var a = A(); return (a && a.me()) || ""; }
function openDlg(t, b, f, r){ return A().openDlg(t, b, f, r); }
function footer(p){ return A().footer(p); }
function key(name){ var h = 5381; for (var i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0; return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) + "-" + (h >>> 0).toString(36); }
function lsGet(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(x){ return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(x){} }

var lists = {}, ranks = {}, started = false, ready = {l:false, r:false};
var cur = lsGet("ctl.cur") || "", who = "", q = "", sel = null, drag = null, dirtyRemote = false;
var mine = null;            /* my ranking for the current list: array of arrays (one per tier) */
var saveT = null;
var root = document.createElement("div"); root.className = "ctl";

function canEdit(){ var a = A(); return !!(a && a.F() && !a.ro() && me()); }
function start(){
  var F = Fb(); if (started || !F) return; started = true;
  F.onSnapshot(F.collection(F.db, "ctl"), function(snap){ var m = {}; snap.docs.forEach(function(d){ m[d.id] = d.data(); }); lists = m; ready.l = true; refresh(); }, function(){});
  F.onSnapshot(F.collection(F.db, "ctlp"), function(snap){ var m = {}; snap.docs.forEach(function(d){ m[d.id] = d.data(); }); ranks = m; ready.r = true; refresh(); }, function(){});
}
function listIds(){ return Object.keys(lists).sort(function(a, b){ return (lists[a].t || 0) - (lists[b].t || 0); }); }
function rowsOf(doc){ var T = tiers(), out = T.map(function(){ return []; }), seen = {}; if (doc && doc.r) T.forEach(function(t, i){ out[i] = (doc.r[t.id] || []).filter(function(id){ if (!CH[id] || seen[id]) return false; seen[id] = 1; return true; }); }); return out; }
function placed(rows){ var s = {}; rows.forEach(function(r){ r.forEach(function(id){ s[id] = 1; }); }); return s; }

function refresh(){
  if (drag) { dirtyRemote = true; return; }
  var ids = listIds();
  if (cur && !lists[cur]) cur = "";
  if (!cur && ids.length) cur = ids[ids.length - 1];
  var myKey = me() ? cur + "__" + key(me()) : "";
  if (!pend) mine = rowsOf(ranks[myKey]);   /* (a change of mine not sent yet wins over what the database says) */
  if (!who || (who !== "me" && !ranks[who])) who = "me";
  draw();
}

function iconHTML(id, cls){ return '<img class="ctl-c'+(cls || "")+'" data-id="'+e(id)+'" src="'+src(id)+'" alt="'+e(nm(id))+'" title="'+e(nm(id))+'" loading="lazy" draggable="false">'; }
function draw(){
  var ids = listIds(), edit = canEdit(), h = "";
  h += '<div class="ctl-bar"><div class="chips" role="group" aria-label="Tier lists de champions">' +
    ids.map(function(id){ return '<button class="chip" data-ctl="pick" data-id="'+e(id)+'" aria-pressed="'+(id === cur)+'">'+e(lists[id].name)+'</button>'; }).join("") +
    (edit ? '<button class="chip add" data-ctl="new">+ Nouvelle tier list</button>' : "") + '</div></div>';
  if (!ready.l) { root.innerHTML = h + '<p class="ctl-empty">Chargement…</p>'; return; }
  if (!cur) { root.innerHTML = h + '<p class="ctl-empty">Aucune tier list de champions pour l’instant. '+(edit ? 'Crée la première avec « + Nouvelle tier list ».' : '')+'</p>'; return; }
  var L = lists[cur];
  var people = Object.keys(ranks).filter(function(k){ return ranks[k].tl === cur && ranks[k].name && ranks[k].name !== me() && Object.keys(placed(rowsOf(ranks[k]))).length; })
    .sort(function(a, b){ return String(ranks[a].name).localeCompare(ranks[b].name); });
  var mineView = who === "me", rows = mineView ? mine : rowsOf(ranks[who]);
  var n = Object.keys(placed(mine || [])).length;
  h += '<div class="prodle-head"><h2>'+e(L.name)+'</h2>' + (edit ? '<button class="ghost" data-ctl="tiers">✎ Modifier les tiers</button><button class="ghost" data-ctl="rename">Renommer</button><button class="ghost" data-ctl="del">Supprimer</button>' : "") + '</div>';
  h += '<div class="chips ctl-who" role="group" aria-label="Tier list de qui">' +
    '<button class="chip" data-ctl="who" data-id="me" aria-pressed="'+mineView+'">'+(me() ? 'Ma tier list' + (n ? ' · ' + n : '') : 'Ma tier list')+'</button>' +
    people.map(function(k){ return '<button class="chip" data-ctl="who" data-id="'+e(k)+'" aria-pressed="'+(who === k)+'">'+e(ranks[k].name)+' · '+Object.keys(placed(rowsOf(ranks[k]))).length+'</button>'; }).join("") + '</div>';
  var editing = mineView && edit;
  if (mineView && !me()) h += '<p class="ctl-empty">Choisis un pseudo (en haut à droite) pour faire ta tier list.</p>';
  h += '<div class="ctl-board'+(editing ? " edit" : "")+'">' + tiers().map(function(t, i){
    return '<div class="ctl-row"><div class="ctl-lab'+(String(t.n).length > 3 ? " long" : "")+'" style="background:'+e(t.c)+';color:'+fg(t.c)+'">'+e(t.n || "?")+'</div><div class="ctl-drop" data-t="'+i+'">' + (rows[i] || []).map(function(id){ return iconHTML(id, sel === id ? " sel" : ""); }).join("") + '</div></div>';
  }).join("") + '</div>';
  if (editing) {
    var p = placed(mine), fq = fold(q), pool = ORDER.filter(function(id){ return !p[id]; });
    var shown = pool.filter(function(id){ return !fq || fold(CH[id].fr).indexOf(fq) >= 0 || fold(CH[id].en).indexOf(fq) >= 0 || fold(id).indexOf(fq) >= 0; });
    h += '<div class="ctl-poolh"><b>À classer</b><span class="ctl-n">'+pool.length+'</span><input type="search" class="ctl-q" placeholder="Chercher un champion" value="'+e(q)+'" aria-label="Chercher un champion">' +
      (n ? '<button class="ghost" data-ctl="reset">Tout remettre à classer</button>' : '') + '</div>' +
      '<div class="ctl-drop ctl-pool" data-t="pool">' + shown.map(function(id){ return iconHTML(id, sel === id ? " sel" : ""); }).join("") + '</div>' +
      '<p class="ctl-tip">Glisse les champions dans les tiers'+(matchMedia("(pointer:coarse)").matches ? ' (appui long), ou touche un champion puis touche un tier.' : ', ou clique sur un champion puis sur un tier.')+'</p>';
  }
  var qi = root.querySelector(".ctl-q"), hadFocus = qi && document.activeElement === qi, pos = qi ? qi.selectionStart : 0;
  root.innerHTML = h;
  if (hadFocus) { qi = root.querySelector(".ctl-q"); if (qi) { qi.focus(); try { qi.setSelectionRange(pos, pos); } catch(x){} } }
}

/* ---- changes to my ranking ---- */
function move(id, t, idx){
  if (!canEdit() || !mine) return;
  mine.forEach(function(r){ var k = r.indexOf(id); if (k >= 0) r.splice(k, 1); });
  if (t !== "pool") { var r = mine[+t]; if (idx == null || idx > r.length) idx = r.length; r.splice(idx, 0, id); }
  sel = null; draw(); save();
}
var pend = null;   /* the save waiting to be sent: {list, rows} */
function save(){
  clearTimeout(saveT); pend = {list: cur, tiers: tiers().slice(), rows: mine.map(function(r){ return r.slice(); })};
  saveT = setTimeout(flush, 350);
}
function flush(){
  var F = Fb();
  clearTimeout(saveT); saveT = null; if (!pend) return;
  var p = pend; pend = null;
  var r = {}; p.rows.forEach(function(row, i){ if (p.tiers[i]) r[p.tiers[i].id] = row; });
  var id = p.list + "__" + key(me());
  ranks[id] = {tl: p.list, name: me(), r: r, t: Date.now()};
  F.setDoc(F.doc(F.db, "ctlp/" + id), ranks[id]).catch(function(){});
}

/* ---- dialogs: new list, rename, delete ---- */
function nameDlg(title, val, ok){
  openDlg(title, '<div class="field"><label for="f-ctl">Nom</label><input id="f-ctl" maxlength="40" value="'+e(val)+'" placeholder="Ex. : Meilleurs champions mid"></div>', footer(val ? "Valider" : "Créer"), function(form){
    form.onsubmit = function(ev){ ev.preventDefault(); var v = form.querySelector("#f-ctl").value.trim(); if (!v) return; A().dlg().close(); ok(v); };
  });
}
function act(a, id){
  var F = Fb();
  if (a === "pick") { flush(); cur = id; lsSet("ctl.cur", cur); who = "me"; sel = null; q = ""; refresh(); return; }
  if (a === "who") { who = id; sel = null; draw(); return; }
  if (!canEdit()) return;
  if (a === "new") nameDlg("Nouvelle tier list de champions", "", function(v){
    flush(); var nid = "c" + Date.now().toString(36); cur = nid; lsSet("ctl.cur", cur); lists[nid] = {name: v, t: Date.now()}; mine = rowsOf(null); who = "me"; draw();
    F.setDoc(F.doc(F.db, "ctl/" + nid), lists[nid]).catch(function(){});
  });
  if (a === "rename") nameDlg("Renommer la tier list", lists[cur].name, function(v){ lists[cur].name = v; draw(); F.setDoc(F.doc(F.db, "ctl/" + cur), lists[cur]).catch(function(){}); });
  if (a === "del") openDlg("Supprimer la tier list", '<p style="margin:0">Supprimer « '+e(lists[cur].name)+' » et les classements de tout le monde dedans ? C’est définitif.</p>', footer("Supprimer"), function(form){
    form.onsubmit = function(ev){ ev.preventDefault(); A().dlg().close(); var gone = cur;
      Object.keys(ranks).forEach(function(k){ if (ranks[k].tl === gone) { F.deleteDoc(F.doc(F.db, "ctlp/" + k)).catch(function(){}); delete ranks[k]; } });
      F.deleteDoc(F.doc(F.db, "ctl/" + gone)).catch(function(){}); delete lists[gone]; cur = ""; pend = null; clearTimeout(saveT); refresh(); };
  });
  if (a === "tiers") editTiers();
  if (a === "reset") openDlg("Tout remettre à classer", '<p style="margin:0">Remettre tous tes champions dans « À classer » ?</p>', footer("Remettre"), function(form){
    form.onsubmit = function(ev){ ev.preventDefault(); A().dlg().close(); mine = rowsOf(null); draw(); save(); };
  });
}

/* ---- tiers of the current list: name, colour, order, add, remove (for everybody's ranking in this list) ---- */
function editTiers(){
  var F = Fb(), rows = tiers().map(function(t){ return {id: t.id, n: t.n, c: t.c}; }), box;
  function count(id){ var n = 0; Object.keys(ranks).forEach(function(k){ var d = ranks[k]; if (d.tl === cur && d.r && d.r[id]) n += d.r[id].length; }); return n; }
  function rowHTML(t, i){
    return '<div class="trow" data-i="'+i+'"><span class="tchip" style="--tb:'+e(t.c)+';--tbfg:'+fg(t.c)+'">'+e(t.n || "?")+'</span>' +
      '<input class="tr-n" value="'+e(t.n)+'" maxlength="12" aria-label="Nom du tier">' +
      '<input class="tr-c" type="color" value="'+e(t.c)+'" aria-label="Couleur">' +
      '<button type="button" class="ghost tr-up" title="Monter"'+(i ? "" : " disabled")+'>↑</button>' +
      '<button type="button" class="ghost tr-dn" title="Descendre"'+(i < rows.length - 1 ? "" : " disabled")+'>↓</button>' +
      '<button type="button" class="ghost tr-x" title="Supprimer"'+(rows.length > 1 ? "" : " disabled")+'>✕</button></div>';
  }
  function draw2(){
    box.innerHTML = rows.map(rowHTML).join("");
    box.querySelectorAll(".trow").forEach(function(r){
      var i = +r.getAttribute("data-i");
      r.querySelector(".tr-n").oninput = function(){ rows[i].n = this.value; r.querySelector(".tchip").textContent = this.value || "?"; };
      r.querySelector(".tr-c").oninput = function(){ rows[i].c = this.value; var ch = r.querySelector(".tchip"); ch.style.setProperty("--tb", this.value); ch.style.setProperty("--tbfg", fg(this.value)); };
      r.querySelector(".tr-up").onclick = function(){ var x = rows.splice(i, 1)[0]; rows.splice(i - 1, 0, x); draw2(); };
      r.querySelector(".tr-dn").onclick = function(){ var x = rows.splice(i, 1)[0]; rows.splice(i + 1, 0, x); draw2(); };
      r.querySelector(".tr-x").onclick = function(){
        var n = count(rows[i].id), w = document.getElementById("f-ctlw");
        if (n) { w.hidden = false; w.textContent = "Le tier « " + (rows[i].n || "?") + " » contenait " + n + " champion(s) : ils retournent dans « À classer »."; }
        rows.splice(i, 1); draw2();
      };
    });
    document.getElementById("f-ctladd").disabled = rows.length >= 15;
  }
  openDlg("Tiers de « " + lists[cur].name + " »",
    '<p class="note-ro" style="margin:0 0 12px">Du meilleur au moins bon. Valable pour la tier list de tout le monde dans cette liste.</p><div id="f-ctlt"></div>' +
    '<div class="tactions"><button type="button" class="btn" id="f-ctladd">+ Ajouter un tier</button><span class="sp"></span>' +
    '<button type="button" class="ghost" id="f-ctlres" title="Remet S+ S A B C D F comme au début">↺ Tiers d\'origine</button></div>' +
    '<p class="note-ro" id="f-ctlw" style="margin:10px 0 0" hidden></p>',
    footer("Valider"),
    function(form){
      box = document.getElementById("f-ctlt"); draw2();
      document.getElementById("f-ctladd").onclick = function(){ rows.push({id: "t" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), n: "", c: "#9aa5b1"}); draw2(); var ins = box.querySelectorAll(".tr-n"); ins[ins.length - 1].focus(); };
      document.getElementById("f-ctlres").onclick = function(){ rows = TIERS_DEF.map(function(t){ return {id: t.id, n: t.n, c: t.c}; }); draw2(); };
      form.onsubmit = function(ev){
        ev.preventDefault(); A().dlg().close();
        flush();
        var out = rows.map(function(t){ return {id: t.id, n: String(t.n || "").trim() || "?", c: /^#[0-9a-f]{6}$/i.test(t.c) ? t.c : "#9aa5b1"}; });
        lists[cur].tiers = out;
        mine = rowsOf(ranks[cur + "__" + key(me())]); draw();
        F.setDoc(F.doc(F.db, "ctl/" + cur), lists[cur]).catch(function(){});
      };
    });
}

/* ---- clicks: buttons, tap to select then tap a tier ---- */
root.addEventListener("click", function(ev){
  var b = ev.target.closest("[data-ctl]");
  if (b) { act(b.getAttribute("data-ctl"), b.getAttribute("data-id")); return; }
  if (drag && drag.moved) return;
  if (!root.querySelector(".ctl-board.edit")) return;
  var ic = ev.target.closest(".ctl-c"), zone = ev.target.closest(".ctl-drop");
  if (ic && (!sel || sel === ic.getAttribute("data-id"))) { sel = sel ? null : ic.getAttribute("data-id"); draw(); return; }
  if (sel && zone) {
    var t = zone.getAttribute("data-t"), idx = null;
    if (ic && t !== "pool") idx = [].indexOf.call(zone.querySelectorAll(".ctl-c"), ic);
    move(sel, t, idx);
  }
});
root.addEventListener("input", function(ev){ if (ev.target.classList.contains("ctl-q")) { q = ev.target.value; draw(); } });

/* ---- drag and drop (mouse: right away; touch: long press) ---- */
function dropAt(x, y){
  var el = document.elementFromPoint(x, y), zone = el && el.closest && el.closest(".ctl-drop");
  if (!zone || !root.contains(zone)) return null;
  var t = zone.getAttribute("data-t"), icons = [].filter.call(zone.querySelectorAll(".ctl-c"), function(i){ return !i.classList.contains("ghost-src"); }), idx = icons.length;
  if (t !== "pool") for (var i = 0; i < icons.length; i++) {
    var r = icons[i].getBoundingClientRect();
    if (y < r.top) { idx = i; break; }
    if (y <= r.bottom && x < r.left + r.width / 2) { idx = i; break; }
  }
  return {zone: zone, t: t, idx: idx, before: icons[idx] || null};
}
function mark(d){
  var m = root.querySelector(".ctl-mark"); if (m) m.remove();
  root.querySelectorAll(".ctl-drop.over").forEach(function(z){ z.classList.remove("over"); });
  if (!d) return;
  d.zone.classList.add("over");
  if (d.t === "pool") return;
  m = document.createElement("span"); m.className = "ctl-mark"; d.zone.insertBefore(m, d.before);
}
root.addEventListener("pointerdown", function(ev){
  var ic = ev.target.closest(".ctl-c"); if (!ic || !root.querySelector(".ctl-board.edit") || ev.button > 0) return;
  var touch = ev.pointerType !== "mouse";
  drag = {id: ic.getAttribute("data-id"), src: ic, x: ev.clientX, y: ev.clientY, on: false, moved: false, pid: ev.pointerId, touch: touch};
  if (touch) drag.timer = setTimeout(function(){ if (drag && !drag.moved) begin(drag.x, drag.y); }, 260);
});
function begin(x, y){
  drag.on = true;
  var g = drag.src.cloneNode(); g.className = "ctl-c ctl-ghost"; document.body.appendChild(g); drag.ghost = g;
  drag.src.classList.add("ghost-src"); document.body.classList.add("ctl-dragging");
  if (navigator.vibrate && drag.touch) try { navigator.vibrate(15); } catch(x){}
  follow(x, y);
}
function follow(x, y){ drag.ghost.style.transform = "translate(" + (x - 26) + "px," + (y - 26) + "px)"; mark(dropAt(x, y)); }
window.addEventListener("pointermove", function(ev){
  if (!drag || ev.pointerId !== drag.pid) return;
  var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y, far = dx*dx + dy*dy > 25;
  if (!drag.on) {
    if (drag.touch) { if (far) { clearTimeout(drag.timer); drag = null; } return; }   /* touch moved before the long press: it is a scroll */
    if (!far) return;
    drag.moved = true; begin(ev.clientX, ev.clientY);
  }
  drag.moved = true; ev.preventDefault(); follow(ev.clientX, ev.clientY);
}, {passive: false});
window.addEventListener("touchmove", function(ev){ if (drag && drag.on) ev.preventDefault(); }, {passive: false});
function end(ev){
  if (!drag || (ev && ev.pointerId !== drag.pid)) return;
  clearTimeout(drag.timer);
  var d = drag, target = d.on && ev ? dropAt(ev.clientX, ev.clientY) : null;
  mark(null);
  if (d.ghost) d.ghost.remove();
  d.src.classList.remove("ghost-src"); document.body.classList.remove("ctl-dragging");
  if (d.on) { setTimeout(function(){ drag = null; if (dirtyRemote) { dirtyRemote = false; refresh(); } }, 0); if (target) move(d.id, target.t, target.idx); else draw(); }
  else drag = null;
}
window.addEventListener("pointerup", end);
window.addEventListener("pointercancel", function(ev){ if (drag && drag.on) end(null); else if (drag) { clearTimeout(drag.timer); drag = null; } });
root.addEventListener("contextmenu", function(ev){ if (ev.target.closest(".ctl-c")) ev.preventDefault(); });

window.CTL = {
  attach: function(){
    var slot = document.getElementById("ctl-slot"); if (!slot) return;
    start(); if (!started) { root.innerHTML = '<p class="ctl-empty">Chargement…</p>'; setTimeout(window.CTL.attach, 500); }
    if (root.parentNode !== slot) { slot.appendChild(root); if (started) refresh(); }
  }
};
})();
