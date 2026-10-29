import { ClampToEdgeWrapping, DataTexture, FloatType, NearestFilter, type PixelFormat } from "three/webgpu";

export function floatDataTexture(data: Float32Array, width: number, height: number, format: PixelFormat): DataTexture {
  const texture = new DataTexture(data, width, height, format, FloatType);

  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}
