export * from './enemies'; export * from './weapons'; export * from './upgrades'; export * from './waves';
/** Projectile kinds (ProjectilePool.kind). Render keys visuals off these. owner 255 = hostile. */
export const PK = { BOLT: 0, ORBIT: 1, SPEAR: 2, LAVA: 3, SPIT: 10, TOXIC: 11 } as const;
export const HOSTILE = 255;
/** Pickup kinds (PickupPool.kind). */
export const PU = { XP: 0, GOLD: 1, HEALTH: 2, CHEST: 3 } as const;
export const PLAYER = { radius: 0.45, dashDur: 0.18, dashSpeed: 22, dashIframes: 0.3, dashCooldown: 1.1, hitIframes: 0.6, accel: 14, magnetSpeed: 18, collectRadius: 0.7 };
