let currentQuestions = [];
let currentQuestionIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let timerInterval;
let seconds = 0;
let playerName = "";
let currentLevel = 1;
let isGameActive = false;
const GAME_TYPE = 1; // Игра 1

const welcomeScreen = document.getElementById('welcome-screen');
const gameScreen = document.getElementById('game-screen');
const resultsScreen = document.getElementById('results-screen');
const playerNameInput = document.getElementById('player-name');
const displayName = document.getElementById('display-name');
const timerEl = document.getElementById('timer');
const scoreCorrectEl = document.getElementById('score-correct');
const scoreWrongEl = document.getElementById('score-wrong');
const shapeDisplay = document.getElementById('shape-display');
const formulasContainer = document.getElementById('formulas-container');
const progressBar = document.getElementById('progress-bar');

document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playerName = playerNameInput.value.trim();
        if (!playerName) { alert('Пожалуйста, введите ваши Фамилию и Имя!'); playerNameInput.focus(); return; }
        currentLevel = parseInt(btn.dataset.level);
        startGame();
    });
});

async function startGame() {
    try {
        const response = await fetch('/api/get_questions', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({level: currentLevel, game_type: GAME_TYPE})
        });
        const data = await response.json();
        
        currentQuestions = data.questions;
        currentQuestionIndex = 0; correctCount = 0; wrongCount = 0; seconds = 0;
        
        updateHUD(); displayName.textContent = playerName;
        welcomeScreen.style.display = 'none'; resultsScreen.style.display = 'none'; gameScreen.style.display = 'block';
        isGameActive = true; startTimer(); showQuestion();
    } catch (error) { console.error("Ошибка:", error); alert("Не удалось связаться с сервером."); }
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { seconds++; timerEl.textContent = formatTime(seconds); }, 1000);
}

function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function updateHUD() {
    scoreCorrectEl.textContent = correctCount;
    scoreWrongEl.textContent = wrongCount;
    const progress = (currentQuestionIndex / currentQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;
}

function showQuestion() {
    if (!isGameActive) return;
    if (currentQuestionIndex >= currentQuestions.length) { endGame(); return; }
    
    const q = currentQuestions[currentQuestionIndex];
    shapeDisplay.textContent = q.text;
    
    formulasContainer.innerHTML = '';
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'formula-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => handleAnswer(q.id, opt, btn));
        formulasContainer.appendChild(btn);
    });
    updateHUD();
}

async function handleAnswer(questionId, selectedOption, clickedBtn) {
    if (!isGameActive) return;
    const allBtns = formulasContainer.querySelectorAll('.formula-btn');
    allBtns.forEach(b => b.disabled = true);
    
    try {
        const response = await fetch('/api/check_answer', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: questionId, selected: selectedOption, game_type: GAME_TYPE})
        });
        const result = await response.json();
        
        if (result.is_correct) {
            correctCount++; clickedBtn.classList.add('correct'); setTimeout(nextQuestion, 400);
        } else {
            wrongCount++; clickedBtn.classList.add('wrong');
            allBtns.forEach(b => { if (b.textContent === result.correct_answer) b.classList.add('correct'); });
            setTimeout(nextQuestion, 1500);
        }
        updateHUD();
    } catch (error) { allBtns.forEach(b => b.disabled = false); }
}

function nextQuestion() { currentQuestionIndex++; showQuestion(); }

async function endGame() {
    isGameActive = false; clearInterval(timerInterval);
    gameScreen.style.display = 'none'; resultsScreen.style.display = 'block';
    
    const total = correctCount + wrongCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    
    document.getElementById('final-correct').textContent = correctCount;
    document.getElementById('final-wrong').textContent = wrongCount;
    document.getElementById('final-time').textContent = formatTime(seconds);
    document.getElementById('accuracy-badge').textContent = `${accuracy}% точность`;
    
    try {
        const response = await fetch('/api/submit_game', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: playerName, level: currentLevel, game_type: GAME_TYPE, score: correctCount, wrong: wrongCount, time: seconds})
        });
        const data = await response.json();
        document.getElementById('result-link').value = window.location.origin + data.result_url;
    } catch (error) { document.getElementById('result-link').value = "Ошибка сохранения"; }
}

document.getElementById('copy-btn').addEventListener('click', () => {
    const linkInput = document.getElementById('result-link');
    linkInput.select(); linkInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(linkInput.value);
    const btn = document.getElementById('copy-btn'); btn.textContent = 'Скопировано!';
    setTimeout(() => btn.textContent = 'Копировать', 2000);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    resultsScreen.style.display = 'none'; welcomeScreen.style.display = 'block';
    playerNameInput.value = ''; progressBar.style.width = '0%';
});