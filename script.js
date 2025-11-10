// ----------------------------
// 1. 単語問題生成
// ----------------------------

// 単語リスト（例として簡略化。実際は1000個以上用意）
const words = [
  "ねこ","いぬ","とり","ひと","やま","かわ","まち","くるま","でんしゃ","がっこう",
  "さかな","はな","くさ","とけい","ほん","つくえ","いす","みず","そら","たいよう",
  "き","み","あし","はし","かぜ","ゆき","ひかり","つき","ほし","かお",
  "みみ","くち","め","て","あたま","てんき","そと","うみ","やさい","くだもの",
  "さくら","もも","ばら","うめ","きりん","ぞう","さる","とら","うま","ねずみ",
  "とけい","はなび","かばん","えんぴつ","じしょ","がっき","ほんだな","まくら","いえ","へや",
  "みせ","えき","こうえん","びょういん","がっこう","しんぶん","でんわ",
  "えいが","うた","おんがく","しごと","やすみ","きょう","あした","きのう","せんせい","がくせい",
  "ともだち","かぞく","いしゃ","けんきゅうしゃ","せいと","せんぱい","こうはい","かいしゃ","まち","むら",
  "かわ","うみ","やま","もり","はな","き","くさ","そら","たいよう","つき"
];

function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// 問題を単語単位で生成
function generateProblems(count){
  let problems = [];
  for(let i=0;i<count;i++){
    problems.push(choice(words)); // 1問 = 単語1つ
  }
  return problems;
}

// ----------------------------
// 2. DOM
// ----------------------------
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const startScreen = document.getElementById("startScreen");
const gameArea = document.getElementById("gameArea");
const scoreScreen = document.getElementById("scoreScreen");
const problemDiv = document.getElementById("problem");
const input = document.getElementById("input");
const qNum = document.getElementById("questionNumber");
const acc = document.getElementById("accuracy");
const speed = document.getElementById("speed");
const avgTime = document.getElementById("avgTime");
const avgAccuracy = document.getElementById("avgAccuracy");
const avgSpeed = document.getElementById("avgSpeed");
const finalScore = document.getElementById("finalScore");
const keyboardDiv = document.getElementById("keyboard");
const howTo = document.getElementById("howTo");

let problems=[], current=0, startTime=null;
let totalTime=0, totalAccuracy=0, totalSpeed=0;
let targetGraphemes=[]; // 現在の問題文をグラフェム単位に分割した配列
let wrongIndices = new Set(); // 今問で一度でも赤くなったインデックス
let typedKanaString = ""; // 物理キー入力から変換したかな文字列（入力モードに依存しない）

// ----------------------------
// グラフェム分割 & 正規化ユーティリティ
// ----------------------------
const segmenter = (typeof Intl !== "undefined" && Intl.Segmenter)
  ? new Intl.Segmenter("ja", { granularity: "grapheme" })
  : null;

function toGraphemes(str){
  if(segmenter){
    return Array.from(segmenter.segment(str), s => s.segment);
  }
  return Array.from(str);
}

function toNFC(str){
  try{ return str.normalize("NFC"); }catch(e){ return str; }
}

function toNFD(str){
  try{ return str.normalize("NFD"); }catch(e){ return str; }
}

function getFirstMismatchIndex(typedG, targetG){
  const n = Math.min(typedG.length, targetG.length);
  for(let i=0;i<n;i++){
    if(toNFC(typedG[i]) !== toNFC(targetG[i])) return i;
  }
  return n;
}

function getDakutenKeyFromNFD(nfd){
  if(nfd.includes("\u3099")) return "゛"; // combining voiced sound mark -> spacing dakuten
  if(nfd.includes("\u309A")) return "゜"; // combining semi-voiced -> spacing handakuten
  return null;
}

// ----------------------------
// 物理キーコードからかな文字へのマッピング（かな入力レイアウト）
// ----------------------------
const keyCodeToKana = {
  // 数字キー行
  "Digit1": "ぬ", "Digit2": "ふ", "Digit3": "あ", "Digit4": "う", "Digit5": "え",
  "Digit6": "お", "Digit7": "や", "Digit8": "ゆ", "Digit9": "よ", "Digit0": "わ",
  "Minus": "ほ", "Equal": "゜",
  // 上段
  "KeyQ": "た", "KeyW": "て", "KeyE": "い", "KeyR": "す", "KeyT": "か", "KeyY": "ん",
  "KeyU": "な", "KeyI": "に", "KeyO": "ら", "KeyP": "せ", "BracketLeft": "゛", "BracketRight": "む",
  "Backslash": "へ",
  // 中段
  "KeyA": "ち", "KeyS": "と", "KeyD": "し", "KeyF": "は", "KeyG": "き", "KeyH": "く",
  "KeyJ": "ま", "KeyK": "の", "KeyL": "り", "Semicolon": "れ", "Quote": "け",
  // 下段
  "KeyZ": "つ", "KeyX": "さ", "KeyC": "そ", "KeyV": "ひ", "KeyB": "こ", "KeyN": "み",
  "KeyM": "も", "Comma": "ね", "Period": "る", "Slash": "め",
  // 特殊キー
  "Space": " ", "Enter": "\n"
};

// Shiftキーとの組み合わせ（小文字・特殊文字）
const keyCodeToKanaShift = {
  "Digit1": "ぬ", "Digit2": "ふ", "Digit3": "ぁ", "Digit4": "ぅ", "Digit5": "ぇ",
  "Digit6": "ぉ", "Digit7": "ゃ", "Digit8": "ゅ", "Digit9": "ょ", "Digit0": "を",
  "Minus": "ほ", "Equal": "「",
  "KeyQ": "た", "KeyW": "て", "KeyE": "ぃ", "KeyR": "す", "KeyT": "か", "KeyY": "ん",
  "KeyU": "な", "KeyI": "に", "KeyO": "ら", "KeyP": "せ", "BracketLeft": "」", "BracketRight": "ー",
  "Backslash": "へ",
  "KeyA": "ち", "KeyS": "と", "KeyD": "し", "KeyF": "は", "KeyG": "き", "KeyH": "く",
  "KeyJ": "ま", "KeyK": "の", "KeyL": "り", "Semicolon": "れ", "Quote": "ろ",
  "KeyZ": "っ", "KeyX": "さ", "KeyC": "そ", "KeyV": "ひ", "KeyB": "こ", "KeyN": "み",
  "KeyM": "も", "Comma": "、", "Period": "。", "Slash": "・",
  "Space": " ", "Enter": "\n"
};

// 濁点・半濁点の処理用マッピング
const dakutenMap = {
  "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
  "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
  "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
  "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
  "カ": "ガ", "キ": "ギ", "ク": "グ", "ケ": "ゲ", "コ": "ゴ",
  "サ": "ザ", "シ": "ジ", "ス": "ズ", "セ": "ゼ", "ソ": "ゾ",
  "タ": "ダ", "チ": "ヂ", "ツ": "ヅ", "テ": "デ", "ト": "ド",
  "ハ": "バ", "ヒ": "ビ", "フ": "ブ", "ヘ": "ベ", "ホ": "ボ"
};

const handakutenMap = {
  "は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ",
  "ハ": "パ", "ヒ": "ピ", "フ": "プ", "ヘ": "ペ", "ホ": "ポ"
};

// ----------------------------
// 3. キーボード生成
// ----------------------------
const normalRows = [
  ["ぬ","ふ","あ","う","え","お","や","ゆ","よ","わ","ほ","゜"],
  ["た","て","い","す","か","ん","な","に","ら","せ","゛","む","へ"],
  ["ち","と","し","は","き","く","ま","の","り","れ","け"],
  ["つ","さ","そ","ひ","こ","み","も","ね","る","め"],
  ["Shift","Space","Enter","Backspace"]
];

const shiftRows = [
  ["ぬ","ふ","ぁ","ぅ","ぇ","ぉ","ゃ","ゅ","ょ","を","ほ","「"],
  ["た","て","ぃ","す","か","ん","な","に","ら","せ","」","ー","へ"],
  ["ち","と","し","は","き","く","ま","の","り","れ","ろ"],
  ["っ","さ","そ","ひ","こ","み","も","、","。","・"],
  ["Shift","Space","Enter","Backspace"]
];


// 濁点付き文字を分解（NFD）
function baseChar(char) {
  return char.normalize("NFD")[0]; // 先頭の基本文字を取得
}

function highlightNextKey() {
  // まず全部リセット
  document.querySelectorAll(".key").forEach(k => k.classList.remove("next"));

  const typedG = toGraphemes(typedKanaString);

  const idx = getFirstMismatchIndex(typedG, targetGraphemes);
  if (idx >= targetGraphemes.length) return; // 完了

  const targetChar = targetGraphemes[idx];
  const nfd = toNFD(targetChar);
  const base = baseChar(targetChar);

  // すでにベースだけ打たれている場合は、次に濁点/半濁点を促す
  if (typedG[idx] && toNFC(typedG[idx]) === toNFC(base)) {
    const markKey = getDakutenKeyFromNFD(nfd);
    if (markKey) {
      const el = [...document.querySelectorAll(".key")].find(k => k.dataset.key === markKey);
      if (el) el.classList.add("next");
      return;
    }
  }

  // それ以外はベース文字を促す
  let keyName = base === " " ? "Space" : base === "\n" ? "Enter" : base;
  const el = [...document.querySelectorAll(".key")].find(k => k.dataset.key === keyName);
  if (el) el.classList.add("next");
}

let shiftPressed = false;

function renderKeyboard(rows){
  const homeKeys = ["は","ま"]; // ホームポジション
  keyboardDiv.innerHTML = "";
  rows.forEach((row,rowIndex)=>{
    const rowDiv = document.createElement("div");
    rowDiv.className = "row";

    // 行ごとのインデント調整
    if(rowIndex === 0) rowDiv.classList.add("indent-first");
    if(rowIndex === 2) rowDiv.classList.add("indent-third");
    if(rowIndex === 3) rowDiv.classList.add("indent-forth");

    row.forEach(k=>{
      const span = document.createElement("span");
      span.className = k.length>1 ? "key special" : "key";
      if(homeKeys.includes(k)) span.classList.add("home"); 
      span.dataset.key = k;
      span.textContent = k==="Space"?"␣":k;
      rowDiv.appendChild(span);
    });
    keyboardDiv.appendChild(rowDiv);
  });
}

// 初期描画
renderKeyboard(normalRows);

// ----------------------------
// 4. 出題
// ----------------------------
function showProblem(){
  const text = problems[current];
  problemDiv.innerHTML="";
  targetGraphemes = toGraphemes(text);
  wrongIndices = new Set();
  typedKanaString = ""; // かな文字列をリセット
  for(let ch of targetGraphemes){
    const span = document.createElement("span");
    span.textContent=ch;
    problemDiv.appendChild(span);
  }
  input.value="";
  input.focus();
  startTime=null;
  qNum.textContent = current+1;

  highlightNextKey();
}

// ----------------------------
// 5. 入力判定（物理キー入力からかな文字への変換）
// ----------------------------

// 物理キー入力をかな文字に変換して処理
function processKanaInput(kanaChar) {
  if(!startTime) startTime = Date.now();
  
  // バックスペース処理
  if(kanaChar === "\b") {
    typedKanaString = typedKanaString.slice(0, -1);
    updateDisplay();
    return;
  }
  
  // 通常の文字入力
  if(kanaChar && kanaChar.length > 0) {
    // 濁点・半濁点の処理
    if(kanaChar === "゛") {
      if(typedKanaString.length > 0) {
        const lastChar = typedKanaString[typedKanaString.length - 1];
        if(dakutenMap[lastChar]) {
          typedKanaString = typedKanaString.slice(0, -1) + dakutenMap[lastChar];
        } else {
          // 濁点が適用できない場合は無視
          return;
        }
      } else {
        return;
      }
    } else if(kanaChar === "゜") {
      if(typedKanaString.length > 0) {
        const lastChar = typedKanaString[typedKanaString.length - 1];
        if(handakutenMap[lastChar]) {
          typedKanaString = typedKanaString.slice(0, -1) + handakutenMap[lastChar];
        } else {
          // 半濁点が適用できない場合は無視
          return;
        }
      } else {
        return;
      }
    } else {
      typedKanaString += kanaChar;
    }
    
    updateDisplay();
  }
}

// 表示を更新
function updateDisplay() {
  // 入力フィールドにかな文字列を表示
  input.value = typedKanaString;
  
  const typedG = toGraphemes(typedKanaString);
  const spans = problemDiv.querySelectorAll("span");
  
  // 先頭一致長（連鎖的な不一致を避ける）
  let prefixLen = 0;
  const limit = Math.min(typedG.length, targetGraphemes.length);
  for(let i=0;i<limit;i++){
    if(toNFC(typedG[i]) === toNFC(targetGraphemes[i])) prefixLen++;
    else break;
  }

  // 表示の更新: 先頭一致をcorrect、それ以降で入力済み領域をwrong
  spans.forEach((span,i)=>{
    if(i<prefixLen){
      span.className = "correct";
    }else if(i<typedG.length){
      span.className = "wrong";
      wrongIndices.add(i); // 実際に赤く表示したインデックスを記録
    }else{
      span.className = "";
    }
  });

  // 赤く光ったインデックス（不一致箇所）を記録
  for(let i=0;i<limit;i++){
    if(toNFC(typedG[i]) !== toNFC(targetGraphemes[i])){
      wrongIndices.add(i);
    }
  }

  // 正確さ: 一度でも赤くなったユニークな文字数の割合で算出
  const wrongCount = wrongIndices.size;
  const accuracy = targetGraphemes.length>0 ? Math.max(0, Math.floor((1 - wrongCount/targetGraphemes.length)*100)) : 100;
  acc.textContent = accuracy+"%";

  const elapsedMin = (Date.now()-startTime)/60000;
  const charsPerMin = elapsedMin>0 ? Math.floor(prefixLen/elapsedMin) : 0;
  speed.textContent = charsPerMin+" 文字/分";

  const typedNorm = toNFC(typedG.join(""));
  const targetNorm = toNFC(targetGraphemes.join(""));
  if(typedNorm===targetNorm){
    const elapsedSec = (Date.now()-startTime)/1000;
    totalTime += elapsedSec;
    totalAccuracy += accuracy;
    totalSpeed += charsPerMin;

    current++;
    if(current<problems.length) showProblem();
    else showScore();
  }
  highlightNextKey();
}

// 物理キー入力を監視（入力モードに依存しない）
input.addEventListener("keydown", (e) => {
  // 入力フィールドへの直接入力を防ぐ（かな文字列は内部で管理）
  e.preventDefault();
  
  const keyCode = e.code;
  let kanaChar = null;
  
  // Backspace処理
  if(keyCode === "Backspace") {
    processKanaInput("\b");
    // キーボード表示用の処理
    document.querySelectorAll(".key").forEach(k=>{
      if(k.dataset.key==="Backspace") k.classList.add("active");
    });
    return;
  }
  
  // Shiftキーとの組み合わせをチェック
  const mapping = e.shiftKey ? keyCodeToKanaShift : keyCodeToKana;
  kanaChar = mapping[keyCode];
  
  if(kanaChar) {
    processKanaInput(kanaChar);
  }
  
  // キーボード表示用の処理（既存のコード）
  const key = e.key===" "? "Space" : e.key==="Enter"?"Enter":e.key;
  if(e.key==="Shift") {
    shiftPressed = true;
    renderKeyboard(shiftRows);
  }
  document.querySelectorAll(".key").forEach(k=>{
    if(k.dataset.key===key) k.classList.add("active");
  });
});

input.addEventListener("keyup", (e) => {
  const key = e.key===" "? "Space" : e.key==="Enter"?"Enter":e.key;
  if(e.key==="Shift") {
    shiftPressed = false;
    renderKeyboard(normalRows);
  }
  document.querySelectorAll(".key").forEach(k=>{
    if(k.dataset.key===key) k.classList.remove("active");
  });
});

// IME入力を無効化
input.addEventListener("compositionstart", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

input.addEventListener("compositionupdate", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

input.addEventListener("compositionend", (e) => {
  e.preventDefault();
  e.stopPropagation();
  // IME入力が終了したら、値を内部のかな文字列で上書き
  input.value = typedKanaString;
});

// beforeinputイベントで入力を防ぐ（より確実に）
input.addEventListener("beforeinput", (e) => {
  // 物理キー入力から変換したかな文字列を使用するため、直接の入力を防ぐ
  if (e.inputType !== "deleteContentBackward") {
    e.preventDefault();
  }
});

// inputイベントで値を常に内部のかな文字列で上書き（ローマ字入力などを防ぐ）
input.addEventListener("input", (e) => {
  e.preventDefault();
  e.stopPropagation();
  // 入力フィールドの値を常に内部のかな文字列で上書き
  // 少し遅延させて確実に上書き
  setTimeout(() => {
    input.value = typedKanaString;
  }, 0);
});

// keypressイベントも無効化（IME入力の一部を防ぐ）
input.addEventListener("keypress", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

// ----------------------------
// 6. スコア画面
// ----------------------------
function showScore(){
  gameArea.style.display="none";
  scoreScreen.style.display="block";
  if(topLeaderboard) topLeaderboard.style.display = "none";
  if(howTo) howTo.style.display = "none"; // スコア画面では非表示
  avgTime.textContent = (totalTime/problems.length).toFixed(2);
  avgAccuracy.textContent = (totalAccuracy/problems.length).toFixed(1);
  avgSpeed.textContent = (totalSpeed/problems.length).toFixed(0);
  // スコアを計算して表示
  const score = computeFinalScore();
  if(finalScore) finalScore.textContent = score;

  // 送信UIを初期化
  hasSubmitted = false;
  isSubmitting = false;
  if(submitBtn) submitBtn.disabled = false;
  if(submitStatus) submitStatus.textContent = "";
  if(submitBtn){
    submitBtn.dataset.locked = "0";
    submitBtn.style.pointerEvents = "auto";
  }

  // ランキング参加条件: ちょうど100問クリア時のみ投稿可
  const isEligibleForRanking = problems.length === 100;
  if(!isEligibleForRanking){
    if(submitBtn){
      submitBtn.disabled = true;
      submitBtn.dataset.locked = "1";
      submitBtn.style.pointerEvents = "none";
    }
    if(submitStatus){
      submitStatus.textContent = `ランキング投稿は100問クリア時のみ可能です（今回: ${problems.length}問）`;
    }
  }

  // スコア表示時にランキング取得
  fetchLeaderboard();
}

// ----------------------------
// 7. スタート / リスタート
// ----------------------------
startBtn.addEventListener("click",()=>{
  const raw = document.getElementById("questionCount").value;
  const count = Number(raw);
  const isInteger = Number.isInteger(count);
  if(!isInteger || count < 1){
    alert("問題数は1以上の整数を入力してください。");
    return;
  }
  problems = generateProblems(count);
  current=0; totalTime=0; totalAccuracy=0; totalSpeed=0;
  startScreen.style.display="none";
  gameArea.style.display="block";
  scoreScreen.style.display="none";
  // トップランキングはゲーム中は非表示
  if(topLeaderboard) topLeaderboard.style.display = "none";
  if(howTo) howTo.style.display = "none"; // ゲーム開始時は非表示
  showProblem();
});

restartBtn.addEventListener("click",()=>{
  startScreen.style.display="block";
  gameArea.style.display="none";
  scoreScreen.style.display="none";
  // スタート画面ではトップランキングを表示
  if(topLeaderboard) topLeaderboard.style.display = "block";
  if(howTo) howTo.style.display = "block"; // リスタートで再表示
  // トップのランキングも最新化
  fetchLeaderboard();
});

// ----------------------------
// 8. キー光らせる
// ----------------------------
document.addEventListener("keydown",(e)=>{
  const key = e.key===" "? "Space" : e.key==="Enter"?"Enter":e.key;
  if(e.key==="Shift") {
    shiftPressed = true;
    renderKeyboard(shiftRows);
  }
  document.querySelectorAll(".key").forEach(k=>{
    if(k.dataset.key===key) k.classList.add("active");
  });
});

document.addEventListener("keyup",(e)=>{
  const key = e.key===" "? "Space" : e.key==="Enter"?"Enter":e.key;
  if(e.key==="Shift") {
    shiftPressed = false;
    renderKeyboard(normalRows);
  }
  document.querySelectorAll(".key").forEach(k=>{
    if(k.dataset.key===key) k.classList.remove("active");
  });
});

// ----------------------------
// 9. Supabase 連携（スコア投稿 & ランキング取得）
// ----------------------------
const submitBtn = document.getElementById("submitScoreBtn");
const playerNameInput = document.getElementById("playerName");
const submitStatus = document.getElementById("submitStatus");
const leaderboardList = document.getElementById("leaderboardList");
const topLeaderboard = document.getElementById("topLeaderboard");
const topLeaderboardList = document.getElementById("topLeaderboardList");
const topLeaderboardTable = document.getElementById("topLeaderboardTable");
const topLeaderboardTableBody = document.getElementById("topLeaderboardTableBody");
const leaderboardTable = document.getElementById("leaderboardTable");
const leaderboardTableBody = document.getElementById("leaderboardTableBody");

// 二重送信防止用フラグ
let hasSubmitted = false;
let isSubmitting = false;

function parseNumberFromText(text){
  const m = String(text).match(/[-+]?[0-9]*\.?[0-9]+/);
  return m ? Number(m[0]) : 0;
}

function computeFinalScore(){
  // ユーザー要望: スコア = 平均速度 × (1 / 平均時間)
  const speedVal = parseNumberFromText(avgSpeed.textContent);
  const avgTimeVal = parseNumberFromText(avgTime.textContent);
  if(avgTimeVal <= 0) return 0;
  return Math.round(speedVal / avgTimeVal);
}

async function submitScore(){
  try{
    // 二重送信ガード
    if(hasSubmitted || isSubmitting || (submitBtn && submitBtn.dataset.locked === "1")){
      if(submitStatus) submitStatus.textContent = hasSubmitted ? "既に送信済みです" : "送信中です...";
      return;
    }

    // 参加条件ガード: 100問以外は投稿不可
    if(problems.length !== 100){
      if(submitStatus) submitStatus.textContent = `ランキング投稿は100問クリア時のみ可能です（今回: ${problems.length}問）`;
      return;
    }
    isSubmitting = true;
    if(submitBtn) submitBtn.disabled = true;
    if(submitBtn){
      submitBtn.dataset.locked = "1";
      submitBtn.style.pointerEvents = "none";
    }

    const name = (playerNameInput.value||"名無し").trim().slice(0,20);
    const score = computeFinalScore();
    const payload = {
      name,
      score,
      avg_time: parseNumberFromText(avgTime.textContent),
      cpm: parseNumberFromText(avgSpeed.textContent),
      total_time: Math.round(totalTime),
      created_at: new Date().toISOString()
    };
    submitStatus.textContent = "送信中...";
    const { error } = await supabase.from("typing_scores").insert(payload);
    if(error){
      submitStatus.textContent = "送信に失敗しました: " + error.message;
      isSubmitting = false;
      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.dataset.locked = "0";
        submitBtn.style.pointerEvents = "auto";
      }
      return;
    }
    submitStatus.textContent = "送信しました！";
    hasSubmitted = true;
    await fetchLeaderboard();
  }catch(err){
    submitStatus.textContent = "送信に失敗しました";
    isSubmitting = false;
    if(submitBtn){
      submitBtn.disabled = false;
      submitBtn.dataset.locked = "0";
      submitBtn.style.pointerEvents = "auto";
    }
  }
}

async function fetchLeaderboard(){
  try{
    if(leaderboardList) leaderboardList.textContent = "読み込み中...";
    if(topLeaderboardList) topLeaderboardList.textContent = "読み込み中...";
    const { data, error } = await supabase
      .from("typing_scores")
      .select("name, score, avg_time, total_time, cpm, created_at")
      .order("score", { ascending:false })
      .limit(20);
    if(error){
      if(leaderboardList) leaderboardList.textContent = "取得に失敗しました: " + error.message;
      if(topLeaderboardList) topLeaderboardList.textContent = "取得に失敗しました: " + error.message;
      return;
    }
    if(!data || data.length===0){
      if(leaderboardList) leaderboardList.textContent = "まだ投稿がありません";
      if(topLeaderboardList) topLeaderboardList.textContent = "まだ投稿がありません";
      return;
    }
    
    // テーブル形式で表示
    if(topLeaderboardTable && topLeaderboardTableBody){
      topLeaderboardTableBody.innerHTML = "";
      data.forEach((row,idx)=>{
        const tr = document.createElement("tr");
        const date = new Date(row.created_at);
        const dateStr = date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'});
        
        tr.innerHTML = `
          <td>${idx+1}</td>
          <td>${row.name}</td>
          <td>${row.score}</td>
          <td>${row.avg_time.toFixed ? row.avg_time.toFixed(2) : row.avg_time}秒</td>
          <td>${row.total_time ?? '-'}秒</td>
          <td>${row.cpm}文字/分</td>
          <td>${dateStr}</td>
        `;
        topLeaderboardTableBody.appendChild(tr);
      });
      topLeaderboardTable.style.display = "table";
      if(topLeaderboardList) topLeaderboardList.style.display = "none";
    }
    
    if(leaderboardTable && leaderboardTableBody){
      leaderboardTableBody.innerHTML = "";
      data.forEach((row,idx)=>{
        const tr = document.createElement("tr");
        const date = new Date(row.created_at);
        const dateStr = date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'});
        
        tr.innerHTML = `
          <td>${idx+1}</td>
          <td>${row.name}</td>
          <td>${row.score}</td>
          <td>${row.avg_time.toFixed ? row.avg_time.toFixed(2) : row.avg_time}秒</td>
          <td>${row.total_time ?? '-'}秒</td>
          <td>${row.cpm}文字/分</td>
          <td>${dateStr}</td>
        `;
        leaderboardTableBody.appendChild(tr);
      });
      leaderboardTable.style.display = "table";
      if(leaderboardList) leaderboardList.style.display = "none";
    }
    
    // フォールバック用のテキスト表示も残す
    const frag1 = document.createDocumentFragment();
    const frag2 = document.createDocumentFragment();
    data.forEach((row,idx)=>{
      const line = `${idx+1}. ${row.name} - スコア ${row.score} / 平均時間 ${row.avg_time.toFixed ? row.avg_time.toFixed(2) : row.avg_time} 秒 / 総時間 ${row.total_time ?? '-'} 秒 / 平均速度 ${row.cpm}`;
      const div1 = document.createElement("div");
      div1.textContent = line;
      const div2 = document.createElement("div");
      div2.textContent = line;
      frag1.appendChild(div1);
      frag2.appendChild(div2);
    });
    if(leaderboardList){
      leaderboardList.innerHTML = "";
      leaderboardList.appendChild(frag1);
    }
    if(topLeaderboardList){
      topLeaderboardList.innerHTML = "";
      topLeaderboardList.appendChild(frag2);
    }
  }catch(err){
    if(leaderboardList) leaderboardList.textContent = "取得に失敗しました";
    if(topLeaderboardList) topLeaderboardList.textContent = "取得に失敗しました";
  }
}

if(submitBtn){
  submitBtn.addEventListener("click", submitScore);
}

// 初回ロード時にトップランキングを取得
document.addEventListener("DOMContentLoaded", () => {
  fetchLeaderboard();
});