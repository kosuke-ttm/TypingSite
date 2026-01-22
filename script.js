// ----------------------------
// 0. Supabase初期化チェック
// ----------------------------
// supabaseConfig.jsが読み込まれていない場合でもエラーが発生しないようにする
// typeof演算子は変数が存在しない場合でも"undefined"を返すので安全
// ただし、script.jsがsupabaseConfig.jsより先に読み込まれる可能性があるため、
// グローバルスコープでsupabaseを参照する際は注意が必要

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
let totalChars=0; // 総文字数を記録（正確な平均速度計算用）
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
  ["ShiftLeft","つ","さ","そ","ひ","こ","み","も","ね","る","め","ShiftRight"],
  ["Space","Enter","Backspace"]
];

const shiftRows = [
  ["ぬ","ふ","ぁ","ぅ","ぇ","ぉ","ゃ","ゅ","ょ","を","ほ","「"],
  ["た","て","ぃ","す","か","ん","な","に","ら","せ","」","ー","へ"],
  ["ち","と","し","は","き","く","ま","の","り","れ","ろ"],
  ["ShiftLeft","っ","さ","そ","ひ","こ","み","も","、","。","・","ShiftRight"],
  ["Space","Enter","Backspace"]
];

// 文字グループごとの色分けマッピング
const charColorGroups = {
  // グループ1: うすはひえかきこ
  "う": "group-1", "す": "group-1", "は": "group-1", "ひ": "group-1", 
  "え": "group-1", "か": "group-1", "き": "group-1", "こ": "group-1",
  "ぅ": "group-1", "ぇ": "group-1", // 小文字
  // グループ2: あいしそ
  "あ": "group-2", "い": "group-2", "し": "group-2", "そ": "group-2",
  "ぁ": "group-2", "ぃ": "group-2", // 小文字
  // グループ3: ふてとさ
  "ふ": "group-3", "て": "group-3", "と": "group-3", "さ": "group-3",
  // グループ4: ぬたちつ
  "ぬ": "group-4", "た": "group-4", "ち": "group-4", "つ": "group-4",
  "っ": "group-4", // 小文字
  // グループ5: やなまもおんくみ
  "や": "group-5", "な": "group-5", "ま": "group-5", "も": "group-5",
  "お": "group-5", "ん": "group-5", "く": "group-5", "み": "group-5",
  "ぉ": "group-5", "ゃ": "group-5", // 小文字
  // グループ6: ゆにのね
  "ゆ": "group-6", "に": "group-6", "の": "group-6", "ね": "group-6",
  "ゅ": "group-6", // 小文字
  // グループ7: よらりる
  "よ": "group-7", "ら": "group-7", "り": "group-7", "る": "group-7",
  "ょ": "group-7", // 小文字
  // グループ8: わせれめほけむへ゛゜
  "わ": "group-8", "せ": "group-8", "れ": "group-8", "め": "group-8",
  "ほ": "group-8", "け": "group-8", "む": "group-8", "へ": "group-8",
  "゛": "group-8", "゜": "group-8",
  "を": "group-8", "ろ": "group-8", // 小文字・その他
  "、": "group-8", "。": "group-8", "・": "group-8", // 句読点
  "「": "group-8", "」": "group-8", "ー": "group-8" // 記号
};


// 濁点付き文字を分解（NFD）
function baseChar(char) {
  return char.normalize("NFD")[0]; // 先頭の基本文字を取得
}

// 濁点付き文字を基本文字と濁点に分解（表示用）
function splitDakutenChar(char) {
  const nfd = toNFD(char);
  const base = baseChar(char);
  const hasDakuten = nfd.includes("\u3099"); // combining voiced sound mark
  const hasHandakuten = nfd.includes("\u309A"); // combining semi-voiced sound mark
  
  if (hasDakuten) {
    return { base: base, mark: "゛", hasMark: true };
  } else if (hasHandakuten) {
    return { base: base, mark: "゜", hasMark: true };
  } else {
    return { base: char, mark: null, hasMark: false };
  }
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

  // 次の文字が小文字（Shiftキーが必要な文字）かどうかを判定
  // normalRowsには存在しないが、shiftRowsには存在する文字を小文字として判定
  const inNormalRows = normalRows.some(row => row.includes(targetChar));
  const inShiftRows = shiftRows.some(row => row.includes(targetChar));
  const isShiftChar = !inNormalRows && inShiftRows;
  
  // 小文字の場合の処理
  if (isShiftChar) {
    // Shiftキーが押されていない場合：Shiftキーを光らせる
    if (!shiftLeftPressed && !shiftRightPressed) {
      // 「ぁ，ぃ，ぅ，ぇ，っ」の場合は右シフトを光らせる
      const rightShiftChars = ["ぁ", "ぃ", "ぅ", "ぇ", "っ"];
      if (rightShiftChars.includes(targetChar)) {
        const shiftRightEl = [...document.querySelectorAll(".key")].find(k => k.dataset.key === "ShiftRight");
        if (shiftRightEl) shiftRightEl.classList.add("next");
      } else {
        // その他の小文字は左シフトを光らせる
        const shiftLeftEl = [...document.querySelectorAll(".key")].find(k => k.dataset.key === "ShiftLeft");
        if (shiftLeftEl) shiftLeftEl.classList.add("next");
      }
      return; // Shiftキーを光らせたら終了
    }
    // Shiftキーが押されている場合：小文字のキーを光らせる
    // （この時点でキーボードレイアウトはshiftRowsになっている）
    const keyName = targetChar;
    const el = [...document.querySelectorAll(".key")].find(k => k.dataset.key === keyName);
    if (el) el.classList.add("next");
    return;
  }
  
  // 小文字でない場合：通常のキーを光らせる
  let keyName = base === " " ? "Space" : base === "\n" ? "Enter" : base;
  const el = [...document.querySelectorAll(".key")].find(k => k.dataset.key === keyName);
  if (el) el.classList.add("next");
}

let shiftLeftPressed = false;
let shiftRightPressed = false;

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
      // 文字グループごとの色分けクラスを追加
      if(charColorGroups[k]) {
        span.classList.add(charColorGroups[k]);
      } else {
        // 特殊キーなど、グループに属さないキーはデフォルト色
        span.classList.add("group-default");
      }
      span.dataset.key = k;
      // Shiftキーの表示テキストを設定
      if(k==="ShiftLeft") {
        span.textContent = "Shift";
      } else if(k==="ShiftRight") {
        span.textContent = "Shift";
      } else if(k==="Space") {
        span.textContent = "␣";
      } else {
        span.textContent = k;
      }
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
  // エラーチェック
  if(!problems || problems.length === 0){
    console.error("問題が生成されていません");
    return;
  }
  if(current < 0 || current >= problems.length){
    console.error(`問題インデックスが範囲外です: current=${current}, problems.length=${problems.length}`);
    return;
  }
  if(!problemDiv){
    console.error("problemDivが取得できません");
    return;
  }
  
  const text = problems[current];
  if(!text){
    console.error(`問題文が空です: current=${current}`);
    return;
  }
  
  problemDiv.innerHTML="";
  targetGraphemes = toGraphemes(text);
  wrongIndices = new Set();
  typedKanaString = ""; // かな文字列をリセット
  
  // 濁点付き文字を基本文字と濁点に分けて表示
  for(let ch of targetGraphemes){
    const split = splitDakutenChar(ch);
    // 基本文字のspan
    const baseSpan = document.createElement("span");
    baseSpan.textContent = split.base;
    baseSpan.dataset.isBase = "true";
    problemDiv.appendChild(baseSpan);
    
    // 濁点がある場合、濁点用のspanを追加
    if(split.hasMark){
      const markSpan = document.createElement("span");
      markSpan.textContent = split.mark;
      markSpan.dataset.isMark = "true";
      markSpan.className = "dakuten-mark";
      problemDiv.appendChild(markSpan);
    }
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
    if(toNFC(typedG[i]) === toNFC(targetGraphemes[i])) {
      prefixLen++;
    } else {
      // 濁点付き文字の入力途中かどうかをチェック
      const targetChar = targetGraphemes[i];
      const typedChar = typedG[i];
      const targetBase = baseChar(targetChar);
      const typedNFC = toNFC(typedChar);
      const targetNFC = toNFC(targetChar);
      
      // 目標文字が濁点付きで、入力済み文字がそのベース文字と一致する場合は、まだ入力途中とみなす
      const isDakutenTarget = targetNFC !== toNFC(targetBase);
      const isBaseMatch = typedNFC === toNFC(targetBase);
      
      if(isDakutenTarget && isBaseMatch){
        // 濁点入力途中なので、一致として扱う（prefixLenには含めないが、correctとして表示）
        break;
      } else {
        break;
      }
    }
  }

  // 表示の更新: 基本文字と濁点を個別に処理
  let spanIndex = 0; // 実際のspan要素のインデックス
  wrongIndices.clear(); // リセット
  
  for(let i=0; i<targetGraphemes.length; i++){
    const targetChar = targetGraphemes[i];
    const split = splitDakutenChar(targetChar);
    const baseSpan = spans[spanIndex++];
    const markSpan = split.hasMark ? spans[spanIndex] : null;
    
    // 基本文字の処理
    if(i < prefixLen){
      // 完全一致
      baseSpan.className = "correct";
      if(markSpan && markSpan.dataset.isMark === "true"){
        markSpan.className = "correct";
      }
    } else if(i < typedG.length){
      // 入力済み領域
      const typedChar = typedG[i];
      const typedNFC = toNFC(typedChar);
      const targetNFC = toNFC(targetChar);
      const targetBase = baseChar(targetChar);
      
      const isDakutenTarget = split.hasMark;
      const isBaseMatch = toNFC(typedChar) === toNFC(targetBase);
      
      if(isDakutenTarget && isBaseMatch){
        // 基本文字は一致しているが、濁点が入力されていない
        baseSpan.className = "correct";
        
        // 次の文字が既に入力されている場合（濁点をスキップしてしまった場合）
        if(i+1 < typedG.length){
          // 濁点部分だけをwrongとして表示
          if(markSpan && markSpan.dataset.isMark === "true"){
            markSpan.className = "wrong";
            wrongIndices.add(i);
          }
        }
        // 次の文字がまだ入力されていない場合は、濁点部分は何も表示しない（correctでもwrongでもない）
      } else if(typedNFC === targetNFC){
        // 完全一致（濁点も含めて）
        baseSpan.className = "correct";
        if(markSpan && markSpan.dataset.isMark === "true"){
          markSpan.className = "correct";
        }
      } else {
        // 不一致
        baseSpan.className = "wrong";
        wrongIndices.add(i);
        if(markSpan && markSpan.dataset.isMark === "true"){
          markSpan.className = "wrong";
        }
      }
    } else {
      // 未入力領域
      baseSpan.className = "";
      if(markSpan && markSpan.dataset.isMark === "true"){
        markSpan.className = "";
      }
    }
    
    // 濁点のspanがある場合はインデックスを進める
    if(split.hasMark){
      spanIndex++;
    }
  }
  
  // 残りのspanをリセット（入力が短すぎる場合）
  for(let i=spanIndex; i<spans.length; i++){
    spans[i].className = "";
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
    totalChars += targetGraphemes.length; // 総文字数を累積

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
  
  // Shiftキーとの組み合わせをチェック（左右どちらのShiftでも動作）
  const mapping = (shiftLeftPressed || shiftRightPressed) ? keyCodeToKanaShift : keyCodeToKana;
  kanaChar = mapping[keyCode];
  
  if(kanaChar) {
    processKanaInput(kanaChar);
  }
  
  // キーボード表示用の処理（既存のコード）
  const key = e.key===" "? "Space" : e.key==="Enter"?"Enter":e.key;
  if(e.code==="ShiftLeft") {
    shiftLeftPressed = true;
    renderKeyboard(shiftRows);
    // Shiftキーが押されたら、次のキーのハイライトを更新
    highlightNextKey();
  } else if(e.code==="ShiftRight") {
    shiftRightPressed = true;
    renderKeyboard(shiftRows);
    // Shiftキーが押されたら、次のキーのハイライトを更新
    highlightNextKey();
  }
  const displayKeyCode = e.code==="ShiftLeft" ? "ShiftLeft" : e.code==="ShiftRight" ? "ShiftRight" : key;
  document.querySelectorAll(".key").forEach(k=>{
    if(k.dataset.key===displayKeyCode) k.classList.add("active");
  });
});

input.addEventListener("keyup", (e) => {
  const key = e.key===" "? "Space" : e.key==="Enter"?"Enter":e.key;
  if(e.code==="ShiftLeft") {
    shiftLeftPressed = false;
    // どちらのShiftキーも離されていない場合のみ通常レイアウトに戻す
    if (!shiftRightPressed) {
      renderKeyboard(normalRows);
    }
    // Shiftキーが離されたら、次のキーのハイライトを更新
    highlightNextKey();
  } else if(e.code==="ShiftRight") {
    shiftRightPressed = false;
    // どちらのShiftキーも離されていない場合のみ通常レイアウトに戻す
    if (!shiftLeftPressed) {
      renderKeyboard(normalRows);
    }
    // Shiftキーが離されたら、次のキーのハイライトを更新
    highlightNextKey();
  }
  const displayKeyCode = e.code==="ShiftLeft" ? "ShiftLeft" : e.code==="ShiftRight" ? "ShiftRight" : key;
  document.querySelectorAll(".key").forEach(k=>{
    if(k.dataset.key===displayKeyCode) k.classList.remove("active");
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

// pasteイベントを無効化（貼り付けを防ぐ）
input.addEventListener("paste", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

// contextmenuイベントを無効化（右クリックメニューを防ぐ）
input.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

// dropイベントを無効化（ドラッグ&ドロップを防ぐ）
input.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

// dragenter, dragoverイベントも無効化
input.addEventListener("dragenter", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

input.addEventListener("dragover", (e) => {
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
  // 正確な平均速度: 総文字数 ÷ 総時間（分）
  const totalTimeMin = totalTime / 60;
  const accurateAvgSpeed = totalTimeMin > 0 ? Math.floor(totalChars / totalTimeMin) : 0;
  avgSpeed.textContent = accurateAvgSpeed.toFixed(0);
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

  // ログイン済みの場合は名前を自動入力
  if (playerNameInput && window.currentUserDisplayName) {
    playerNameInput.value = window.currentUserDisplayName;
    playerNameInput.readOnly = false; // 編集可能にする
  } else if (playerNameInput) {
    playerNameInput.value = "";
    playerNameInput.readOnly = false;
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
if(startBtn){
  startBtn.addEventListener("click",()=>{
    const raw = document.getElementById("questionCount").value;
    const count = Number(raw);
    const isInteger = Number.isInteger(count);
    if(!isInteger || count < 1){
      alert("問題数は1以上の整数を入力してください。");
      return;
    }
    problems = generateProblems(count);
    current=0; totalTime=0; totalAccuracy=0; totalSpeed=0; totalChars=0;
    startScreen.style.display="none";
    gameArea.style.display="block";
    scoreScreen.style.display="none";
    // トップランキングはゲーム中は非表示
    if(topLeaderboard) topLeaderboard.style.display = "none";
    if(howTo) howTo.style.display = "none"; // ゲーム開始時は非表示
    showProblem();
  });
} else {
  console.error("startBtnが取得できません");
}

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
  if(e.code==="ShiftLeft") {
    shiftLeftPressed = true;
    renderKeyboard(shiftRows);
    // Shiftキーが押されたら、次のキーのハイライトを更新
    highlightNextKey();
  } else if(e.code==="ShiftRight") {
    shiftRightPressed = true;
    renderKeyboard(shiftRows);
    // Shiftキーが押されたら、次のキーのハイライトを更新
    highlightNextKey();
  }
  const displayKeyCode = e.code==="ShiftLeft" ? "ShiftLeft" : e.code==="ShiftRight" ? "ShiftRight" : key;
  document.querySelectorAll(".key").forEach(k=>{
    if(k.dataset.key===displayKeyCode) k.classList.add("active");
  });
});

document.addEventListener("keyup",(e)=>{
  const key = e.key===" "? "Space" : e.key==="Enter"?"Enter":e.key;
  if(e.code==="ShiftLeft") {
    shiftLeftPressed = false;
    // どちらのShiftキーも離されていない場合のみ通常レイアウトに戻す
    if (!shiftRightPressed) {
      renderKeyboard(normalRows);
    }
    // Shiftキーが離されたら、次のキーのハイライトを更新
    highlightNextKey();
  } else if(e.code==="ShiftRight") {
    shiftRightPressed = false;
    // どちらのShiftキーも離されていない場合のみ通常レイアウトに戻す
    if (!shiftLeftPressed) {
      renderKeyboard(normalRows);
    }
    // Shiftキーが離されたら、次のキーのハイライトを更新
    highlightNextKey();
  }
  const displayKeyCode = e.code==="ShiftLeft" ? "ShiftLeft" : e.code==="ShiftRight" ? "ShiftRight" : key;
  document.querySelectorAll(".key").forEach(k=>{
    if(k.dataset.key===displayKeyCode) k.classList.remove("active");
  });
});

// ----------------------------
// 9. ユーザー認証機能
// ----------------------------
const authMessage = document.getElementById("authMessage");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const loginCancelBtn = document.getElementById("loginCancelBtn");
const loginStatus = document.getElementById("loginStatus");
const registerName = document.getElementById("registerName");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");
const registerSubmitBtn = document.getElementById("registerSubmitBtn");
const registerCancelBtn = document.getElementById("registerCancelBtn");
const registerStatus = document.getElementById("registerStatus");

// 認証状態を確認してUIを更新
async function checkAuthStatus() {
  try {
    // supabaseオブジェクトが存在しない場合はゲストモードで続行
    // windowオブジェクト経由で安全にチェック
    if(typeof window.supabase === 'undefined' || typeof supabase === 'undefined' || !supabase){
      authMessage.textContent = "ゲストでプレイ中";
      loginBtn.style.display = "inline-block";
      registerBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
      loginForm.style.display = "none";
      registerForm.style.display = "none";
      window.currentUserDisplayName = null;
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // ログイン済み
      authMessage.textContent = `ログイン中: ${user.email || 'ユーザー'}`;
      loginBtn.style.display = "none";
      registerBtn.style.display = "none";
      logoutBtn.style.display = "inline-block";
      loginForm.style.display = "none";
      registerForm.style.display = "none";
      
      // ユーザーメタデータから表示名を取得
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();
      
      if (profile && profile.display_name) {
        // 表示名を保存してスコア画面で使用
        window.currentUserDisplayName = profile.display_name;
      } else {
        // メタデータから取得を試みる
        const metadata = user.user_metadata;
        if (metadata && metadata.display_name) {
          window.currentUserDisplayName = metadata.display_name;
        } else {
          window.currentUserDisplayName = user.email?.split("@")[0] || "ユーザー";
        }
      }
    } else {
      // 未ログイン
      authMessage.textContent = "ゲストでプレイ中";
      loginBtn.style.display = "inline-block";
      registerBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
      loginForm.style.display = "none";
      registerForm.style.display = "none";
      window.currentUserDisplayName = null;
    }
  } catch (error) {
    console.error("認証状態の確認に失敗しました:", error);
    authMessage.textContent = "ゲストでプレイ中";
    loginBtn.style.display = "inline-block";
    registerBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
  }
}

// ログイン
async function handleLogin() {
  try {
    if(typeof window.supabase === 'undefined' || typeof supabase === 'undefined' || !supabase){
      loginStatus.textContent = "認証機能は利用できません（設定が必要です）";
      loginStatus.style.color = "#ff5555";
      return;
    }
  } catch(e) {
    loginStatus.textContent = "認証機能は利用できません（設定が必要です）";
    loginStatus.style.color = "#ff5555";
    return;
  }
  
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();
  
  if (!email || !password) {
    loginStatus.textContent = "メールアドレスとパスワードを入力してください";
    loginStatus.style.color = "#ff5555";
    return;
  }
  
  try {
    loginStatus.textContent = "ログイン中...";
    loginStatus.style.color = "#fff";
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      loginStatus.textContent = "ログインに失敗しました: " + error.message;
      loginStatus.style.color = "#ff5555";
      return;
    }
    
    loginStatus.textContent = "ログイン成功！";
    loginStatus.style.color = "#00ff00";
    loginForm.style.display = "none";
    loginEmail.value = "";
    loginPassword.value = "";
    
    await checkAuthStatus();
  } catch (error) {
    loginStatus.textContent = "ログインに失敗しました";
    loginStatus.style.color = "#ff5555";
  }
}

// ユーザー登録
async function handleRegister() {
  try {
    if(typeof window.supabase === 'undefined' || typeof supabase === 'undefined' || !supabase){
      registerStatus.textContent = "認証機能は利用できません（設定が必要です）";
      registerStatus.style.color = "#ff5555";
      return;
    }
  } catch(e) {
    registerStatus.textContent = "認証機能は利用できません（設定が必要です）";
    registerStatus.style.color = "#ff5555";
    return;
  }
  
  const name = registerName.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value.trim();
  
  if (!name || !email || !password) {
    registerStatus.textContent = "すべての項目を入力してください";
    registerStatus.style.color = "#ff5555";
    return;
  }
  
  if (password.length < 6) {
    registerStatus.textContent = "パスワードは6文字以上で入力してください";
    registerStatus.style.color = "#ff5555";
    return;
  }
  
  if (name.length > 20) {
    registerStatus.textContent = "表示名は20文字以内で入力してください";
    registerStatus.style.color = "#ff5555";
    return;
  }
  
  try {
    registerStatus.textContent = "登録中...";
    registerStatus.style.color = "#fff";
    
    // ユーザー登録
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name
        }
      }
    });
    
    if (authError) {
      registerStatus.textContent = "登録に失敗しました: " + authError.message;
      registerStatus.style.color = "#ff5555";
      return;
    }
    
    if (authData.user) {
      // ユーザープロファイルテーブルに表示名を保存
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: authData.user.id,
          display_name: name,
          email: email
        });
      
      if (profileError) {
        console.error("プロファイル保存エラー:", profileError);
        // エラーでも続行（メタデータには保存されている）
      }
      
      registerStatus.textContent = "登録成功！ログインしました";
      registerStatus.style.color = "#00ff00";
      registerForm.style.display = "none";
      registerName.value = "";
      registerEmail.value = "";
      registerPassword.value = "";
      
      await checkAuthStatus();
    }
  } catch (error) {
    registerStatus.textContent = "登録に失敗しました";
    registerStatus.style.color = "#ff5555";
  }
}

// ログアウト
async function handleLogout() {
  try {
    if(typeof window.supabase === 'undefined' || typeof supabase === 'undefined' || !supabase){
      console.warn("Supabaseが設定されていません");
      return;
    }
    await supabase.auth.signOut();
    window.currentUserDisplayName = null;
    await checkAuthStatus();
  } catch (error) {
    console.error("ログアウトに失敗しました:", error);
  }
}

// イベントリスナー
if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    loginForm.style.display = "block";
    registerForm.style.display = "none";
  });
}

if (registerBtn) {
  registerBtn.addEventListener("click", () => {
    registerForm.style.display = "block";
    loginForm.style.display = "none";
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", handleLogout);
}

if (loginSubmitBtn) {
  loginSubmitBtn.addEventListener("click", handleLogin);
}

if (loginCancelBtn) {
  loginCancelBtn.addEventListener("click", () => {
    loginForm.style.display = "none";
    loginEmail.value = "";
    loginPassword.value = "";
    loginStatus.textContent = "";
  });
}

if (registerSubmitBtn) {
  registerSubmitBtn.addEventListener("click", handleRegister);
}

if (registerCancelBtn) {
  registerCancelBtn.addEventListener("click", () => {
    registerForm.style.display = "none";
    registerName.value = "";
    registerEmail.value = "";
    registerPassword.value = "";
    registerStatus.textContent = "";
  });
}

// Enterキーで送信
if (loginEmail && loginPassword) {
  loginEmail.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });
  loginPassword.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });
}

if (registerName && registerEmail && registerPassword) {
  registerName.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleRegister();
  });
  registerEmail.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleRegister();
  });
  registerPassword.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleRegister();
  });
}

// 認証状態の変更を監視
// DOMContentLoadedイベントで実行することで、supabaseConfig.jsの読み込みを待つ
document.addEventListener("DOMContentLoaded", () => {
  // supabaseが定義されているか確認（windowオブジェクト経由で安全にチェック）
  if(typeof window.supabase !== 'undefined' && window.supabase && typeof supabase !== 'undefined' && supabase){
    try {
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          checkAuthStatus();
        }
      });
    } catch(err) {
      console.warn("認証状態の監視を開始できませんでした:", err);
    }
  }
});

// 初回ロード時に認証状態を確認
checkAuthStatus();

// ----------------------------
// 10. Supabase 連携（スコア投稿 & ランキング取得）
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
    // supabaseオブジェクトが存在しない場合は早期リターン
    try {
      if(typeof window.supabase === 'undefined' || typeof supabase === 'undefined' || !supabase){
        if(submitStatus) submitStatus.textContent = "ランキング機能は利用できません（設定が必要です）";
        return;
      }
    } catch(e) {
      if(submitStatus) submitStatus.textContent = "ランキング機能は利用できません（設定が必要です）";
      return;
    }
    
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
    // supabaseオブジェクトが存在しない場合は早期リターン
    try {
      if(typeof window.supabase === 'undefined' || typeof supabase === 'undefined' || !supabase || supabase === null){
        if(leaderboardList) leaderboardList.textContent = "ランキング機能は利用できません（設定が必要です）";
        if(topLeaderboardList) topLeaderboardList.textContent = "ランキング機能は利用できません（設定が必要です）";
        return;
      }
    } catch(e) {
      if(leaderboardList) leaderboardList.textContent = "ランキング機能は利用できません（設定が必要です）";
      if(topLeaderboardList) topLeaderboardList.textContent = "ランキング機能は利用できません（設定が必要です）";
      return;
    }
    
    if(leaderboardList) leaderboardList.textContent = "読み込み中...";
    if(topLeaderboardList) topLeaderboardList.textContent = "読み込み中...";
    
    // タイムアウトを設定（5秒に短縮）
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("タイムアウト: ランキングの取得に時間がかかりすぎています")), 5000);
    });
    
    const fetchPromise = supabase
      .from("typing_scores")
      .select("name, score, avg_time, total_time, cpm, created_at")
      .order("score", { ascending:false })
      .limit(20);
    
    // Promise.raceでタイムアウトとフェッチを競争させる
    let result;
    try {
      result = await Promise.race([fetchPromise, timeoutPromise]);
      // タイムアウトをクリア（正常に完了した場合）
      if(timeoutId) clearTimeout(timeoutId);
    } catch (timeoutError) {
      // タイムアウトの場合
      if(timeoutId) clearTimeout(timeoutId);
      if(leaderboardList) leaderboardList.textContent = timeoutError.message || "タイムアウト: ランキングの取得に時間がかかりすぎています";
      if(topLeaderboardList) topLeaderboardList.textContent = timeoutError.message || "タイムアウト: ランキングの取得に時間がかかりすぎています";
      return;
    }
    
    // resultがundefinedの場合はエラーとして扱う
    if(!result){
      if(leaderboardList) leaderboardList.textContent = "ランキングの取得に失敗しました";
      if(topLeaderboardList) topLeaderboardList.textContent = "ランキングの取得に失敗しました";
      return;
    }
    
    const { data, error } = result;
    
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
    console.error("ランキング取得エラー:", err);
    const errorMessage = err.message || "取得に失敗しました";
    if(leaderboardList) leaderboardList.textContent = errorMessage;
    if(topLeaderboardList) topLeaderboardList.textContent = errorMessage;
    // テーブルを非表示にして、エラーメッセージを表示
    if(topLeaderboardTable) topLeaderboardTable.style.display = "none";
    if(leaderboardTable) leaderboardTable.style.display = "none";
  }
}

if(submitBtn){
  submitBtn.addEventListener("click", submitScore);
}

// 初回ロード時にトップランキングを取得（エラーが発生してもゲームは開始できるようにする）
document.addEventListener("DOMContentLoaded", () => {
  // ランキング取得は非同期で実行し、エラーが発生してもゲーム開始をブロックしない
  // setTimeoutで少し遅延させて、他の初期化処理を優先させる
  setTimeout(() => {
    fetchLeaderboard().catch(err => {
      console.error("初回ランキング取得エラー:", err);
      // エラーが発生してもゲームは開始できるようにする
    });
  }, 100);
});