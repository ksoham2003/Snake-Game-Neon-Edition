(() => {
    'use strict';

    const CELL_COUNT = 20;
    const STORAGE_KEY = 'snakeGame_highScore';
    const BASE_SPEED = 150;
    const SPEED_STEP = 12;
    const POINTS_PER_FOOD = 10;
    const LEVEL_UP_EVERY = 5;

    const DIR = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
    };

    const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const startOverlay = document.getElementById('startOverlay');
    const gameOverOv = document.getElementById('gameOverOverlay');
    const pauseOverlay = document.getElementById('pauseOverlay');
    const scoreEl = document.getElementById('currentScore');
    const highScoreEl = document.getElementById('highScore');
    const finalScoreEl = document.getElementById('finalScore');
    const newHighEl = document.getElementById('newHighScore');
    const levelEl = document.getElementById('levelDisplay');
    const canvasWrapper = document.getElementById('canvasWrapper');
    const btnStart = document.getElementById('btnStart');
    const btnRestart = document.getElementById('btnRestart');
    const btnResume = document.getElementById('btnResume');
    const btnPause = document.getElementById('btnPause');
    const pauseIcon = document.getElementById('pauseIcon');

    let snake, direction, nextDirection, food, score, highScore, level;
    let foodsEaten, gameLoop, isPaused, isRunning, cellSize;

    function sizeCanvas() {
        const wrapper = canvasWrapper.getBoundingClientRect();
        const size = Math.floor(wrapper.width);
        canvas.width = size;
        canvas.height = size;
        cellSize = size / CELL_COUNT;
    }

    function loadHighScore() {
        const stored = localStorage.getItem(STORAGE_KEY);
        highScore = stored ? parseInt(stored, 10) : 0;
        highScoreEl.textContent = highScore;
    }

    function saveHighScore() {
        localStorage.setItem(STORAGE_KEY, highScore);
        highScoreEl.textContent = highScore;
    }

    function spawnParticles() {
        const container = document.getElementById('bgParticles');
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div');
            p.className = 'bg-particle';
            container.appendChild(p);

            animateParticle(p);
        }
    }

    function animateParticle(el) {
        const startX = Math.random() * window.innerWidth;
        const startY = Math.random() * window.innerHeight;
        const size = 2 + Math.random() * 3;

        gsap.set(el, {
            x: startX,
            y: startY,
            width: size,
            height: size,
            opacity: 0,
        });

        gsap.to(el, {
            opacity: 0.15 + Math.random() * 0.25,
            duration: 1 + Math.random() * 2,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
        });

        gsap.to(el, {
            y: startY - 100 - Math.random() * 200,
            x: startX + (Math.random() - 0.5) * 100,
            duration: 8 + Math.random() * 12,
            repeat: -1,
            ease: 'none',
            onRepeat() {
                gsap.set(el, {
                    x: Math.random() * window.innerWidth,
                    y: window.innerHeight + 20,
                });
            },
        });
    }

    function showOverlay(el) {
        el.classList.remove('hidden');
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
        gsap.fromTo(
            el.querySelector('.overlay-content'),
            { scale: 0.85, y: 20 },
            { scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.7)' }
        );
    }

    function hideOverlay(el) {
        gsap.to(el, {
            opacity: 0,
            duration: 0.25,
            ease: 'power2.in',
            onComplete: () => el.classList.add('hidden'),
        });
    }

    function showScorePop(gridX, gridY, text) {
        const pop = document.createElement('div');
        pop.className = 'score-pop';
        pop.textContent = text;

        const rect = canvasWrapper.getBoundingClientRect();
        const px = gridX * cellSize + cellSize / 2;
        const py = gridY * cellSize;

        pop.style.left = px + 'px';
        pop.style.top = py + 'px';
        pop.style.transform = 'translate(-50%, -50%)';
        canvasWrapper.appendChild(pop);

        gsap.fromTo(pop,
            { opacity: 1, scale: 0.5, y: 0 },
            {
                opacity: 0,
                scale: 1.4,
                y: -40,
                duration: 0.8,
                ease: 'power2.out',
                onComplete: () => pop.remove(),
            }
        );
    }

    function animateFoodSpawn(x, y) {
        const ring = document.createElement('div');
        ring.className = 'food-glow-ring';

        const px = x * cellSize;
        const py = y * cellSize;
        const size = cellSize;

        ring.style.left = px + 'px';
        ring.style.top = py + 'px';
        ring.style.width = size + 'px';
        ring.style.height = size + 'px';
        canvasWrapper.appendChild(ring);

        gsap.fromTo(ring,
            { scale: 0.3, opacity: 1 },
            {
                scale: 2.5,
                opacity: 0,
                duration: 0.6,
                ease: 'power2.out',
                onComplete: () => ring.remove(),
            }
        );
    }

    function animateScoreUpdate() {
        gsap.fromTo(scoreEl,
            { scale: 1.5, color: '#00ff88' },
            { scale: 1, color: '#00ff88', duration: 0.35, ease: 'back.out(2)' }
        );
    }

    function animateHighScore() {
        gsap.fromTo(highScoreEl,
            { scale: 1.6, color: '#ff2d75' },
            { scale: 1, color: '#ffe14d', duration: 0.5, ease: 'elastic.out(1, 0.4)' }
        );
    }

    function shakeCanvas() {
        gsap.to(canvasWrapper, {
            x: 8,
            duration: 0.05,
            yoyo: true,
            repeat: 5,
            ease: 'power1.inOut',
            onComplete: () => gsap.set(canvasWrapper, { x: 0 }),
        });
    }

    function levelUpFlash() {
        gsap.fromTo(canvasWrapper,
            { borderColor: 'rgba(0, 229, 255, 0.8)', boxShadow: '0 0 40px rgba(0, 229, 255, 0.5)' },
            {
                borderColor: 'rgba(0, 255, 136, 0.15)',
                boxShadow: '0 0 20px rgba(0, 255, 136, 0.25)',
                duration: 0.8,
                ease: 'power2.out'
            }
        );

        gsap.fromTo(levelEl,
            { scale: 1.8, color: '#00e5ff' },
            { scale: 1, color: '#00e5ff', duration: 0.5, ease: 'elastic.out(1, 0.5)' }
        );
    }

    function animateTitleEntrance() {
        const title = startOverlay.querySelector('.overlay-title');
        const subtitle = startOverlay.querySelector('.overlay-subtitle');
        const btn = startOverlay.querySelector('.btn-play');
        const hint = startOverlay.querySelector('.overlay-hint');

        const tl = gsap.timeline();
        tl.fromTo(title, { opacity: 0, y: -30, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.7)' })
            .fromTo(subtitle, { opacity: 0, letterSpacing: '20px' }, { opacity: 1, letterSpacing: '6px', duration: 0.5, ease: 'power2.out' }, '-=0.3')
            .fromTo(btn, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, '-=0.2')
            .fromTo(hint, { opacity: 0 }, { opacity: 1, duration: 0.3 }, '-=0.1');
    }

    function resetGame() {
        const mid = Math.floor(CELL_COUNT / 2);
        snake = [
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
            { x: mid - 2, y: mid },
        ];
        direction = 'right';
        nextDirection = 'right';
        score = 0;
        foodsEaten = 0;
        level = 1;
        isPaused = false;
        isRunning = false;

        scoreEl.textContent = '0';
        levelEl.textContent = '1';
        pauseIcon.textContent = '⏸';

        spawnFood();
    }

    function spawnFood() {
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * CELL_COUNT),
                y: Math.floor(Math.random() * CELL_COUNT),
            };
        } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));

        food = pos;
        animateFoodSpawn(food.x, food.y);
    }

    function drawCell(x, y, color, glow) {
        const px = x * cellSize;
        const py = y * cellSize;
        const padding = 1;

        if (glow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
        }

        ctx.fillStyle = color;
        roundRect(ctx, px + padding, py + padding, cellSize - padding * 2, cellSize - padding * 2, 4);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }

    function roundRect(context, x, y, w, h, r) {
        context.beginPath();
        context.moveTo(x + r, y);
        context.lineTo(x + w - r, y);
        context.quadraticCurveTo(x + w, y, x + w, y + r);
        context.lineTo(x + w, y + h - r);
        context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        context.lineTo(x + r, y + h);
        context.quadraticCurveTo(x, y + h, x, y + h - r);
        context.lineTo(x, y + r);
        context.quadraticCurveTo(x, y, x + r, y);
        context.closePath();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const pulseScale = 0.85 + 0.15 * Math.sin(Date.now() / 200);
        const foodPx = food.x * cellSize + cellSize / 2;
        const foodPy = food.y * cellSize + cellSize / 2;
        const foodRadius = (cellSize / 2 - 2) * pulseScale;

        ctx.shadowColor = '#ff2d75';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ff2d75';
        ctx.beginPath();
        ctx.arc(foodPx, foodPy, foodRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        snake.forEach((seg, i) => {
            const t = i / snake.length;
            const r = Math.round(0 + t * 0);
            const g = Math.round(255 - t * 130);
            const b = Math.round(136 - t * 80);
            const color = `rgb(${r}, ${g}, ${b})`;
            drawCell(seg.x, seg.y, color, i === 0);
        });

        if (snake.length > 0) {
            const head = snake[0];
            const d = DIR[direction];
            const eyeX = head.x * cellSize + cellSize / 2 + d.x * cellSize * 0.2;
            const eyeY = head.y * cellSize + cellSize / 2 + d.y * cellSize * 0.2;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, cellSize * 0.12, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0a0a1a';
            ctx.beginPath();
            ctx.arc(eyeX + d.x * 1.5, eyeY + d.y * 1.5, cellSize * 0.06, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function tick() {
        direction = nextDirection;
        const head = snake[0];
        const d = DIR[direction];
        const newHead = { x: head.x + d.x, y: head.y + d.y };

        if (newHead.x < 0 || newHead.x >= CELL_COUNT || newHead.y < 0 || newHead.y >= CELL_COUNT) {
            gameOver();
            return;
        }

        if (snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
            gameOver();
            return;
        }

        snake.unshift(newHead);

        if (newHead.x === food.x && newHead.y === food.y) {
            score += POINTS_PER_FOOD;
            foodsEaten++;
            scoreEl.textContent = score;
            animateScoreUpdate();
            showScorePop(food.x, food.y, `+${POINTS_PER_FOOD}`);

            if (score > highScore) {
                highScore = score;
                saveHighScore();
                animateHighScore();
            }

            const newLevel = Math.floor(foodsEaten / LEVEL_UP_EVERY) + 1;
            if (newLevel > level) {
                level = newLevel;
                levelEl.textContent = level;
                levelUpFlash();
                restartLoop();
            }

            spawnFood();
        } else {
            snake.pop();
        }

        draw();
    }

    function getSpeed() {
        return Math.max(50, BASE_SPEED - (level - 1) * SPEED_STEP);
    }

    function startLoop() {
        gameLoop = setInterval(tick, getSpeed());
    }

    function stopLoop() {
        clearInterval(gameLoop);
    }

    function restartLoop() {
        stopLoop();
        startLoop();
    }

    function startGame() {
        resetGame();
        isRunning = true;
        hideOverlay(startOverlay);
        draw();
        setTimeout(() => startLoop(), 300);
    }

    function gameOver() {
        stopLoop();
        isRunning = false;
        shakeCanvas();

        finalScoreEl.textContent = score;

        if (score >= highScore && score > 0) {
            newHighEl.classList.remove('hidden');
        } else {
            newHighEl.classList.add('hidden');
        }

        gsap.to(canvasWrapper, {
            duration: 0.12,
            onUpdate: () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                snake.forEach(seg => drawCell(seg.x, seg.y, '#ff2d75', true));
            },
            onComplete: () => {
                setTimeout(() => showOverlay(gameOverOv), 400);
            },
        });
    }

    function restartGame() {
        hideOverlay(gameOverOv);
        resetGame();
        isRunning = true;
        draw();
        setTimeout(() => startLoop(), 300);
    }

    function togglePause() {
        if (!isRunning) return;

        if (isPaused) {
            isPaused = false;
            hideOverlay(pauseOverlay);
            pauseIcon.textContent = '⏸';
            startLoop();
        } else {
            isPaused = true;
            stopLoop();
            pauseIcon.textContent = '▶';
            showOverlay(pauseOverlay);
        }
    }

    function handleDirection(dir) {
        if (!isRunning || isPaused) return;
        if (dir === OPPOSITE[direction]) return;
        nextDirection = dir;
    }

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();

        const keyMap = {
            arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
            w: 'up', s: 'down', a: 'left', d: 'right',
        };

        if (keyMap[key]) {
            e.preventDefault();
            handleDirection(keyMap[key]);
        }

        if (key === ' ' || key === 'escape') {
            e.preventDefault();
            if (!isRunning && startOverlay.classList.contains('hidden') && !gameOverOv.classList.contains('hidden')) return;
            if (isRunning) togglePause();
        }

        if (key === 'enter') {
            if (!startOverlay.classList.contains('hidden')) startGame();
            if (!gameOverOv.classList.contains('hidden')) restartGame();
        }
    });

    document.querySelectorAll('.dpad-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dir = btn.getAttribute('data-dir');
            handleDirection(dir);
        });

        btn.addEventListener('pointerdown', () => {
            gsap.to(btn, { scale: 0.88, duration: 0.1 });
        });
        btn.addEventListener('pointerup', () => {
            gsap.to(btn, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
        });
    });

    let touchStartX = 0, touchStartY = 0;
    canvas.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < 20) return;

        if (absDx > absDy) {
            handleDirection(dx > 0 ? 'right' : 'left');
        } else {
            handleDirection(dy > 0 ? 'down' : 'up');
        }
    }, { passive: true });

    btnStart.addEventListener('click', startGame);
    btnRestart.addEventListener('click', restartGame);
    btnResume.addEventListener('click', togglePause);
    btnPause.addEventListener('click', togglePause);

    window.addEventListener('resize', () => {
        sizeCanvas();
        if (isRunning || !startOverlay.classList.contains('hidden')) draw();
    });

    function init() {
        sizeCanvas();
        loadHighScore();
        resetGame();
        draw();
        spawnParticles();
        animateTitleEntrance();
    }

    init();
})();
