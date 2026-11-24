import sqlite3, uuid, random
from flask import Flask, render_template, request, jsonify, g, session, redirect

app = Flask(__name__)
app.secret_key = 'super_secret_key_school'
DATABASE = 'formulas.db'
ADMIN_PASSWORD = "admin123"
speedrun_sessions = {}

# --- УСКОРЕНИЕ: Кэширование статических файлов (CSS, JS, картинки) ---
@app.after_request
def add_header(response):
    if 'static' in request.path:
        # Браузер будет хранить файлы 1 год и не будет запрашивать их заново
        response.headers['Cache-Control'] = 'public, max-age=31536000'
    return response

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None: db.close()

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('DROP TABLE IF EXISTS questions')
        db.execute('DROP TABLE IF EXISTS records')
        
        db.execute('''CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)''')
        db.execute('''CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, game_type INTEGER, level INTEGER, 
            shape TEXT, text TEXT, correct TEXT, wrong1 TEXT, wrong2 TEXT, wrong3 TEXT, explanation TEXT)''')
        db.execute('''CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, user_name TEXT NOT NULL,
            game_type INTEGER NOT NULL, level INTEGER, score INTEGER NOT NULL, wrong INTEGER, time REAL NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
        
        # --- УСКОРЕНИЕ: Создаем индексы для быстрого поиска в базе данных ---
        db.execute('CREATE INDEX IF NOT EXISTS idx_questions_game_level ON questions (game_type, level)')
        db.execute('CREATE INDEX IF NOT EXISTS idx_records_score ON records (score DESC)')
        
        # Заполнение базы
        g1 = [
            (1, 1, "Квадрат", "", "S = a²", "S = a · b", "S = 2 · a", "S = a · h", "Площадь квадрата — это сторона в квадрате (a²)."),
            (1, 1, "Прямоугольник", "", "S = a · b", "S = a²", "S = 2 · (a + b)", "S = a · h", "Площадь прямоугольника — произведение смежных сторон."),
            (1, 1, "Треугольник", "", "S = (a · h) / 2", "S = a · h", "S = a + b + c", "S = a²", "Площадь треугольника — половина произведения основания на высоту."),
            (1, 1, "Круг", "", "S = π · R²", "C = 2 · π · R", "S = 2 · π · R", "S = π · d", "Площадь круга равна πR². 2πR — это длина окружности."),
            (1, 1, "Ромб", "", "S = (d1 · d2) / 2", "S = d1 · d2", "S = a · h", "S = (a + h) / 2", "Площадь ромба — половина произведения диагоналей."),
            (1, 1, "Трапеция", "", "S = ((a + b) / 2) · h", "S = (a + b) · h", "S = a · h", "S = a · b", "Площадь трапеции — полусумма оснований на высоту.")
        ]
        g2 = [
            (2, 1, "Треугольник", "Формула: s = a · h", "S = (a · h) / 2", "S = a · h", "S = a + b", "S = a²", "Забыли разделить на 2!"),
            (2, 1, "Квадрат", "Формула: P = 2 · a", "P = 4 · a", "P = 2 · a", "P = a²", "P = a + b", "Периметр квадрата — сумма всех 4 сторон."),
            (2, 1, "Круг", "Формула: S = 2 · π · r", "S = π · R²", "S = 2 · π · R", "S = π · d", "S = 2 · R", "Вы перепутали площадь и длину окружности."),
            (2, 2, "Прямоугольник", "Площадь (a=5, b=4).<br>Решение: S = 5 + 4 = 9", "S = 5 · 4 = 20", "S = (5+4) · 2 = 18", "S = 5 · 4 / 2 = 10", "S = 9", "Площадь прямоугольника - это произведение сторон."),
            (2, 2, "Квадрат", "Площадь (a=6).<br>Решение: S = 6 · 2 = 12", "S = 6² = 36", "S = 6 · 4 = 24", "S = 6 + 6 = 12", "S = 12", "Площадь квадрата — сторона в квадрате."),
            (2, 2, "Треугольник", "Площадь (a=4, h=5).<br>Решение: S = 4 · 5 = 20", "S = (4 · 5) / 2 = 10", "S = 4 + 5 = 9", "S = 4 · 5 · 2 = 40", "S = 20", "Площадь треугольника - половина произведения."),
            (2, 3, "", "Найдите неверное решение.<br>Задача: Площадь квадрата (a=4).", "S = 4 · 2 = 8", "S = 4² = 16", "S = 4 · 4 = 16", "S = 16", "Здесь ошибка! Площадь квадрата — это a², то есть 4 · 4 = 16."),
            (2, 3, "", "Найдите неверное решение.<br>Задача: Площадь треугольника (a=6, h=4).", "S = 6 · 4 = 24", "S = (6 · 4) / 2 = 12", "S = 0.5 · 6 · 4 = 12", "S = 12", "Здесь ошибка! Забыли разделить на 2. Правильно: (6 · 4) / 2 = 12."),
            (2, 3, "", "Найдите неверное решение.<br>Задача: Длина окружности (r=5).", "C = 3.14 · 5² = 78.5", "C = 2 · 3.14 · 5 = 31.4", "C = 3.14 · 10 = 31.4", "C = 31.4", "Здесь ошибка! Это формула площади круга. Длина окружности: 2πR = 2 · 3.14 · 5 = 31.4.")
        ]
        db.executemany('INSERT INTO questions (game_type, level, shape, text, correct, wrong1, wrong2, wrong3, explanation) VALUES (?,?,?,?,?,?,?,?,?)', g1 + g2)
        db.commit()

# === МАРШРУТЫ ===
@app.route('/login', methods=['POST'])
def login():
    name = request.json.get('name', '').strip()
    if not name: return jsonify({"error": "Имя пустое"}), 400
    db = get_db()
    try: db.execute('INSERT INTO users (name) VALUES (?)', (name,)); db.commit()
    except sqlite3.IntegrityError: pass 
    session['username'] = name
    return jsonify({"status": "ok"})

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect('/')

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if request.method == 'POST':
        if request.form.get('password') == ADMIN_PASSWORD:
            session['is_admin'] = True
            return redirect('/admin')
        return "Неверный пароль", 403
    if not session.get('is_admin'):
        return '<body style="font-family:sans-serif;padding:50px;text-align:center;"><h2>Вход в Админку</h2><form method="POST"><input type="password" name="password" placeholder="Пароль" style="padding:10px;margin:10px;"><button type="submit" style="padding:10px 20px;">Войти</button></form></body>'
    
    db = get_db()
    if request.args.get('add') == '1':
        db.execute('INSERT INTO questions (game_type, level, shape, text, correct, wrong1, wrong2, wrong3, explanation) VALUES (1, 1, ?, ?, ?, ?, ?, ?, ?)',
                   (request.args.get('shape'), request.args.get('text', ''), request.args.get('correct'), request.args.get('wrong1'), request.args.get('wrong2'), request.args.get('wrong3'), request.args.get('explanation')))
        db.commit()
    qs = db.execute('SELECT * FROM questions').fetchall()
    return render_template('admin.html', questions=qs)

@app.route('/')
def index(): return render_template('index.html')

@app.route('/leaderboard')
def leaderboard_page(): return render_template('leaderboard.html')

@app.route('/cheatsheet')
def cheatsheet(): return render_template('cheatsheet.html')

@app.route('/game1')
def game1(): return render_template('game1.html')

@app.route('/game2')
def game2(): return render_template('game2.html')

@app.route('/game3')
def game3(): return render_template('game3.html')

@app.route('/api/leaderboard')
def leaderboard():
    db = get_db()
    res = {}
    for g_type in [1, 2, 3]:
        records = db.execute(
            'SELECT user_name, MAX(score) as score, MIN(time) as time FROM records WHERE game_type = ? GROUP BY user_name ORDER BY score DESC, time ASC LIMIT 5', 
            (g_type,)
        ).fetchall()
        res[str(g_type)] = [dict(r) for r in records]
    return jsonify(res)

@app.route('/api/get_questions', methods=['POST'])
def get_questions():
    d = request.get_json()
    qs = get_db().execute('SELECT * FROM questions WHERE game_type = ? AND level = ?', (d.get('game_type', 1), d.get('level', 1))).fetchall()
    out = []
    for q in qs:
        opts = [q['correct'], q['wrong1'], q['wrong2'], q['wrong3']]
        random.shuffle(opts)
        out.append({"id": q['id'], "shape": q['shape'], "text": q['text'], "options": opts})
    random.shuffle(out)
    return jsonify({"questions": out})

@app.route('/api/check_answer', methods=['POST'])
def check_answer():
    d = request.get_json()
    q = get_db().execute('SELECT correct, explanation FROM questions WHERE id = ?', (d['id'],)).fetchone()
    return jsonify({"is_correct": d['selected'] == q['correct'], "correct_answer": q['correct'], "explanation": q['explanation']})

@app.route('/api/speedrun/start', methods=['POST'])
def speedrun_start():
    session_id = str(uuid.uuid4())
    shuffled = [
        {"id": "tree", "points": "50,10 80,40 70,40 90,60 70,60 80,80 60,80 60,90 40,90 40,80 20,80 30,60 10,60 30,40 20,40", "area": 19},
        {"id": "rocket", "points": "50,10 70,30 70,70 90,90 70,90 70,80 30,80 30,90 10,90 30,70 30,30", "area": 28},
        {"id": "lshape", "points": "20,20 60,20 60,40 80,40 80,80 20,80", "area": 32},
        {"id": "cross", "points": "30,10 60,10 60,30 80,30 80,60 60,60 60,80 30,80 30,60 10,60 10,30 30,30", "area": 33},
        {"id": "ushape", "points": "10,20 90,20 90,80 60,80 60,40 40,40 40,80 10,80", "area": 40},
        {"id": "zigzag", "points": "20,20 50,20 50,40 80,40 80,70 50,70 50,50 20,50", "area": 18}
    ]
    random.shuffle(shuffled)
    speedrun_sessions[session_id] = shuffled
    return jsonify({"session_id": session_id})

@app.route('/api/speedrun/get', methods=['POST'])
def speedrun_get():
    d = request.get_json(); session_id = d.get('session_id')
    if session_id not in speedrun_sessions or not speedrun_sessions[session_id]: return jsonify({"error": "Конец"}), 404
    return jsonify(speedrun_sessions[session_id].pop(0))

@app.route('/api/speedrun/check', methods=['POST'])
def speedrun_check():
    d = request.get_json()
    correct_ans = 19
    shapes = [{"id": "tree", "area": 19}, {"id": "rocket", "area": 28}, {"id": "lshape", "area": 32}, {"id": "cross", "area": 33}, {"id": "ushape", "area": 40}, {"id": "zigzag", "area": 18}]
    for s in shapes:
        if s['id'] == d.get('id'): correct_ans = s['area']
    try: user_ans = float(str(d.get('answer')).replace(',', '.'))
    except: return jsonify({"is_correct": False})
    return jsonify({"is_correct": abs(user_ans - correct_ans) < 0.01, "correct_answer": correct_ans})

@app.route('/api/submit_game', methods=['POST'])
def submit_game():
    d = request.get_json()
    r_uuid = str(uuid.uuid4())
    db = get_db()
    db.execute('INSERT INTO records (uuid, user_name, game_type, level, score, wrong, time) VALUES (?,?,?,?,?,?,?)',
               (r_uuid, d.get('name', 'Гость'), d['game_type'], d.get('level', 1), d['score'], d.get('wrong', 0), d['time']))
    db.commit()
    return jsonify({"result_url": f"/result/{r_uuid}"})

@app.route('/result/<r_uuid>')
def show_result(r_uuid):
    r = get_db().execute('SELECT * FROM records WHERE uuid = ?', (r_uuid,)).fetchone()
    return render_template('result.html', record=r) if r else ("Не найдено", 404)

# Инициализируем базу данных при запуске любым сервером (Flask или Waitress)
with app.app_context():
    init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)