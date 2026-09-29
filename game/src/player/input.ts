/** Keyboard + pointer-lock mouse state. Mouse deltas accumulate until consumed each frame. */
export class Input {
  private readonly keys = new Set<string>();
  /** Keys pressed since last consumed, so taps shorter than a frame still register. */
  private readonly pressed = new Set<string>();
  private dx = 0;
  private dy = 0;
  locked = false;

  onMouseButton: (button: number) => void = () => {};
  onWheel: (dir: number) => void = () => {};
  onLockChange: (locked: boolean) => void = () => {};

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.locked && e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Some browsers emit occasional huge spurious deltas under pointer lock; drop them.
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    document.addEventListener('mousedown', (e) => {
      if (this.locked) this.onMouseButton(e.button);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener(
      'wheel',
      (e) => {
        if (this.locked && e.deltaY !== 0) this.onWheel(Math.sign(e.deltaY));
      },
      { passive: true },
    );
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.target;
      if (!this.locked) {
        this.keys.clear();
        this.pressed.clear();
      }
      this.onLockChange(this.locked);
    });
  }

  requestLock(): void {
    const p = this.target.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => {});
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  consumePress(code: string): boolean {
    return this.pressed.delete(code);
  }

  consumeMouse(): [number, number] {
    const out: [number, number] = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return out;
  }
}
