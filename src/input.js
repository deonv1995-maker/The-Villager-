import { GAME_CONFIG } from './config.js';

export class VirtualJoystick {
  constructor(root, knob) {
    this.root = root;
    this.knob = knob;
    this.pointerId = null;
    this.vector = { x: 0, y: 0 };

    root.addEventListener('pointerdown', (event) => this.start(event));
    window.addEventListener('pointermove', (event) => this.move(event));
    window.addEventListener('pointerup', (event) => this.end(event));
    window.addEventListener('pointercancel', (event) => this.end(event));
  }

  start(event) {
    if (this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    this.root.setPointerCapture?.(event.pointerId);
    this.updateFromPointer(event);
  }

  move(event) {
    if (event.pointerId !== this.pointerId) return;
    this.updateFromPointer(event);
  }

  end(event) {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  updateFromPointer(event) {
    const rect = this.root.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const radius = GAME_CONFIG.joystick.radius;
    const distance = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(distance, radius);
    const nx = (dx / distance) * clamped;
    const ny = (dy / distance) * clamped;

    let vx = nx / radius;
    let vy = ny / radius;
    if (Math.hypot(vx, vy) < GAME_CONFIG.joystick.deadZone) {
      vx = 0;
      vy = 0;
    }

    this.vector.x = vx;
    this.vector.y = vy;
    this.knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
  }
}
