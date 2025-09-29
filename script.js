// ----------------------------
// 1. 問題生成
// ----------------------------
const nouns = ["ねこ","いぬ","とり","ひと","やま","かわ","まち","くるま","でんしゃ","がっこう"];
const verbs = ["あるく","はしる","たべる","のむ","みる","きく","かく","つかう","つくる","すわる"];
const adjectives = ["おおきい","ちいさい","たのしい","かなしい","あかるい","くらい","あたらしい","ふるい"];
const particles = ["が","を","で","に","から","まで","と"];

function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function generateSentence(){
  const templates = [
    ()=>`${choice(nouns)}${choice(particles)} ${choice(verbs)}。`,
    ()=>`${choice(nouns)}${choice(particles)} ${choice(adjectives)} ので、${choice(nouns)}${choice(particles)} ${choice(verbs)}。`,
    ()=>`${choice(nouns)}${choice(particles)} ${choice(verbs)} て、${choice(nouns)}${choice(particles)} ${choice(verbs)}。`
  ];
  return templates[Math.floor(Math.random()*templates.length)]();
}
function generateParagraph(){
  const count = Math.floor(Math.random()*6)+5;
  let p="";
  for(let i=0;i<count;i++) p += generateSentence()+" ";
  return p.trim();
}
function generateProblems(count){
  let problems=[];
  for(let i=0;i<count;i++) problems.push(generateParagraph());
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

// ----------------------------
// 3. キーボード生成
// ----------------------------
const normalRows = [
  ["ぬ","ふ","あ","う","え","お","や","ゆ","よ","わ","ほ","゜"],
  ["た","て","い","す","か","ん","な","に","ら","せ","゛","む","へ"],
  ["ち","と","し","は","き","く","ま","の","り","れ","け"],
  ["つ","さ","そ","ひ","こ","み","も","ね","る","め"],
  ["Shift","ゃ","ゅ","ょ","Space","Enter","Backspace"]
];

const shiftRows = [
  ["ぬ","ふ","ぁ","ぅ","ぇ","ぉ","ゃ","ゅ","ょ","を","ほ","「"],
  ["た","て","ぃ","す","か","ん","な","に","ら","せ","」","ー","へ"],
  ["ち","と","し","は","き","く","ま","の","り","れ","ろ"],
  ["っ","さ","そ","ひ","こ","み","も","、","。","・"],
  ["Shift","ゃ","ゅ","ょ","Space","Enter","Backspace"]
];

let shiftPressed = false;

function renderKeyboard(rows){
  const homeKeys = ["は","ま"]; // ホームポジション
  keyboardDiv.innerHTML = "";
  rows.forEach((row,rowIndex)=>{
    const rowDiv = document.createElement("div");
    rowDiv.className = "row";

    // 1行目を左にずらす
    if(rowIndex === 0){
      rowDiv.classList.add("indent-first");
    }
    // 3行目を左にずらす
    if(rowIndex === 2){ 
      rowDiv.classList.add("indent-third");
    }

    // 4行目を右にずらす
    if(rowIndex === 3){ 
      rowDiv.classList.add("indent-forth");
    }

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
  for(let ch of text){
    const span = document.createElement("span");
    span.textContent=ch;
    problemDiv.appendChild(span);
  }
  input.value="";
  input.focus();
  startTime=null;
  qNum.textContent = current+1;
}

// ----------------------------
// 5. 入力判定
// ----------------------------
input.addEventListener("input",()=>{
  if(!startTime) startTime = Date.now();
  const text = problems[current];
  const typed = input.value;
  const spans = problemDiv.querySelectorAll("span");
  let correct=0;

  spans.forEach((span,i)=>{
    if(i<typed.length){
      if(typed[i]===span.textContent){ span.className="correct"; correct++; }
      else span.className="wrong";
    }else span.className="";
  });

  const accuracy = typed.length>0 ? Math.floor(correct/typed.length*100) : 100;
  acc.textContent = accuracy+"%";

  const elapsedMin = (Date.now()-startTime)/60000;
  const charsPerMin = elapsedMin>0 ? Math.floor(correct/elapsedMin) : 0;
  speed.textContent = charsPerMin+" 文字/分";

  if(typed===text){
    const elapsedSec = (Date.now()-startTime)/1000;
    totalTime += elapsedSec;
    totalAccuracy += accuracy;
    totalSpeed += charsPerMin;

    current++;
    if(current<problems.length) showProblem();
    else showScore();
  }
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