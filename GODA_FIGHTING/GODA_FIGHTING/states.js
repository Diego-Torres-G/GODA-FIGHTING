export class IdleState {
  get name() { return 'IDLE'; }

  enter(ctx) {
    ctx.sprite.anims.play(ctx.anim.idle, true);
  }

  update(ctx, delta) {
    const { sprite, anim, keys } = ctx;

    if (keys.block.isDown) return new BlockState();
    if ((keys.atk1.isDown || keys.atk2.isDown) && ctx.attackCooldown <= 0)
      return new AttackState(keys.atk2.isDown);
    if (keys.down.isDown)  return new CrouchState();
    if (keys.jump.isDown && sprite.body.touching.down) return new JumpState();
    if (keys.left.isDown || keys.right.isDown) return new WalkState();

    sprite.setVelocityX(0);
    if (!sprite.body.touching.down) return new JumpState();
    return null;
  }

  exit(ctx) {}
}

export class WalkState {
  get name() { return 'WALK'; }

  enter(ctx) {}

  update(ctx, delta) {
    const { sprite, anim, keys } = ctx;

    if (keys.block.isDown) return new BlockState();
    if ((keys.atk1.isDown || keys.atk2.isDown) && ctx.attackCooldown <= 0)
      return new AttackState(keys.atk2.isDown);
    if (keys.down.isDown)  return new CrouchState();
    if (keys.jump.isDown && sprite.body.touching.down) return new JumpState();
    if (!sprite.body.touching.down) return new JumpState();

    if (keys.left.isDown) {
      sprite.setVelocityX(-280);
      sprite.anims.play(anim.andar, true);
    } else if (keys.right.isDown) {
      sprite.setVelocityX(280);
      sprite.anims.play(anim.andar, true);
    } else {
      return new IdleState();
    }
    return null;
  }

  exit(ctx) {}
}

export class JumpState {
  get name() { return 'JUMP'; }

  enter(ctx) {
    if (ctx.sprite.body.touching.down) {
      ctx.sprite.setVelocityY(-340);
    }
    ctx.sprite.anims.play(ctx.anim.saltar, true);
  }

  update(ctx, delta) {
    const { sprite, anim, keys } = ctx;

    if ((keys.atk1.isDown || keys.atk2.isDown) && ctx.attackCooldown <= 0)
      return new AerialAttackState();

    if (keys.left.isDown)       sprite.setVelocityX(-280);
    else if (keys.right.isDown) sprite.setVelocityX(280);
    else                        sprite.setVelocityX(0);

    sprite.anims.play(anim.saltar, true);

    if (sprite.body.touching.down) return new IdleState();
    return null;
  }

  exit(ctx) {}
}

export class AerialAttackState {
  constructor() {
    this._timer = 0;
  }
  get name() { return 'AERIAL_ATTACK'; }

  enter(ctx) {
    const key = ctx.sprite.texture.key;
    ctx.sprite.anims.play(ctx.anim.ataqueAereo, true);
    ctx.attackCooldown = ctx.scene.ATTACK_COOLDOWN;
    ctx.attackWindow   = ctx.scene.ATTACK_DURATION;
    ctx.attackHit      = false;
    ctx.isSpecial      = false;
    ctx.isAerialAtk    = true;
  }

  update(ctx, delta) {
    this._timer += delta;
    const { sprite, keys } = ctx;

    if (keys.left.isDown)       sprite.setVelocityX(-280);
    else if (keys.right.isDown) sprite.setVelocityX(280);

    if (sprite.body.touching.down) {
      ctx.isAerialAtk = false;
      return new IdleState();
    }
    if (this._timer >= ctx.scene.ATTACK_DURATION) {
      ctx.isAerialAtk = false;
      return new JumpState();
    }
    return null;
  }

  exit(ctx) {
    ctx.isAerialAtk = false;
  }
}

export class CrouchState {
  get name() { return 'CROUCH'; }

  enter(ctx) {
    ctx.sprite.setVelocityX(0);
    ctx.sprite.anims.play(ctx.anim.agacharse, true);
  }

  update(ctx, delta) {
    const { keys } = ctx;
    if (!keys.down.isDown) return new IdleState();
    if ((keys.atk1.isDown || keys.atk2.isDown) && ctx.attackCooldown <= 0)
      return new AttackState(true);
    return null;
  }

  exit(ctx) {}
}

export class AttackState {
  constructor(isSpecial) {
    this._isSpecial = isSpecial;
    this._timer = 0;
  }
  get name() { return 'ATTACK'; }
  get isSpecial() { return this._isSpecial; }

  enter(ctx) {
    ctx.sprite.setVelocityX(0);
    const animKey = this._isSpecial ? ctx.anim.ataqueAbajo : ctx.anim.ataque1;
    ctx.sprite.anims.play(animKey, true);
    ctx.attackCooldown = ctx.scene.ATTACK_COOLDOWN;
    ctx.attackWindow   = ctx.scene.ATTACK_DURATION;
    ctx.attackHit      = false;
    ctx.isSpecial      = this._isSpecial;
  }

  update(ctx, delta) {
    this._timer += delta;
    if (this._timer >= ctx.scene.ATTACK_DURATION) return new IdleState();
    return null;
  }

  exit(ctx) {}
}

export class BlockState {
  get name() { return 'BLOCK'; }

  enter(ctx) {
    ctx.sprite.setVelocityX(0);
    ctx.sprite.anims.play(ctx.anim.cubrirse, true);
    ctx.isBlocking = true;
  }

  update(ctx, delta) {
    if (!ctx.keys.block.isDown) return new IdleState();
    ctx.sprite.anims.play(ctx.anim.cubrirse, true);
    ctx.isBlocking = true;
    return null;
  }

  exit(ctx) {
    ctx.isBlocking = false;
  }
}

export class HurtState {
  constructor(stunDuration) {
    this._stun = stunDuration;
    this._elapsed = 0;
  }
  get name() { return 'HURT'; }

  enter(ctx) {
    ctx.sprite.anims.play(ctx.anim.dano, true);
  }

  update(ctx, delta) {
    this._elapsed += delta;
    ctx.sprite.anims.play(ctx.anim.dano, true);
    if (this._elapsed >= this._stun) return new IdleState();
    return null;
  }

  exit(ctx) {}
}

export class DeadState {
  get name() { return 'DEAD'; }

  enter(ctx) {
    ctx.sprite.anims.play(ctx.anim.morir, true);
    ctx.sprite.setVelocityX(0);
  }

  update(ctx, delta) { return null; } 
  exit(ctx) {}
}

export class WinState {
  get name() { return 'WIN'; }

  enter(ctx) {
    ctx.sprite.anims.play(ctx.anim.ganar, true);
    ctx.sprite.setVelocityX(0);
  }

  update(ctx, delta) { return null; }
  exit(ctx) {}
}
