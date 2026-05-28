export class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(cb => cb(data));
  }
}

export class HealthBar {
  
  constructor(image, maxHp) {
    this.image   = image;
    this.maxHp   = maxHp;
    this.current = maxHp;

    this.emitter = new EventEmitter();

    this.emitter.on('damage', ({ amount }) => this._onDamage(amount));
    this.emitter.on('heal',   ({ amount }) => this._onHeal(amount));
  }

  takeDamage(amount) {
    this.emitter.emit('damage', { amount });
  }

  heal(amount) {
    this.emitter.emit('heal', { amount });
  }

  get isDepleted() {
    return this.current <= 0;
  }

  _onDamage(amount) {
    this.current = Math.max(0, this.current - amount);
    this._refresh();
  }

  _onHeal(amount) {
    this.current = Math.min(this.maxHp, this.current + amount);
    this._refresh();
  }

  _refresh() {
    this.image.displayWidth = this.current;
  }
}
