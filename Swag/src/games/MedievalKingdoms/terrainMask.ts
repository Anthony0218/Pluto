import type { Position, TerrainType } from "./types";

export class TerrainMask {
  private canvas: HTMLCanvasElement;

  private context: CanvasRenderingContext2D;

  width = 0;
  height = 0;
  loaded = false;

  constructor() {
    this.canvas = document.createElement("canvas");

    const context = this.canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      throw new Error("Could not create terrain mask canvas.");
    }

    this.context = context;
  }

  async load(imageUrl: string): Promise<void> {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();

      image.onerror = () =>
        reject(new Error(`Could not load terrain mask: ${imageUrl}`));

      image.src = imageUrl;
    });

    this.width = image.naturalWidth;

    this.height = image.naturalHeight;

    this.canvas.width = this.width;

    this.canvas.height = this.height;

    this.context.drawImage(image, 0, 0);

    this.loaded = true;
  }

  getTerrainAtPosition(position: Position): TerrainType {
    if (!this.loaded || this.width === 0 || this.height === 0) {
      return "normal";
    }

    const x = Math.max(
      0,
      Math.min(
        this.width - 1,
        Math.round((position.x / 100) * (this.width - 1)),
      ),
    );

    const y = Math.max(
      0,
      Math.min(
        this.height - 1,
        Math.round((position.y / 100) * (this.height - 1)),
      ),
    );

    const [r, g, b] = this.context.getImageData(x, y, 1, 1).data;

    if (r < 40 && g < 40 && b < 40) {
      return "blocked";
    }

    if (b > 200 && r < 80 && g < 120) {
      return "river";
    }

    if (g > 180 && r < 120 && b < 120) {
      return "forest";
    }

    if (r > 180 && g > 180 && b < 120) {
      return "highGround";
    }

    if (r > 180 && g < 120 && b < 120) {
      return "special";
    }

    return "normal";
  }
}
