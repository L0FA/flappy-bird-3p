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

export default class GameEngine {
  constructor() {
    this.board = document.getElementById('board');
    this.board.width = CONFIG.boardWidth;
    this.board.height = CONFIG.boardHeight;
    this.context = this.board.getContext('2d');

    this.maxPlayers = 3;
    this.playersCount = 1;
    this.playerBindings = [
      ['Space', 'ArrowUp'],
      ['KeyW'],
      ['KeyI'],
      ['Numpad8']
    ];
    this.toggleButton = document.getElementById('mode-toggle');
    this.loadingCount = 0;
    this.loadingTotal = 0;
    this.isCoopMode = false;
    this.gameStarted = false;
    this.isDead = false;
    this.gameOver = false;
    this.score = 0;
    this.flashAlpha = 0;
    this.currentVelocityX = CONFIG.initialVelocityX;
    this.currentGap = CONFIG.baseGap;
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
    this.assets = {
      bgDay: this.loadImageAsset('./assets/background-day.png'),
      bgNight: this.loadImageAsset('./assets/background-night.png'),
      bg: null,
      pipeGreen: this.loadImageAsset('./assets/pipe-green.png'),
      pipeRed: this.loadImageAsset('./assets/pipe-red.png'),
      pipe: null,
      base: this.loadImageAsset('./assets/base.png'),
      message: this.loadImageAsset('./assets/message.png'),
      gameOver: this.loadImageAsset('./assets/gameover.png'),
      numbers: []
    };

    for (let i = 0; i < 10; i++) {
      this.assets.numbers.push(this.loadImageAsset(`./assets/${i}.png`));
    }

    this.sounds = {
      wing: new Audio('./assets/sfx_wing.wav'),
      hit: new Audio('./assets/sfx_hit.wav'),
      point: new Audio('./assets/sfx_point.wav'),
      die: new Audio('./assets/sfx_die.wav'),
      swoosh: new Audio('./assets/sfx_swooshing.wav'),
      bgm: new Audio('./assets/bgm_mario.mp3')
    };
    this.sounds.bgm.loop = true;
  }

  setupEvents() {
    document.addEventListener('keydown', (e) => this.handleAction(e.code));

    const processInputPosition = (clientX) => {
      const rect = this.board.getBoundingClientRect();
      const clickXOnCanvas = ((clientX - rect.left) / rect.width) * CONFIG.boardWidth;
      const zoneWidth = CONFIG.boardWidth / Math.max(1, this.playersCount);
      const idx = Math.floor(clickXOnCanvas / zoneWidth);
      const playerIndex = Math.min(Math.max(0, idx), Math.max(0, this.playersCount - 1));

      if (this.playersCount === 1) {
        this.handleAction('ClickAnywhere');
      } else {
        this.handleAction(`TouchP${playerIndex + 1}`);
      }
    };

    this.board.addEventListener('mousedown', (e) => processInputPosition(e.clientX));

    this.board.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        processInputPosition(e.changedTouches[i].clientX);
      }
    }, { passive: false });

    if (this.toggleButton) {
      this.toggleButton.addEventListener('click', () => this.toggleGameMode());
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
    if (Math.random() < 0.5) {
      this.assets.bg = this.assets.bgDay;
      this.assets.pipe = this.assets.pipeGreen;
    } else {
      this.assets.bg = this.assets.bgNight;
      this.assets.pipe = this.assets.pipeRed;
    }

    this.players = [];
    const colors = ['yellow', 'blue', 'red', 'green'];
    for (let i = 0; i < this.playersCount; i++) {
      const x = CONFIG.boardWidth / 8 - 15 + (i * 30);
      const bindings = Array.isArray(this.playerBindings[i]) ? [...this.playerBindings[i]] : [this.playerBindings[i]];
      bindings.push(`TouchP${i + 1}`);
      if (this.playersCount === 1) bindings.push('ClickAnywhere');
      this.players.push(new Bird(x, CONFIG.boardHeight / 2, colors[i] || 'yellow', bindings));
    }
    if (!this.isCoopMode) {
      this.playersCount = 1;
    }

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
    const isValidKey = this.players.some(p => p.jumpKeys.includes(actionCode));
    if (!isValidKey) return;

    if (!this.gameStarted) {
      this.sounds.swoosh.play();
      this.gameStarted = true;
      this.sounds.bgm.currentTime = 0;
      this.sounds.bgm.play();
      this.triggerPlayerJump(actionCode);
      if (this.toggleButton) this.toggleButton.style.display = 'none';
      return;
    }

    if (this.isDead && !this.gameOver) return;

    if (this.gameOver) {
      this.sounds.swoosh.play();
      this.gameStarted = false;
      if (this.toggleButton) this.toggleButton.style.display = 'block';
      this.resetGameContext();
      return;
    }

    this.triggerPlayerJump(actionCode);
  }

  triggerPlayerJump(keyCode) {
    this.players.forEach(player => {
      if (player.jumpKeys.includes(keyCode) && player.alive) {
        player.jump();
        this.sounds.wing.cloneNode(true).play();
      }
    });
  }

  toggleGameMode() {
    if (this.gameStarted) return;
    this.sounds.swoosh.play();
    if (this.cycleGameMode) {
      this.cycleGameMode();
    } else if ...