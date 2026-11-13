/* 試験 - 過去問CBT
 * ジャンル → 試験の種類 → 年度 を選び、CBT 方式で受験するアプリ。
 * サーバ不要（index.html を直接開いても、GitHub Pages でも動作します）。
 */
(function () {
  "use strict";

  const LABELS = ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ", "サ", "シ"];
  const HISTORY_KEY = "shiken-history-v1";
  const WRONG_KEY = "shiken-wrong-v1";
  const app = document.getElementById("app");
  const topbarRight = document.getElementById("topbarRight");
  const catalog = window.EXAM_CATALOG || [];
  const loaded = {}; // file -> exam data

  // ---------- 問題データの読み込み ----------
  let pendingRegister = null;
  window.registerExam = function (data) {
    if (pendingRegister) pendingRegister(data);
  };

  function loadExamFile(file) {
    if (loaded[file]) return Promise.resolve(loaded[file]);
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      pendingRegister = function (data) { loaded[file] = data; };
      s.src = file;
      s.onload = function () {
        pendingRegister = null;
        loaded[file] ? resolve(loaded[file]) : reject(new Error("registerExam が呼ばれませんでした: " + file));
      };
      s.onerror = function () {
        pendingRegister = null;
        reject(new Error("ファイルを読み込めませんでした: " + file));
      };
      document.head.appendChild(s);
    });
  }

  // ---------- ユーティリティ ----------
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function nl2br(str) { return esc(str).replace(/\n/g, "<br>"); }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
    return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
  }
  // 表: table = 行の配列（1行目は見出し）、tables = [{ caption, rows }]
  // セル先頭の "_" は実線下線（主キー）、"~" は破線下線（外部キー）
  function cellHtml(c, tag) {
    c = String(c == null ? "" : c);
    let inner;
    if (c[0] === "_") inner = '<span class="pk">' + esc(c.slice(1)) + "</span>";
    else if (c[0] === "~") inner = '<span class="fk">' + esc(c.slice(1)) + "</span>";
    else inner = nl2br(c);
    return "<" + tag + ">" + inner + "</" + tag + ">";
  }
  function tableHtml(rows, caption) {
    if (!rows || !rows.length) return "";
    return '<div class="qtable-wrap"><table class="qtable">' + (caption ? "<caption>" + esc(caption) + "</caption>" : "") +
      rows.map(function (r, i) {
        return "<tr>" + r.map(function (c) { return cellHtml(c, i === 0 ? "th" : "td"); }).join("") + "</tr>";
      }).join("") + "</table></div>";
  }
  function figuresHtml(q) {
    return (q.code ? '<pre class="code">' + esc(q.code) + "</pre>" : "") +
      tableHtml(q.table) +
      (q.tables || []).map(function (t) { return tableHtml(t.rows, t.caption); }).join("") +
      (q.image ? [q.image] : []).concat(q.images || []).map(function (src) {
        return '<img class="qimg" src="' + esc(src) + '" alt="問題の図">';
      }).join("");
  }
  function answerSet(q) { return Array.isArray(q.answer) ? q.answer.slice().sort() : [q.answer]; }
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    const x = a.slice().sort(), y = b.slice().sort();
    return x.every(function (v, i) { return v === y[i]; });
  }
  function findGenre(id) { return catalog.find(function (g) { return g.id === id; }); }
  function findExam(g, id) { return g && (g.exams || []).find(function (e) { return e.id === id; }); }
  function findYear(e, id) { return e && (e.years || []).find(function (y) { return y.id === id; }); }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveHistory(key, rec) {
    try {
      const h = loadHistory();
      (h[key] = h[key] || []).push(rec);
      h[key] = h[key].slice(-20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    } catch (e) { /* 保存できない環境では無視 */ }
  }

  // 間違えた問題の記録: { "genre/exam/year": [元の問題番号, ...] }
  function loadWrongAll() {
    try { return JSON.parse(localStorage.getItem(WRONG_KEY)) || {}; } catch (e) { return {}; }
  }
  function loadWrong(key) { return loadWrongAll()[key] || []; }
  function updateWrong(key, list) {
    try {
      const all = loadWrongAll();
      const set = (all[key] || []).slice();
      list.forEach(function (x) {
        const p = set.indexOf(x.orig);
        if (!x.ok && p < 0) set.push(x.orig);
        if (x.ok && p >= 0) set.splice(p, 1);
      });
      set.sort(function (a, b) { return a - b; });
      if (set.length) all[key] = set; else delete all[key];
      localStorage.setItem(WRONG_KEY, JSON.stringify(all));
    } catch (e) { /* 保存できない環境では無視 */ }
  }
  function clearWrong(key) {
    try { const all = loadWrongAll(); delete all[key]; localStorage.setItem(WRONG_KEY, JSON.stringify(all)); } catch (e) { /* 無視 */ }
  }

  // ---------- 画面: 選択（ジャンル → 試験 → 年度） ----------
  function breadcrumb(parts) {
    return '<nav class="crumbs">' + parts.map(function (p, i) {
      return i < parts.length - 1 ? '<a href="' + p.href + '">' + esc(p.label) + "</a><span>›</span>" : "<b>" + esc(p.label) + "</b>";
    }).join("") + "</nav>";
  }
  function steps(active) {
    const names = ["ジャンル", "試験の種類", "年度", "受験"];
    return '<ol class="steps">' + names.map(function (n, i) {
      return '<li class="' + (i < active ? "done" : i === active ? "active" : "") + '"><span>' + (i + 1) + "</span>" + n + "</li>";
    }).join("") + "</ol>";
  }

  function renderGenres() {
    topbarRight.innerHTML = "";
    app.innerHTML = steps(0) +
      "<h1>ジャンルを選択</h1>" +
      '<div class="cards">' + catalog.map(function (g) {
        const n = (g.exams || []).length;
        return '<a class="card" href="#/' + encodeURIComponent(g.id) + '"><h2>' + esc(g.name) + "</h2><p>" + esc(g.description || "") +
          '</p><span class="meta">' + n + " 種類の試験</span></a>";
      }).join("") + "</div>" +
      (catalog.length ? "" : '<p class="empty">data/catalog.js に試験が登録されていません。</p>');
  }

  function renderExams(g) {
    topbarRight.innerHTML = "";
    app.innerHTML = steps(1) + breadcrumb([{ label: "ジャンル", href: "#/" }, { label: g.name }]) +
      "<h1>試験の種類を選択</h1>" +
      '<div class="cards">' + (g.exams || []).map(function (e) {
        return '<a class="card" href="#/' + encodeURIComponent(g.id) + "/" + encodeURIComponent(e.id) + '"><h2>' + esc(e.name) + "</h2><p>" +
          esc(e.description || "") + '</p><span class="meta">' + (e.years || []).length + " 回分</span></a>";
      }).join("") + "</div>";
  }

  function renderYears(g, e) {
    topbarRight.innerHTML = "";
    const hist = loadHistory();
    app.innerHTML = steps(2) + breadcrumb([{ label: "ジャンル", href: "#/" }, { label: g.name, href: "#/" + g.id }, { label: e.name }]) +
      "<h1>年度（回）を選択</h1>" +
      '<div class="list">' + (e.years || []).map(function (y) {
        const recs = hist[g.id + "/" + e.id + "/" + y.id] || [];
        let meta = "未受験";
        if (recs.length) {
          const best = Math.max.apply(null, recs.map(function (r) { return r.rate; }));
          meta = "受験 " + recs.length + " 回 ・ 最高 " + best + "% ・ 前回 " + recs[recs.length - 1].rate + "%";
        }
        const wn = loadWrong(g.id + "/" + e.id + "/" + y.id).length;
        if (wn) meta += " ・ 間違えた問題 " + wn + " 問";
        return '<a class="row" href="#/' + [g.id, e.id, y.id].map(encodeURIComponent).join("/") + '"><span class="row-title">' +
          esc(y.label) + '</span><span class="row-meta">' + meta + "</span><span class=\"chev\">›</span></a>";
      }).join("") + "</div>" +
      ((e.years || []).length ? "" : '<p class="empty">この試験の過去問はまだ登録されていません。</p>');
  }

  function renderStart(g, e, y) {
    topbarRight.innerHTML = "";
    app.innerHTML = steps(3) + '<p class="loading">読み込み中…</p>';
    loadExamFile(y.file).then(function (data) {
      if (data.format === "essay") return window.EssayMode.renderStart(essayCtx(), g, e, y, data);
      const n = data.questions.length;
      const key = g.id + "/" + e.id + "/" + y.id;
      const wrong = loadWrong(key).filter(function (k) { return k < n; });
      app.innerHTML = steps(3) +
        breadcrumb([{ label: "ジャンル", href: "#/" }, { label: g.name, href: "#/" + g.id }, { label: e.name, href: "#/" + g.id + "/" + e.id }, { label: y.label }]) +
        '<section class="start">' +
        "<h1>" + esc(data.title || e.name + " " + y.label) + "</h1>" +
        '<dl class="info">' +
        "<dt>問題数</dt><dd>" + n + " 問</dd>" +
        "<dt>制限時間</dt><dd>" + (data.timeLimit ? data.timeLimit + " 分" : "なし") + "</dd>" +
        "<dt>合格ライン</dt><dd>" + (data.passingRate != null ? data.passingRate + "% 以上" : "—") + "</dd>" +
        (data.source ? "<dt>出典</dt><dd>" + esc(data.source) + "</dd>" : "") +
        "</dl>" +
        '<fieldset class="opts"><legend>受験モード</legend>' +
        '<label><input type="radio" name="mode" value="exam" checked> 本番モード <small>（最後にまとめて採点）</small></label>' +
        '<label><input type="radio" name="mode" value="practice"> 練習モード <small>（1問ごとに正誤と解説を表示）</small></label>' +
        "</fieldset>" +
        '<fieldset class="opts"><legend>オプション</legend>' +
        '<label><input type="checkbox" id="optShuffleQ"> 問題の順番をシャッフル</label>' +
        '<label><input type="checkbox" id="optShuffleC"> 選択肢の順番をシャッフル</label>' +
        '<label><input type="checkbox" id="optNoTimer"> 制限時間なし</label>' +
        "</fieldset>" +
        '<div class="start-actions"><button class="btn primary big" id="startBtn">試験を開始する</button>' +
        (wrong.length ? '<button class="btn big" id="wrongBtn">間違えた問題だけ受ける（' + wrong.length + " 問）</button>" : "") + "</div>" +
        (wrong.length ? '<p class="note">間違えた問題の記録: ' + wrong.map(function (n) { return "問" + (n + 1); }).join("、") +
          '　<button class="linkbtn" id="clearWrong">記録を消す</button></p>' : "") +
        "</section>";
      function opts() {
        return {
          practice: document.querySelector('input[name="mode"]:checked').value === "practice",
          shuffleQ: document.getElementById("optShuffleQ").checked,
          shuffleC: document.getElementById("optShuffleC").checked,
          noTimer: document.getElementById("optNoTimer").checked
        };
      }
      document.getElementById("startBtn").onclick = function () { startExam(g, e, y, data, opts()); };
      const wb = document.getElementById("wrongBtn");
      if (wb) wb.onclick = function () { startExam(g, e, y, data, opts(), wrong); };
      const cw = document.getElementById("clearWrong");
      if (cw) cw.onclick = function () {
        if (confirm("この回の「間違えた問題」の記録を消しますか？")) { clearWrong(key); renderStart(g, e, y); }
      };
    }).catch(function (err) {
      app.innerHTML = '<p class="error">' + esc(err.message) + '</p><p><a href="#/">ジャンル選択に戻る</a></p>';
    });
  }

  // ---------- 画面: CBT 受験 ----------
  let session = null;
  let timerId = null;

  function startExam(g, e, y, data, opts, onlyIndexes) {
    let qs = data.questions.map(function (q, i) {
      let order = q.choices.map(function (_, k) { return k; });
      if (opts.shuffleC) order = shuffle(order);
      return { q: q, orig: i, order: order };
    });
    if (onlyIndexes) qs = qs.filter(function (x) { return onlyIndexes.indexOf(x.orig) >= 0; });
    if (opts.shuffleQ) qs = shuffle(qs);
    const limit = !opts.noTimer && data.timeLimit ? data.timeLimit * 60 : 0;
    const scaled = limit && onlyIndexes ? Math.ceil(limit * qs.length / data.questions.length) : limit;
    session = {
      g: g, e: e, y: y, data: data, opts: opts, items: qs,
      answers: qs.map(function () { return []; }), // 元の選択肢番号
      flags: qs.map(function () { return false; }),
      marks: qs.map(function () { return false; }), // 受験者が付けたチェック（結果に印を出す）
      checked: qs.map(function () { return false; }), // 練習モードで確認済み
      cur: 0, start: Date.now(), limit: scaled, retry: !!onlyIndexes
    };
    window.onbeforeunload = function () { return "受験中です。"; };
    document.body.classList.add("in-cbt");
    renderQuestion();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(tick, 500);
    tick();
  }

  function tick() {
    if (!session) return;
    const el = document.getElementById("timer");
    const elapsed = (Date.now() - session.start) / 1000;
    if (session.limit) {
      const left = session.limit - elapsed;
      if (el) {
        el.textContent = "残り " + fmtTime(left);
        el.classList.toggle("warn", left <= 60);
      }
      if (left <= 0) { finishExam(true); }
    } else if (el) {
      el.textContent = "経過 " + fmtTime(elapsed);
    }
  }

  function renderQuestion() {
    const s = session, i = s.cur, item = s.items[i], q = item.q;
    const multi = Array.isArray(q.answer);
    const sel = s.answers[i];
    const showResult = s.opts.practice && s.checked[i];
    const correctSet = answerSet(q);

    const answeredCount = s.answers.filter(function (a) { return a.length; }).length;
    topbarRight.innerHTML = '<span class="timer" id="timer"></span>' +
      '<button class="btn danger" id="finishBtn">試験を終了</button>';

    // 選択肢: 左に文字、右に解答ボタン
    function stateCls(orig) {
      const chosen = sel.indexOf(orig) >= 0;
      let cls = chosen ? " chosen" : "";
      if (showResult) {
        if (correctSet.indexOf(orig) >= 0) cls += " correct";
        else if (chosen) cls += " wrong";
      }
      return cls;
    }
    const choicesHtml =
      '<ol class="choice-list">' + item.order.map(function (orig, k) {
        return '<li class="ctext' + stateCls(orig) + '"><span class="lbl">' + LABELS[k] + '</span><span class="txt">' + nl2br(q.choices[orig]) + "</span></li>";
      }).join("") + "</ol>" +
      '<div class="answer-pad" role="group" aria-label="解答"><div class="pad-title">解答' + (multi ? "<small>（複数）</small>" : "") + "</div>" +
      item.order.map(function (orig, k) {
        return '<button class="choice' + stateCls(orig) + '" data-orig="' + orig + '"' + (showResult ? " disabled" : "") +
          ' aria-pressed="' + (sel.indexOf(orig) >= 0) + '">' + LABELS[k] + "</button>";
      }).join("") + "</div>";

    let feedback = "";
    if (showResult) {
      const ok = sameSet(sel, correctSet);
      feedback = '<div class="feedback ' + (ok ? "ok" : "ng") + '"><b>' + (ok ? "○ 正解" : "× 不正解") + "</b>　正解: " +
        correctSet.map(function (c) { return LABELS[item.order.indexOf(c)]; }).join("・") +
        (q.explanation ? '<p>' + nl2br(q.explanation) + "</p>" : "") + "</div>";
    }

    app.innerHTML =
      '<div class="cbt">' +
      '<section class="qpane">' +
      '<div class="qhead"><span class="qno">問' + (i + 1) + '<small> / ' + s.items.length + "</small></span>" +
      (s.retry ? '<span class="tag">元の問' + (item.orig + 1) + "</span>" : "") +
      (q.category ? '<span class="tag">' + esc(q.category) + "</span>" : "") +
      (multi ? '<span class="tag multi">複数選択</span>' : "") +
      (s.flags[i] ? '<span class="tag flagtag">★ 見直し</span>' : "") +
      '<button class="btn markbtn' + (s.marks[i] ? " on" : "") + '" id="markBtn" aria-pressed="' + s.marks[i] + '">' +
      (s.marks[i] ? "✔ チェック済み" : "☐ チェック") + "</button></div>" +
      '<div class="qtext">' + nl2br(q.text) + "</div>" +
      figuresHtml(q) +
      '<div class="choices">' + choicesHtml + "</div>" +
      feedback +
      "</section>" +
      // 問題のすぐ下: 左に「問題一覧」「電卓」、右に「後で見直す」「前へ」「次へ」
      '<div class="qactions"><div class="qa-left">' +
      '<button class="btn" id="listBtn">問題一覧 <small>' + answeredCount + "/" + s.items.length + "</small></button>" +
      '<button class="btn" id="calcBtn">電卓</button></div><div class="qa-right">' +
      (s.opts.practice && !s.checked[i] ? '<button class="btn primary" id="checkBtn"' + (sel.length ? "" : " disabled") + ">解答を確認</button>" : "") +
      '<button class="btn flag' + (s.flags[i] ? " on" : "") + '" id="flagBtn">' + (s.flags[i] ? "★ 見直し中" : "☆ 後で見直す") + "</button>" +
      '<button class="btn" id="prevBtn"' + (i === 0 ? " disabled" : "") + ">‹ 前へ</button>" +
      '<button class="btn primary" id="nextBtn"' + (i === s.items.length - 1 ? " disabled" : "") + ">次へ ›</button>" +
      "</div></div></div>";

    app.querySelectorAll(".choice").forEach(function (b) {
      b.onclick = function () {
        const orig = Number(b.dataset.orig);
        if (multi) {
          const p = sel.indexOf(orig);
          p >= 0 ? sel.splice(p, 1) : sel.push(orig);
        } else {
          s.answers[i] = sel.length === 1 && sel[0] === orig ? [] : [orig];
        }
        renderQuestion();
      };
    });
    document.getElementById("flagBtn").onclick = function () { s.flags[i] = !s.flags[i]; renderQuestion(); };
    document.getElementById("markBtn").onclick = function () { s.marks[i] = !s.marks[i]; renderQuestion(); };
    document.getElementById("prevBtn").onclick = function () { go(i - 1); };
    document.getElementById("nextBtn").onclick = function () { go(i + 1); };
    const cb = document.getElementById("checkBtn"); if (cb) cb.onclick = function () { s.checked[i] = true; renderQuestion(); };
    document.getElementById("listBtn").onclick = openList;
    document.getElementById("calcBtn").onclick = Calc.toggle;
    document.getElementById("finishBtn").onclick = openFinish;
    tick();
  }

  function go(k) {
    if (k < 0 || k >= session.items.length) return;
    closeModal();
    session.cur = k;
    renderQuestion();
    window.scrollTo(0, 0);
  }

  // ---------- モーダル（問題一覧・試験終了の確認） ----------
  let modal = null;
  function openModal(html, cls) {
    closeModal();
    modal = document.createElement("div");
    modal.className = "modal-back";
    modal.innerHTML = '<div class="modal ' + (cls || "") + '" role="dialog" aria-modal="true">' + html + "</div>";
    modal.addEventListener("click", function (ev) {
      if (ev.target === modal || ev.target.closest("[data-close]")) closeModal();
    });
    document.body.appendChild(modal);
    return modal;
  }
  function closeModal() {
    if (modal) { modal.remove(); modal = null; }
  }
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && modal) { ev.stopImmediatePropagation(); closeModal(); }
  });

  function openList() {
    const s = session;
    const answered = s.answers.filter(function (a) { return a.length; }).length;
    const m = openModal(
      '<div class="modal-head"><h3>問題一覧</h3><button class="btn icon" data-close aria-label="閉じる">×</button></div>' +
      '<p class="count">解答済み ' + answered + " / " + s.items.length + " ・ 見直し " + s.flags.filter(Boolean).length + " 問 ・ チェック " + s.marks.filter(Boolean).length + " 問</p>" +
      '<div class="grid big">' + s.items.map(function (_, k) {
        let cls = "cell";
        if (s.answers[k].length) cls += " answered";
        if (s.flags[k]) cls += " flagged";
        if (s.marks[k]) cls += " marked";
        if (k === s.cur) cls += " current";
        return '<button class="' + cls + '" data-go="' + k + '">' + (k + 1) + "</button>";
      }).join("") + "</div>" +
      '<ul class="legend"><li><i class="cell answered"></i>解答済み</li><li><i class="cell"></i>未解答</li><li><i class="cell flagged"></i>見直し</li><li><i class="cell marked"></i>チェック</li><li><i class="cell current"></i>表示中</li></ul>',
      "list-modal");
    m.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { go(Number(b.dataset.go)); }; });
  }

  function openFinish() {
    const s = session;
    const unanswered = s.answers.filter(function (a) { return !a.length; }).length;
    const flagged = s.flags.filter(Boolean).length;
    const marked = s.marks.filter(Boolean).length;
    const m = openModal(
      "<h3>試験を終了して採点しますか？</h3>" +
      "<p>未解答 <b class=\"" + (unanswered ? "ng" : "") + "\">" + unanswered + "</b> 問 ・ 見直しマーク <b>" + flagged + "</b> 問 ・ チェック <b>" + marked + "</b> 問</p>" +
      (unanswered ? '<p class="note">未解答の問題は不正解になります。</p>' : "") +
      '<div class="modal-actions"><button class="btn" data-close>試験に戻る</button>' +
      '<button class="btn danger-fill" id="endBtn">終了して採点する</button></div>',
      "finish-modal");
    m.querySelector("#endBtn").onclick = function () { closeModal(); finishExam(false); };
  }

  // ---------- 電卓 ----------
  const Calc = (function () {
    let box = null, disp = "0", acc = null, op = null, fresh = true;
    // 移動した位置を覚えておき、次に開いたときも同じ場所に出す
    const POS_KEY = "shiken-calc-pos";
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem(POS_KEY)); } catch (e) { pos = null; }
    function place() {
      if (!box || !pos) return;
      const r = box.getBoundingClientRect();
      const x = Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - r.width));
      const y = Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - r.height));
      box.style.left = x + "px"; box.style.top = y + "px"; box.style.right = "auto"; box.style.bottom = "auto";
    }
    window.addEventListener("resize", place);
    const SYM = { "+": "+", "-": "−", "*": "×", "/": "÷" };
    const KEYS = [
      ["C", "clear"], ["CE", "ce"], ["⌫", "bs"], ["÷", "op/"],
      ["7", "d7"], ["8", "d8"], ["9", "d9"], ["×", "op*"],
      ["4", "d4"], ["5", "d5"], ["6", "d6"], ["−", "op-"],
      ["1", "d1"], ["2", "d2"], ["3", "d3"], ["+", "op+"],
      ["±", "neg"], ["0", "d0"], [".", "d."], ["=", "eq"],
      ["√", "sqrt"], ["%", "pct"]
    ];
    function fmt(x) {
      if (!isFinite(x)) return "エラー";
      return String(parseFloat(x.toPrecision(12)));
    }
    function num() { return disp === "エラー" ? 0 : parseFloat(disp); }
    function calc(a, o, b) {
      return o === "+" ? a + b : o === "-" ? a - b : o === "*" ? a * b : b === 0 ? NaN : a / b;
    }
    function press(k) {
      if (disp === "エラー" && k !== "clear") { disp = "0"; acc = null; op = null; fresh = true; }
      if (k[0] === "d") {
        const d = k.slice(1);
        if (fresh) { disp = d === "." ? "0." : d; fresh = false; }
        else if (d === "." && disp.indexOf(".") >= 0) return;
        else if (disp.replace(/[-.]/g, "").length >= 15) return;
        else disp = disp === "0" && d !== "." ? d : disp + d;
      } else if (k.slice(0, 2) === "op") {
        if (op && !fresh) { disp = fmt(calc(acc, op, num())); }
        acc = num(); op = k.slice(2); fresh = true;
      } else if (k === "eq") {
        if (!op) return;
        disp = fmt(calc(acc, op, num())); acc = null; op = null; fresh = true;
      } else if (k === "clear") { disp = "0"; acc = null; op = null; fresh = true; }
      else if (k === "ce") { disp = "0"; fresh = true; }
      else if (k === "bs") {
        if (fresh) return;
        disp = disp.length > 1 && !(disp.length === 2 && disp[0] === "-") ? disp.slice(0, -1) : "0";
      } else if (k === "neg") { if (disp !== "0") disp = disp[0] === "-" ? disp.slice(1) : "-" + disp; }
      else if (k === "sqrt") { disp = fmt(Math.sqrt(num())); fresh = true; }
      else if (k === "pct") { disp = fmt(num() / 100); fresh = true; }
      draw();
    }
    function draw() {
      if (!box) return;
      box.querySelector(".calc-expr").textContent = op ? fmt(acc) + " " + SYM[op] : "";
      box.querySelector(".calc-disp").textContent = disp;
    }
    function open() {
      if (box) return;
      box = document.createElement("div");
      box.className = "calc";
      box.innerHTML = '<div class="calc-head"><span>電卓</span><button class="btn icon" aria-label="閉じる">×</button></div>' +
        '<div class="calc-screen"><div class="calc-expr"></div><div class="calc-disp"></div></div>' +
        '<div class="calc-keys">' + KEYS.map(function (k) {
          const cls = k[1].slice(0, 2) === "op" || k[1] === "eq" ? " opkey" : k[1][0] === "d" || k[1] === "neg" ? " numkey" : "";
          return '<button class="ckey' + cls + (k[1] === "eq" ? " eq" : "") + '" data-k="' + k[1] + '">' + k[0] + "</button>";
        }).join("") + "</div>";
      box.querySelector(".calc-head .btn").onclick = close;
      box.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { press(b.dataset.k); }; });
      // ヘッダーをドラッグして移動
      const head = box.querySelector(".calc-head");
      head.addEventListener("pointerdown", function (ev) {
        if (ev.target.closest("button")) return;
        const r = box.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
        head.setPointerCapture(ev.pointerId);
        function move(e) {
          const x = Math.min(Math.max(0, e.clientX - dx), window.innerWidth - r.width);
          const y = Math.min(Math.max(0, e.clientY - dy), window.innerHeight - r.height);
          box.style.left = x + "px"; box.style.top = y + "px"; box.style.right = "auto"; box.style.bottom = "auto";
        }
        function up() {
          head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up);
          const b = box.getBoundingClientRect();
          pos = { x: Math.round(b.left), y: Math.round(b.top) };
          try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch (e) { /* 無視 */ }
        }
        head.addEventListener("pointermove", move);
        head.addEventListener("pointerup", up);
      });
      document.body.appendChild(box);
      place();
      draw();
    }
    function close() { if (box) { box.remove(); box = null; } }
    function toggle() { box ? close() : open(); }
    // 電卓が開いているときはキーボードでも入力できる
    document.addEventListener("keydown", function (ev) {
      if (!box || modal || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.target.closest && ev.target.closest("input, textarea, select")) return;
      const k = ev.key;
      let code = null;
      if (/^[0-9.]$/.test(k)) code = "d" + k;
      else if ("+-*/".indexOf(k) >= 0) code = "op" + k;
      else if (k === "Enter" || k === "=") code = "eq";
      else if (k === "Backspace") code = "bs";
      else if (k === "Escape") code = "clear";
      else if (k === "Delete") code = "ce";
      else if (k === "%") code = "pct";
      if (!code) return;
      ev.preventDefault();
      press(code);
    });
    return { toggle: toggle, close: close };
  })();

  // ---------- 画面: 結果 ----------
  function finishExam(timeUp) {
    if (!session) return;
    clearInterval(timerId); timerId = null;
    window.onbeforeunload = null;
    document.body.classList.remove("in-cbt");
    closeModal(); Calc.close();
    const s = session; session = null;
    const elapsed = Math.min((Date.now() - s.start) / 1000, s.limit || Infinity);
    const results = s.items.map(function (item, k) {
      return { item: item, sel: s.answers[k], ok: sameSet(s.answers[k], answerSet(item.q)), marked: s.marks[k] };
    });
    const examKey = s.g.id + "/" + s.e.id + "/" + s.y.id;
    // 間違えた問題を記録（正解した問題は記録から外す）
    updateWrong(examKey, results.map(function (r) { return { orig: r.item.orig, ok: r.ok }; }));
    const wrongLeft = loadWrong(examKey).length;
    const markedCount = results.filter(function (r) { return r.marked; }).length;
    const correct = results.filter(function (r) { return r.ok; }).length;
    const rate = Math.round(correct / results.length * 100);
    const pass = s.data.passingRate != null ? rate >= s.data.passingRate : null;
    if (!s.retry) saveHistory(examKey, { date: new Date().toISOString(), correct: correct, total: results.length, rate: rate });

    // 分野別集計
    const cats = {};
    results.forEach(function (r) {
      const c = r.item.q.category || "その他";
      cats[c] = cats[c] || { ok: 0, n: 0 };
      cats[c].n++; if (r.ok) cats[c].ok++;
    });

    topbarRight.innerHTML = "";
    app.innerHTML = '<section class="result">' +
      (timeUp ? '<p class="timeup">制限時間になったため、自動で採点しました。</p>' : "") +
      "<h1>" + esc(s.data.title || s.e.name) + (s.retry ? "（間違えた問題の再挑戦）" : "") + " の結果</h1>" +
      '<div class="score">' +
      '<div class="big-rate ' + (pass === null ? "" : pass ? "ok" : "ng") + '">' + rate + "<small>%</small></div>" +
      "<div><p>" + correct + " / " + results.length + " 問正解</p><p>所要時間 " + fmtTime(elapsed) + "</p>" +
      (pass === null ? "" : '<p class="verdict ' + (pass ? "ok" : "ng") + '">' + (pass ? "合格ライン到達" : "合格ライン未達") + "（" + s.data.passingRate + "%）</p>") +
      "</div></div>" +
      '<h2>分野別</h2><table class="cats"><tbody>' + Object.keys(cats).map(function (c) {
        const v = cats[c], p = Math.round(v.ok / v.n * 100);
        return "<tr><th>" + esc(c) + "</th><td>" + v.ok + " / " + v.n + '</td><td class="bar"><span style="width:' + p + '%"></span></td><td>' + p + "%</td></tr>";
      }).join("") + "</tbody></table>" +
      '<div class="actions">' +
      (results.some(function (r) { return !r.ok; }) ? '<button class="btn primary" id="retryWrong">間違えた問題だけ再挑戦</button>' : "") +
      '<button class="btn" id="retryAll">もう一度受ける</button>' +
      '<a class="btn" href="#/' + s.g.id + "/" + s.e.id + '">年度選択に戻る</a></div>' +
      '<p class="note">間違えた問題は記録されます（この回で現在 ' + wrongLeft + " 問）。年度の開始画面から、記録した問題だけを受けられます。</p>" +
      (markedCount ? '<p class="marked-sum"><span class="markbadge">✔ チェック</span> を付けた問題: ' +
        results.map(function (r, k) { return r.marked ? "問" + (k + 1) + (r.ok ? "（○）" : "（×）") : null; }).filter(Boolean).join("、") + "</p>" : "") +
      '<h2>解答と解説 <label class="filter"><input type="checkbox" id="onlyWrong"> 間違えた問題のみ表示</label>' +
      (markedCount ? '<label class="filter"><input type="checkbox" id="onlyMarked"> チェックした問題のみ表示</label>' : "") + "</h2>" +
      '<div class="answers">' + results.map(function (r, k) {
        const q = r.item.q, order = r.item.order;
        const lab = function (orig) { return LABELS[order.indexOf(orig)]; };
        return '<details class="ans ' + (r.ok ? "ok" : "ng") + (r.marked ? " marked" : "") + '"' + (r.ok && !r.marked ? "" : " open") + ">" +
          "<summary><span class=\"mark\">" + (r.ok ? "○" : "×") + "</span> 問" + (k + 1) +
          (r.marked ? ' <span class="markbadge">✔ チェック</span>' : "") + "　" + esc(q.text.split("\n")[0].slice(0, 60)) + "</summary>" +
          '<div class="qtext">' + nl2br(q.text) + "</div>" +
          figuresHtml(q) +
          '<ul class="ans-choices">' + order.map(function (orig, i) {
            const isC = answerSet(q).indexOf(orig) >= 0, isS = r.sel.indexOf(orig) >= 0;
            return '<li class="' + (isC ? "correct" : isS ? "wrong" : "") + '"><b>' + LABELS[i] + "</b> " + nl2br(q.choices[orig]) +
              (isC ? ' <em>正解</em>' : "") + (isS ? ' <em class="you">あなたの解答</em>' : "") + "</li>";
          }).join("") + "</ul>" +
          "<p>あなたの解答: " + (r.sel.length ? r.sel.map(lab).join("・") : "未解答") + "　正解: " + answerSet(q).map(lab).join("・") + "</p>" +
          (q.explanation ? '<div class="expl"><b>解説</b><p>' + nl2br(q.explanation) + "</p></div>" : "") +
          "</details>";
      }).join("") + "</div></section>";

    document.getElementById("onlyWrong").onchange = function (ev) {
      app.querySelector(".answers").classList.toggle("only-wrong", ev.target.checked);
    };
    const om = document.getElementById("onlyMarked");
    if (om) om.onchange = function (ev) { app.querySelector(".answers").classList.toggle("only-marked", ev.target.checked); };
    document.getElementById("retryAll").onclick = function () { startExam(s.g, s.e, s.y, s.data, s.opts); };
    const rw = document.getElementById("retryWrong");
    if (rw) rw.onclick = function () {
      startExam(s.g, s.e, s.y, s.data, s.opts, results.filter(function (r) { return !r.ok; }).map(function (r) { return r.item.orig; }));
    };
    window.scrollTo(0, 0);
  }

  // ---------- ルーティング ----------
  function essayCtx() {
    return { app: app, topbarRight: topbarRight, steps: steps, breadcrumb: breadcrumb };
  }

  function route() {
    if (window.EssayMode && window.EssayMode.isActive()) {
      if (!confirm("受験を中断しますか？（解答は破棄されます）")) { history.replaceState(null, "", window.EssayMode.hash()); return; }
      window.EssayMode.leave();
    }
    if (session) {
      // 受験中に戻る操作をされた場合
      if (!confirm("受験を中断しますか？（解答は破棄されます）")) {
        history.replaceState(null, "", "#/" + [session.g.id, session.e.id, session.y.id].join("/"));
        return;
      }
      clearInterval(timerId); timerId = null; session = null; window.onbeforeunload = null;
      closeModal(); Calc.close();
    }
    document.body.classList.remove("in-cbt");
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    const g = findGenre(parts[0]), e = findExam(g, parts[1]), y = findYear(e, parts[2]);
    window.scrollTo(0, 0);
    if (y) return renderStart(g, e, y);
    if (e) return renderYears(g, e);
    if (g) return renderExams(g);
    renderGenres();
  }

  document.getElementById("brand").onclick = function (ev) { ev.preventDefault(); location.hash = "#/"; };
  window.addEventListener("hashchange", route);
  route();
})();
