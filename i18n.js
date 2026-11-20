/* Langue du site (français / anglais).
   Le choix est gardé dans localStorage "lol.lang" (partagé par le site et les jeux, qui sont sur la même adresse).
   En anglais, chaque texte affiché (texte, title, placeholder, aria-label) est traduit à la volée :
   d'abord par la table I18N_EN (texte français exact -> anglais), puis par les motifs I18N_EN_RX (textes avec des nombres ou des noms).
   Ce qui n'est dans aucune des deux reste tel quel (noms de joueurs, d'équipes, textes écrits par les utilisateurs). */
(function(){
  var KEY = "lol.lang";
  function read(){ try { var v = JSON.parse(localStorage.getItem(KEY)); return v === "en" || v === "fr" ? v : null; } catch(e){ return null; } }
  function guess(){ var n = (navigator.languages && navigator.languages[0]) || navigator.language || "fr"; return /^fr/i.test(n) ? "fr" : "en"; }
  var chosen = read(), lang = chosen || guess();   /* before any choice: the browser's language */
  var I = window.I18N = {
    lang: lang,
    chosen: !!chosen,
    en: lang === "en",
    /* change the language, then reload (the parent page reloads its games too) */
    set: function(l){
      try { localStorage.setItem(KEY, JSON.stringify(l === "en" ? "en" : "fr")); } catch(e){}
      var top = window;
      try { if (window.parent && window.parent !== window && window.parent.I18N) top = window.parent; } catch(e){}
      top.location.reload();
    },
    /* keep the language shown now as the choice (no reload) */
    save: function(){ try { localStorage.setItem(KEY, JSON.stringify(I.lang)); } catch(e){} I.chosen = true; }
  };
  /* English: the translation tables, loaded right away (this script is in the <head>) */
  if (lang === "en") document.write('<script src="i18n-en.js"><\/script>');
  var DICT = null, RX = null, CACHE = new Map();
  function tables(){
    if (DICT) return;
    DICT = window.I18N_EN || {};
    RX = (window.I18N_EN_RX || []).map(function(p){ return [new RegExp("^" + p[0] + "$"), p[1]]; });
  }
  /* translate one text (the French original); returns it unchanged when there is no translation */
  function T(s){
    if (!I.en || s == null) return s;
    s = String(s);
    if (s.indexOf("\n") >= 0) return s.split("\n").map(T).join("\n");   /* several lines (tooltips): one by one */
    var core = s.trim();
    if (!core) return s;
    if (CACHE.has(core)) { var c = CACHE.get(core); if (c == null) return s; var rr = s.replace(core, c); return /^[:;,.!?)]/.test(c) ? rr.replace(/\s+(?=[:;,.!?)])/, "") : rr; }
    tables();
    var out = null;
    if (Object.prototype.hasOwnProperty.call(DICT, core)) out = DICT[core];
    else for (var i = 0; i < RX.length; i++) {
      var m = core.match(RX[i][0]);
      if (m) { out = typeof RX[i][1] === "function" ? RX[i][1].apply(null, m) : RX[i][1].replace(/\$(\d)/g, function(_, k){ return T(m[+k] || ""); }); break; }
    }
    if (CACHE.size > 20000) CACHE.clear();
    CACHE.set(core, out);
    if (out == null) return s;
    var r = s.replace(core, out);
    return /^[:;,.!?)]/.test(out) ? r.replace(/\s+(?=[:;,.!?)])/, "") : r;   /* French puts a space before ":" — English doesn't */
  }
  window.T = T;
  I.T = T;
  if (!I.en) return;
  document.documentElement.lang = "en";
  var ATTRS = ["title", "placeholder", "aria-label", "alt"];
  function skip(el){ return el && el.closest && el.closest("[data-notr], script, style, textarea, [contenteditable=true]"); }
  function doText(n){
    var v = n.nodeValue; if (!v || !/[A-Za-zÀ-ÿ]/.test(v)) return;
    if (skip(n.parentNode)) return;
    var t = T(v); if (t !== v) n.nodeValue = t;
  }
  function doAttrs(el){
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (v && /[A-Za-zÀ-ÿ]/.test(v)) { var t = T(v); if (t !== v) el.setAttribute(a, t); }
    }
    if (el.tagName === "INPUT" && (el.type === "button" || el.type === "submit") && el.value) { var tv = T(el.value); if (tv !== el.value) el.value = tv; }
  }
  function walk(n){
    if (n.nodeType === 3) return doText(n);
    if (n.nodeType !== 1 || skip(n)) return;
    doAttrs(n);
    var w = document.createTreeWalker(n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null), x;
    while ((x = w.nextNode())) { if (x.nodeType === 3) doText(x); else if (!skip(x)) doAttrs(x); }
  }
  function start(){
    walk(document.documentElement);
    if (document.title) document.title = T(document.title);
    new MutationObserver(function(ms){
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === "childList") for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        else if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes" && m.target.nodeType === 1 && !skip(m.target)) doAttrs(m.target);
      }
    }).observe(document.documentElement, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(["value"])});
    var tt = document.querySelector("title");
    if (tt) new MutationObserver(function(){ var v = document.title, t = T(v); if (t !== v) document.title = t; }).observe(tt, {childList: true, characterData: true, subtree: true});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
