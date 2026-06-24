/**
 * FLAPPY BIRD - COOPERATIVE EDITION
 * Estructura limpia basada en Clases y Programación Orientada a Objetos
 */

// --- CONFIGURACIÓN GLOBAL ---
const CONFIG = {
  boardWidth: 360,
  boardHeight: 640,
  baseHeight: 112,
  pipeWidth: 52,
  pipeHeight: 320,
  birdWidth: 34,
  birdHeight: 24,
  initialVelocityX: -2,
  gravity: 0.23,
  jumpForce: -5.2,
  baseGap: 115,
  minGap: 80,
  pipeInterval: 1500
};

// --- CONTROLLER: ENTORNO, MULTIMEDIA Y ESTADOS ---
class GameEngine {
  constructor() {
    this.board = document.getElementById("board");
    this.board.width = CONFIG.boardWidth;
    this.board.height = CONFIG.boardHeight;
    this.context = this.board.getContext("2d");
    // Players configuration (UI will allow changing up to maxPlayers)
    this.maxPlayers = 3;
    this.playersCount = 1; // configurable via UI
    this.playerBindings = [
      ["Space", "ArrowUp"],
      ["KeyW"],
      ["KeyI"],
      ["Numpad8"]
    ];
    this.toggleButton = document.getElementById("mode-toggle");

    // Loading screen
    this.loadingCount = 0;
    this.loadingTotal = 0;

    // Configuración del Modo
    this.isCoopMode = false; // Por defecto inicia en Solitario

    // Estados
    this.gameStarted = false;
    this.isDead = false;
    this.gameOver = false;
    this.score = 0;
    this.flashAlpha = 0;
    
    // Dificultad Dinámica
    this.currentVelocityX = CONFIG.initialVelocityX;
    this.currentGap = CONFIG.baseGap;

    // Componentes del bucle
    this.players = [];
    this.pipes = [];
    this.pipeTimer = null;

    this.initLoadingScreen();
    this.initMultimedia();
    this.setupEvents();
    this.createSettingsUI();
    this.resetGameContext();
    this.startLoop();
  }

  initMultimedia() {
    // UI Assets
    this.assets = {
      bgDay: this.loadImageAsset("./assets/background-day.png"),
      bgNight: this.loadImageAsset("./assets/background-night.png"),
      bg: null,
      pipeGreen: this.loadImageAsset("./assets/pipe-green.png"),
      pipeRed: this.loadImageAsset("./assets/pipe-red.png"),
      pipe: null,
      base: this.loadImageAsset("./assets/base.png"),
      message: this.loadImageAsset("./assets/message.png"),
      gameOver: this.loadImageAsset("./assets/gameover.png"),
      numbers: []
    };

    for (let i = 0; i < 10; i++) {
      this.assets.numbers.push(this.loadImageAsset(`./assets/${i}.png`));
    }

    // Audio Assets
    this.sounds = {
      wing: new Audio("./assets/sfx_wing.wav"),
      hit: new Audio("./assets/sfx_hit.wav"),
      point: new Audio("./assets/sfx_point.wav"),
      die: new Audio("./assets/sfx_die.wav"),
      swoosh: new Audio("./assets/sfx_swooshing.wav"),
      bgm: new Audio("./assets/bgm_mario.mp3")
    };
    this.sounds.bgm.loop = true;
  }

  setupEvents() {
    // 1. Controles de Teclado
    document.addEventListener("keydown", (e) => this.handleAction(e.code));

    // 2. Control de Clics / Pantalla Táctil
    const processInputPosition = (clientX) => {
      const rect = this.board.getBoundingClientRect();
      const clickXOnCanvas = ((clientX - rect.left) / rect.width) * CONFIG.boardWidth;

      // Mapear a una zona en función de playersCount
      const zoneWidth = CONFIG.boardWidth / Math.max(1, this.playersCount);
      const idx = Math.floor(clickXOnCanvas / zoneWidth);
      const playerIndex = Math.min(Math.max(0, idx), Math.max(0, this.playersCount - 1));

      if (this.playersCount === 1) {
        // En solitario cualquier click salta al P1
        this.handleAction('ClickAnywhere');
      } else {
        // Acción táctil específica por jugador: TouchP1..TouchP4
        this.handleAction(`TouchP${playerIndex + 1}`);
      }
    };

    // Eventos del Mouse
    this.board.addEventListener("mousedown", (e) => processInputPosition(e.clientX));

    // Eventos Táctiles (Soporta toques simultáneos multitouch)
    this.board.addEventListener("touchstart", (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        processInputPosition(e.changedTouches[i].clientX);
      }
    }, { passive: false });

    // 3. Botón Cambiar de Modo (si existe en el DOM)
    if (this.toggleButton) {
      this.toggleButton.addEventListener("click", () => this.toggleGameMode());
    }
  }

  createSettingsUI() {
    if (document.getElementById('flappy-settings')) return;
    const panel = document.createElement('div');
    panel.id = 'flappy-settings';
    panel.className = 'settings-panel';

    const title = document.createElement('div');
    title.textContent = 'Settings';
    title.className = 'settings-title';
    panel.appendChild(title);

    const modeRow = document.createElement('div');
    modeRow.className = 'settings-row';
    const modeLabel = document.createElement('span');
    modeLabel.textContent = 'Modo:';
    modeLabel.className = 'settings-player-label';
    const soloBtn = document.createElement('button');
    soloBtn.className = 'settings-action';
    soloBtn.textContent = 'Solitario';
    const coopBtn = document.createElement('button');
    coopBtn.className = 'settings-action';
    coopBtn.textContent = 'Coop';
    modeRow.appendChild(modeLabel);
    modeRow.appendChild(soloBtn);
    modeRow.appendChild(coopBtn);
    panel.appendChild(modeRow);

    const countRow = document.createElement('div');
    countRow.className = 'settings-row';
    const dec = document.createElement('button'); dec.textContent = '-';
    const inc = document.createElement('button'); inc.textContent = '+';
    const lbl = document.createElement('span'); lbl.textContent = `Players: ${this.playersCount}`;
    dec.className = 'settings-action';
    inc.className = 'settings-action';
    lbl.className = 'settings-label';
    const updatePlayerCountLabel = () => {
      lbl.textContent = `Players: ${this.isCoopMode ? this.playersCount : 1}`;
    };
    this.updateModeButton = () => {
      if (!this.toggleButton) return;
      if (this.isCoopMode) {
        this.toggleButton.textContent = `MODO: COOPERATIVO (${this.playersCount}P)`;
        this.toggleButton.style.backgroundColor = '#0088cc';
      } else {
        this.toggleButton.textContent = 'MODO: SOLITARIO';
        this.toggleButton.style.backgroundColor = '#f7701d';
      }
    };
    this.setCoopMode = (coop, count = null) => {
      this.isCoopMode = coop;
      if (coop) {
        if (count !== null) {
          this.playersCount = Math.min(this.maxPlayers, Math.max(2, count));
        } else {
          this.playersCount = Math.max(2, this.playersCount);
        }
      } else {
        this.playersCount = 1;
      }
      countRow.style.display = coop ? 'flex' : 'none';
      soloBtn.style.opacity = coop ? '0.65' : '1';
      coopBtn.style.opacity = coop ? '1' : '0.65';
      updatePlayerCountLabel();
      this.updateModeButton();
      this.resetGameContext();
    };
    this.cycleGameMode = () => {
      if (!this.isCoopMode) {
        this.setCoopMode(true, 2);
      } else if (this.playersCount < this.maxPlayers) {
        this.setCoopMode(true, this.playersCount + 1);
      } else {
        this.setCoopMode(false);
      }
    };
    dec.onclick = () => {
      if (!this.isCoopMode) return;
      this.playersCount = Math.max(2, this.playersCount - 1);
      updatePlayerCountLabel();
      this.updateModeButton();
      this.resetGameContext();
    };
    inc.onclick = () => {
      if (!this.isCoopMode) return;
      this.playersCount = Math.min(this.maxPlayers, this.playersCount + 1);
      updatePlayerCountLabel();
      this.updateModeButton();
      this.resetGameContext();
    };
    countRow.appendChild(dec);
    countRow.appendChild(lbl);
    countRow.appendChild(inc);
    panel.appendChild(countRow);

    soloBtn.onclick = () => this.setCoopMode(false);
    coopBtn.onclick = () => this.setCoopMode(true);
    this.setCoopMode(this.isCoopMode);

    this.bindButtons = [];
    for (let i = 0; i < this.maxPlayers; i++) {
      const row = document.createElement('div');
      row.className = 'settings-row';
      const pLabel = document.createElement('span');
      pLabel.textContent = `P${i + 1}`;
      pLabel.className = 'settings-player-label';
      const btn = document.createElement('button');
      btn.className = 'settings-keybtn';
      btn.textContent = this.playerBindings[i].join(', ');
      btn.onclick = () => this.startKeyCapture(i, btn);
      row.appendChild(pLabel);
      row.appendChild(btn);
      panel.appendChild(row);
      this.bindButtons.push(btn);
    }

    const gear = document.createElement('button');
    gear.id = 'flappy-settings-toggle';
    gear.className = 'settings-toggle';
    gear.innerText = '⚙';
    gear.title = 'Settings';
    gear.onclick = () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };

    document.body.appendChild(gear);
    document.body.appendChild(panel);
    this.awaitingKeyFor = -1;
    this._keyCaptureHandler = (e) => {
      if (this.awaitingKeyFor === -1) return;
      e.preventDefault();
      const code = e.code || e.key;
      this.playerBindings[this.awaitingKeyFor] = [code];
      this.bindButtons[this.awaitingKeyFor].textContent = this.playerBindings[this.awaitingKeyFor].join(', ');
      this.awaitingKeyFor = -1;
      window.removeEventListener('keydown', this._keyCaptureHandler);
      this.resetGameContext();
    };
  }

  startKeyCapture(playerIndex, buttonEl) {
    if (this.awaitingKeyFor !== -1) return;
    this.awaitingKeyFor = playerIndex;
    buttonEl.textContent = 'Press a key...';
    window.addEventListener('keydown', this._keyCaptureHandler);
  }

  initLoadingScreen() {
    const overlay = document.createElement('div');
    overlay.id = 'flappy-loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-card">
        <div class="loading-title">FLAPPY BIRD</div>
        <div class="loading-bar"><div class="loading-progress"></div></div>
        <div class="loading-text">Preparando el vuelo...</div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.loadingOverlay = overlay;
    this.loadingProgressBar = overlay.querySelector('.loading-progress');
    this.loadingText = overlay.querySelector('.loading-text');
  }

  loadImageAsset(src) {
    const img = new Image();
    this.loadingTotal += 1;
    img.onload = () => this.reportLoadedAsset();
    img.onerror = () => this.reportLoadedAsset();
    img.src = src;
    return img;
  }

  reportLoadedAsset() {
    this.loadingCount += 1;
    if (this.loadingProgressBar) {
      this.loadingProgressBar.style.width = `${Math.round((this.loadingCount / this.loadingTotal) * 100)}%`;
    }
    if (this.loadingText) {
      this.loadingText.textContent = `Cargando ${this.loadingCount}/${this.loadingTotal}`;
    }
    if (this.loadingCount >= this.loadingTotal) {
      this.hideLoadingScreen();
    }
  }

  hideLoadingScreen() {
    if (!this.loadingOverlay) return;
    this.loadingOverlay.classList.add('loaded');
    setTimeout(() => {
      if (this.loadingOverlay?.parentNode) {
        this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
      }
    }, 450);
  }

  resetGameContext() {
    // 1. Clima y Escenario
    if (Math.random() < 0.5) {
      this.assets.bg = this.assets.bgDay;
      this.assets.pipe = this.assets.pipeGreen;
    } else {
      this.assets.bg = this.assets.bgNight;
      this.assets.pipe = this.assets.pipeRed;
    }

    // 2. Jugadores (dependiendo de la configuración de la UI)
    this.players = [];
    const colors = ["yellow", "blue", "red", "green"];
    for (let i = 0; i < this.playersCount; i++) {
      const x = CONFIG.boardWidth / 8 - 15 + (i * 30);
      // Cada jugador recibe sus bindings configuradas y un binding táctil "TouchP{n}"
      const bindings = Array.isArray(this.playerBindings[i]) ? [...this.playerBindings[i]] : [this.playerBindings[i]];
      bindings.push(`TouchP${i + 1}`);
      if (this.playersCount === 1) bindings.push('ClickAnywhere');
      this.players.push(new Bird(x, CONFIG.boardHeight / 2, colors[i] || 'yellow', bindings));
    }
    if (!this.isCoopMode) {
      this.playersCount = 1;
    }

    // 3. Reset Variables de Control
    this.pipes = [];
    this.score = 0;
    this.currentVelocityX = CONFIG.initialVelocityX;
    this.currentGap = CONFIG.baseGap;
    this.isDead = false;
    this.gameOver = false;
    this.flashAlpha = 0;

    if (this.pipeTimer) clearInterval(this.pipeTimer);
    this.pipeTimer = setInterval(() => this.spawnPipes(), CONFIG.pipeInterval);
  }

  handleAction(actionCode) {
    // Validar si el código enviado pertenece a las claves de algún jugador activo
    const isValidKey = this.players.some(p => p.jumpKeys.includes(actionCode));
    if (!isValidKey) return;

    if (!this.gameStarted) {
      this.sounds.swoosh.play();
      this.gameStarted = true;
      this.sounds.bgm.currentTime = 0;
      this.sounds.bgm.play();
      this.triggerPlayerJump(actionCode);
      if (this.toggleButton) this.toggleButton.style.display = "none"; // Oculta el botón al jugar
      return;
    }

    if (this.isDead && !this.gameOver) return;

    if (this.gameOver) {
      this.sounds.swoosh.play();
      this.gameStarted = false;
      if (this.toggleButton) this.toggleButton.style.display = "block"; // Vuelve a mostrar el botón
      this.resetGameContext();
      return;
    }

    this.triggerPlayerJump(actionCode);
  }

  triggerPlayerJump(keyCode) {
    this.players.forEach(player => {
      if (player.jumpKeys.includes(keyCode) && player.alive) {
        player.jump();
        this.sounds.wing.cloneNode(true).play(); // Clonar permite sonidos simultáneos rápidos
      }
    });
  }

  toggleGameMode() {
    if (this.gameStarted) return; // Bloqueado si la partida está en curso
    this.sounds.swoosh.play();
    if (this.cycleGameMode) {
      this.cycleGameMode();
    } else if (this.setCoopMode) {
      this.setCoopMode(!this.isCoopMode);
    } else {
      this.isCoopMode = !this.isCoopMode;
      this.resetGameContext();
      if (this.updateModeButton) this.updateModeButton();
    }
  }

  updateDifficulty() {
    // Cada 3 puntos aumentamos velocidad y reducimos el tamaño de la brecha
    let levels = Math.floor(this.score / 3);
    this.currentVelocityX = CONFIG.initialVelocityX - (levels * 0.25);
    this.currentGap = Math.max(CONFIG.baseGap - (levels * 4), CONFIG.minGap);
  }

  spawnPipes() {
    if (!this.gameStarted || this.isDead || this.gameOver) return;

    let playableHeight = CONFIG.boardHeight - CONFIG.baseHeight;
    let minPipeY = -CONFIG.pipeHeight + 60;
    let maxPipeY = playableHeight - CONFIG.pipeHeight - this.currentGap - 60;
    if (maxPipeY < minPipeY) maxPipeY = minPipeY;
    let randomPipeY = minPipeY + Math.random() * (maxPipeY - minPipeY);

    // Oscilación basada en score (aumenta con la puntuación)
    const oscLevel = Math.floor(this.score / 5);
    const oscAmplitude = Math.min(oscLevel * 6, 40);
    const oscFreq = 1 + oscLevel * 0.18;
    const offset = Math.random() * 10000;

    const top = new Pipe(CONFIG.boardWidth, randomPipeY, true);
    top.yBase = randomPipeY;
    top.oscAmplitude = oscAmplitude;
    top.oscFreq = oscFreq;
    top.oscOffset = offset;

    const bottomYBase = randomPipeY + CONFIG.pipeHeight + this.currentGap;
    const bottom = new Pipe(CONFIG.boardWidth, bottomYBase, false);
    bottom.yBase = bottomYBase;
    bottom.oscAmplitude = oscAmplitude;
    bottom.oscFreq = oscFreq;
    bottom.oscOffset = offset + 500;

    this.pipes.push(top);
    this.pipes.push(bottom);
  }

  checkCollisions() {
    let sueloY = CONFIG.boardHeight - CONFIG.baseHeight;

    this.players.forEach(bird => {
      if (!bird.alive) return;

      // Colisión Suelo
      if (bird.y + bird.height >= sueloY) {
        bird.y = sueloY - bird.height;
        bird.alive = false;
      }

      // Colisión Tuberías
      this.pipes.forEach(pipe => {
        if (bird.getBounds().collidesWith(pipe.getBounds())) {
          bird.alive = false;
        }
      });

      // Si un ave muere en este frame, reproducimos impacto
      if (!bird.alive && !this.isDead) {
        // Sonido de choque y flash
        this.sounds.hit.play();
        this.flashAlpha = 1;

        // Efecto rebote involuntario general
        this.players.forEach(p => p.velocityY = -3.5);
        this.isDead = true;

        // Mostrar Game Over mientras el cadáver cae (comportamiento clásico)
        if (!this.gameOver) {
          this.sounds.die.play();
          this.sounds.bgm.pause();
          this.gameOver = true;
        }
      }
    });

    // Cooperativo: El juego sigue mientras al menos uno esté vivo en el aire
    if (this.players.every(p => !p.alive)) {
      let lowestBirdY = Math.max(...this.players.map(p => p.y));
      if (lowestBirdY >= sueloY - CONFIG.birdHeight && !this.gameOver) {
        this.sounds.die.play();
        this.sounds.bgm.pause();
        this.gameOver = true;
      }
    }
  }

  startLoop() {
    const loop = () => {
      this.update();
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update() {
    // No salimos aquí: permitimos que las aves sigan actualizándose
    // para que el cadáver caiga fuera de la pantalla incluso cuando
    // ya mostramos el Game Over.

    // Actualizar Pipes
    if (this.gameStarted && !this.isDead) {
      this.pipes.forEach(pipe => {
        pipe.x += this.currentVelocityX;

        // Gestión de puntos
        if (!pipe.passed && pipe.isTop && (this.players[0].x > pipe.x + CONFIG.pipeWidth)) {
          this.sounds.point.play();
          this.score += 1;
          pipe.passed = true;
          this.updateDifficulty(); // Re-evaluar nivel al subir score
        }
        // Aplicar oscilación vertical si está definida
        if (pipe.oscAmplitude && pipe.yBase !== undefined) {
          pipe.y = pipe.yBase + Math.sin((Date.now() + (pipe.oscOffset || 0)) / 1000 * (pipe.oscFreq || 1)) * pipe.oscAmplitude;
        }
      });
    }

    // Limpieza de Pipes
    while (this.pipes.length > 0 && this.pipes[0].x < -CONFIG.pipeWidth) {
      this.pipes.shift();
    }

    // Actualizar Jugadores (siempre actualizar para permitir caída tras la muerte)
    this.players.forEach(bird => bird.update(this.gameStarted, this.isDead));

    // Validar Impactos si siguen jugando
    if (!this.gameOver) {
      this.checkCollisions();
    }
  }

  render() {
    this.context.clearRect(0, 0, CONFIG.boardWidth, CONFIG.boardHeight);

    // 1. Dibujar Fondo de juego
    if (this.assets.bg.complete) {
      this.context.drawImage(this.assets.bg, 0, 0, CONFIG.boardWidth, CONFIG.boardHeight);
    }

    // 2. Dibujar Pipes
    this.pipes.forEach(pipe => pipe.draw(this.context, this.assets.pipe));

    // 3. Dibujar Suelo (Base)
    if (this.assets.base.complete) {
      this.context.drawImage(this.assets.base, 0, CONFIG.boardHeight - CONFIG.baseHeight, CONFIG.boardWidth, CONFIG.baseHeight);
    }

    // 4. Dibujar Jugadores
    this.players.forEach(bird => bird.draw(this.context));

    // 5. Dibujar UI Intermitente / Puntuación / Estados
    if (this.gameStarted) this.drawScore();
    if (!this.gameStarted) this.context.drawImage(this.assets.message, CONFIG.boardWidth / 2 - 92, CONFIG.boardHeight / 2 - 150, 184, 267);
    if (this.gameOver) this.context.drawImage(this.assets.gameOver, CONFIG.boardWidth / 2 - 96, CONFIG.boardHeight / 3, 192, 42);

    // Flash Efecto visual
    if (this.flashAlpha > 0) {
      this.context.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
      this.context.fillRect(0, 0, CONFIG.boardWidth, CONFIG.boardHeight);
      this.flashAlpha -= 0.08;
    }
  }

  drawScore() {
    let scoreStr = Math.floor(this.score).toString();
    let dW = 24, dH = 36;
    let startX = (CONFIG.boardWidth / 2) - ((scoreStr.length * dW) / 2);

    for (let i = 0; i < scoreStr.length; i++) {
      let digitImg = this.assets.numbers[parseInt(scoreStr[i])];
      if (digitImg?.complete) {
        this.context.drawImage(digitImg, startX + (i * dW), 40, dW, dH);
      }
    }
  }
}

// --- MODEL: CLASE PARA ENTIDADES (Manejador de Hitbox) ---
class Hitbox {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }
  collidesWith(o) {
    return this.x < o.x + o.w && this.x + this.w > o.x && this.y < o.y + o.h && this.y + this.h > o.y;
  }
}

// --- MODEL: CLASE JUGADOR (BIRD) ---
class Bird {
  constructor(startX, startY, skinColor, jumpKeys) {
    this.x = startX;
    this.y = startY;
    this.width = CONFIG.birdWidth;
    this.height = CONFIG.birdHeight;
    this.velocityY = 0;
    this.alive = true;
    this.jumpKeys = jumpKeys;

    // Carga local de Sprites de animación
    this.sprites = [];
    ["downflap", "midflap", "upflap"].forEach(flap => {
      let img = new Image();
      img.src = `./assets/${skinColor}bird-${flap}.png`;
      this.sprites.push(img);
    });

    this.animFrame = 0;
    this.tick = 0;
    this.angle = 0; // Guardará el eje de inclinación física futura
  }

  jump() {
    this.velocityY = CONFIG.jumpForce;
  }

  update(gameStarted, isDead) {
    if (!gameStarted) {
      this.y = (CONFIG.boardHeight / 2 - 50) + Math.sin(Date.now() * 0.005) * 8;
      this.tick++;
      if (this.tick % 8 === 0) this.animFrame = (this.animFrame + 1) % 3;
      return;
    }
    // Física vertical
    this.velocityY += CONFIG.gravity;
    if (isDead) {
      // Si el juego está en estado muerto, permitimos que el cadáver caiga sin tope superior
      this.y = this.y + this.velocityY;
    } else {
      this.y = Math.max(this.y + this.velocityY, 0);
    }

    // Animación de aleteo
    if (this.alive && !isDead) {
      this.tick++;
      if (this.tick % 5 === 0) this.animFrame = (this.animFrame + 1) % 3;
    } else {
      this.animFrame = 1; // Estático en colisión
    }

    // Inclinación (tilt) basada en la velocidad vertical
    if (this.velocityY < 0) {
      // Subiendo => inclinar hacia arriba
      this.angle = -0.35;
    } else {
      // Cayendo => inclinar hacia abajo proporcionalmente
      this.angle = Math.min((this.velocityY / 15) * 1.2, Math.PI / 2);
    }
    // Si está muerto, acelerar la rotación hacia 90 grados mientras cae
    if (!this.alive) {
      this.angle = Math.min(this.angle + 0.06, Math.PI / 2);
    }
  }

  draw(ctx) {
    let currentImg = this.sprites[this.animFrame];
    if (!currentImg?.complete) return;

    // Dibujar con rotación alrededor del centro del sprite
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate(this.angle);
    ctx.drawImage(currentImg, -this.width / 2, -this.height / 2, this.width, this.height);
    ctx.restore();
  }

  getBounds() {
    return new Hitbox(this.x, this.y, this.width, this.height);
  }
}

// --- MODEL: CLASE TUBERÍA (PIPE) ---
class Pipe {
  constructor(x, y, isTop) {
    this.x = x;
    this.y = y;
    this.width = CONFIG.pipeWidth;
    this.height = CONFIG.pipeHeight;
    this.isTop = isTop;
    this.passed = false;
  }

  draw(ctx, img) {
    if (!img.complete) return;
    if (this.isTop) {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.scale(1, -1);
      ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
      ctx.restore();
    } else {
      ctx.drawImage(img, this.x, this.y, this.width, this.height);
    }
  }

  getBounds() {
    return new Hitbox(this.x, this.y, this.width, this.height);
  }
}

// Inicialización Automática
window.addEventListener("DOMContentLoaded", () => new GameEngine());