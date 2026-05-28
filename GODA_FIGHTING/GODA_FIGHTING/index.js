import { Network, MSG } from './network.js';
import { Game } from './game.js';

const net = new Network();
window._net = net;

const $ = id => document.getElementById(id);
const screens = ['screen-main','screen-join','screen-waiting'];

function showScreen(id) {
  screens.forEach(s => $(s).style.display = s === id ? 'flex' : 'none');
}

$('back-to-menu-btn').addEventListener('click', () => {
  returnToLobby();
});

function returnToLobby() {
  $('game-wrapper').style.display     = 'none';
  $('lobby').style.display            = 'flex';
  $('ping-display').style.display     = 'none';
  $('net-indicator').style.display    = 'none';
  showScreen('screen-main');
  if (window._phaserGame) {
    window._phaserGame.destroy(true);
    window._phaserGame = null;
  }
  window._localMode = false;
  window._isHost    = true;
}

function setControlsVisibility(localMode) {
  if (localMode) {
    $('ctrl-p1-img').style.display = 'block';
    $('ctrl-p2-img').style.display = 'block';
  } else {
    const isHost = window._isHost;
    $('ctrl-p1-img').style.display = isHost ? 'block' : 'none';
    $('ctrl-p2-img').style.display = isHost ? 'none' : 'block';
  }
}

$('btn-create').disabled = true;
$('status-main').textContent = 'Conectando con el servidor…';

$('btn-local').addEventListener('click', () => {
  startLocalGame({ p1Sprite: 'jugador1', p2Sprite: 'jugador2' });
});

$('btn-create').addEventListener('click', () => {
  $('btn-create').disabled = true;
  net.createRoom((code) => {
    $('room-code-display').textContent = code;
    $('status-waiting').textContent    = 'Esperando que alguien se conecte…';
    showScreen('screen-waiting');
  });
  net.onOpen = () => {
    $('status-waiting').textContent = '✔ Rival conectado — esperando inicio…';
  };
  net.onMessage = (type, payload) => {
    if (type === MSG.READY) {
      const spriteData = { p1Sprite: 'jugador1', p2Sprite: 'jugador2' };
      net.send(MSG.GAME_START, spriteData);
      startPhaserGame(spriteData, true);
    }
  };
});

$('room-code-display').addEventListener('click', () => {
  navigator.clipboard.writeText($('room-code-display').textContent).then(() => {
    $('room-code-display').style.color = '#00ff88';
    setTimeout(() => $('room-code-display').style.color = '#ff4400', 1200);
  });
});

$('btn-cancel').addEventListener('click', () => { net.destroy(); showScreen('screen-main'); });
$('btn-join-show').addEventListener('click', () => showScreen('screen-join'));
$('btn-join-back').addEventListener('click', () => showScreen('screen-main'));

$('join-code-input').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
});

$('btn-join-confirm').addEventListener('click', () => {
  const code = $('join-code-input').value.trim();
  if (code.length < 4) { $('status-join').textContent = '⚠ Código muy corto'; return; }
  $('btn-join-confirm').disabled = true;
  $('status-join').textContent   = 'Conectando…';
  net.joinRoom(code, (ok, err) => {
    if (ok) {
      $('status-join').textContent = 'Conectado. Esperando al host…';
      net.send(MSG.READY, {});
      net.onMessage = (type, payload) => {
        if (type === MSG.GAME_START) startPhaserGame(payload, false);
      };
    } else {
      $('status-join').textContent = `No se pudo conectar (${err || 'sala no encontrada'})`;
      $('btn-join-confirm').disabled = false;
    }
  });
});

$('join-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join-confirm').click(); });

(function checkPeerServer() {
  const testPeer = new Peer(undefined, { debug: 0 });
  testPeer.on('open', () => { $('btn-create').disabled = false; $('status-main').textContent = ''; testPeer.destroy(); });
  testPeer.on('error', () => { $('status-main').textContent = '⚠ Sin conexión al servidor de señalización'; });
})();

function getPhaserConfig() {
  return {
    type: Phaser.AUTO,
    width: 800,
    height: 500,
    parent: 'game-container',
    scene: [Game],
    physics: { default: 'arcade', arcade: { gravity: { y: 600 }, debug: false } }
  };
}

function launchPhaser() {
  window._phaserGame = new Phaser.Game(getPhaserConfig());
}

function startPhaserGame(spriteData, isHost) {
  window._isHost    = isHost;
  window._sprites   = spriteData;
  window._localMode = false;

  $('lobby').style.display         = 'none';
  $('game-wrapper').style.display  = 'flex';
  $('ping-display').style.display  = 'block';
  $('net-indicator').style.display = 'block';
  $('net-indicator').textContent   = isHost ? '● HOST (P1)' : '● GUEST (P2)';

  setControlsVisibility(false);
  net.onMessage = null;
  launchPhaser();

  setInterval(() => {
    const p = $('ping-display'), ms = net.latency;
    p.textContent = `● ${ms}ms`;
    p.style.color = ms < 80 ? '#0f0' : ms < 150 ? '#ff0' : '#f00';
  }, 500);
}

function startLocalGame(spriteData) {
  window._isHost    = true;
  window._sprites   = spriteData;
  window._localMode = true;

  $('lobby').style.display         = 'none';
  $('game-wrapper').style.display  = 'flex';
  $('ping-display').style.display  = 'none';
  $('net-indicator').style.display = 'block';
  $('net-indicator').textContent   = '● LOCAL (2 jugadores)';

  setControlsVisibility(true);
  launchPhaser();
}
