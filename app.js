/* 2026 臺北市長候選人對照: client app. Plain JS, no dependencies, hash routing. */
(function () {
  'use strict';

  var G = window.GUIDE || {};
  var CAND = G.candidates || {};
  var SECTIONS = G.sections || [];
  var SOURCES = G.sources || {};
  var main = document.getElementById('main');
  var sheet = document.getElementById('sheet');
  var sheetBody = document.getElementById('sheet-body');
  var sheetTitle = document.getElementById('sheet-title');

  var state = { order: ['shen', 'chiang'], size: 1, blind: null, search: '' };
  try {
    if (localStorage.getItem('tp26-order') === 'swap') state.order = ['chiang', 'shen'];
    var sz = parseInt(localStorage.getItem('tp26-size') || '1', 10);
    if (sz >= 1 && sz <= 3) state.size = sz;
  } catch (e) { /* private mode */ }

  var KIND = {
    policy: '政見', position: '立場', record: '紀錄', bio: '', allegation: '指控', critique: '批評',
    response: '回應', factcheck: '查核', quote: '發言', event: '事件', data: '資料', no_position: '未見主張'
  };
  var STYPE = {
    official: '官方', campaign: '候選人陣營', government: '政府', legislature: '立法院', court: '法院',
    factcheck: '事實查核', media: '媒體', academic: '學術', partisan: '政黨', aggregator: '彙整網站', ngo: '公民團體'
  };

  var NAV_TOP = [
    ['home', '首頁', '#/'], ['issues', '議題政見', '#/issues'], ['china', '兩岸立場', '#/china'],
    ['politics', '政治立場', '#/politics'], ['people', '背景經歷', '#/people'], ['record', '施政問政', '#/record'],
    ['controversies', '爭議查核', '#/controversies'], ['more', '更多', '#/more']
  ];
  var NAV_TAB = [
    ['home', '首頁', '#/'], ['issues', '議題', '#/issues'], ['china', '兩岸', '#/china'],
    ['people', '人物', '#/people'], ['more', '更多', '#/more']
  ];

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : '#'; }
  function sec(key) { for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].key === key) return SECTIONS[i]; return null; }
  function secsByNav(nav) { return SECTIONS.filter(function (s) { return s.nav === nav; }); }
  function other(c) { return c === 'shen' ? 'chiang' : 'shen'; }
  function fmtDate(d) {
    if (!d) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    return m ? (m[1] + '-' + m[2] + '-' + m[3]) : esc(d);
  }
  function who(c, withParty) {
    var k = CAND[c] || {};
    return '<span class="who"><span class="no-badge" aria-hidden="true">' + esc(k.no) + '</span><span>' +
      '<span class="visually-hidden">' + esc(k.no) + '號 </span>' + esc(k.name) +
      (withParty ? ' <span class="party">' + esc(k.party) + '</span>' : '') + '</span></span>';
  }
  function hl(text) {
    var t = esc(text);
    if (!state.search) return t;
    var q = esc(state.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp(q, 'g'), function (m) { return '<mark>' + m + '</mark>'; });
  }

  /* ---------- footnotes: numbered per page ---------- */
  function Notes() { this.map = {}; this.list = []; }
  Notes.prototype.cite = function (ids) {
    if (!ids || !ids.length) return '';
    var self = this, out = [];
    ids.forEach(function (id) {
      if (!SOURCES[id]) return;
      if (!self.map[id]) { self.list.push(id); self.map[id] = self.list.length; }
      out.push('<button type="button" class="fn" data-src="' + esc(id) + '" aria-label="來源 ' + self.map[id] + '">' + self.map[id] + '</button>');
    });
    return out.length ? '<span class="fns">' + out.join('') + '</span>' : '';
  };
  Notes.prototype.render = function () {
    if (!this.list.length) return '';
    var lis = this.list.map(function (id, i) {
      var s = SOURCES[id];
      return '<li id="src-' + esc(id) + '">' + srcLine(s) + '</li>';
    });
    return '<section class="srclist" aria-labelledby="srch"><h2 id="srch">本頁來源</h2><ol>' + lis.join('') + '</ol></section>';
  };
  var NOLINK_NOTE = '投票日前十日內暫不提供連結，11/28 下午 4 點投票結束後恢復';
  function srcLine(s) {
    var title = s.nolink ? '<span>' + esc(s.title || '') + '</span>'
      : '<a class="ext" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title || s.url) + '</a>';
    return title + '<br><span class="stype">' + esc(s.publisher || '') + (s.published ? '，' + fmtDate(s.published) : '') +
      (s.type && STYPE[s.type] ? '，' + STYPE[s.type] : '') + (s.nolink ? '，' + NOLINK_NOTE : '') + '</span>';
  }

  /* ---------- item rendering ---------- */
  function renderItem(it, N) {
    var cls = 'item' + (it.kind === 'no_position' ? ' nopos' : '');
    var tag = '', statusLine = '';
    if (it.status && it.status.length <= 10) tag = '<span class="tag">' + esc(it.status) + '</span>';
    else if (it.status) statusLine = '<p class="status"><b>狀態：</b>' + hl(it.status) + '</p>';
    else if (KIND[it.kind] && it.kind !== 'policy' && it.kind !== 'bio' && it.kind !== 'position' && it.kind !== 'quote' && it.kind !== 'data') {
      tag = '<span class="tag kind-' + esc(it.kind) + '">' + KIND[it.kind] + '</span>';
    }
    var h = '<article class="' + cls + '" id="i-' + esc(it.id) + '">';
    if (it.head) h += '<h4>' + hl(it.head) + tag + (it.text ? '' : ' ' + N.cite(it.src)) + '</h4>';
    if (it.text) h += '<p>' + hl(it.text) + ' ' + N.cite(it.src) + '</p>';
    else if (!it.head && it.src && it.src.length) h += '<p>' + N.cite(it.src) + '</p>';
    if (it.quote && it.quote.text) {
      var q = it.quote;
      h += '<blockquote class="q"><p>「' + hl(q.text) + '」</p><footer>' + esc(q.speaker || '') +
        (q.date ? '，' + fmtDate(q.date) : '') + (q.occasion ? '，' + esc(q.occasion) : '') + ' ' + N.cite(q.src || []) + '</footer></blockquote>';
    }
    if (it.nums && it.nums.length) {
      h += '<ul class="nums">' + it.nums.map(function (n) { return '<li>' + esc(n[0]) + ' <b>' + esc(n[1]) + '</b></li>'; }).join('') + '</ul>';
    }
    if (statusLine) h += statusLine;
    if (it.cost) h += '<p class="cost"><b>經費與財源：</b>' + hl(it.cost) + '</p>';
    if (it.views && it.views.length) {
      h += '<details class="views"><summary>各方看法（' + it.views.length + '）</summary><ul>' +
        it.views.map(function (v) {
          return '<li><span class="vt">' + (v.type === 'response' ? '回應' : v.type === 'finding' ? '查證' : '批評') + '</span>' +
            esc(v.by || '') + (v.date ? '（' + fmtDate(v.date) + '）' : '') + '：' + hl(v.text) + ' ' + N.cite(v.src) + '</li>';
        }).join('') + '</ul></details>';
    }
    return h + '</article>';
  }
  function renderItems(list, N, emptyText) {
    if (!list || !list.length) return '<p class="muted small">' + esc(emptyText || '此項目前沒有整理到可查證的公開資料。') + '</p>';
    return list.map(function (it) { return renderItem(it, N); }).join('');
  }

  /* ---------- section pages ---------- */
  function sectionHead(s, N) {
    var intro = s.intro || '', first = intro, rest = '';
    var cut = intro.indexOf('。');
    if (intro.length > 70 && cut > 0 && cut < intro.length - 1) { first = intro.slice(0, cut + 1); rest = intro.slice(cut + 1); }
    return '<div class="page-head"><h1>' + esc(s.title) + '</h1>' +
      (first ? '<p>' + esc(first) + (s.src && N ? ' ' + N.cite(s.src) : '') + '</p>' : '') +
      (rest ? '<details class="views intro-more"><summary>本頁說明</summary><p class="small muted">' + esc(rest) + '</p></details>' : '') +
      '</div>';
  }
  function summaryBlock(s, N) {
    if (!s.summary) return '';
    var sides = state.order.filter(function (c) { return s.summary[c]; });
    if (!sides.length) return '';
    return '<div class="summary">' + sides.map(function (c) {
      return '<div class="side">' + who(c) + '<p>' + hl(s.summary[c]) + '</p></div>';
    }).join('') + '</div>';
  }
  function diffBlock(s) {
    var h = '';
    if (s.differences && s.differences.length) {
      h += '<h2>兩人主要差異</h2><ul>' + s.differences.map(function (d) { return '<li>' + hl(d) + '</li>'; }).join('') + '</ul>';
    }
    if (s.common && s.common.length) {
      h += '<h2>兩人都提到</h2><ul>' + s.common.map(function (d) { return '<li>' + hl(d) + '</li>'; }).join('') + '</ul>';
    }
    return h ? '<div class="diff">' + h + '</div>' : '';
  }
  function gapsBlock(s) {
    if (!s.gaps || !s.gaps.length) return '';
    return '<details class="views"><summary>資料缺口與搜尋範圍</summary><ul>' +
      s.gaps.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul></details>';
  }
  function pairedGroups(s, N) {
    return (s.groups || []).map(function (g) {
      var h = '<section class="group" id="g-' + esc(s.key) + '-' + esc(g.id || '') + '"><h3>' + hl(g.title) + '</h3>';
      if (g.note) h += '<p class="gnote">' + esc(g.note) + '</p>';
      h += '<div class="pair">' + state.order.map(function (c) {
        return '<div class="side">' + who(c) + renderItems(g[c], N, g.empty && g.empty[c]) + '</div>';
      }).join('') + '</div>';
      if (g.both && g.both.length) h += '<div class="both"><span class="who">兩人交鋒與共同事項</span>' + renderItems(g.both, N) + '</div>';
      return h + '</section>';
    }).join('');
  }
  function splitGroups(s, N, active) {
    var tabs = '<div class="split-tabs" role="tablist" aria-label="選擇候選人">' + state.order.map(function (c) {
      var k = CAND[c] || {};
      return '<button type="button" role="tab" data-split="' + c + '" aria-selected="' + (c === active) + '">' +
        '<span class="no-badge" aria-hidden="true">' + esc(k.no) + '</span>' + esc(k.name) + '</button>';
    }).join('') + '</div>';
    var cols = state.order.map(function (c) {
      var body = (s.groups || []).filter(function (g) { return (g[c] && g[c].length) || (g.both && g.both.length); }).map(function (g) {
        var items = (g[c] || []).concat(g.both || []);
        return '<h3 class="subhead">' + hl(g.title) + '</h3>' + (g.note ? '<p class="gnote small muted">' + esc(g.note) + '</p>' : '') + renderItems(items, N);
      }).join('');
      return '<section data-col="' + c + '"' + (c === active ? '' : ' hidden') + ' aria-label="' + esc((CAND[c] || {}).name) + '">' +
        who(c, true) + (body || '<p class="muted">目前沒有整理到可查證的資料。</p>') + '</section>';
    }).join('');
    return tabs + '<div class="split">' + cols + '</div>';
  }
  function renderSection(s, opts) {
    var N = new Notes();
    var h = (opts && opts.chips ? opts.chips : '') + sectionHead(s, N);
    h += summaryBlock(s, N) + diffBlock(s);
    if ((s.groups || []).length > 4 && s.layout !== 'split') {
      h += '<details class="views toc"><summary>本頁目錄（' + s.groups.length + ' 節）</summary><ul>' + s.groups.map(function (g) {
        return '<li><button type="button" class="jump" data-jump="g-' + esc(s.key) + '-' + esc(g.id || '') + '">' + esc(g.title) + '</button></li>';
      }).join('') + '</ul></details>';
    }
    h += '<div class="sec-body' + (s.compact ? ' compact' : '') + '">';
    if (s.layout === 'split') h += splitGroups(s, N, state.order[0]);
    else h += pairedGroups(s, N);
    h += '</div>';
    h += gapsBlock(s);
    h += N.render();
    return h;
  }

  /* ---------- pages ---------- */
  function ballotStrip() {
    return '<div class="ballot" role="group" aria-label="兩位候選人，依號次排列">' + state.order.map(function (c) {
      var k = CAND[c] || {};
      var rows = [['政黨', k.party], ['出生', k.born_label], ['現職', k.current], ['口號', k.slogan]].filter(function (r) { return r[1]; });
      return '<div class="cell"><div class="no" aria-hidden="true">' + esc(k.no) + '</div><div class="name">' +
        '<span class="visually-hidden">' + esc(k.no) + '號 </span>' + esc(k.name) + '</div><dl>' +
        rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
        '<div class="links">' + (k.site ? '<a class="ext" href="' + esc(safeUrl(k.site)) + '" target="_blank" rel="noopener noreferrer">競選官網</a>' : '') +
        (G.meta && G.meta.bulletin_url ? '<a class="ext" href="' + esc(safeUrl(G.meta.bulletin_url)) + '" target="_blank" rel="noopener noreferrer">選舉公報</a>' : '') + '</div></div>';
    }).join('') + '</div>';
  }
  function pageHome() {
    var m = G.meta || {};
    var issues = secsByNav('issues');
    var hl2 = (m.headline_lines || ['2026 臺北市長選舉', '候選人對照']).map(function (x) { return '<span class="l">' + esc(x) + '</span>'; }).join('');
    var h = '<div class="page-head"><h1>' + hl2 + '</h1><p>' + esc(m.lede || '') + '</p></div>';
    h += ballotStrip();
    h += '<p class="small muted">左右依號次排列。按右上角「對調」可交換左右，全站同步。</p>';
    if (m.principles && m.principles.length) {
      h += '<div class="notice"><h2>這個網站怎麼做</h2>' + m.principles.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
    }
    h += '<h2 class="sec">從你關心的議題開始</h2><div class="chips" role="list">' + issues.map(function (s) {
      return '<a class="chip" role="listitem" href="#/issues/' + esc(s.key) + '">' + esc(s.short || s.title) + '</a>';
    }).join('') + '</div>';
    var E = [
      ['#/blind', '先看政見，不看名字', '把兩人的政見拿掉姓名、隨機排成甲乙，你選完才揭曉是誰。結果只留在你的手機。', true],
      ['#/bulletin', '選舉公報政見原文', '兩人刊在官方選舉公報上的政見，各 36 項，照公報原文轉錄。'],
      ['#/china', '兩岸與對中共立場', '兩人用自己的話怎麼說，做過什麼，中國官方又如何回應。'],
      ['#/people', '背景經歷', '學歷、經歷、家庭背景、政治歷程與這次參選。'],
      ['#/record', '施政與問政紀錄', '蔣萬安的市長任內紀錄，沈伯洋的立委問政紀錄。'],
      ['#/politics', '其他政治立場', '核電公投、罷免、財劃法、同婚、轉型正義等。'],
      ['#/controversies', '爭議與事實查核', '誰指控了什麼、本人如何回應、查核單位怎麼判定。'],
      ['#/debate', '辯論與政見會', '10/31 電視辯論與公辦政見會的問答。'],
      ['#/timeline', '選戰時間軸', '提名、登記、抽籤、辯論與重要事件。'],
      ['#/vote', '投票資訊', '投票時間、要帶什麼、投票所查詢、其他候選人。']
    ];
    h += '<div class="entries">' + E.map(function (e) {
      return '<a class="entry' + (e[3] ? ' primary' : '') + '" href="' + e[0] + '"><strong>' + esc(e[1]) + '</strong><span>' + esc(e[2]) + '</span></a>';
    }).join('') + '</div>';
    if (G.others && G.others.length) {
      h += '<p class="small">本次臺北市長共有 6 位候選人。本站依使用者需求整理3號與5號兩位；另 4 位為 ' +
        G.others.map(function (o) { return esc(o.no + '號 ' + o.name + '（' + o.party + '）'); }).join('、') +
        '，完整學經歷與政見請見 <a class="ext" href="' + esc(safeUrl(m.bulletin_url)) + '" target="_blank" rel="noopener noreferrer">官方選舉公報</a>。</p>';
    }
    h += footer();
    return h;
  }
  function pageIssues(key) {
    var issues = secsByNav('issues');
    var s = sec(key) || issues[0];
    if (!s) return '<p class="empty">資料準備中。</p>';
    var chips = '<div class="chips" role="list" aria-label="議題">' + issues.map(function (x) {
      return '<a class="chip" role="listitem" href="#/issues/' + esc(x.key) + '"' + (x.key === s.key ? ' aria-current="page"' : '') + '>' + esc(x.short || x.title) + '</a>';
    }).join('') + '</div>';
    return renderSection(s, { chips: chips }) + footer();
  }
  function pageSection(key) {
    var s = sec(key);
    if (!s) return '<p class="empty">資料準備中。</p>';
    return renderSection(s) + footer();
  }
  function pageMore() {
    var L = [
      ['#/bulletin', '選舉公報政見原文'],
      ['#/politics', '其他政治立場'], ['#/controversies', '爭議與事實查核'], ['#/debate', '10/31 電視辯論'],
      ['#/forums', '政見發表會與論壇'], ['#/factchecks', '事實查核一覽'], ['#/timeline', '選戰時間軸'],
      ['#/record', '施政與問政紀錄'], ['#/blind', '先看政見，不看名字'], ['#/vote', '投票資訊'],
      ['#/glossary', '名詞解釋'], ['#/search', '搜尋'], ['#/method', '方法、原則與全部來源']
    ];
    return '<div class="page-head"><h1>更多</h1></div><div class="entries">' + L.map(function (l) {
      return '<a class="entry" href="' + l[0] + '"><strong>' + esc(l[1]) + '</strong></a>';
    }).join('') + '</div>' + footer();
  }
  function pageFactchecks() {
    var N = new Notes();
    var list = (G.factchecks || []).slice();
    var h = '<div class="page-head"><h1>事實查核一覽</h1><p>由台灣事實查核中心等第三方查核組織發布的報告。判定用語照查核組織原文，本站不另作判定。</p></div>';
    h += '<div class="filter" role="group" aria-label="篩選">' + ['all'].concat(state.order).map(function (c) {
      var lab = c === 'all' ? '全部' : (CAND[c].no + '號 ' + CAND[c].name + ' 相關');
      return '<button type="button" class="chip" data-fcf="' + c + '" aria-pressed="' + (c === 'all') + '">' + esc(lab) + '</button>';
    }).join('') + '</div>';
    h += '<div id="fc-list">' + list.map(function (f) {
      return '<article class="item" data-about="' + esc(f.about) + '"><h4>' + esc(f.claim) + '<span class="tag">' + esc(f.verdict) + '</span></h4>' +
        '<p class="small muted">' + esc(f.org || '') + (f.date ? '，' + fmtDate(f.date) : '') + (f.by ? '，說法來自：' + esc(f.by) : '') + '</p>' +
        (f.text ? '<p>' + esc(f.text) + ' ' + N.cite(f.src) + '</p>' : '<p>' + N.cite(f.src) + '</p>') + '</article>';
    }).join('') + '</div>';
    if (!list.length) h += '<p class="empty">資料準備中。</p>';
    return h + N.render() + footer();
  }
  function pageTimeline() {
    var N = new Notes();
    var list = (G.timeline || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var h = '<div class="page-head"><h1>選戰時間軸</h1><p>依日期排列。只收已發生且有來源的事件，不收民調。</p></div>';
    h += '<div class="filter" role="group" aria-label="篩選">' + ['all'].concat(state.order).map(function (c) {
      var lab = c === 'all' ? '全部' : (CAND[c].no + '號 ' + CAND[c].name);
      return '<button type="button" class="chip" data-tlf="' + c + '" aria-pressed="' + (c === 'all') + '">' + esc(lab) + '</button>';
    }).join('') + '</div><ol class="tl" id="tl-list">' + list.map(function (t) {
      var tag = (t.who === 'shen' || t.who === 'chiang') ? who(t.who) : '<span class="who">' + (t.who === 'both' ? '兩人' : '選務與其他') + '</span>';
      return '<li data-who="' + esc(t.who) + '"><time datetime="' + esc(t.date) + '">' + fmtDate(t.date) + '</time><div>' + tag +
        '<div>' + esc(t.text) + ' ' + N.cite(t.src) + '</div></div></li>';
    }).join('') + '</ol>';
    if (!list.length) h += '<p class="empty">資料準備中。</p>';
    return h + N.render() + footer();
  }
  function pageVote() {
    var N = new Notes();
    var v = G.vote || {};
    var h = '<div class="page-head"><h1>投票資訊</h1><p>' + esc(v.lede || '') + '</p></div>';
    (v.blocks || []).forEach(function (b) {
      h += '<section class="group"><h3>' + esc(b.title) + '</h3>' + (b.text ? '<p class="prose">' + esc(b.text) + ' ' + N.cite(b.src) + '</p>' : '') +
        (b.list ? '<ul class="prose">' + b.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        (b.link ? '<p><a class="btn" href="' + esc(safeUrl(b.link.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(b.link.label) + '</a></p>' : '') + '</section>';
    });
    if (G.others && G.others.length) {
      h += '<section class="group"><h3>全部 6 位市長候選人</h3><ul class="prose">' +
        [{ no: CAND.shen.no, name: CAND.shen.name, party: CAND.shen.party }, { no: CAND.chiang.no, name: CAND.chiang.name, party: CAND.chiang.party }].concat(G.others)
          .sort(function (a, b) { return a.no - b.no; })
          .map(function (o) { return '<li>' + esc(o.no + '號 ' + o.name + '，' + o.party) + '</li>'; }).join('') +
        '</ul><p class="small">完整學經歷與政見以 <a class="ext" href="' + esc(safeUrl((G.meta || {}).bulletin_url)) + '" target="_blank" rel="noopener noreferrer">中選會選舉公報</a> 為準。</p></section>';
    }
    return h + N.render() + footer();
  }
  function pageGlossary() {
    var N = new Notes();
    var list = (G.glossary || []).slice().sort(function (a, b) { return a.term.localeCompare(b.term, 'zh-Hant'); });
    var h = '<div class="page-head"><h1>名詞解釋</h1><p>網站裡常出現的政策與政治名詞，用白話說明。</p></div>';
    h += list.map(function (g) {
      return '<article class="item"><h4>' + esc(g.term) + '</h4><p>' + esc(g.plain) + ' ' + N.cite(g.src) + '</p></article>';
    }).join('');
    if (!list.length) h += '<p class="empty">資料準備中。</p>';
    return h + N.render() + footer();
  }
  function pageMethod() {
    var m = G.method || {};
    var h = '<div class="page-head"><h1>方法、原則與全部來源</h1></div><div class="prose">' +
      (m.paras || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
    var ids = Object.keys(SOURCES);
    var byType = {};
    ids.forEach(function (id) { var t = SOURCES[id].type || 'media'; (byType[t] = byType[t] || []).push(id); });
    h += '<h2 class="sec">全部來源（' + ids.length + ' 筆）</h2>';
    Object.keys(STYPE).forEach(function (t) {
      var L = byType[t];
      if (!L || !L.length) return;
      L.sort(function (a, b) { return (SOURCES[b].published || '').localeCompare(SOURCES[a].published || ''); });
      h += '<details class="views"><summary>' + STYPE[t] + '（' + L.length + '）</summary><ul>' +
        L.map(function (id) { return '<li>' + srcLine(SOURCES[id]) + '</li>'; }).join('') + '</ul></details>';
    });
    return h + footer();
  }
  function footer() {
    var m = G.meta || {};
    return '<footer class="footer"><p>資料截至 ' + esc(m.as_of_label || m.as_of || '') + '。內容整理自公開資料，每則附來源，請以原始來源為準。</p>' +
      (m.footer_note ? '<p>' + esc(m.footer_note) + '</p>' : '') +
      '<p><a href="#/method">方法、原則與全部來源</a></p></footer>';
  }

  /* ---------- search ---------- */
  function allItems() {
    var out = [];
    SECTIONS.forEach(function (s) {
      (s.groups || []).forEach(function (g) {
        ['shen', 'chiang', 'both'].forEach(function (c) {
          (g[c] || []).forEach(function (it) { out.push({ s: s, g: g, c: c, it: it }); });
        });
      });
    });
    return out;
  }
  function itemText(it) {
    return [it.head, it.text, it.quote && it.quote.text, it.cost].concat((it.views || []).map(function (v) { return v.text; })).join(' ');
  }
  function routeFor(s) {
    if (s.nav === 'issues') return '#/issues/' + s.key;
    return '#/' + s.key;
  }
  function pageSearch() {
    var q = state.search;
    var h = '<div class="page-head"><h1>搜尋</h1><p>輸入關鍵字，例如：捷運、社宅、敬老卡、雙城論壇。</p></div>' +
      '<form class="searchbox" id="searchform" role="search"><label class="visually-hidden" for="q">關鍵字</label>' +
      '<input id="q" name="q" type="search" enterkeyhint="search" autocomplete="off" value="' + esc(q) + '"><button type="submit">搜尋</button></form>';
    if (!q) return h + footer();
    var hits = allItems().filter(function (x) { return itemText(x.it).indexOf(q) >= 0; });
    h += '<p class="muted small">找到 ' + hits.length + ' 筆。</p>';
    h += hits.slice(0, 200).map(function (x) {
      var whoTag = (x.c === 'both') ? '<span class="who">兩人</span>' : who(x.c);
      return '<div class="hit"><div class="where">' + esc(x.s.title) + '，' + esc(x.g.title) + '</div>' + whoTag +
        '<div><a href="' + routeFor(x.s) + '/' + esc(x.it.id) + '">' + hl(x.it.head || x.it.text || '') + '</a></div>' +
        (x.it.head && x.it.text ? '<div class="small">' + hl(x.it.text) + '</div>' : '') + '</div>';
    }).join('');
    return h + footer();
  }

  /* ---------- blind mode ---------- */
  function rnd() { var a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0] / 4294967296; }
  function blindTopics() { return secsByNav('issues').filter(function (s) { return s.blind && s.blind.length; }); }
  function pageBlind() {
    var B = state.blind;
    if (!B || B.stage === 'intro') return blindIntro();
    if (B.stage === 'q') return blindQuestion();
    return blindResult();
  }
  function blindIntro() {
    var topics = blindTopics();
    var B = state.blind || { stage: 'intro', pick: {} };
    if (!state.blind) { topics.forEach(function (t) { B.pick[t.key] = true; }); state.blind = B; }
    var n = topics.filter(function (t) { return B.pick[t.key]; }).reduce(function (a, t) { return a + t.blind.length; }, 0);
    var h = '<div class="page-head"><h1>先看政見，不看名字</h1><p>每一題有兩個方案，分別整理自兩位候選人的政見，但拿掉姓名，並隨機排成「甲」「乙」。看完選出比較接近你想法的一個，全部選完才揭曉是誰。</p></div>';
    h += '<div class="notice"><p>這不是民調，也不是推薦。你的選擇只存在這支手機的瀏覽器裡，不會上傳。</p><p>政見只是投票的一個考量，經歷、紀錄與立場請看其他頁面。</p></div>';
    h += '<h2 class="sec">選擇想比較的議題</h2><div class="filter" role="group" aria-label="議題">' + topics.map(function (t) {
      return '<button type="button" class="chip" data-bt="' + esc(t.key) + '" aria-pressed="' + (!!B.pick[t.key]) + '">' + esc(t.short || t.title) + '（' + t.blind.length + '）</button>';
    }).join('') + '</div>';
    h += '<p><button type="button" class="btn dark" id="blind-start"' + (n ? '' : ' disabled') + '>開始，共 ' + n + ' 題</button></p>';
    if (!topics.length) h = '<div class="page-head"><h1>先看政見，不看名字</h1></div><p class="empty">資料準備中。</p>';
    return h + footer();
  }
  function blindStart() {
    var B = state.blind;
    var deck = [];
    blindTopics().forEach(function (t) {
      if (!B.pick[t.key]) return;
      t.blind.forEach(function (b) { deck.push({ t: t, b: b, first: rnd() < 0.5 ? 'shen' : 'chiang', rot: Math.round(rnd() * 16 - 8) }); });
    });
    B.deck = deck; B.i = 0; B.answers = []; B.stage = 'q';
  }
  function blindQuestion() {
    var B = state.blind, d = B.deck[B.i];
    var a = d.first, b = other(a), cur = B.answers[B.i];
    function card(c, label) {
      return '<button type="button" class="blind-card" data-bc="' + c + '" aria-pressed="' + (cur === c) + '" style="--rot:' + d.rot + 'deg">' +
        '<span class="label">方案' + label + '</span><span class="body">' + esc(d.b[c]) + '</span>' +
        '<svg class="stamp-mark" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="8"/><path d="M56 25V75M54 46L37 58" stroke="currentColor" stroke-width="8" stroke-linecap="round" fill="none"/></svg></button>';
    }
    var h = '<div class="progress">第 ' + (B.i + 1) + ' 題，共 ' + B.deck.length + ' 題</div>' +
      '<div class="page-head" style="padding-top:4px"><h1>' + esc(d.t.short || d.t.title) + '：' + esc(d.b.group) + '</h1></div>';
    h += card(a, '甲') + card(b, '乙');
    h += '<div class="blind-actions"><button type="button" class="btn" data-bx="same" aria-pressed="' + (cur === 'same') + '">差不多</button>' +
      '<button type="button" class="btn" data-bx="skip">跳過</button></div>';
    h += '<div class="blind-actions"><button type="button" class="btn" id="blind-prev"' + (B.i ? '' : ' disabled') + '>上一題</button>' +
      '<button type="button" class="btn dark" id="blind-next"' + (cur ? '' : ' disabled') + '>' + (B.i === B.deck.length - 1 ? '看結果' : '下一題') + '</button></div>';
    return h;
  }
  function blindResult() {
    var B = state.blind;
    var cnt = { shen: 0, chiang: 0, same: 0 };
    B.deck.forEach(function (d, i) { var x = B.answers[i]; if (x === 'shen' || x === 'chiang') cnt[x]++; else cnt.same++; });
    var h = '<div class="page-head"><h1>揭曉</h1><p>下面是你在每一題的選擇，以及甲乙各是誰的政見。</p></div>';
    h += '<div class="tally">' + state.order.map(function (c) {
      return '<div><b>' + cnt[c] + '</b>' + esc(CAND[c].no + '號 ' + CAND[c].name) + '的方案</div>';
    }).join('') + '<div><b>' + cnt.same + '</b>差不多或跳過</div></div>';
    h += '<div class="notice"><p>這只是你對這幾題政見文字的偏好，不代表全部政見，也不代表誰比較適合。題目由本站摘要，摘要方式可能影響你的判斷，請點各議題頁看原文與來源。</p></div>';
    h += B.deck.map(function (d, i) {
      var x = B.answers[i];
      var lab = x === 'shen' || x === 'chiang' ? ('你選了' + (x === d.first ? '甲' : '乙') + '：' + CAND[x].no + '號 ' + CAND[x].name) : '你選了差不多或跳過';
      return '<div class="result-row"><div class="small muted">' + esc(d.t.short || d.t.title) + '：' + esc(d.b.group) + '</div><div><b>' + esc(lab) + '</b></div>' +
        '<div class="small">甲是 ' + esc(CAND[d.first].no + '號 ' + CAND[d.first].name) + '，乙是 ' + esc(CAND[other(d.first)].no + '號 ' + CAND[other(d.first)].name) +
        '。<a href="#/issues/' + esc(d.t.key) + '">看這個議題的完整對照</a></div></div>';
    }).join('');
    h += '<p><button type="button" class="btn dark" id="blind-reset">重新開始</button></p>';
    return h + footer();
  }

  /* ---------- router ---------- */
  function parse() {
    var raw = (location.hash || '#/').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
    return parts;
  }
  function activeKey(p) {
    var r = p[0] || 'home';
    if (r === 'issues') return 'issues';
    if (r === 'china') return 'china';
    if (r === 'people') return 'people';
    if (r === 'home') return 'home';
    return NAV_TOP.some(function (n) { return n[0] === r; }) ? r : 'more';
  }
  function renderNav(p) {
    var a = activeKey(p);
    var tabA = (a === 'record') ? 'people' : (['home', 'issues', 'china', 'people'].indexOf(a) >= 0 ? a : 'more');
    document.getElementById('topnav').innerHTML = NAV_TOP.map(function (n) {
      return '<a href="' + n[2] + '"' + (n[0] === a ? ' aria-current="page"' : '') + '>' + n[1] + '</a>';
    }).join('');
    document.getElementById('tabbar').innerHTML = NAV_TAB.map(function (n) {
      return '<a href="' + n[2] + '"' + (n[0] === tabA ? ' aria-current="page"' : '') + '>' + n[1] + '</a>';
    }).join('');
  }
  var TITLES = { home: '', bulletin: '選舉公報政見原文', issues: '議題政見', china: '兩岸與對中共立場', politics: '其他政治立場', people: '背景經歷', record: '施政與問政紀錄', controversies: '爭議與事實查核', debate: '10/31 電視辯論', forums: '政見發表會與論壇', factchecks: '事實查核一覽', timeline: '選戰時間軸', vote: '投票資訊', method: '方法與來源', glossary: '名詞解釋', blind: '先看政見，不看名字', more: '更多', search: '搜尋' };
  function render(keepScroll) {
    var p = parse();
    var r = p[0] || 'home';
    var focusId = null;
    var html;
    if (r === 'home') html = pageHome();
    else if (r === 'issues') { html = pageIssues(p[1]); focusId = p[2]; }
    else if (r === 'more') html = pageMore();
    else if (r === 'factchecks') html = pageFactchecks();
    else if (r === 'timeline') html = pageTimeline();
    else if (r === 'vote') html = pageVote();
    else if (r === 'method') html = pageMethod();
    else if (r === 'glossary') html = pageGlossary();
    else if (r === 'blind') html = pageBlind();
    else if (r === 'search') html = pageSearch();
    else { html = pageSection(r); focusId = p[1]; }
    main.innerHTML = html;
    renderNav(p);
    var t = TITLES[r] || ((sec(r) || {}).title) || '';
    if (r === 'issues') { var s = sec(p[1]) || secsByNav('issues')[0]; if (s) t = s.title; }
    document.title = (t ? t + '｜' : '') + '2026 臺北市長候選人對照';
    if (focusId) {
      var el = document.getElementById('i-' + focusId);
      if (el) {
        var col = el.closest('[data-col]');
        if (col && col.hidden) selectSplit(col.getAttribute('data-col'));
        el.scrollIntoView({ block: 'center' });
        el.style.background = 'var(--stamp-soft)';
        return;
      }
    }
    if (!keepScroll) window.scrollTo(0, 0);
  }
  function selectSplit(c) {
    main.querySelectorAll('[data-split]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-split') === c)); });
    main.querySelectorAll('[data-col]').forEach(function (s) { s.hidden = s.getAttribute('data-col') !== c; });
  }

  /* ---------- sheet (source details) ---------- */
  function openSources(ids, title) {
    sheetTitle.textContent = title || '來源';
    sheetBody.innerHTML = ids.map(function (id) {
      var s = SOURCES[id];
      if (!s) return '';
      return '<div class="src"><h3>' + esc(s.title || s.url) + '</h3><div class="meta">' + esc(s.publisher || '') +
        (s.published ? '，' + fmtDate(s.published) : '') + (s.type && STYPE[s.type] ? '，' + STYPE[s.type] : '') + '</div>' +
        (s.excerpt ? '<blockquote>' + esc(s.excerpt) + '</blockquote>' : '') +
        (s.nolink ? '<p class="small muted">' + NOLINK_NOTE + '。</p>'
          : '<a class="btn" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer">開啟原始頁面</a>') + '</div>';
    }).join('');
    if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
    sheetTitle.setAttribute('tabindex', '-1');
    sheetTitle.focus({ preventScroll: true });
  }
  function closeSheet() { if (sheet.open) { if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open'); } }
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });

  /* ---------- global events ---------- */
  main.addEventListener('click', function (e) {
    var t = e.target.closest('button, a');
    if (!t) return;
    if (t.classList.contains('fn')) { openSources([t.getAttribute('data-src')], '來源 ' + t.textContent); return; }
    if (t.hasAttribute('data-jump')) {
      var target = document.getElementById(t.getAttribute('data-jump'));
      if (target) { target.scrollIntoView({ block: 'start' }); var h3 = target.querySelector('h3'); if (h3) { h3.setAttribute('tabindex', '-1'); h3.focus({ preventScroll: true }); } }
      return;
    }
    if (t.hasAttribute('data-split')) { selectSplit(t.getAttribute('data-split')); return; }
    if (t.hasAttribute('data-fcf') || t.hasAttribute('data-tlf')) {
      var attr = t.hasAttribute('data-fcf') ? 'data-fcf' : 'data-tlf';
      var v = t.getAttribute(attr);
      main.querySelectorAll('[' + attr + ']').forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); });
      var rows = attr === 'data-fcf' ? main.querySelectorAll('#fc-list > [data-about]') : main.querySelectorAll('#tl-list > li');
      rows.forEach(function (row) {
        var w = row.getAttribute(attr === 'data-fcf' ? 'data-about' : 'data-who');
        row.hidden = !(v === 'all' || w === v || w === 'both');
      });
      return;
    }
    var B = state.blind;
    if (t.hasAttribute('data-bt') && B) { var k = t.getAttribute('data-bt'); B.pick[k] = !B.pick[k]; render(true); return; }
    if (t.id === 'blind-start' && B) { blindStart(); render(); return; }
    if (t.hasAttribute('data-bc') && B) { B.answers[B.i] = t.getAttribute('data-bc'); render(true); return; }
    if (t.hasAttribute('data-bx') && B) {
      if (t.getAttribute('data-bx') === 'skip') { B.answers[B.i] = 'skip'; advance(); }
      else { B.answers[B.i] = 'same'; render(true); }
      return;
    }
    if (t.id === 'blind-prev' && B) { if (B.i > 0) { B.i--; render(); } return; }
    if (t.id === 'blind-next' && B) { advance(); return; }
    if (t.id === 'blind-reset') { state.blind = null; render(); return; }
  });
  function advance() {
    var B = state.blind;
    if (B.i < B.deck.length - 1) { B.i++; } else { B.stage = 'result'; }
    render();
  }
  main.addEventListener('submit', function (e) {
    if (e.target.id === 'searchform') {
      e.preventDefault();
      state.search = (document.getElementById('q').value || '').trim();
      render(true);
    }
  });
  document.getElementById('btn-swap').addEventListener('click', function () {
    state.order = [state.order[1], state.order[0]];
    try { localStorage.setItem('tp26-order', state.order[0] === 'chiang' ? 'swap' : 'normal'); } catch (e) { }
    this.setAttribute('aria-pressed', String(state.order[0] === 'chiang'));
    render(true);
  });
  document.getElementById('btn-size').addEventListener('click', function () {
    state.size = state.size % 3 + 1;
    applySize();
    try { localStorage.setItem('tp26-size', String(state.size)); } catch (e) { }
  });
  document.getElementById('btn-search').addEventListener('click', function () { location.hash = '#/search'; });
  function applySize() {
    document.documentElement.setAttribute('data-size', String(state.size));
    var b = document.getElementById('btn-size');
    if (b) b.textContent = ['字級', '字級 大', '字級 特大'][state.size - 1];
  }
  applySize();
  document.getElementById('btn-swap').setAttribute('aria-pressed', String(state.order[0] === 'chiang'));
  var sub = document.getElementById('brand-sub');
  if (sub && G.meta && G.meta.brand_sub) sub.textContent = G.meta.brand_sub;
  window.addEventListener('hashchange', function () { if (parse()[0] !== 'search') state.search = ''; render(); });
  render();
})();
