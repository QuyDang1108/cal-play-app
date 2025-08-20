// =========================
// Biến cấu hình chung (dễ chỉnh)
// =========================
const gameSettings = {
nextQuestionDelayCorrect: 180, // ms
nextQuestionDelayWrong: 1000, // ms
viewOnlyRevealDelay: 900, // ms
// advanced mode: khi level up
defaultPointsPerCorrect: 1,
};

// =========================
// Trạng thái toàn cục
// =========================
let operations,
minNum,
maxNum,
minRes,
maxRes,
timeLimit,
mode,
optionCount;
let presentAs, hideTextInAudio, viewOnlyMode;
let correctCount = 0,
currentAnswer,
currentQuestion,
timerInterval,
timeLeft,
answeredFlag = false, // tránh nhiều lần bấm cùng 1 câu
scorePoints = 0,
pointsPerCorrect = gameSettings.defaultPointsPerCorrect,
level = 0; // cấp độ tăng khi chơi nâng cao

const questionEl = document.getElementById("question");
const subnoteEl = document.getElementById("subnote");
const scoreEl = document.getElementById("score");
const endEl = document.getElementById("end");
const timerText = document.getElementById("timerText");
const timerBar = document.getElementById("timerBar");
const container = document.getElementById("container");
const audioStateWrap = document.getElementById("audioState");
const repeatBtn = document.getElementById("repeatBtn");
const toggleQBtn = document.getElementById("toggleQBtn");
const submitBtn = document.getElementById("submitBtn");

// =========================
// Audio (SpeechSynthesis)
// =========================
let voices = [];
let viVoice = null;
function loadVoices() {
voices = window.speechSynthesis
    ? window.speechSynthesis.getVoices()
    : [];
viVoice = voices.find((v) => /vi|Vietnam/i.test(v.lang)) || null;
}
if (window.speechSynthesis) {
loadVoices();
window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
if (!window.speechSynthesis || !text) return;
window.speechSynthesis.cancel();
const utter = new SpeechSynthesisUtterance(text);
if (viVoice) utter.voice = viVoice;
utter.rate = 1;
utter.pitch = 1;
utter.lang = viVoice ? viVoice.lang : "vi-VN";
window.speechSynthesis.speak(utter);
}

function stopSpeak() {
if (!window.speechSynthesis) return;
window.speechSynthesis.cancel();
}

// =========================
// Kiểm tra đầu vào
// =========================
function validateInput() {
operations = Array.from(
    document.querySelectorAll(
    '#operationGroup input[type="checkbox"]:checked'
    )
).map((o) => o.value);
mode = document.getElementById("mode").value;
optionCount =
    parseInt(document.getElementById("optionCount").value) || 4;
minNum = parseInt(document.getElementById("minNum").value) || 0;
maxNum = parseInt(document.getElementById("maxNum").value) || 100;
minRes = document.getElementById("minRes").value
    ? parseInt(document.getElementById("minRes").value)
    : null;
maxRes = document.getElementById("maxRes").value
    ? parseInt(document.getElementById("maxRes").value)
    : null;
timeLimit = parseInt(document.getElementById("timeLimit").value) || 5;

presentAs = document.getElementById("questionPresentation").value;
hideTextInAudio = document.getElementById("hideTextWhenAudio").checked;
viewOnlyMode = document.getElementById("viewOnly").checked;

if (operations.length === 0) {
    alert("Chọn ít nhất 1 phép toán!");
    return false;
}
if (minNum > maxNum) {
    alert("Min phải nhỏ hơn hoặc bằng Max!");
    return false;
}
if (optionCount < 2 || optionCount > 8) {
    alert("Số lượng đáp án (2-8)!");
    return false;
}
return true;
}

// =========================
// Tiện ích
// =========================
function rand(min, max) {
return Math.floor(Math.random() * (max - min + 1)) + min;
}
function checkResultLimit(res) {
if (minRes !== null && res < minRes) return false;
if (maxRes !== null && res > maxRes) return false;
return true;
}

function generateQuestion() {
let op = operations[Math.floor(Math.random() * operations.length)];
let a, b, res, symbol;
while (true) {
    a = rand(minNum, maxNum);
    b = rand(minNum, maxNum);
    switch (op) {
    case "add":
        res = a + b;
        symbol = "+";
        break;
    case "sub":
        res = a - b;
        symbol = "−";
        break;
    case "mul":
        res = a * b;
        symbol = "×";
        break;
    case "div":
        do {
        b = rand(Math.max(1, minNum), maxNum);
        let q = rand(minNum, maxNum);
        a = b * q;
        res = q;
        } while (a < minNum || a > maxNum || b === 0);
        symbol = "÷";
        break;
    }
    if (checkResultLimit(res)) break;
}
return { q: `${a} ${symbol} ${b}`, a: res };
}

function toggleModeOptions() {
document.getElementById("mcqOptions").style.display =
    document.getElementById("mode").value === "mcq" ? "block" : "none";
}

// =========================
// Bắt đầu trò chơi
// =========================
function startGame() {
if (!validateInput()) return;

stopSpeak();

// reset trạng thái
correctCount = 0;
scorePoints = 0;
pointsPerCorrect = gameSettings.defaultPointsPerCorrect;
level = 0;
answeredFlag = false;

document.getElementById("setup").style.display = "none";
const game = document.getElementById("game");
game.style.display = "flex";
game.style.flexDirection = "column";

// Audio state show/hide
audioStateWrap.style.display = presentAs === "audio" ? "flex" : "none";
updateScoreUI();

nextQuestion();
}

// =========================
// MCQ setup (có số thứ tự)
// =========================
function setupMCQ() {
const wrap = document.getElementById("mcqMode");
wrap.innerHTML = "";
const answers = new Set([currentAnswer]);
while (answers.size < optionCount) {
    let fake = currentAnswer + rand(-10, 10);
    if (fake !== currentAnswer) answers.add(fake);
}
const options = Array.from(answers).sort(() => Math.random() - 0.5);

options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `<span class="op-index">${
    index + 1
    }</span><span>${opt}</span>`;
    btn.onclick = () => checkAnswer(opt, btn);
    wrap.appendChild(btn);
});

setupMCQ.currentOptions = options;
setupMCQ.currentButtons = wrap.querySelectorAll("button");
}

// =========================
// Xử lý phím (số 1..N hoặc Enter)
// =========================
document.addEventListener("keydown", function (e) {
// View-only: Enter để hiện đáp án (khóa tránh spam)
if (viewOnlyMode) {
    if (e.key === "Enter") {
    e.preventDefault();
    if (!answeredFlag) {
        revealAnswerThenNext();
    }
    return;
    }
    return;
}

// Nếu đã trả lời câu hiện tại thì ignore mọi phím số
if (answeredFlag) return;

if (mode === "mcq" && setupMCQ.currentOptions) {
    const num = parseInt(e.key);
    if (
    !Number.isNaN(num) &&
    num >= 1 &&
    num <= setupMCQ.currentOptions.length
    ) {
    const ans = setupMCQ.currentOptions[num - 1];
    const btn = setupMCQ.currentButtons[num - 1];
    checkAnswer(ans, btn);
    }
}
});

// =========================
// Timer
// =========================
function setTimerUI() {
clearInterval(timerInterval);
if (timeLimit && timeLimit > 0) {
    timerBar.style.width = "100%";
    timeLeft = timeLimit;
    timerText.textContent = `⏱ ${timeLeft} giây`;
    timerInterval = setInterval(() => {
    timeLeft--;
    const pct = Math.max(0, (timeLeft / timeLimit) * 100);
    timerBar.style.width = pct + "%";
    timerText.textContent = `⏱ ${timeLeft} giây`;
    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (viewOnlyMode) {
        revealAnswerThenNext();
        } else {
        // block further inputs for this question
        if (!answeredFlag) {
            answeredFlag = true;
            revealAndEnd("⏰ Hết thời gian!");
        }
        }
    }
    }, 1000);
} else {
    timerText.textContent = "⏱ ∞";
    timerBar.style.width = "0%";
}
}

// =========================
// Next question
// =========================
function nextQuestion() {
// reset flag, enable controls
answeredFlag = false;
const q = generateQuestion();
currentQuestion = q.q;
currentAnswer = q.a;

questionEl.textContent = currentQuestion;
questionEl.classList.remove(
    "correct",
    "wrong",
    "wrong-shake",
    "hidden-question"
);
subnoteEl.textContent = "";
endEl.textContent = "";
updateScoreUI();

// Presentation: audio / text
if (presentAs === "audio") {
    if (hideTextInAudio) questionEl.classList.add("hidden-question");
    else questionEl.classList.remove("hidden-question");
    speak(formatQuestionForSpeech(currentQuestion));
} else {
    stopSpeak();
    questionEl.classList.remove("hidden-question");
}

// Show/hide input/mcq depending on mode and viewOnly
const inputWrap = document.getElementById("inputMode");
const mcqWrap = document.getElementById("mcqMode");

if (viewOnlyMode) {
    inputWrap.style.display = "none";
    mcqWrap.style.display = "none";
} else {
    inputWrap.style.display = mode === "input" ? "flex" : "none";
    mcqWrap.style.display = mode === "mcq" ? "grid" : "none";
}

if (mode === "mcq" && !viewOnlyMode) setupMCQ();

// Reset input focus
if (mode === "input" && !viewOnlyMode) {
    const answerInput = document.getElementById("answer");
    answerInput.value = "";
    answerInput.focus();
}

// Ensure option buttons are enabled
const mcq = document.getElementById("mcqMode");
Array.from(mcq.querySelectorAll("button")).forEach((b) => {
    b.disabled = false;
    b.style.background = "";
    b.style.borderColor = "";
});

// Update audio toggle button text
updateToggleButtonText();

setTimerUI();
}

// =========================
// Format text cho speech
// =========================
function formatQuestionForSpeech(text) {
return text
    .replace(/×/g, " nhân ")
    .replace(/÷/g, " chia ")
    .replace(/\+/g, " cộng ")
    .replace(/−/g, " trừ ");
}

// =========================
// View-only reveal
// =========================
let revealLock = false;
function revealAnswerThenNext() {
if (revealLock) return;
revealLock = true;
clearInterval(timerInterval);
answeredFlag = true;

endEl.innerHTML = `
    <div class="answer-reveal">
    Câu hỏi: <strong>${currentQuestion}</strong>
    &nbsp;|&nbsp; Đáp án: <strong>${currentAnswer}</strong>
    </div>
`;

setTimeout(() => {
    revealLock = false;
    nextQuestion();
}, gameSettings.viewOnlyRevealDelay);
}

// =========================
// Hiển đáp án & kết thúc câu
// =========================
function revealAndEnd(prefixMsg) {
clearInterval(timerInterval);
questionEl.classList.add("wrong", "wrong-shake");
answeredFlag = true;

endEl.innerHTML = `
    <div class="answer-reveal">
    ${prefixMsg} — Câu hỏi: <strong>${currentQuestion}</strong>
    &nbsp;|&nbsp; Đáp án đúng: <strong>${currentAnswer}</strong>
    </div>
    <div style="margin-top:8px;">Điểm của bạn: <strong>${scorePoints}</strong></div>
`;

const mcq = document.getElementById("mcqMode");
Array.from(mcq.querySelectorAll("button")).forEach(
    (b) => (b.disabled = true)
);

timerText.textContent = "⏱ 0 giây";
timerBar.style.width = "0%";
}

// =========================
// Kiểm tra đáp án
// =========================
function checkAnswer(ans = null, clickedBtn = null) {
// View-only xử lý khác
if (viewOnlyMode) {
    revealAnswerThenNext();
    return;
}

if (answeredFlag) return; // đã xử lý cho câu này rồi

// lock ngay để chặn bấm tiếp
answeredFlag = true;
clearInterval(timerInterval);

const userAns =
    mode === "input"
    ? parseInt(document.getElementById("answer").value)
    : ans;

if (userAns === currentAnswer) {
    // đúng
    correctCount++;
    scorePoints += pointsPerCorrect;
    questionEl.classList.remove("wrong", "wrong-shake");
    questionEl.classList.add("correct");
    container.classList.add("correct-flash");
    setTimeout(() => container.classList.remove("correct-flash"), 700);

    // advanced mode: check level up
    const advancedMode = document.getElementById("advancedMode").checked;
    if (advancedMode) {
    const levelUpEvery =
        parseInt(document.getElementById("levelUpEvery").value) || 10;
    const increment =
        parseInt(document.getElementById("levelUpIncrement").value) || 50;
    if (correctCount % levelUpEvery === 0) {
        level++;
        // mở rộng range
        minNum = Math.max(0, minNum - increment);
        maxNum = maxNum + increment;
        // tăng điểm mỗi lần đúng để "kết quả cũng tăng tương ứng"
        pointsPerCorrect += 1;
        subnoteEl.textContent = `★ Level lên ${level}: range mở rộng ±${increment}, điểm mỗi lần đúng tăng.`;
    }
    } else {
    subnoteEl.textContent = "";
    }

    updateScoreUI();

    // chuyển câu sau một khoảng ngắn (gameSettings)
    setTimeout(() => {
    nextQuestion();
    }, gameSettings.nextQuestionDelayCorrect);
} else {
    // sai
    if (clickedBtn) {
    clickedBtn.style.background = "#ffecec";
    clickedBtn.style.borderColor = "#ffc9c9";
    }
    revealAndEnd("❌ Sai rồi!");
}
}

// wrapper cho nút input trả lời
function onSubmitInput() {
// Khi Enter hoặc bấm nút: kiểm tra 1 lần duy nhất
if (answeredFlag) return;
checkAnswer(null, null);
}

// =========================
// Điều khiển chung: restart, presets
// =========================
function restartGame() {
clearInterval(timerInterval);
stopSpeak();
document.getElementById("setup").style.display = "block";
document.getElementById("game").style.display = "none";
questionEl.textContent = " ";
subnoteEl.textContent = " ";
endEl.textContent = "";
timerText.textContent = "⏱ 0 giây";
timerBar.style.width = "0%";
}

// =========================
// Nghe lại (repeat) và ẩn/hiện câu hỏi
// =========================
function repeatAudio() {
if (presentAs !== "audio") {
    // Nếu mode text, vẫn có thể đọc lại nếu bạn muốn
    speak(formatQuestionForSpeech(currentQuestion));
    return;
}
// phát lại bằng speechSynthesis
speak(formatQuestionForSpeech(currentQuestion));
}

function toggleQuestion() {
// làm việc trên element questionEl (class hidden-question)
if (questionEl.classList.contains("hidden-question")) {
    questionEl.classList.remove("hidden-question");
} else {
    questionEl.classList.add("hidden-question");
}
updateToggleButtonText();
}

function updateToggleButtonText() {
// Khi câu hỏi đang hiện thì text sẽ là "Ẩn câu hỏi" và ngược lại
if (questionEl.classList.contains("hidden-question")) {
    toggleQBtn.textContent = "Hiện câu hỏi";
} else {
    toggleQBtn.textContent = "Ẩn câu hỏi";
}
}

// =========================
// Cập nhật điểm UI
// =========================
function updateScoreUI() {
scoreEl.textContent = `Điểm: ${scorePoints}`;
}

// =========================
// Sự kiện Enter trong input (chế độ cũ vẫn giữ)
// =========================
document
.getElementById("answer")
.addEventListener("keydown", function (e) {
    if (viewOnlyMode) return;
    if (e.key === "Enter") {
    e.preventDefault();
    if (!answeredFlag) {
        // Behave like submit once
        onSubmitInput();
    }
    }
});

// =========================
// Khi rời trang: stop audio & timers
// =========================
window.addEventListener("beforeunload", () => {
stopSpeak();
clearInterval(timerInterval);
});