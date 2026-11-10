/* 試験 - 過去問CBT
 * ジャンル → 試験の種類 → 年度 を選び、CBT 方式で受験するアプリ。
 * サーバ不要（index.html を直接開いても、GitHub Pages でも動作します）。
 */
(function () {
  "use strict";

  const LABELS = ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ", "サ", "シ"];
  const HISTORY_KEY = "shiken-history-v1";
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
        return '<a class="row" href="#/' + [g.id, e.id, y.id].map(encodeURIComponent).join("/") + '"><span class="row-title">' +
          esc(y.label) + '</span><span class="row-meta">' + meta + "</span><span class=\"chev\">›</span></a>";
      }).join("") + "</div>";
  }

  function renderStart(g, e, y) {
    topbarRight.innerHTML = "";
    app.innerHTML = steps(3) + '<p class="loading">読み込み中…</p>';
    loadExamFile(y.file).then(function (data) {
      if (data.format === "essay") return window.EssayMode.renderStart(essayCtx(), g, e, y, data);
      const n = data.questions.length;
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
        '<button class="btn primary big" id="startBtn">試験を開始する</button>' +
        "</section>";
      document.getElementById("startBtn").onclick = function () {
        startExam(g, e, y, data, {
          practice: document.querySelector('input[name="mode"]:checked').value === "practice",
          shuffleQ: document.getElementById("optShuffleQ").checked,
          shuffleC: document.getElementById("optShuffleC").checked,
          noTimer: document.getElementById("optNoTimer").checked
        });
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
      checked: qs.map(function () { return false; }), // 練習モードで確認済み
      cur: 0, start: Date.now(), limit: scaled, retry: !!onlyIndexes
    };
    window.onbeforeunload = function () { return "受験中です。"; };
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

    topbarRight.innerHTML = '<span class="timer" id="timer"></span>' +
      '<button class="btn danger" id="finishBtn">試験終了</button>';

    const choicesHtml = item.order.map(function (orig, k) {
      const chosen = sel.indexOf(orig) >= 0;
      let cls = "choice" + (chosen ? " chosen" : "");
      if (showResult) {
        if (correctSet.indexOf(orig) >= 0) cls += " correct";
        else if (chosen) cls += " wrong";
      }
      return '<button class="' + cls + '" data-orig="' + orig + '"' + (showResult ? " disabled" : "") + '>' +
        '<span class="lbl">' + LABELS[k] + "</span><span class=\"txt\">" + nl2br(q.choices[orig]) + "</span></button>";
    }).join("");

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
      (q.category ? '<span class="tag">' + esc(q.category) + "</span>" : "") +
      (multi ? '<span class="tag multi">複数選択</span>' : "") +
      '<button class="btn flag' + (s.flags[i] ? " on" : "") + '" id="flagBtn">' + (s.flags[i] ? "★ 見直し中" : "☆ 後で見直す") + "</button></div>" +
      '<div class="qtext">' + nl2br(q.text) + "</div>" +
      figuresHtml(q) +
      '<div class="choices">' + choicesHtml + "</div>" +
      feedback +
      '<div class="qnav">' +
      '<button class="btn" id="prevBtn"' + (i === 0 ? " disabled" : "") + ">‹ 前へ</button>" +
      (s.opts.practice && !s.checked[i] ? '<button class="btn primary" id="checkBtn"' + (sel.length ? "" : " disabled") + ">解答を確認</button>" : "") +
      (i < s.items.length - 1 ? '<button class="btn primary" id="nextBtn">次へ ›</button>' : '<button class="btn primary" id="reviewBtn">見直し画面へ</button>') +
      "</div></section>" +
      '<aside class="panel"><h3>問題一覧</h3><div class="grid">' + s.items.map(function (_, k) {
        let cls = "cell";
        if (s.answers[k].length) cls += " answered";
        if (s.flags[k]) cls += " flagged";
        if (k === i) cls += " current";
        return '<button class="' + cls + '" data-go="' + k + '">' + (k + 1) + "</button>";
      }).join("") + "</div>" +
      '<ul class="legend"><li><i class="cell answered"></i>解答済み</li><li><i class="cell"></i>未解答</li><li><i class="cell flagged"></i>見直し</li></ul>' +
      '<p class="count">解答済み ' + s.answers.filter(function (a) { return a.length; }).length + " / " + s.items.length + "</p>" +
      "</aside></div>";

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
    app.querySelectorAll("[data-go]").forEach(function (b) {
      b.onclick = function () { go(Number(b.dataset.go)); };
    });
    document.getElementById("flagBtn").onclick = function () { s.flags[i] = !s.flags[i]; renderQuestion(); };
    document.getElementById("prevBtn").onclick = function () { go(i - 1); };
    const nb = document.getElementById("nextBtn"); if (nb) nb.onclick = function () { go(i + 1); };
    const rb = document.getElementById("reviewBtn"); if (rb) rb.onclick = renderReview;
    const cb = document.getElementById("checkBtn"); if (cb) cb.onclick = function () { s.checked[i] = true; renderQuestion(); };
    document.getElementById("finishBtn").onclick = renderReview;
    tick();
  }

  function go(k) {
    if (k < 0 || k >= session.items.length) return;
    session.cur = k;
    renderQuestion();
    window.scrollTo(0, 0);
  }

  function renderReview() {
    const s = session;
    const unanswered = s.answers.filter(function (a) { return !a.length; }).length;
    const flagged = s.flags.filter(Boolean).length;
    topbarRight.innerHTML = '<span class="timer" id="timer"></span>';
    app.innerHTML = '<section class="review">' +
      "<h1>見直し</h1>" +
      '<p>未解答 <b class="' + (unanswered ? "ng" : "") + '">' + unanswered + "</b> 問 ・ 見直しマーク <b>" + flagged + "</b> 問</p>" +
      '<div class="grid big">' + s.items.map(function (_, k) {
        let cls = "cell";
        if (s.answers[k].length) cls += " answered";
        if (s.flags[k]) cls += " flagged";
        return '<button class="' + cls + '" data-go="' + k + '">' + (k + 1) + "</button>";
      }).join("") + "</div>" +
      '<div class="qnav"><button class="btn" id="backBtn">問題に戻る</button>' +
      '<button class="btn danger" id="endBtn">採点して終了する</button></div></section>';
    app.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { go(Number(b.dataset.go)); }; });
    document.getElementById("backBtn").onclick = function () { go(s.cur); };
    document.getElementById("endBtn").onclick = function () {
      if (confirm("試験を終了して採点します。よろしいですか？" + (unanswered ? "\n（未解答が " + unanswered + " 問あります）" : ""))) finishExam(false);
    };
    tick();
  }

  // ---------- 画面: 結果 ----------
  function finishExam(timeUp) {
    if (!session) return;
    clearInterval(timerId); timerId = null;
    window.onbeforeunload = null;
    const s = session; session = null;
    const elapsed = Math.min((Date.now() - s.start) / 1000, s.limit || Infinity);
    const results = s.items.map(function (item, k) {
      return { item: item, sel: s.answers[k], ok: sameSet(s.answers[k], answerSet(item.q)) };
    });
    const correct = results.filter(function (r) { return r.ok; }).length;
    const rate = Math.round(correct / results.length * 100);
    const pass = s.data.passingRate != null ? rate >= s.data.passingRate : null;
    if (!s.retry) saveHistory(s.g.id + "/" + s.e.id + "/" + s.y.id, { date: new Date().toISOString(), correct: correct, total: results.length, rate: rate });

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
      '<h2>解答と解説 <label class="filter"><input type="checkbox" id="onlyWrong"> 間違えた問題のみ表示</label></h2>' +
      '<div class="answers">' + results.map(function (r, k) {
        const q = r.item.q, order = r.item.order;
        const lab = function (orig) { return LABELS[order.indexOf(orig)]; };
        return '<details class="ans ' + (r.ok ? "ok" : "ng") + '"' + (r.ok ? "" : " open") + ">" +
          "<summary><span class=\"mark\">" + (r.ok ? "○" : "×") + "</span> 問" + (k + 1) + "　" + esc(q.text.split("\n")[0].slice(0, 60)) + "</summary>" +
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
    if (location.hash === "#/settings") { window.scrollTo(0, 0); return window.EssayMode.renderSettings(essayCtx()); }
    if (session) {
      // 受験中に戻る操作をされた場合
      if (!confirm("受験を中断しますか？（解答は破棄されます）")) {
        history.replaceState(null, "", "#/" + [session.g.id, session.e.id, session.y.id].join("/"));
        return;
      }
      clearInterval(timerId); timerId = null; session = null; window.onbeforeunload = null;
    }
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
