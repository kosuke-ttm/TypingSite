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
const keyboardDiv = document.getElementById("keyboard");

let problems=[], current=0, startTime=null;
let totalTime=0, totalAccuracy=0, totalSpeed=0;
let targetGraphemes=[]; // 現在の問題文をグラフェム単位に分割した配列

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

  const typedG = toGraphemes(input.value);

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
// 5. 入力判定
// ----------------------------
input.addEventListener("input",()=>{
  if(!startTime) startTime = Date.now();
  const text = problems[current];
  const typed = input.value;
  const typedG = toGraphemes(typed);
  const spans = problemDiv.querySelectorAll("span");
  let correct=0;

  spans.forEach((span,i)=>{
    if(i<typedG.length){
      const a = toNFC(typedG[i]);
      const b = toNFC(span.textContent);
      if(a===b){ span.className="correct"; correct++; }
      else span.className="wrong";
    }else span.className="";
  });

  const accuracy = typedG.length>0 ? Math.floor(correct/typedG.length*100) : 100;
  acc.textContent = accuracy+"%";

  const elapsedMin = (Date.now()-startTime)/60000;
  const charsPerMin = elapsedMin>0 ? Math.floor(correct/elapsedMin) : 0;
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
});

// ----------------------------
// 6. スコア画面
// ----------------------------
function showScore(){
  gameArea.style.display="none";
  scoreScreen.style.display="block";
  avgTime.textContent = (totalTime/problems.length).toFixed(2);
  avgAccuracy.textContent = (totalAccuracy/problems.length).toFixed(1);
  avgSpeed.textContent = (totalSpeed/problems.length).toFixed(0);
}

// ----------------------------
// 7. スタート / リスタート
// ----------------------------
startBtn.addEventListener("click",()=>{
  const count = parseInt(document.getElementById("questionCount").value);
  problems = generateProblems(count);
  current=0; totalTime=0; totalAccuracy=0; totalSpeed=0;
  startScreen.style.display="none";
  gameArea.style.display="block";
  scoreScreen.style.display="none";
  showProblem();
});

restartBtn.addEventListener("click",()=>{
  startScreen.style.display="block";
  gameArea.style.display="none";
  scoreScreen.style.display="none";
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