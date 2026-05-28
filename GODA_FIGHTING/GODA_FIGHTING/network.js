
export const MSG = {
  CHAR_SELECT:  'char_select', 
  INPUT:        'input',         
  STATE_SYNC:   'state_sync',   
  GAME_START:   'game_start',    
  READY:        'ready',         
  PING:         'ping',          
  PONG:         'pong',         
};

export class Network {
  constructor() {
    this.peer       = null;
    this.conn       = null;
    this.isHost     = false;
    this.roomCode   = null;
    this.onMessage  = null;   
    this.onOpen     = null;  
    this.onClose    = null;  
    this._pingInterval = null;
    this.latency    = 0;
  }

  _genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  createRoom(onReady) {
    this.isHost   = true;
    this.roomCode = this._genCode();
    this.peer = new Peer(this.roomCode, { debug: 0 });

    this.peer.on('open', (id) => {
      console.log('[NET] Host listo, código:', id);
      onReady(id);
    });

    this.peer.on('connection', (conn) => {
      this.conn = conn;
      this._setupConn();
    });

    this.peer.on('error', (err) => {
      console.error('[NET] Peer error:', err);
      if (err.type === 'unavailable-id') {
        this.peer.destroy();
        this.roomCode = this._genCode();
        this.createRoom(onReady);
      }
    });
  }

  joinRoom(code, onResult) {
    this.isHost   = false;
    this.roomCode = code.toUpperCase();
    this.peer = new Peer(undefined, { debug: 0 });

    this.peer.on('open', () => {
      console.log('[NET] Guest abriendo conexión a', this.roomCode);
      const conn = this.peer.connect(this.roomCode, { reliable: false, serialization: 'json' });
      this.conn = conn;

      conn.on('open', () => {
        console.log('[NET] Conexión establecida con host');
        this._setupConn();
        onResult(true);
      });

      conn.on('error', (err) => {
        console.error('[NET] Error conectando:', err);
        onResult(false, err.message);
      });
    });

    this.peer.on('error', (err) => {
      console.error('[NET] Peer error (guest):', err);
      onResult(false, err.type);
    });

    setTimeout(() => {
      if (!this.conn || !this.conn.open) {
        onResult(false, 'timeout');
      }
    }, 8000);
  }

  _setupConn() {
    this.conn.on('open', () => {
      console.log('[NET] Canal abierto');
      this._startPing();
      if (this.onOpen) this.onOpen();
    });

    this.conn.on('data', (data) => {
      if (!data || !data.type) return;

      if (data.type === MSG.PING) {
        this.send(MSG.PONG, { ts: data.ts });
        return;
      }
      if (data.type === MSG.PONG) {
        this.latency = Date.now() - data.ts;
        return;
      }

      if (this.onMessage) this.onMessage(data.type, data.payload);
    });

    this.conn.on('close', () => {
      console.warn('[NET] Conexión cerrada');
      this._stopPing();
      if (this.onClose) this.onClose();
    });

    this.conn.on('error', (err) => {
      console.error('[NET] Conn error:', err);
    });
  }

  send(type, payload = {}) {
    if (!this.conn || !this.conn.open) return;
    this.conn.send({ type, payload });
  }

  _startPing() {
    this._pingInterval = setInterval(() => {
      this.send(MSG.PING, { ts: Date.now() });
    }, 2000);
  }

  _stopPing() {
    if (this._pingInterval) clearInterval(this._pingInterval);
  }

  destroy() {
    this._stopPing();
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}
