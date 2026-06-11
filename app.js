/* ============================================================
   婚活自己開示QA Part2 – app.js
   ============================================================ */

const LIFF_ID   = "YOUR_LIFF_ID"; // ← 実際のLIFF IDに差し替えてください
const DRAFT_KEY = "konkatsu_qa_part2_draft";

/* ------------------------------------------------------------
   URLセーフ Base64 エンコード／デコード
   ------------------------------------------------------------ */
function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
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
const Q7_OPTIONS = [
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

const Q8_OPTIONS = [
  "会う頻度、連絡頻度が多い",
  "誉め言葉や感謝の言葉をたくさんくれる",
  "プレゼント",
  "私がお願いしたことを手伝ってくれる",
  "スキンシップ",
];

/* ------------------------------------------------------------
   ランキングUI制御
   各ランキンググループごとに「選択順」を配列で保持する。
   クリック：
     - 未選択 → 末尾に追加し、その順位番号を表示
     - 選択済み → 配列から除去し、それより後ろの順位番号を1つずつ繰り上げる
   ------------------------------------------------------------ */
const rankingState = {
  q7: [],
  q8: [],
};

function setupRankingGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;

  const key = groupId === "q7Ranking" ? "q7" : "q8";

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

  const key = groupId === "q7Ranking" ? "q7" : "q8";
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
  const key = groupId === "q7Ranking" ? "q7" : "q8";
  rankingState[key] = [];
  renderRankingGroup(groupId);
}

function restoreRankingGroup(groupId, savedOrder) {
  const key = groupId === "q7Ranking" ? "q7" : "q8";
  rankingState[key] = Array.isArray(savedOrder) ? savedOrder.slice() : [];
  renderRankingGroup(groupId);
}

/* ------------------------------------------------------------
   フォーム値の収集
   ------------------------------------------------------------ */
function collectFormData() {
  const q1Radio = document.querySelector('input[name="q1"]:checked');
  const q2Radio = document.querySelector('input[name="q2"]:checked');
  const q6Radio = document.querySelector('input[name="q6"]:checked');

  return {
    q1: q1Radio ? q1Radio.value : "",
    q2: q2Radio ? q2Radio.value : "",
    q3: document.getElementById("q3").value,
    q4: document.getElementById("q4").value,
    q5: document.getElementById("q5").value,
    q6: q6Radio ? q6Radio.value : "",
    q7: rankingState.q7.slice(),
    q8: rankingState.q8.slice(),
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

  setText("q3", data.q3);
  setText("q4", data.q4);
  setText("q5", data.q5);

  if (data.q1) {
    const r = document.querySelector(`input[name="q1"][value="${data.q1}"]`);
    if (r) r.checked = true;
  }
  if (data.q2) {
    const r = document.querySelector(`input[name="q2"][value="${data.q2}"]`);
    if (r) r.checked = true;
  }
  if (data.q6) {
    const r = document.querySelector(`input[name="q6"][value="${data.q6}"]`);
    if (r) r.checked = true;
  }

  restoreRankingGroup("q7Ranking", data.q7);
  restoreRankingGroup("q8Ranking", data.q8);
}

/* ------------------------------------------------------------
   バリデーション（本送信時のみ）
   ------------------------------------------------------------ */
function validate(data) {
  const errors = [];

  if (!data.q1) errors.push("Q1: 過去・未来どちらに行きたいか選択してください。");
  if (!data.q2) errors.push("Q2: 喧嘩の頻度を選択してください。");
  if (!data.q3.trim()) errors.push("Q3: 1年後までにしたいことを入力してください。");
  if (!data.q4.trim()) errors.push("Q4: 5年後までにしたいことを入力してください。");
  if (!data.q5.trim()) errors.push("Q5: 定年退職後にしたいことを入力してください。");
  if (!data.q6) errors.push("Q6: 宝くじ3億円が当たったらどうするか選択してください。");

  const q7Total = document.querySelectorAll("#q7Ranking .rank-option").length;
  const q8Total = document.querySelectorAll("#q8Ranking .rank-option").length;

  if (data.q7.length < q7Total) errors.push("Q7: すべての選択肢を順位付けしてください。");
  if (data.q8.length < q8Total) errors.push("Q8: すべての選択肢を順位付けしてください。");

  return errors;
}

/* ------------------------------------------------------------
   回答データ → 共有URL（URLセーフBase64）
   Q7/Q8はテキストではなくインデックス番号で持たせてURLを短縮する
   ------------------------------------------------------------ */
function encodeDataToURL(data) {
  const compact = {
    ...data,
    q7: data.q7.map((v) => Q7_OPTIONS.indexOf(v)),
    q8: data.q8.map((v) => Q8_OPTIONS.indexOf(v)),
  };
  const encoded = base64UrlEncode(JSON.stringify(compact));
  const base    = location.href.split("?")[0].split("#")[0];
  return `${base}?share=${encoded}`;
}

/* ------------------------------------------------------------
   URL → 回答データ（ビューモード）
   インデックス番号 → 選択肢テキストに復元する
   ------------------------------------------------------------ */
function decodeDataFromURL() {
  const params = new URLSearchParams(location.search);
  const raw    = params.get("share");
  if (!raw) return null;
  try {
    const data = JSON.parse(base64UrlDecode(raw));
    if (Array.isArray(data.q7)) data.q7 = data.q7.map((i) => Q7_OPTIONS[i]).filter(Boolean);
    if (Array.isArray(data.q8)) data.q8 = data.q8.map((i) => Q8_OPTIONS[i]).filter(Boolean);
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
function renderViewMode(data) {
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

  const q6Labels = {
    "a6-1": "仕事をやめ(セミFIRE含む) 当選金額で生活する",
    "a6-2": "大きな金額のものを買う",
    "a6-3": "すぐには生活を変えずに貯めておく",
    "a6-4": "寄付する",
  };

  const rows = [
    { q: "Q1 タイムスリップができるなら過去と未来どちらに行きたいですか？",
      a: q1Labels[data.q1] || "未回答" },
    { q: "Q2 子どもの頃、兄弟げんかや親子げんかはする方でしたか？",
      a: q2Labels[data.q2] || "未回答" },
    { q: "Q3 1年後までに個人的にしたいことはありますか？", a: data.q3 || "未回答" },
    { q: "Q4 5年後までに個人的にしたいことはありますか？", a: data.q4 || "未回答" },
    { q: "Q5 定年退職後ぐらいの年齢で個人的にしたいことはありますか？", a: data.q5 || "未回答" },
    { q: "Q6 もし宝くじ3億円が当たったらどうしますか？",
      a: q6Labels[data.q6] || "未回答" },
    { q: "Q7 業績不振により給料が減ることになった場合、支出を削ってもいいと思う順番",
      html: rankingListHTML(data.q7) },
    { q: "Q8 次の愛情表現について、嬉しい順",
      html: rankingListHTML(data.q8) },
  ];

  // フォーム要素を非表示
  document.querySelectorAll(
    ".container > label, .container > input, .container > textarea, " +
    ".container > div.ranking-group, .container > div.button-group, " +
    ".container > div#shareModal"
  ).forEach(el => (el.style.display = "none"));

  const container = document.getElementById("viewMode");
  container.style.display = "block";
  container.innerHTML = `
    <div class="view-header">
      <p class="view-label">回答内容</p>
      ${data._shareName ? `<p class="view-name">${escapeHTML(data._shareName)} さんの回答</p>` : ""}
    </div>
    ${rows.map(({ q, a, html }) => `
      <div class="view-item">
        <p class="view-question">${escapeHTML(q)}</p>
        <p class="view-answer">${html ? html : escapeHTML(a).replace(/\n/g, "<br>")}</p>
      </div>
    `).join("")}
  `;
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
  setupRankingGroup("q7Ranking");
  setupRankingGroup("q8Ranking");

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

    ["q3","q4","q5"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    document.querySelectorAll('input[type="radio"]').forEach(r => (r.checked = false));

    resetRankingGroup("q7Ranking");
    resetRankingGroup("q8Ranking");

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
  document.getElementById("shareBtn").addEventListener("click", () => {
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

    const lineShareURL = `https://line.me/R/msg/text/?${encodeURIComponent(previewMsg)}`;

    if (liff.isInClient()) {
      window.location.href = lineShareURL;
    } else {
      window.open(lineShareURL, "_blank");
    }
  });

  /* ----- モーダル外クリックで閉じる ----- */
  document.getElementById("shareModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove("show");
      e.currentTarget.classList.add("hidden");
    }
  });

})();
