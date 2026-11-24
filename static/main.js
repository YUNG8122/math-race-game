const $ = id => document.getElementById(id);
const getTimeStr = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

const SVGS = {
    "Квадрат": '<svg viewBox="0 0 100 100"><rect x="25" y="25" width="50" height="50" rx="4" fill="rgba(79,70,229,.05)" stroke="#4f46e5" stroke-width="4"/></svg>',
    "Прямоугольник": '<svg viewBox="0 0 100 100"><rect x="15" y="30" width="70" height="40" rx="4" fill="rgba(79,70,229,.05)" stroke="#4f46e5" stroke-width="4"/></svg>',
    "Треугольник": '<svg viewBox="0 0 100 100"><polygon points="50,20 85,80 15,80" fill="rgba(79,70,229,.05)" stroke="#4f46e5" stroke-width="4" stroke-linejoin="round"/></svg>',
    "Круг": '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="rgba(79,70,229,.05)" stroke="#4f46e5" stroke-width="4"/></svg>',
    "Трапеция": '<svg viewBox="0 0 100 100"><polygon points="30,25 70,25 85,75 15,75" fill="rgba(79,70,229,.05)" stroke="#4f46e5" stroke-width="4" stroke-linejoin="round"/></svg>',
    "Ромб": '<svg viewBox="0 0 100 100"><polygon points="50,15 85,50 50,85 15,50" fill="rgba(79,70,229,.05)" stroke="#4f46e5" stroke-width="4" stroke-linejoin="round"/></svg>'
};

function formatMath(text) {
    if (!text) return text;
    let f = text.replace(/([a-zA-Z])(\d+)/g, '$1<sub>$2</sub>');
    return f.replace(/(\([^)]+\)|[a-zA-Z0-9\s\.\*·π²³<>\/]+)\s*\/\s*(\d+)/g, (m, n, d) => {
        let c = n.trim(); if (c.startsWith('(') && c.endsWith(')')) c = c.slice(1, -1);
        return `<span class="math-fraction"><span class="num">${c}</span><span class="den">${d}</span></span>`;
    });
}

// ТЕМНАЯ ТЕМА
if (localStorage.getItem('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
if ($('theme-toggle')) {
    $('theme-toggle').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    $('theme-toggle').onclick = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        $('theme-toggle').textContent = isDark ? '🌙' : '☀️';
    };
}


if (PAGE_TYPE === 'LOBBY') {
    if ($('login-btn')) $('login-btn').onclick = async () => {
        const name = $('login-name').value.trim();
        if (!name) return Swal.fire({ title: 'Ошибка!', text: 'Введите имя', icon: 'error', confirmButtonColor: '#4f46e5' });
        const res = await fetch('/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name}) });
        if (res.ok) location.reload();
    };
    
    // Формула дня
    const formulas = [
        { text: "S = π · R²", name: "Площадь круга" },
        { text: "P = 4 · a", name: "Периметр квадрата" },
        { text: "S = (a · h) / 2", name: "Площадь треугольника" },
        { text: "S = (d1 · d2) / 2", name: "Площадь ромба" },
        { text: "S = ((a + b) / 2) · h", name: "Площадь трапеции" }
    ];
    
    const daily = formulas[Math.floor(Math.random() * formulas.length)];
    if ($('daily-formula')) $('daily-formula').textContent = daily.text;
    
    // Кнопка "Узнать ответ"
    if ($('check-formula-btn')) $('check-formula-btn').onclick = () => {
        Swal.fire({ 
            title: 'Формула дня', 
            html: `Эта формула используется для вычисления:<br><br><b style="font-size:24px; color:#4f46e5;">${daily.name}</b>`, 
            icon: 'info', 
            confirmButtonText: 'Запомнил!', 
            confirmButtonColor: '#4f46e5' 
        });
    };
}

// --- РЕЙТИНГ ---
if (PAGE_TYPE === 'LEADERBOARD') {
    fetch('/api/leaderboard').then(r => r.json()).then(data => {
        [1, 2, 3].forEach(g => {
            const el = $(`lb-${g}`);
            if (el) {
                if (window.autoAnimate) autoAnimate(el);
                const list = data[g] || [];
                el.innerHTML = list.map((r, i) => `
                    <div class="lb-item" style="padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 16px;">
                        <span style="font-weight: 600;"><b>${i+1}.</b> ${r.user_name}</span>
                        <b style="color:var(--primary); font-weight: 800;">${r.score} очк.</b>
                    </div>
                `).join('') || '<div style="color:var(--text-muted); text-align:center; padding: 20px;">Нет результатов</div>';
            }
        });
    });
}

// --- ИГРЫ 1 и 2 ---
if (PAGE_TYPE === 'GAME1' || PAGE_TYPE === 'GAME2') {
    const G_TYPE = PAGE_TYPE === 'GAME1' ? 1 : 2;
    let st = { score: 0, correct: 0, wrong: 0, lives: 3, combo: 0, idx: 0, qs: [], active: false, time: 0, level: 1 }, timer;
    
    async function init(lvl = 1) {
        if ($('welcome-screen')) $('welcome-screen').style.display = 'none';
        $('game-screen').style.display = 'block'; $('results-screen').style.display = 'none';
        st = { score: 0, correct: 0, wrong: 0, lives: 3, combo: 0, idx: 0, qs: [], active: true, time: 0, level: lvl };
        
        clearInterval(timer);
        timer = setInterval(() => { st.time++; if($('timer')) $('timer').textContent = getTimeStr(st.time); }, 1000);
        
        const res = await fetch('/api/get_questions', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({game_type: G_TYPE, level: lvl}) });
        st.qs = (await res.json()).questions;
        showQ();
    }

    if (PAGE_TYPE === 'GAME1') init(1); 
    else document.querySelectorAll('.level-btn').forEach(b => b.onclick = () => init(parseInt(b.dataset.level)));

    function update() {
        if ($('lives-display')) $('lives-display').textContent = '❤️'.repeat(st.lives) + '🖤'.repeat(3 - st.lives);
        if ($('combo-display')) { $('combo-display').textContent = `x${st.combo}`; $('combo-display').style.opacity = st.combo > 1 ? '1' : '0'; }
        if ($('score-correct')) $('score-correct').textContent = st.correct;
        if ($('q-progress')) $('q-progress').textContent = `${st.idx + 1}/${st.qs.length}`;
        if ($('progress-bar')) $('progress-bar').style.width = `${(st.idx / st.qs.length) * 100}%`;
    }

    function showQ() {
        if (!st.active) return;
        if (st.idx >= st.qs.length || st.lives <= 0) return end();
        const q = st.qs[st.idx];
        
        if ($('shape-display')) {
            if (SVGS[q.shape]) { $('shape-display').innerHTML = SVGS[q.shape]; $('shape-display').style.display = 'flex'; }
            else $('shape-display').style.display = 'none';
        }
        if ($('question-text')) {
            if (q.text) { $('question-text').innerHTML = formatMath(q.text); $('question-text').style.display = 'block'; }
            else $('question-text').style.display = 'none';
        }
        update();

        const cont = $('formulas-container'); cont.innerHTML = '';
        q.options.forEach(opt => {
            const b = document.createElement('button');
            b.className = 'formula-btn'; b.dataset.raw = opt; 
            b.innerHTML = `<span style="color:var(--text-muted); font-size:14px; margin-right:10px;">${q.options.indexOf(opt)+1}</span> ${formatMath(opt)}`;
            b.onclick = () => check(q, opt, b, cont); cont.appendChild(b);
        });
        
        document.onkeydown = (e) => {
            if (['1','2','3','4'].includes(e.key)) {
                const btns = cont.querySelectorAll('.formula-btn');
                if (btns[parseInt(e.key)-1] && !btns[parseInt(e.key)-1].disabled) btns[parseInt(e.key)-1].click();
            }
        };
    }

    async function check(q, sel, btn, cont) {
        cont.querySelectorAll('button').forEach(b => b.disabled = true);
        const res = await fetch('/api/check_answer', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: q.id, selected: sel}) });
        const d = await res.json();

        if (d.is_correct) {
            st.correct++; st.combo++; st.score += 100 * st.combo;
            btn.classList.add('correct'); confetti({ particleCount: 30, spread: 50 });
            setTimeout(() => { st.idx++; showQ(); }, 600);
        } else {
            st.wrong++; st.combo = 0; st.lives--; btn.classList.add('wrong');
            Swal.fire({ title: 'Ошибка! ❌', html: `<b>${d.explanation}</b><br><br>Правильный ответ: <span style="color:var(--success); font-size: 18px;">${formatMath(d.correct_answer)}</span>`, icon: 'error', confirmButtonText: 'Понятно', confirmButtonColor: '#4f46e5' });
            setTimeout(() => { st.idx++; showQ(); }, 2500);
        }
    }

    async function end() {
        st.active = false; clearInterval(timer);
        $('game-screen').style.display = 'none'; $('results-screen').style.display = 'block';
        if ($('final-score')) $('final-score').textContent = st.score;
        if ($('game-over-reason')) $('game-over-reason').textContent = st.lives <= 0 ? "Жизни закончились!" : "Игра пройдена!";
        
        const res = await fetch('/api/submit_game', { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({
                name: USERNAME, 
                game_type: G_TYPE, 
                level: st.level, 
                score: st.correct, 
                wrong: st.wrong, 
                time: st.time
            }) 
        });
        window.resultUrl = window.location.origin + (await res.json()).result_url; 
    }
}

// --- ИГРА 3 (БЛИЦ) ---
if (PAGE_TYPE === 'GAME3') {
    let st = { score: 0, correct: 0, wrong: 0, lives: 3, idx: 0, active: false, timeLeft: 300, sid: null, spinning: false }, timer;

    if ($('start-blitz-btn')) $('start-blitz-btn').onclick = async () => {
        $('welcome-screen').style.display = 'none'; $('game-screen').style.display = 'block';
        st.active = true; st.score = 0; st.correct = 0; st.wrong = 0; st.lives = 3; st.idx = 0; st.timeLeft = 300;
        $('score').textContent = '0'; $('lives-display').textContent = '❤️❤️❤️'; $('q-counter').textContent = '1/6';
        
        const res = await fetch('/api/speedrun/start', { method: 'POST' }); st.sid = (await res.json()).session_id;
        
        clearInterval(timer);
        timer = setInterval(() => {
            if (!st.active) return;
            st.timeLeft--; $('timer').textContent = getTimeStr(st.timeLeft);
            $('progress-bar').style.width = `${(st.timeLeft / 300) * 100}%`;
            if (st.timeLeft <= 0) end();
        }, 1000);
        
        $('wheel-container').style.display = 'flex'; $('spin-btn').style.display = 'block'; $('grid-container').style.display = 'none';
    };

    if ($('spin-btn')) $('spin-btn').onclick = () => {
        if (st.spinning) return; st.spinning = true;
        $('spin-btn').style.display = 'none'; $('wheel').classList.add('spinning');
        
        setTimeout(async () => {
            $('wheel').classList.remove('spinning'); $('wheel-container').style.display = 'none';
            const res = await fetch('/api/speedrun/get', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ session_id: st.sid }) });
            const data = await res.json();
            
            $('svg-container').innerHTML = `<svg viewBox="-10 -10 120 120" style="width:100%; height:auto; max-height: 250px;"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#cbd5e1" stroke-width="0.8"/></pattern></defs><rect x="-10" y="-10" width="120" height="120" fill="url(#grid)" /><polygon id="shape-poly" points="${data.points}" fill="rgba(79,70,229,.05)" stroke="#4f46e5" stroke-width="2.5" stroke-linejoin="round" style="transition: all 0.3s;"/></svg>`;
            $('grid-container').style.display = 'flex'; $('answer-input').value = ''; $('answer-input').disabled = false; $('answer-input').focus(); $('submit-answer-btn').disabled = false;
            window.curId = data.id; st.spinning = false;
        }, 1500);
    };

    if ($('submit-answer-btn')) $('submit-answer-btn').onclick = async () => {
        const inp = $('answer-input'); if (!inp.value || inp.disabled) return;
        inp.disabled = true; $('submit-answer-btn').disabled = true;
        const res = await fetch('/api/speedrun/check', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: window.curId, answer: inp.value}) });
        const data = await res.json();
        
        if (data.is_correct) {
            st.correct++; st.score++; $('score').textContent = st.score; confetti({ particleCount: 30 });
            $('shape-poly').setAttribute('stroke', '#10b981'); $('shape-poly').setAttribute('fill', 'rgba(16, 185, 129, 0.2)');
        } else {
            st.wrong++; st.lives--; $('lives-display').textContent = '❤️'.repeat(st.lives) + '🖤'.repeat(3 - st.lives);
            $('shape-poly').setAttribute('stroke', '#ef4444'); $('shape-poly').setAttribute('fill', 'rgba(239, 68, 68, 0.2)');
            $('svg-container').innerHTML += `<div style="color:var(--danger); font-weight:bold; margin-top:10px;">Правильно: ${data.correct_answer}</div>`;
        }
        
        st.idx++; 
        $('q-counter').textContent = `${Math.min(st.idx + 1, 6)}/6`;

        if (st.idx >= 6 || st.lives <= 0) { setTimeout(end, 2000); } 
        else { setTimeout(() => { $('grid-container').style.display = 'none'; $('wheel-container').style.display = 'flex'; $('spin-btn').style.display = 'block'; }, 1500); }
    };

    if ($('answer-input')) $('answer-input').onkeypress = (e) => { if (e.key === 'Enter') $('submit-answer-btn').click(); };

    async function end() {
        st.active = false; clearInterval(timer);
        $('game-screen').style.display = 'none'; $('results-screen').style.display = 'block';
        $('final-score').textContent = st.score;
        $('game-over-reason').textContent = st.lives <= 0 ? "Жизни закончились!" : "Вы прошли все задания!";
        
        const res = await fetch('/api/submit_game', { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({
                name: USERNAME, 
                game_type: 3, 
                level: 1, 
                score: st.correct, 
                wrong: st.wrong, 
                time: 300 - st.timeLeft
            }) 
        });
        window.resultUrl = window.location.origin + (await res.json()).result_url;
    }
}

// --- КНОПКИ ---
if ($('copy-btn')) {
    $('copy-btn').addEventListener('click', () => {
        if (!window.resultUrl) return;
        navigator.clipboard.writeText(window.resultUrl).then(() => {
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
            Toast.fire({ icon: 'success', title: 'Ссылка для учителя скопирована!' });
        });
    });
}
if ($('restart-btn')) $('restart-btn').addEventListener('click', () => { window.location.reload(); });