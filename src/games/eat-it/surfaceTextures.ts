import * as T from 'three';

export type Surface = 'brick' | 'siding' | 'roof' | 'paint' | 'rubber' | 'fur' | 'feather' | 'wood';

/** Small, seamless, deterministic maps shared by all instances of a material. */
export function surfaceTexture(surface: Surface) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = ((x * 73 + y * 151 + x * y * 7) % 29) / 29;
    let value = 0.92 + grain * 0.08;
    if (surface === 'brick') {
      const row = Math.floor(y / 16), seam = y % 16 < 2 || (x + row % 2 * 16) % 32 < 2;
      value = seam ? .63 : .85 + grain * .15;
    } else if (surface === 'siding') {
      value = y % 16 < 2 ? .64 : .87 + (y % 16) / 160 + grain * .04;
    } else if (surface === 'roof') {
      const row = Math.floor(y / 16);
      value = y % 16 < 2 || (x + row % 2 * 8) % 16 < 1 ? .5 : .7 + (y % 16) / 64 + grain * .08;
    } else if (surface === 'rubber') {
      value = (x + Math.abs(y % 32 - 16)) % 16 < 3 ? .45 : .86 + grain * .12;
    } else if (surface === 'fur') {
      const stripe = Math.sin(x / size * Math.PI * 12 + Math.sin(y / size * Math.PI * 4) * 1.8);
      value = stripe > .7 ? .60 + grain * .1 : .88 + grain * .12;
    } else if (surface === 'feather') {
      const row = Math.floor(y / 16), u = (x + row % 2 * 8) % 16;
      value = y % 16 > 11 + Math.cos((u - 8) / 8 * Math.PI) * 3 ? .65 : .84 + u / 120 + grain * .05;
    } else if (surface === 'wood') {
      value = .78 + Math.sin(x / size * Math.PI * 18 + Math.sin(y / size * Math.PI * 2)) * .1 + grain * .1;
    }
    const i = (y * size + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = Math.round(value * 255);
    pixels[i + 3] = 255;
  }
  const texture = new T.DataTexture(pixels, size, size, T.RGBAFormat);
  texture.name = `eat-it-${surface}`;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
