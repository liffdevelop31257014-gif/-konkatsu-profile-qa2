/* ============================================================
   婚活自己開示QA Part2 – app.js
   ============================================================ */

const LIFF_ID   = "2010312230-bBsE4hSS";
const DRAFT_KEY = "konkatsu_qa_part2_draft";

/* Part3への案内メッセージ（送信＆共有完了後にトーク画面へ送信） */
/* ※ Part3のLIFF IDが確定したらURLを差し替えてください */
const NEXT_PART_MESSAGE =
  "次は自己開示QA part3を答えてみましょう！\n→ https://liff.line.me/YOUR_PART3_LIFF_ID";

/* ------------------------------------------------------------
   URLセーフ Base64（圧縮対応）
   JSON文字列を pako（deflate）で圧縮し、バイナリをURLセーフな
   Base64に変換することで共有URLを大幅に短縮する。
   pako が読み込めない環境では非圧縮のBase64にフォールバックする。
   ------------------------------------------------------------ */
function uint8ToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64UrlToUint8(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad    = padded.length % 4;
  const fixed  = pad ? padded + "=".repeat(4 - pad) : padded;
  const binary = atob(fixed);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(str) {
  try {
    if (typeof pako !== "undefined") {
      const compressed = pako.deflate(str);
      return "z" + uint8ToBase64Url(compressed); // "z"=圧縮フォーマットの目印
    }
  } catch (e) {
    console.warn("pako compress failed, fallback to plain encode", e);
  }
  // フォールバック（非圧縮）
  return "p" + btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64UrlDecode(str) {
  const flag = str.charAt(0);
  const body = str.slice(1);

  if (flag === "z") {
    const bytes = base64UrlToUint8(body);
    return pako.inflate(bytes, { to: "string" });
  }

  // flag === "p"（非圧縮フォールバック）。旧バージョンの目印なし文字列にも対応。
  const target = flag === "p" ? body : str;
  const padded = target.replace(/-/g, "+").replace(/_/g, "/");
  const pad    = padded.length % 4;
  const fixed  = pad ? padded + "=".repeat(4 - pad) : padded;
  return decodeURIComponent(escape(atob(fixed)));
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------
   ランキング選択肢一覧（共有URL短縮のため、テキストの代わりに
   インデックス番号でやり取りする）
   ------------------------------------------------------------ */
const Q9_OPTIONS = [
  "家賃",
  "食費",
  "会社での飲み会代",
  "友人との食事代、飲み会代",
  "旅行代",
  "プレゼント代",
  "衣服や美容にかけるお金",
  "動画配信などのサブスク代",
  "その他趣味に使うお金",
  "その他",
];

const Q11_OPTIONS = [
  "会う頻度、連絡頻度が多い",
  "誉め言葉や感謝の言葉をたくさんくれる",
  "プレゼント",
  "私がお願いしたことを手伝ってくれる",
  "スキンシップ",
];

const Q12_OPTIONS = [
  "容姿の中で、身長や寝起きの顔など生まれつきの要素に関して褒めてくれる",
  "容姿の中で、体型や髪型、服装などある程度自身で変えられるところに関して褒めてくれる",
  "優しい",
  "おもしろい",
  "頭がいい、博識",
  "お店選びや買い物などのセンスがいい",
  "気が利く、思いやりがある",
  "仕事など個人的な努力について褒めてくれる",
  "「作った料理がおいしい」など2人での生活のために頑張ったことについて褒めてくれる",
  "「生きているだけで偉い」のようにとにかく何でも褒めてくれる",
];

/* ------------------------------------------------------------
   ランキングUI制御
   各ランキンググループごとに「選択順」を配列で保持する。
   クリック：
     - 未選択 → 末尾に追加し、その順位番号を表示
     - 選択済み → 配列から除去し、それより後ろの順位番号を1つずつ繰り上げる
   ------------------------------------------------------------ */
const rankingState = {
  q9: [],
  q11: [],
  q12: [],
};

function rankingKey(groupId) {
  if (groupId === "q9Ranking")  return "q9";
  if (groupId === "q11Ranking") return "q11";
  if (groupId === "q12Ranking") return "q12";
  return null;
}

function setupRankingGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;

  const key = rankingKey(groupId);
  if (!key) return;

  group.querySelectorAll(".rank-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.value;
      const arr   = rankingState[key];
      const idx   = arr.indexOf(value);

      if (idx === -1) {
        arr.push(value);
      } else {
        arr.splice(idx, 1);
      }

      renderRankingGroup(groupId);
    });
  });
}

function renderRankingGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;

  const key = rankingKey(groupId);
  if (!key) return;
  const arr = rankingState[key];

  group.querySelectorAll(".rank-option").forEach((btn) => {
    const value = btn.dataset.value;
    const order = arr.indexOf(value);
    const numEl = btn.querySelector(".rank-number");

    if (order === -1) {
      btn.classList.remove("selected");
      numEl.textContent = "";
    } else {
      btn.classList.add("selected");
      numEl.textContent = String(order + 1);
    }
  });
}

function resetRankingGroup(groupId) {
  const key = rankingKey(groupId);
  if (!key) return;
  rankingState[key] = [];
  renderRankingGroup(groupId);
}

/* ------------------------------------------------------------
   下書きからのランキング復元
   保存されていた値のうち、現在その選択肢グループに実在する
   data-value のみを採用する（選択肢が変更された場合に順位が
   ずれてしまう不具合を防ぐ）
   ------------------------------------------------------------ */
function restoreRankingGroup(groupId, savedOrder) {
  const key = rankingKey(groupId);
  if (!key) return;

  const group = document.getElementById(groupId);
  const validValues = group
    ? Array.from(group.querySelectorAll(".rank-option")).map(btn => btn.dataset.value)
    : [];

  const filtered = Array.isArray(savedOrder)
    ? savedOrder.filter(v => validValues.includes(v))
    : [];

  rankingState[key] = filtered;
  renderRankingGroup(groupId);
}

/* ------------------------------------------------------------
   フォーム値の収集
   ------------------------------------------------------------ */
function collectFormData() {
  const q1Radio = document.querySelector('input[name="q1"]:checked');
  const q2Radio = document.querySelector('input[name="q2"]:checked');
  const q3Radio = document.querySelector('input[name="q3"]:checked');
  const q4Radio = document.querySelector('input[name="q4"]:checked');
  const q8Radio = document.querySelector('input[name="q8"]:checked');

  return {
    q1:  q1Radio ? q1Radio.value : "",
    q2:  q2Radio ? q2Radio.value : "",
    q3:  q3Radio ? q3Radio.value : "",
    q4:  q4Radio ? q4Radio.value : "",
    q5:  document.getElementById("q5").value,
    q6:  document.getElementById("q6").value,
    q7:  document.getElementById("q7").value,
    q8:  q8Radio ? q8Radio.value : "",
    q9:  rankingState.q9.slice(),
    q10: document.getElementById("q10").value,
    q11: rankingState.q11.slice(),
    q12: rankingState.q12.slice(),
  };
}

/* ------------------------------------------------------------
   フォームへの値の復元
   ------------------------------------------------------------ */
function restoreFormData(data) {
  if (!data) return;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  };

  setText("q5",  data.q5);
  setText("q6",  data.q6);
  setText("q7",  data.q7);
  setText("q10", data.q10);

  if (data.q1) {
    const r = document.querySelector(`input[name="q1"][value="${data.q1}"]`);
    if (r) r.checked = true;
  }
  if (data.q2) {
    const r = document.querySelector(`input[name="q2"][value="${data.q2}"]`);
    if (r) r.checked = true;
  }
  if (data.q3) {
    const r = document.querySelector(`input[name="q3"][value="${data.q3}"]`);
    if (r) r.checked = true;
  }
  if (data.q4) {
    const r = document.querySelector(`input[name="q4"][value="${data.q4}"]`);
    if (r) r.checked = true;
  }
  if (data.q8) {
    const r = document.querySelector(`input[name="q8"][value="${data.q8}"]`);
    if (r) r.checked = true;
  }

  restoreRankingGroup("q9Ranking",  data.q9);
  restoreRankingGroup("q11Ranking", data.q11);
  restoreRankingGroup("q12Ranking", data.q12);
}

/* ------------------------------------------------------------
   バリデーション（本送信時のみ）
   ------------------------------------------------------------ */
function validate(data) {
  const errors = [];

  if (!data.q1)        errors.push("Q1: 過去・未来どちらに行きたいか選択してください。");
  if (!data.q2)        errors.push("Q2: 喧嘩の頻度を選択してください。");
  if (!data.q3)        errors.push("Q3: 旅行の計画について選択してください。");
  if (!data.q4)        errors.push("Q4: 旅行中やデート中の別行動について選択してください。");
  if (!data.q5.trim()) errors.push("Q5: 1年後までにしたいことを入力してください。");
  if (!data.q6.trim()) errors.push("Q6: 5年後までにしたいことを入力してください。");
  if (!data.q7.trim()) errors.push("Q7: 定年退職後にしたいことを入力してください。");
  if (!data.q8)        errors.push("Q8: 宝くじ3億円が当たったらどうするか選択してください。");

  const q9Total  = document.querySelectorAll("#q9Ranking .rank-option").length;
  const q11Total = document.querySelectorAll("#q11Ranking .rank-option").length;
  const q12Total = document.querySelectorAll("#q12Ranking .rank-option").length;

  if (data.q9.length  < q9Total)  errors.push("Q9: すべての選択肢を順位付けしてください。");
  if (!data.q10.trim())           errors.push("Q10: 苦手な状況や言動について入力してください。");
  if (data.q11.length < q11Total) errors.push("Q11: すべての選択肢を順位付けしてください。");
  if (data.q12.length < q12Total) errors.push("Q12: すべての選択肢を順位付けしてください。");

  return errors;
}

/* ------------------------------------------------------------
   共有URL短縮用：キー名を1文字に変換するマッピング
   ------------------------------------------------------------ */
const SHARE_KEY_MAP = {
  q1: "a", q2: "b", q3: "c", q4: "d", q5: "e", q6: "f",
  q7: "g", q8: "h", q9: "i", q10: "j", q11: "k", q12: "l",
  _shareName: "zz",
};
const SHARE_KEY_MAP_REVERSE = Object.fromEntries(
  Object.entries(SHARE_KEY_MAP).map(([k, v]) => [v, k])
);

/* ------------------------------------------------------------
   回答データ → 共有URL（URLセーフBase64・キー短縮）
   Q9/Q11/Q12はテキストではなくインデックス番号で持たせてURLを短縮する
   ------------------------------------------------------------ */
function encodeDataToURL(data) {
  const compact = {
    ...data,
    q9:  data.q9.map((v)  => Q9_OPTIONS.indexOf(v)),
    q11: data.q11.map((v) => Q11_OPTIONS.indexOf(v)),
    q12: data.q12.map((v) => Q12_OPTIONS.indexOf(v)),
  };

  const shortData = {};
  Object.keys(compact).forEach((key) => {
    const shortKey = SHARE_KEY_MAP[key] || key;
    shortData[shortKey] = compact[key];
  });

  const encoded = base64UrlEncode(JSON.stringify(shortData));
  const base    = location.href.split("?")[0].split("#")[0];
  return `${base}?share=${encoded}`;
}

/* ------------------------------------------------------------
   URL → 回答データ（ビューモード・キー復元）
   インデックス番号 → 選択肢テキストに復元する
   ------------------------------------------------------------ */
function decodeDataFromURL() {
  const params = new URLSearchParams(location.search);
  const raw    = params.get("share");
  if (!raw) return null;
  try {
    const shortData = JSON.parse(base64UrlDecode(raw));
    const data = {};
    Object.keys(shortData).forEach((key) => {
      const longKey = SHARE_KEY_MAP_REVERSE[key] || key;
      data[longKey] = shortData[key];
    });

    if (Array.isArray(data.q9))  data.q9  = data.q9.map((i)  => Q9_OPTIONS[i]).filter(Boolean);
    if (Array.isArray(data.q11)) data.q11 = data.q11.map((i) => Q11_OPTIONS[i]).filter(Boolean);
    if (Array.isArray(data.q12)) data.q12 = data.q12.map((i) => Q12_OPTIONS[i]).filter(Boolean);

    return data;
  } catch (e) {
    console.error("URL decode error", e);
    return null;
  }
}

/* ------------------------------------------------------------
   ランキング配列 → 「1位：◯◯」形式のHTML（昇順）
   ------------------------------------------------------------ */
function rankingListHTML(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "未回答";

  return arr
    .map((item, i) => `${i + 1}位：${escapeHTML(item)}`)
    .join("<br>");
}

/* ------------------------------------------------------------
   ビューモード：回答をカード表示
   ------------------------------------------------------------ */
function renderViewMode(data, options = {}) {
  const { selfPreview = false, onShare = null } = options;

  const q1Labels = {
    "past":   "過去",
    "future": "未来",
  };

  const q2Labels = {
    "a2-1": "毎日のようにしていた、時々手が出ることもあった",
    "a2-2": "毎日のようにしていたが口喧嘩のみ",
    "a2-3": "たまにしていた、時々手が出ることもあった",
    "a2-4": "たまにしていたが口喧嘩のみ",
    "a2-5": "年に1~2回程度していた",
    "a2-6": "喧嘩した記憶がない、ほとんどない",
  };

  const q3Labels = {
    "a3-1": "行き当たりばったりがいい",
    "a3-2": "周りの計画に乗っかることが多い",
    "a3-3": "あらかじめ調べて決めておくのが楽しい",
  };

  const q4Labels = {
    "a4-1": "別行動はしたくない",
    "a4-2": "目の届く範囲内なら良い（たとえば同じフロア内の少し離れた展示を見るなど）",
    "a4-3": "同じ施設内なら目の届かない距離でも良い",
    "a4-4": "数時間以内なら時間を決めて別行動でも構わない",
    "a4-5": "2泊以上の旅行で丸一日別行動の日があっても構わない",
  };

  const q8Labels = {
    "a8-1": "仕事をやめ(セミFIRE含む) 当選金額で生活する",
    "a8-2": "大きな金額のものを買う",
    "a8-3": "すぐには生活を変えずに貯めておく",
    "a8-4": "寄付する",
  };

  const rows = [
    { q: "Q1 タイムスリップができるなら過去と未来どちらに行きたいですか？",
      a: q1Labels[data.q1] || "未回答" },
    { q: "Q2 子どもの頃、兄弟げんかや親子げんかはする方でしたか？",
      a: q2Labels[data.q2] || "未回答" },
    { q: "Q3 旅行は計画立てて行くのが好きですか？行き当たりばったりがいいですか？",
      a: q3Labels[data.q3] || "未回答" },
    { q: "Q4 旅行中やデート中の別行動はしても平気なタイプですか？",
      a: q4Labels[data.q4] || "未回答" },
    { q: "Q5 1年後までに個人的にしたいことはありますか？", a: data.q5 || "未回答" },
    { q: "Q6 5年後までに個人的にしたいことはありますか？", a: data.q6 || "未回答" },
    { q: "Q7 定年退職後ぐらいの年齢で個人的にしたいことはありますか？", a: data.q7 || "未回答" },
    { q: "Q8 もし宝くじ3億円が当たったらどうしますか？",
      a: q8Labels[data.q8] || "未回答" },
    { q: "Q9 業績不振により給料が減ることになった場合、支出を削ってもいいと思う順番",
      html: rankingListHTML(data.q9) },
    { q: "Q10 これだけは苦手または生理的に受け付けないというシチュエーションや他人の言動はありますか？",
      a: data.q10 || "未回答" },
    { q: "Q11 次の愛情表現について、嬉しい順",
      html: rankingListHTML(data.q11) },
    { q: "Q12 デートや日常生活のなかでパートナーからなんて褒められるのが嬉しいですか？",
      html: rankingListHTML(data.q12) },
  ];

  // フォーム要素を非表示
  document.querySelectorAll(
    ".container > label, .container > input, .container > textarea, " +
    ".container > div.ranking-group, .container > div.button-group, " +
    ".container > div#shareModal"
  ).forEach(el => (el.style.display = "none"));

  // 自分自身（このLIFFアプリ）の回答フォームURL
  const formURL = location.href.split("?")[0].split("#")[0];

  // 共有画面（ビューモード）の上部注意書きを差し替える
  const descEl = document.querySelector(".form-header .form-description");
  if (descEl) {
    descEl.innerHTML =
      "回答を共有してお互いのことを知りましょう。<br>" +
      "回答内容だけじゃなく、なぜそう思ってるのか、この場合はどう変わるかなども質問し合ってみましょう。";
  }

  const container = document.getElementById("viewMode");
  container.style.display = "block";
  container.innerHTML = `
    ${selfPreview ? `
    <div class="cta-card share-confirm-card">
      <div class="cta-content" style="text-align:center;">
        <h3 class="cta-title">この内容を共有します</h3>
        <p class="cta-text">
          内容を確認したら、共有先を選んでください。
        </p>
        <button type="button" id="goShareBtn" class="cta-button">
          共有先を選ぶ <span class="cta-arrow">›</span>
        </button>
      </div>
    </div>
    ` : ""}

    ${!selfPreview ? `
    <div class="view-header">
      <p class="view-label">回答内容</p>
      ${data._shareName ? `<p class="view-name">${escapeHTML(data._shareName)} さんの回答</p>` : ""}
    </div>
    ` : ""}

    ${rows.map(({ q, a, html }) => `
      <div class="view-item">
        <p class="view-question">${escapeHTML(q)}</p>
        <p class="view-answer">${html ? html : escapeHTML(a).replace(/\n/g, "<br>")}</p>
      </div>
    `).join("")}

    ${!selfPreview ? `
    <div class="cta-card">
      <img src="image1.PNG" class="cta-image-left" alt="">
      <div class="cta-content">
        <h3 class="cta-title">あなたの価値観も共有してみませんか？</h3>
        <p class="cta-text">
          婚活・交際前の自己開示は、<br>
          お互いを知る大切なきっかけになります。<br>
          あなたの考えや価値観をアンケートで伝えてみましょう。
        </p>
        <button type="button" id="ctaButton" class="cta-button" data-href="${formURL}">
          私も回答する <span class="cta-arrow">›</span>
        </button>
      </div>
    </div>
    ` : ""}
  `;

  if (selfPreview) {
    const goShareBtn = document.getElementById("goShareBtn");
    if (goShareBtn && typeof onShare === "function") {
      goShareBtn.addEventListener("click", onShare);
    }
    return;
  }

  const ctaButton = document.getElementById("ctaButton");
  if (ctaButton) {
    ctaButton.addEventListener("click", () => {
      if (confirm("自己開示QA part2を開く")) {
        window.location.href = ctaButton.dataset.href;
      }
    });
  }
}

/* ------------------------------------------------------------
   共有メッセージを本人のトーク画面にも送信する
   （共有相手に送るのと同じ文言）
   liff.sendMessages は、LIFFアプリが公式アカウントとのトーク画面
   から開かれている場合のみ利用可能（サーバー処理不要）。
   利用できない場合は何もしない。
   ------------------------------------------------------------ */
async function sendShareMessageToSelf(previewMsg) {
  try {
    if (liff.isInClient() && liff.isApiAvailable("sendMessages")) {
      await liff.sendMessages([
        { type: "text", text: previewMsg }
      ]);
    }
  } catch (e) {
    console.warn("sendMessages (self) skipped:", e);
  }
}

/* ------------------------------------------------------------
   Part3への案内メッセージをトーク画面に送信
   ------------------------------------------------------------ */
async function sendNextPartMessage() {
  try {
    if (liff.isInClient() && liff.isApiAvailable("sendMessages")) {
      await liff.sendMessages([
        { type: "text", text: NEXT_PART_MESSAGE }
      ]);
    }
  } catch (e) {
    console.warn("sendMessages skipped:", e);
  }
}

/* ------------------------------------------------------------
   メイン処理
   ------------------------------------------------------------ */
(async () => {

  /* ----- ビューモード判定（LIFFログイン不要） ----- */
  const sharedData = decodeDataFromURL();
  if (sharedData) {
    renderViewMode(sharedData);
    return;
  }

  /* ----- LIFF 初期化 ----- */
  try {
    await liff.init({ liffId: LIFF_ID });
  } catch (e) {
    console.error("LIFF init failed", e);
    alert("LIFFの初期化に失敗しました。");
    return;
  }

  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }

  /* ----- ランキングUIの初期化 ----- */
  setupRankingGroup("q9Ranking");
  setupRankingGroup("q11Ranking");
  setupRankingGroup("q12Ranking");

  /* ----- localStorage から下書き復元 ----- */
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) restoreFormData(JSON.parse(saved));
  } catch (_) {}

  /* ----- 下書き保存 ----- */
  document.getElementById("draftBtn").addEventListener("click", () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(collectFormData()));
      alert("下書きを保存しました。");
    } catch (_) {
      alert("下書きの保存に失敗しました。");
    }
  });

  /* ----- フォームクリア ----- */
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (!confirm("入力内容をすべてクリアしますか？")) return;

    ["q5","q6","q7","q10"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    document.querySelectorAll('input[type="radio"]').forEach(r => (r.checked = false));

    resetRankingGroup("q9Ranking");
    resetRankingGroup("q11Ranking");
    resetRankingGroup("q12Ranking");

    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  });

  /* ----- 送信ボタン ----- */
  document.getElementById("submitBtn").addEventListener("click", () => {
    const data   = collectFormData();
    const errors = validate(data);

    if (errors.length > 0) {
      alert("以下の項目を入力してください。\n\n" + errors.join("\n"));
      return;
    }

    // 前回の回答として保存（次回編集時に復元できるようにする）
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (_) {}

    const modal = document.getElementById("shareModal");
    modal.classList.remove("hidden");
    modal.classList.add("show");

    document.getElementById("submitBtn").disabled = true;
  });

  /* ----- 共有ボタン ----- */
  document.getElementById("shareBtn").addEventListener("click", async () => {
    const shareName = document.getElementById("shareName").value.trim();
    const data      = collectFormData();
    data._shareName = shareName;

    const shareURL   = encodeDataToURL(data);
    const previewMsg = shareName
      ? `${shareName}さんの婚活　自己開示QA part2の回答が届きました。\n回答をみる→${shareURL}`
      : `婚活　自己開示QA part2の回答が届きました。\n回答をみる→${shareURL}`;

    // モーダルを閉じる
    const modal = document.getElementById("shareModal");
    modal.classList.remove("show");
    modal.classList.add("hidden");

    // 送信＆共有完了 → 本人にも共有URLを送信し、続けてPart3への案内も送信
    // （liff.sendMessages はページ遷移前に呼び出す必要があるため先に実行）
    await sendShareMessageToSelf(previewMsg);
    await sendNextPartMessage();

    // まず本人の画面を「回答内容」プレビューに切り替える
    renderViewMode(data, {
      selfPreview: true,
      onShare: () => {
        const lineShareURL = `https://line.me/R/msg/text/?${encodeURIComponent(previewMsg)}`;

        if (liff.isInClient()) {
          window.location.href = lineShareURL;
        } else {
          window.open(lineShareURL, "_blank");
        }
      },
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ----- モーダル外クリックで閉じる ----- */
  document.getElementById("shareModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove("show");
      e.currentTarget.classList.add("hidden");
    }
  });

})();
