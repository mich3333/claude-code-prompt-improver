import { BLOCKS, HOTBAR } from '../world/blocks';
import { TILE_SIZE } from '../render/textures';

export class Hud {
  selected = 0;
  private readonly slots: HTMLElement[] = [];
  private readonly label: HTMLElement;
  private readonly debug = document.getElementById('debug')!;
  private readonly overlay = document.getElementById('overlay')!;

  constructor(atlas: HTMLCanvasElement) {
    const bar = document.getElementById('hotbar')!;
    HOTBAR.forEach((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const icon = document.createElement('canvas');
      icon.width = icon.height = TILE_SIZE;
      icon.getContext('2d')!.drawImage(atlas, BLOCKS[id].tiles.side * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
      const num = document.createElement('span');
      num.textContent = String(i + 1);
      slot.append(icon, num);
      bar.appendChild(slot);
      this.slots.push(slot);
    });
    this.label = document.createElement('div');
    this.label.className = 'label';
    bar.appendChild(this.label);
    this.select(0);
  }

  get selectedBlock(): number {
    return HOTBAR[this.selected];
  }

  select(i: number): void {
    this.selected = ((i % HOTBAR.length) + HOTBAR.length) % HOTBAR.length;
    this.slots.forEach((s, j) => s.classList.toggle('active', j === this.selected));
    this.label.textContent = BLOCKS[this.selectedBlock].name;
  }

  setOverlay(visible: boolean): void {
    this.overlay.classList.toggle('hidden', !visible);
  }

  onOverlayClick(fn: () => void): void {
    this.overlay.addEventListener('click', fn);
  }

  setDebug(text: string): void {
    this.debug.textContent = text;
  }
}
