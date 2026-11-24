// static/game3.js
let playerName = "";
let correctCount = 0;
let wrongCount = 0;
let totalTime = 300; // 5 минут в секундах
let timerInterval;
let currentProblemId = null;
let isGameActive = false;
const GAME_TYPE = 3;

const welcomeScreen = document.getElementById('welcome-screen');
const gameScreen = document.getElementById('game-screen');
const resultsScreen = document.getElementById('results-screen');
const playerNameInput = document.getElementById('player-name');
const displayName = document.getElementById('display-name');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer-input');
const submitBtn = document.getElementById('submit-answer-btn');
const progressBar = document.getElementById('progress-bar');

document.getElementById('start-blitz-btn').addEventListener('click', () => {
    playerName = playerNameInput.value.trim();
    if (!playerName) { alert('Введите имя!'); return; }
    startGame();
});

async function startGame() {
    correctCount = 0; wrongCount = 0; totalTime = 300;
    updateHUD();
    displayName.textContent = playerName;
    
    welcomeScreen.style.display = 'none'; resultsScreen.style.display = 'none'; gameScreen.style.display = 'block';
    isGameActive = true;
    
    answerInput.focus();
    startTimer();
    loadNextProblem();
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        totalTime--;
        timerEl.textContent = formatTime(totalTime);
        
        // Обновляем прогресс-бар (от 100% до 0%)
        const percent = (totalTime / 300) * 100;
        progressBar.style.width = `${percent}%`;
        
        // Меняем цвет на красный, когда остается меньше минуты
        if (totalTime <= 60) {
            timerEl.classList.add('timer-danger');
            progressBar.style.background = 'var(--danger)';
        }

        if (totalTime <= 0) {
            endGame();
        }
    }, 1000);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function updateHUD() {
    scoreEl.textContent = correctCount;
}

async function loadNextProblem() {
    if (!isGameActive) return;
    answerInput.value = '';
    answerInput.classList.remove('correct', 'wrong');
    answerInput.disabled = false;
    submitBtn.disabled = false;
    
    try {
        const response = await fetch('/api/speedrun/get');
        const data = await response.json();
        currentProblemId = data.id;
        questionText.innerHTML = data.text;
        answerInput.focus();
    } catch (error) {
        console.error("Ошибка загрузки задачи", error);
    }
}

async function submitAnswer() {
    if (!isGameActive || !currentProblemId || answerInput.disabled) return;
    
    const userAnswer = answerInput.value.trim();
    if (userAnswer === '') return;
    
    answerInput.disabled = true;
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/speedrun/check', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: currentProblemId, answer: userAnswer})
        });
        const result = await response.json();
        
        if (result.is_correct) {
            correctCount++;
            updateHUD();
            answerInput.classList.add('correct');
            // Мгновенно грузим следующий вопрос
            setTimeout(loadNextProblem, 200);
        } else {
            wrongCount++;
            answerInput.classList.add('wrong');
            // Показываем правильный ответ на 1.5 секунды
            questionText.innerHTML += `<br><span style="color: var(--danger); font-size: 20px;">Правильный ответ: ${result.correct_answer}</span>`;
            setTimeout(loadNextProblem, 1500);
        }
    } catch (error) {
        answerInput.disabled = false;
        submitBtn.disabled = false;
    }
}

// Обработка нажатия на кнопку и клавишу Enter
submitBtn.addEventListener('click', submitAnswer);
answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitAnswer();
});

async function endGame() {
    isGameActive = false;
    clearInterval(timerInterval);
    gameScreen.style.display = 'none';
    resultsScreen.style.display = 'block';
    
    document.getElementById('final-correct').textContent = correctCount;
    document.getElementById('final-wrong').textContent = wrongCount;
    const total = correctCount + wrongCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    document.getElementById('accuracy-badge').textContent = `${accuracy}% точность`;
    
    try {
        const response = await fetch('/api/submit_game', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: playerName, level: 1, game_type: GAME_TYPE, score: correctCount, wrong: wrongCount, time: 300})
        });
        const data = await response.json();
        document.getElementById('result-link').value = window.location.origin + data.result_url;
    } catch (error) {
        document.getElementById('result-link').value = "Ошибка сохранения";
    }
}

document.getElementById('copy-btn').addEventListener('click', () => {
    const linkInput = document.getElementById('result-link');
    linkInput.select(); linkInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(linkInput.value);
    const btn = document.getElementById('copy-btn'); btn.textContent = 'Скопировано!';
    setTimeout(() => btn.textContent = 'Копировать', 2000);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    resultsScreen.style.display = 'none';
    welcomeScreen.style.display = 'block';
    playerNameInput.value = '';
    timerEl.classList.remove('timer-danger');
    progressBar.style.background = 'var(--success)';
    progressBar.style.width = '100%';
});