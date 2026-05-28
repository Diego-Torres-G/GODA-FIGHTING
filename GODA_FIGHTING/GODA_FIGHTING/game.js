import { HealthBar }    from './observer.js';
import { IdleState, WalkState, JumpState, AerialAttackState, CrouchState,
         AttackState, BlockState, HurtState, DeadState, WinState } from './states.js';
import { MSG } from './network.js';

export class Game extends Phaser.Scene {

  constructor() { super({ key: 'game' }); }

  init(data) {
    const sprites = data || window._sprites || {};
    this.p1SpriteKey  = sprites.p1Sprite || 'jugador1';
    this.p2SpriteKey  = sprites.p2Sprite || 'jugador2';
    this.isHost       = window._isHost !== undefined ? window._isHost : true;
    this.localMode    = !!window._localMode;
    this.net          = window._net;
    this._remoteInput = {};
    this._syncFrame   = 0;
  }

  preload() {
    this.load.image('mapa',      'assets/fondo2.png');
    this.load.image('ground',    'assets/platform2.png');
    this.load.image('BarraVida', 'assets/BarraVida.png');
    this.load.image('Win1',      'assets/Win1.png');
    this.load.image('Win2',      'assets/Win2.png');
    this.load.spritesheet('jugador1', 'assets/caballero.png',        { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('jugador2', 'assets/godzillasprites2.png', { frameWidth: 64, frameHeight: 64 });
  }

  create() {
    this.ATTACK_COOLDOWN = 500;
    this.ATTACK_DURATION = 250;
    this.DAMAGE_NORMAL   = 10;
    this.DAMAGE_SPECIAL  = 18;
    this.KNOCKBACK_X     = 180;
    this.KNOCKBACK_Y     = -120;
    this.BLOCK_REDUCE    = 0.25;
    this.HIT_STUN        = 300;
    this.MAX_HP          = 240;
    this.ROUND_TIME      = 90;

    this.add.image(400, 250, 'mapa');
    this.platforms = this.physics.add.staticGroup();
    this.platforms.create(400, 470, 'ground').setScale(2).refreshBody();

    const img1 = this.add.image(85,  29, 'BarraVida').setDepth(10);
    const img2 = this.add.image(463, 29, 'BarraVida').setDepth(10);
    img1.displayOriginX = 0;
    img2.displayOriginX = 0;
    this.healthBar1 = new HealthBar(img1, this.MAX_HP);
    this.healthBar2 = new HealthBar(img2, this.MAX_HP);

    this.comboText1 = this.add.text(120, 55, '', { fontSize:'18px', fill:'#FFD700', fontFamily:'Arial', fontStyle:'bold', stroke:'#000', strokeThickness:3 }).setDepth(10);
    this.comboText2 = this.add.text(480, 55, '', { fontSize:'18px', fill:'#FFD700', fontFamily:'Arial', fontStyle:'bold', stroke:'#000', strokeThickness:3 }).setDepth(10);

    if (!this.localMode) {
      const roleLabel = this.isHost ? '← Tú (P1)' : 'Tú (P2) →';
      const roleX     = this.isHost ? 120 : 680;
      this.add.text(roleX, 480, roleLabel, { fontSize:'13px', fontFamily:'Arial', fill:'#ff4400', stroke:'#000', strokeThickness:2 }).setDepth(10).setOrigin(0.5, 1);
    }

    this.timeLeft   = this.ROUND_TIME;
    this.timerText  = this.add.text(380, 10, '90', { fontSize:'22px', fill:'#fff', fontFamily:'Arial', fontStyle:'bold', stroke:'#000', strokeThickness:3 }).setDepth(10);
    this.timerEvent = this.time.addEvent({ delay:1000, callback: this.tickTimer, callbackScope: this, loop: true });

    this.win1Image = this.add.image(400, 140, 'Win1').setVisible(false).setDepth(20);
    this.win2Image = this.add.image(400, 140, 'Win2').setVisible(false).setDepth(20);
    this.drawText  = this.add.text(260, 120, '¡EMPATE!', { fontSize:'48px', fill:'#fff', fontFamily:'Arial', fontStyle:'bold', stroke:'#000', strokeThickness:5 }).setVisible(false).setDepth(20);

    this.player1 = this.physics.add.sprite(100, 250, this.p1SpriteKey);
    this.player1.setCollideWorldBounds(true).setSize(30, 50);

    this.player2 = this.physics.add.sprite(500, 250, this.p2SpriteKey);
    this.player2.setCollideWorldBounds(true).setSize(30, 50);

    this.createAnims('jugador1', {
      andar:'andarDerecha', ataque1:'ataque1Derecha', ataque2:'ataque2Derecha',
      ataqueAbajo:'ataqueAbajoDerecha', ataqueAereo:'ataqueAereoDerecha',
      saltar:'saltarDerecha', agacharse:'agacharseDerecha',
      dano:'dano1', cubrirse:'cubrirse1', ganar:'ganarDerecha', vida:'vidaDerecha',
      morir:'morirDerecha', idle:'turn'
    }, false);

    this.createAnims('jugador2', {
      andar:'andar2', ataque1:'ataque12', ataque2:'ataque22',
      ataqueAbajo:'ataqueAbajo2', ataqueAereo:'ataqueAereo2',
      saltar:'saltar2', agacharse:'agacharse2',
      dano:'dano2', cubrirse:'cubrirse2', ganar:'ganar2', vida:'vida2',
      morir:'morir2', idle:'turn2'
    }, true);

    this.physics.add.collider(this.player1, this.platforms);
    this.physics.add.collider(this.player2, this.platforms);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys    = this.input.keyboard.addKeys({
      a: Phaser.Input.Keyboard.KeyCodes.A, s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D, w: Phaser.Input.Keyboard.KeyCodes.W,
      m: Phaser.Input.Keyboard.KeyCodes.M, e: Phaser.Input.Keyboard.KeyCodes.E,
      r: Phaser.Input.Keyboard.KeyCodes.R, n: Phaser.Input.Keyboard.KeyCodes.N,
      q: Phaser.Input.Keyboard.KeyCodes.Q, k: Phaser.Input.Keyboard.KeyCodes.K
    });

    this.anim1 = { andar:'andarDerecha', ataque1:'ataque1Derecha', ataque2:'ataque2Derecha', ataqueAbajo:'ataqueAbajoDerecha', ataqueAereo:'ataqueAereoDerecha', saltar:'saltarDerecha', agacharse:'agacharseDerecha', dano:'dano1', cubrirse:'cubrirse1', ganar:'ganarDerecha', morir:'morirDerecha', idle:'turn' };
    this.anim2 = { andar:'andar2', ataque1:'ataque12', ataque2:'ataque22', ataqueAbajo:'ataqueAbajo2', ataqueAereo:'ataqueAereo2', saltar:'saltar2', agacharse:'agacharse2', dano:'dano2', cubrirse:'cubrirse2', ganar:'ganar2', morir:'morir2', idle:'turn2' };

    this.ctx1 = this._makeContext(this.player1, this.anim1, null);
    this.ctx2 = this._makeContext(this.player2, this.anim2, null);

    this._changeState(this.ctx1, new IdleState());
    this._changeState(this.ctx2, new IdleState());

    this.gameOver = false;

    if (!this.localMode) {
      this._setupNetworkListener();
      this.net.onClose = () => this._showDisconnect();
    }
  }

  _setupNetworkListener() {
    this.net.onMessage = (type, payload) => {
      if (type === MSG.INPUT)                     this._remoteInput = payload.keys || {};
      if (type === MSG.STATE_SYNC && !this.isHost) this._applyStateSync(payload);
      if (type === 'game_over'   && !this.isHost)  this._resolveGameOver(payload.winner);
    };
  }

  _applyStateSync(state) {
    if (!state) return;
    const LERP = 0.3;
    if (state.p1) {
      this.player1.x = Phaser.Math.Linear(this.player1.x, state.p1.x, LERP);
      this.player1.y = Phaser.Math.Linear(this.player1.y, state.p1.y, LERP);
      this.player1.setVelocityX(state.p1.vx * LERP + this.player1.body.velocity.x * (1-LERP));
      if (Math.abs(state.p1.hp - this.healthBar1.current) > 1) {
        const diff = state.p1.hp - this.healthBar1.current;
        if (diff < 0) this.healthBar1.takeDamage(-diff);
      }
    }
    if (state.p2) {
      this.player2.x = Phaser.Math.Linear(this.player2.x, state.p2.x, LERP);
      this.player2.y = Phaser.Math.Linear(this.player2.y, state.p2.y, LERP);
      this.player2.setVelocityX(state.p2.vx * LERP + this.player2.body.velocity.x * (1-LERP));
      if (Math.abs(state.p2.hp - this.healthBar2.current) > 1) {
        const diff = state.p2.hp - this.healthBar2.current;
        if (diff < 0) this.healthBar2.takeDamage(-diff);
      }
    }
    if (state.time !== undefined) {
      this.timeLeft = state.time;
      this.timerText.setText(String(this.timeLeft));
    }
  }

  _resolveGameOver(winner) {
    if (this.gameOver) return;
    this.gameOver = true;
    if (winner === 1)      this.win1Image.setVisible(true);
    else if (winner === 2) this.win2Image.setVisible(true);
    else                   this.drawText.setVisible(true);
  }

  _getP1Input() {
    return { left: this.cursors.left.isDown, right: this.cursors.right.isDown, down: this.cursors.down.isDown, jump: this.cursors.up.isDown, atk1: this.keys.m.isDown, atk2: this.keys.k.isDown, block: this.keys.n.isDown };
  }

  _getP2Input() {
    return { left: this.keys.a.isDown, right: this.keys.d.isDown, down: this.keys.s.isDown, jump: this.keys.w.isDown, atk1: this.keys.e.isDown, atk2: this.keys.q.isDown, block: this.keys.r.isDown };
  }

  _getLocalInput() { return this.isHost ? this._getP1Input() : this._getP2Input(); }

  _inputToKeys(inp) {
    const key = val => ({ isDown: !!val });
    return { left: key(inp.left), right: key(inp.right), down: key(inp.down), jump: key(inp.jump), atk1: key(inp.atk1), atk2: key(inp.atk2), block: key(inp.block) };
  }

  _makeContext(sprite, anim, keys) {
    return { sprite, anim, keys, scene: this, currentState: null, attackCooldown: 0, attackWindow: 0, attackHit: false, isSpecial: false, isBlocking: false, isAerialAtk: false, comboCount: 0, comboTimer: 0 };
  }

  _changeState(ctx, newState) {
    if (ctx.currentState) ctx.currentState.exit(ctx);
    ctx.currentState = newState;
    ctx.isBlocking   = false;
    newState.enter(ctx);
  }

  createAnims(key, names, isP2) {
    if (isP2) {
      const defs = [
        [names.andar,       1,  5,  10, true ],
        [names.ataque1,     6,  10, 15, false],
        [names.ataque2,     11, 14, 15, false],
        [names.ataqueAbajo, 15, 17, 15, false],
        [names.saltar,      18, 23, 10, true ],
        [names.agacharse,   24, 24,  8, true ],
        [names.ganar,       6,  10, 10, true ],
        [names.vida,        1,  5,  10, true ],
        [names.morir,       26, 26,  8, false],
      ];
      defs.forEach(([animKey, start, end, fps, loop]) => {
        if (!this.anims.exists(animKey))
          this.anims.create({ key: animKey, frames: this.anims.generateFrameNumbers(key, { start, end }), frameRate: fps, repeat: loop ? -1 : 0 });
      });
      [[names.dano, 26], [names.cubrirse, 25], [names.idle, 0], [names.ataqueAereo, 27]].forEach(([animKey, frame]) => {
        if (!this.anims.exists(animKey))
          this.anims.create({ key: animKey, frames: [{ key, frame }], frameRate: 8 });
      });
    } else {
      const defs = [
        [names.andar,       1,  5,  10, true ],
        [names.ataque1,     6,  10, 15, false],
        [names.ataque2,     11, 14, 15, false],
        [names.ataqueAbajo, 15, 17, 15, false],
        [names.saltar,      18, 23, 10, true ],
        [names.agacharse,   24, 24,  0, true ],
        [names.ganar,       6,  10, 10, true ],
        [names.vida,        1,  5,  10, true ],
        [names.morir,       26, 26, 10, true ],
      ];
      defs.forEach(([animKey, start, end, fps, loop]) => {
        if (!this.anims.exists(animKey))
          this.anims.create({ key: animKey, frames: this.anims.generateFrameNumbers(key, { start, end }), frameRate: fps, repeat: loop ? -1 : 0 });
      });
      [[names.dano, 22], [names.cubrirse, 25], [names.idle, 0], [names.ataqueAereo, 27]].forEach(([animKey, frame]) => {
        if (!this.anims.exists(animKey))
          this.anims.create({ key: animKey, frames: [{ key, frame }], frameRate: 20 });
      });
    }
  }

  tickTimer() {
    if (this.gameOver) return;
    if (!this.localMode && !this.isHost) return;
    this.timeLeft--;
    this.timerText.setText(String(this.timeLeft));
    if (this.timeLeft <= 0) this.endRoundByTime();
  }

  endRoundByTime() {
    if (this.gameOver) return;
    const hp1 = this.healthBar1.current;
    const hp2 = this.healthBar2.current;
    let winner = 0;
    if      (hp1 > hp2) winner = 1;
    else if (hp2 > hp1) winner = 2;
    this._resolveGameOver(winner);
    if (!this.localMode && this.isHost) this.net.send('game_over', { winner });
  }

  tryHit(attacker, defender, defCtx, damage, isSpecial) {
    const dist  = Phaser.Math.Distance.Between(attacker.x, attacker.y, defender.x, defender.y);
    const range = isSpecial ? 90 : 75;
    if (dist > range) return false;

    let dmg = damage;
    if (defCtx.isBlocking) dmg = Math.round(damage * this.BLOCK_REDUCE);

    const dir = attacker.x < defender.x ? 1 : -1;
    if (!defCtx.isBlocking) {
      defender.setVelocityX(dir * this.KNOCKBACK_X);
      defender.setVelocityY(this.KNOCKBACK_Y);
      this._changeState(defCtx, new HurtState(this.HIT_STUN));
    } else {
      defender.setVelocityX(dir * 60);
    }
    this.tweens.add({ targets: defender, alpha: 0.3, duration: 80, yoyo: true, repeat: 1 });
    return dmg;
  }

  updateCombo(ctx, textObj) {
    ctx.comboCount++;
    ctx.comboTimer = 1500;
    const labels = ['','','2 HITS!','3 HITS!!','4 HITS!!!','COMBO x5!!'];
    const label   = ctx.comboCount >= 5 ? `COMBO x${ctx.comboCount}!!` : (labels[ctx.comboCount] || '');
    textObj.setText(label);
  }

  resetCombo(ctx, textObj) { ctx.comboCount = 0; textObj.setText(''); }

  tickPlayer(ctx, enemyCtx, myHealthBar, enemyHealthBar, comboText, delta) {
    if (ctx.attackCooldown > 0) ctx.attackCooldown -= delta;
    if (ctx.attackWindow   > 0) ctx.attackWindow   -= delta;
    if (ctx.comboTimer     > 0) {
      ctx.comboTimer -= delta;
      if (ctx.comboTimer <= 0) this.resetCombo(ctx, comboText);
    }

    const isAuthority = this.localMode || this.isHost;

    if (isAuthority && ctx.attackWindow > 0 && !ctx.attackHit) {
      const dmg = this.tryHit(
        ctx.sprite, enemyCtx.sprite, enemyCtx,
        ctx.isSpecial ? this.DAMAGE_SPECIAL : this.DAMAGE_NORMAL,
        ctx.isSpecial
      );
      if (dmg !== false) {
        enemyHealthBar.takeDamage(dmg);
        ctx.attackHit = true;
        this.updateCombo(ctx, comboText);
        if (dmg >= this.DAMAGE_SPECIAL) this.cameras.main.shake(80, 0.006);
        if (enemyHealthBar.isDepleted) {
          this._changeState(ctx, new WinState());
          this._changeState(enemyCtx, new DeadState());
          const winner = ctx === this.ctx1 ? 1 : 2;
          this._resolveGameOver(winner);
          if (!this.localMode && this.isHost) this.net.send('game_over', { winner });
          return;
        }
      }
    }

    const stateName = ctx.currentState ? ctx.currentState.name : '';
    if (stateName === 'DEAD' || stateName === 'WIN') { ctx.currentState.update(ctx, delta); return; }

    const nextState = ctx.currentState ? ctx.currentState.update(ctx, delta) : null;
    if (nextState) this._changeState(ctx, nextState);
  }

  _showDisconnect() {
    if (this.scene.isPaused()) return;
    this.add.rectangle(400, 250, 400, 120, 0x000000, 0.85).setDepth(30);
    this.add.text(400, 230, 'Rival desconectado', { fontSize:'24px', fontFamily:'Impact', fill:'#ff4400', stroke:'#000', strokeThickness:4 }).setOrigin(0.5).setDepth(31);
    this.add.text(400, 265, 'Recarga la página para volver a jugar', { fontSize:'14px', fontFamily:'Arial', fill:'#ccc' }).setOrigin(0.5).setDepth(31);
  }

  update(time, delta) {
    if (this.gameOver) return;

    if (this.localMode) {
      this.ctx1.keys = this._inputToKeys(this._getP1Input());
      this.ctx2.keys = this._inputToKeys(this._getP2Input());
    } else {
      const localInput = this._getLocalInput();
      this.net.send(MSG.INPUT, { keys: localInput });
      if (this.isHost) {
        this.ctx1.keys = this._inputToKeys(localInput);
        this.ctx2.keys = this._inputToKeys(this._remoteInput);
      } else {
        this.ctx1.keys = this._inputToKeys(this._remoteInput);
        this.ctx2.keys = this._inputToKeys(localInput);
      }
    }

    this.healthBar1.image.setScrollFactor(0);
    this.healthBar2.image.setScrollFactor(0);

    const sentido = this.player1.x < this.player2.x ? 0 : 1;
    this.player1.setScale(sentido === 0 ?  2.5 : -2.5, 2.5);
    this.player2.setScale(sentido === 0 ? -2.5 :  2.5, 2.5);

    this.tickPlayer(this.ctx1, this.ctx2, this.healthBar1, this.healthBar2, this.comboText1, delta);
    this.tickPlayer(this.ctx2, this.ctx1, this.healthBar2, this.healthBar1, this.comboText2, delta);

    if (!this.localMode && this.isHost) {
      this._syncFrame++;
      if (this._syncFrame % 6 === 0) {
        this.net.send(MSG.STATE_SYNC, {
          p1: { x: this.player1.x, y: this.player1.y, vx: this.player1.body.velocity.x, hp: this.healthBar1.current },
          p2: { x: this.player2.x, y: this.player2.y, vx: this.player2.body.velocity.x, hp: this.healthBar2.current },
          time: this.timeLeft
        });
      }
    }
  }
}
