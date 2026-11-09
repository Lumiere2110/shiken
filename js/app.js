/* 試験 - 過去問CBT
 * ジャンル → 試験の種類 → 年度 を選び、CBT 方式で受験するアプリ。
 * サーバ不要（index.html を直接開いても、GitHub Pages でも動作します）。
 */
(function () {
  "use strict";

  const LABELS = ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク"];
  const HISTORY_KEY = "shiken-history-v1";
  const NOTE_KEY = "shiken-notebook-v1";
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

  // ---------- 復習ノート（ブラウザに保存） ----------
  // { "<file>#<問題番号>": { file, index, title, category, text, reason, addedAt, wrongCount, streak, lastAt, memo } }
  function loadNotes() {
    try { return JSON.parse(localStorage.getItem(NOTE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveNotes(n) {
    try { localStorage.setItem(NOTE_KEY, JSON.stringify(n)); } catch (e) { /* 保存できない環境では無視 */ }
    updateNoteLink();
  }
  function noteId(ref) { return ref.file + "#" + ref.index; }
  function isNoted(ref) { return !!loadNotes()[noteId(ref)]; }
  function addNote(ref, q, reason) {
    const n = loadNotes(), id = noteId(ref);
    if (!n[id]) {
      n[id] = { file: ref.file, index: ref.index, title: ref.title || "", category: q.category || "", text: q.text,
        reason: reason, addedAt: new Date().toISOString(), wrongCount: 0, streak: 0, lastAt: null, memo: "" };
    }
    saveNotes(n);
    return n[id];
  }
  function removeNote(ref) {
    const n = loadNotes();
    delete n[noteId(ref)];
    saveNotes(n);
  }
  function toggleNote(ref, q) { isNoted(ref) ? removeNote(ref) : addNote(ref, q, "manual"); }
  function updateNoteLink() {
    const el = document.getElementById("noteLink");
    if (el) el.innerHTML = "📒 復習ノート <b>" + Object.keys(loadNotes()).length + "</b>";
  }

  // 解説ブロック（問題全体の解説 + 選択肢ごとの解説）
  function explanationHtml(q, order) {
    const ce = q.choiceExplanations || [];
    const per = order.filter(function (orig) { return ce[orig]; }).map(function (orig) {
      return "<li><b>" + LABELS[order.indexOf(orig)] + "</b> " + nl2br(ce[orig]) + "</li>";
    }).join("");
    if (!q.explanation && !per) return '<div class="expl none"><b>解説</b><p>この問題の解説は登録されていません。</p></div>';
    return '<div class="expl"><b>解説</b>' + (q.explanation ? "<p>" + nl2br(q.explanation) + "</p>" : "") +
      (per ? '<ul class="expl-choices">' + per + "</ul>" : "") + "</div>";
  }
  // 問題文・選択肢（正解/自分の解答つき）・解説
  function answerDetailHtml(q, order, sel) {
    const lab = function (orig) { return LABELS[order.indexOf(orig)]; };
    return '<div class="qtext">' + nl2br(q.text) + "</div>" +
      (q.code ? '<pre class="code">' + esc(q.code) + "</pre>" : "") +
      (q.image ? '<img class="qimg" src="' + esc(q.image) + '" alt="問題の図">' : "") +
      '<ul class="ans-choices">' + order.map(function (orig, i) {
        const isC = answerSet(q).indexOf(orig) >= 0, isS = sel && sel.indexOf(orig) >= 0;
        return '<li class="' + (isC ? "correct" : isS ? "wrong" : "") + '"><b>' + LABELS[i] + "</b> " + nl2br(q.choices[orig]) +
          (isC ? " <em>正解</em>" : "") + (isS ? ' <em class="you">あなたの解答</em>' : "") + "</li>";
      }).join("") + "</ul>" +
      (sel ? "<p>あなたの解答: " + (sel.length ? sel.map(lab).join("・") : "未解答") + "　正解: " + answerSet(q).map(lab).join("・") + "</p>"
        : "<p>正解: " + answerSet(q).map(lab).join("・") + "</p>") +
      explanationHtml(q, order);
  }
  function noteBtnHtml(ref, extraCls) {
    const on = isNoted(ref);
    return '<button class="btn note' + (on ? " on" : "") + (extraCls ? " " + extraCls : "") + '" data-note="' + esc(noteId(ref)) + '">' +
      (on ? "📒 ノート登録済み" : "＋ 復習ノートに追加") + "</button>";
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
        '<label><input type="checkbox" id="optAutoNote" checked> 間違えた問題を自動で復習ノートに追加</label>' +
        "</fieldset>" +
        '<button class="btn primary big" id="startBtn">試験を開始する</button>' +
        "</section>";
      document.getElementById("startBtn").onclick = function () {
        startExam(g, e, y, data, {
          practice: document.querySelector('input[name="mode"]:checked').value === "practice",
          shuffleQ: document.getElementById("optShuffleQ").checked,
          shuffleC: document.getElementById("optShuffleC").checked,
          noTimer: document.getElementById("optNoTimer").checked,
          autoNote: document.getElementById("optAutoNote").checked
        });
      };
    }).catch(function (err) {
      app.innerHTML = '<p class="error">' + esc(err.message) + '</p><p><a href="#/">ジャンル選択に戻る</a></p>';
    });
  }

  // ---------- 画面: CBT 受験 ----------
  let session = null;
  let timerId = null;

  // g, e, y が null のときは復習ノートからの受験（data.refs に各問題の出どころが入る）
  function startExam(g, e, y, data, opts, onlyIndexes) {
    let qs = data.questions.map(function (q, i) {
      let order = q.choices.map(function (_, k) { return k; });
      if (opts.shuffleC) order = shuffle(order);
      const ref = data.refs ? data.refs[i] : { file: y.file, index: i, title: data.title || e.name + " " + y.label };
      return { q: q, orig: i, order: order, ref: ref };
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
      cur: 0, start: Date.now(), limit: scaled, retry: !!onlyIndexes, notebook: !g
    };
    document.body.classList.add("in-exam");
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
        correctSet.map(function (c) { return LABELS[item.order.indexOf(c)]; }).join("・") + "</div>" +
        explanationHtml(q, item.order);
    }

    app.innerHTML =
      '<div class="cbt">' +
      '<section class="qpane">' +
      '<div class="qhead"><span class="qno">問' + (i + 1) + '<small> / ' + s.items.length + "</small></span>" +
      (q.category ? '<span class="tag">' + esc(q.category) + "</span>" : "") +
      (multi ? '<span class="tag multi">複数選択</span>' : "") +
      (s.notebook ? '<span class="tag src">' + esc(item.ref.title) + "</span>" : "") +
      '<span class="qhead-btns">' + noteBtnHtml(item.ref) +
      '<button class="btn flag' + (s.flags[i] ? " on" : "") + '" id="flagBtn">' + (s.flags[i] ? "★ 見直し中" : "☆ 後で見直す") + "</button></span></div>" +
      '<div class="qtext">' + nl2br(q.text) + "</div>" +
      (q.code ? "<pre class=\"code\">" + esc(q.code) + "</pre>" : "") +
      (q.image ? '<img class="qimg" src="' + esc(q.image) + '" alt="問題の図">' : "") +
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
    app.querySelector("[data-note]").onclick = function () { toggleNote(item.ref, q); renderQuestion(); };
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
    document.body.classList.remove("in-exam");
    const s = session; session = null;
    const elapsed = Math.min((Date.now() - s.start) / 1000, s.limit || Infinity);
    const results = s.items.map(function (item, k) {
      return { item: item, sel: s.answers[k], ok: sameSet(s.answers[k], answerSet(item.q)) };
    });
    const correct = results.filter(function (r) { return r.ok; }).length;
    const rate = Math.round(correct / results.length * 100);
    const pass = s.data.passingRate != null ? rate >= s.data.passingRate : null;
    if (!s.retry && !s.notebook) saveHistory(s.g.id + "/" + s.e.id + "/" + s.y.id, { date: new Date().toISOString(), correct: correct, total: results.length, rate: rate });

    // 復習ノートの更新（間違えた問題の自動追加・正誤の記録）
    const notes = loadNotes(), now = new Date().toISOString();
    let autoAdded = 0;
    results.forEach(function (r) {
      const id = noteId(r.item.ref);
      if (!notes[id] && !r.ok && s.opts.autoNote) {
        const q = r.item.q;
        notes[id] = { file: r.item.ref.file, index: r.item.ref.index, title: r.item.ref.title, category: q.category || "", text: q.text,
          reason: "wrong", addedAt: now, wrongCount: 0, streak: 0, lastAt: null, memo: "" };
        autoAdded++;
      }
      const n = notes[id];
      if (n) {
        n.lastAt = now;
        if (r.ok) n.streak = (n.streak || 0) + 1;
        else { n.wrongCount = (n.wrongCount || 0) + 1; n.streak = 0; }
      }
    });
    saveNotes(notes);
    const title = s.notebook ? "復習ノート" : (s.data.title || s.e.name);
    const backHtml = s.notebook ? '<a class="btn" href="#/notebook">復習ノートに戻る</a>'
      : '<a class="btn" href="#/' + s.g.id + "/" + s.e.id + '">年度選択に戻る</a>';

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
      "<h1>" + esc(title) + (s.retry ? "（間違えた問題の再挑戦）" : "") + " の結果</h1>" +
      '<div class="score">' +
      '<div class="big-rate ' + (pass === null ? "" : pass ? "ok" : "ng") + '">' + rate + "<small>%</small></div>" +
      "<div><p>" + correct + " / " + results.length + " 問正解</p><p>所要時間 " + fmtTime(elapsed) + "</p>" +
      (pass === null ? "" : '<p class="verdict ' + (pass ? "ok" : "ng") + '">' + (pass ? "合格ライン到達" : "合格ライン未達") + "（" + s.data.passingRate + "%）</p>") +
      "</div></div>" +
      (autoAdded ? '<p class="notice">間違えた ' + autoAdded + ' 問を <a href="#/notebook">復習ノート</a> に追加しました。</p>' : "") +
      '<h2>分野別</h2><table class="cats"><tbody>' + Object.keys(cats).map(function (c) {
        const v = cats[c], p = Math.round(v.ok / v.n * 100);
        return "<tr><th>" + esc(c) + "</th><td>" + v.ok + " / " + v.n + '</td><td class="bar"><span style="width:' + p + '%"></span></td><td>' + p + "%</td></tr>";
      }).join("") + "</tbody></table>" +
      '<div class="actions">' +
      (results.some(function (r) { return !r.ok; }) ? '<button class="btn primary" id="retryWrong">間違えた問題だけ再挑戦</button>' : "") +
      '<button class="btn" id="retryAll">もう一度受ける</button>' +
      (s.notebook && results.some(function (r) { return r.ok; }) ? '<button class="btn" id="removeOk">正解した問題をノートから外す</button>' : "") +
      backHtml + "</div>" +
      '<h2>解答と解説 <label class="filter"><input type="checkbox" id="onlyWrong"> 間違えた問題のみ表示</label></h2>' +
      '<div class="answers">' + results.map(function (r, k) {
        const q = r.item.q;
        return '<details class="ans ' + (r.ok ? "ok" : "ng") + '"' + (r.ok ? "" : " open") + ">" +
          "<summary><span class=\"mark\">" + (r.ok ? "○" : "×") + "</span> 問" + (k + 1) + "　" + esc(q.text.split("\n")[0].slice(0, 60)) + "</summary>" +
          (s.notebook ? '<p class="src">' + esc(r.item.ref.title) + " 問" + (r.item.ref.index + 1) + "</p>" : "") +
          answerDetailHtml(q, r.item.order, r.sel) +
          '<div class="ans-tools">' + noteBtnHtml(r.item.ref) + "</div>" +
          "</details>";
      }).join("") + "</div></section>";

    document.getElementById("onlyWrong").onchange = function (ev) {
      app.querySelector(".answers").classList.toggle("only-wrong", ev.target.checked);
    };
    document.getElementById("retryAll").onclick = function () { startExam(s.g, s.e, s.y, s.data, s.opts); };
    bindResultNotes();
    function bindResultNotes() {
      app.querySelectorAll("[data-note]").forEach(function (b, k) {
        b.onclick = function () {
          toggleNote(results[k].item.ref, results[k].item.q);
          b.outerHTML = noteBtnHtml(results[k].item.ref);
          bindResultNotes();
        };
      });
    }
    const ro = document.getElementById("removeOk");
    if (ro) ro.onclick = function () {
      const n = loadNotes();
      results.forEach(function (r) { if (r.ok) delete n[noteId(r.item.ref)]; });
      saveNotes(n);
      app.querySelectorAll("[data-note]").forEach(function (b, k) { b.outerHTML = noteBtnHtml(results[k].item.ref); });
      bindResultNotes();
      ro.disabled = true; ro.textContent = "正解した問題を外しました";
    };
    const rw = document.getElementById("retryWrong");
    if (rw) rw.onclick = function () {
      startExam(s.g, s.e, s.y, s.data, s.opts, results.filter(function (r) { return !r.ok; }).map(function (r) { return r.item.orig; }));
    };
    window.scrollTo(0, 0);
  }

  // ---------- 画面: 復習ノート ----------
  const noteView = { title: "", category: "", sort: "added" };

  function renderNotebook() {
    topbarRight.innerHTML = "";
    const notes = loadNotes();
    const ids = Object.keys(notes);
    if (!ids.length) {
      app.innerHTML = breadcrumb([{ label: "ジャンル", href: "#/" }, { label: "復習ノート" }]) +
        "<h1>復習ノート</h1>" +
        '<p class="empty">まだ問題が登録されていません。<br>受験中や結果画面の「＋ 復習ノートに追加」で登録できます。' +
        "<br>間違えた問題は採点時に自動で追加されます（開始画面のオプションで切り替え可）。</p>";
      return;
    }
    app.innerHTML = "<h1>復習ノート</h1>" + '<p class="loading">読み込み中…</p>';
    const files = ids.map(function (id) { return notes[id].file; }).filter(function (f, i, a) { return a.indexOf(f) === i; });
    Promise.all(files.map(function (f) { return loadExamFile(f).catch(function () { return null; }); })).then(function () {
      if (location.hash !== "#/notebook" || session) return;
      drawNotebook();
    });
  }

  function drawNotebook() {
    const notes = loadNotes();
    const all = Object.keys(notes).map(function (id) {
      const n = notes[id], d = loaded[n.file];
      const q = d && d.questions[n.index];
      return { id: id, n: n, q: q };
    });
    const titles = all.map(function (x) { return x.n.title; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    const cats = all.map(function (x) { return x.n.category || "その他"; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    if (titles.indexOf(noteView.title) < 0) noteView.title = "";
    if (cats.indexOf(noteView.category) < 0) noteView.category = "";
    let list = all.filter(function (x) {
      return (!noteView.title || x.n.title === noteView.title) && (!noteView.category || (x.n.category || "その他") === noteView.category);
    });
    list.sort(function (a, b) {
      if (noteView.sort === "wrong") return (b.n.wrongCount || 0) - (a.n.wrongCount || 0) || (a.n.streak || 0) - (b.n.streak || 0);
      if (noteView.sort === "exam") return a.n.title.localeCompare(b.n.title) || a.n.index - b.n.index;
      return b.n.addedAt.localeCompare(a.n.addedAt);
    });
    const playable = list.filter(function (x) { return x.q; });
    const opt = function (v, cur, label) { return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(label) + "</option>"; };

    app.innerHTML = breadcrumb([{ label: "ジャンル", href: "#/" }, { label: "復習ノート" }]) +
      '<section class="notebook">' +
      "<h1>復習ノート <small>" + all.length + " 問</small></h1>" +
      '<div class="note-filters">' +
      '<label>試験 <select id="nfTitle">' + opt("", noteView.title, "すべて") + titles.map(function (t) { return opt(t, noteView.title, t); }).join("") + "</select></label>" +
      '<label>分野 <select id="nfCat">' + opt("", noteView.category, "すべて") + cats.map(function (t) { return opt(t, noteView.category, t); }).join("") + "</select></label>" +
      '<label>並び順 <select id="nfSort">' + opt("added", noteView.sort, "追加が新しい順") + opt("wrong", noteView.sort, "間違えた回数が多い順") +
      opt("exam", noteView.sort, "試験・問題番号順") + "</select></label></div>" +
      '<div class="note-start">' +
      '<label><input type="radio" name="nmode" value="practice" checked> 練習モード <small>（1問ごとに解説）</small></label>' +
      '<label><input type="radio" name="nmode" value="exam"> 本番モード</label>' +
      '<label><input type="checkbox" id="nShuffle" checked> 問題をシャッフル</label>' +
      '<button class="btn primary" id="nStart"' + (playable.length ? "" : " disabled") + ">表示中の " + playable.length + " 問を解く</button></div>" +
      '<div class="answers">' + list.map(function (x) {
        const n = x.n, q = x.q;
        const badges = '<span class="badge ' + (n.reason === "wrong" ? "ng" : "") + '">' + (n.reason === "wrong" ? "間違えた問題" : "手動で追加") + "</span>" +
          (n.wrongCount ? '<span class="badge ng">不正解 ' + n.wrongCount + " 回</span>" : "") +
          (n.streak ? '<span class="badge ok">連続正解 ' + n.streak + " 回</span>" : "");
        const order = q ? q.choices.map(function (_, k) { return k; }) : [];
        return '<details class="ans note-item" data-id="' + esc(x.id) + '">' +
          "<summary>" + (n.category ? '<span class="tag">' + esc(n.category) + "</span> " : "") +
          esc(n.title) + " 問" + (n.index + 1) + "　" + esc((q ? q.text : n.text).split("\n")[0].slice(0, 50)) +
          '<span class="badges">' + badges + "</span></summary>" +
          (q ? answerDetailHtml(q, order, null) : '<p class="error">問題データを読み込めませんでした（' + esc(n.file) + "）。</p>") +
          '<label class="memo">メモ<textarea rows="2" placeholder="覚え方・間違えた理由など">' + esc(n.memo || "") + "</textarea></label>" +
          '<div class="ans-tools"><button class="btn danger-outline" data-remove>ノートから外す</button></div>' +
          "</details>";
      }).join("") + "</div>" +
      '<p class="note-foot"><button class="btn danger-outline" id="nClear">ノートを空にする</button></p></section>';

    document.getElementById("nfTitle").onchange = function (ev) { noteView.title = ev.target.value; drawNotebook(); };
    document.getElementById("nfCat").onchange = function (ev) { noteView.category = ev.target.value; drawNotebook(); };
    document.getElementById("nfSort").onchange = function (ev) { noteView.sort = ev.target.value; drawNotebook(); };
    app.querySelectorAll(".note-item").forEach(function (el) {
      const id = el.dataset.id;
      el.querySelector("textarea").oninput = function (ev) {
        const all2 = loadNotes();
        if (all2[id]) { all2[id].memo = ev.target.value; saveNotes(all2); }
      };
      el.querySelector("[data-remove]").onclick = function () {
        const all2 = loadNotes(); delete all2[id]; saveNotes(all2);
        Object.keys(all2).length ? drawNotebook() : renderNotebook();
      };
    });
    document.getElementById("nClear").onclick = function () {
      if (confirm("復習ノートの問題をすべて削除します。よろしいですか？")) { saveNotes({}); renderNotebook(); }
    };
    document.getElementById("nStart").onclick = function () {
      startExam(null, null, null, {
        title: "復習ノート", timeLimit: 0, passingRate: null,
        questions: playable.map(function (x) { return x.q; }),
        refs: playable.map(function (x) { return { file: x.n.file, index: x.n.index, title: x.n.title }; })
      }, {
        practice: document.querySelector('input[name="nmode"]:checked').value === "practice",
        shuffleQ: document.getElementById("nShuffle").checked,
        shuffleC: false, noTimer: true, autoNote: false
      });
    };
  }

  // ---------- ルーティング ----------
  function route() {
    if (session) {
      // 受験中に戻る操作をされた場合
      if (!confirm("受験を中断しますか？（解答は破棄されます）")) {
        history.replaceState(null, "", session.notebook ? "#/notebook" : "#/" + [session.g.id, session.e.id, session.y.id].join("/"));
        return;
      }
      clearInterval(timerId); timerId = null; session = null; window.onbeforeunload = null;
      document.body.classList.remove("in-exam");
    }
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    window.scrollTo(0, 0);
    if (parts[0] === "notebook") return renderNotebook();
    const g = findGenre(parts[0]), e = findExam(g, parts[1]), y = findYear(e, parts[2]);
    window.scrollTo(0, 0);
    if (y) return renderStart(g, e, y);
    if (e) return renderYears(g, e);
    if (g) return renderExams(g);
    renderGenres();
  }

  document.getElementById("brand").onclick = function (ev) { ev.preventDefault(); location.hash = "#/"; };
  window.addEventListener("hashchange", route);
  // 現在と同じ URL へのリンク（例: 復習ノートの結果 → 復習ノート）は hashchange が起きないので再描画する
  document.addEventListener("click", function (ev) {
    const a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (a && a.getAttribute("href") === location.hash && !session) { ev.preventDefault(); route(); }
  });
  updateNoteLink();
  route();
})();
