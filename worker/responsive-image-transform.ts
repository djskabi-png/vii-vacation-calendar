import jpeg from "jpeg-js";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 24_000_000;

export interface NativeImageBinding {
  input(stream: ReadableStream): {
    transform(options: Record<string, unknown>): {
      output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
    };
  };
}

export interface ResponsiveImageOptions {
  width: number;
  format: string;
  quality: number;
}

function bytesResponse(bytes: Uint8Array, contentType: string, engine: string) {
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "X-VII-Image-Engine": engine,
    },
  });
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function resizeRgba(source: Uint8Array, sourceWidth: number, sourceHeight: number, width: number, height: number) {
  const output = new Uint8Array(width * height * 4);
  const xRatio = sourceWidth / width;
  const yRatio = sourceHeight / height;
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y + 0.5) * yRatio));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x + 0.5) * xRatio));
      const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
      const outputOffset = (y * width + x) * 4;
      output[outputOffset] = source[sourceOffset];
      output[outputOffset + 1] = source[sourceOffset + 1];
      output[outputOffset + 2] = source[sourceOffset + 2];
      output[outputOffset + 3] = source[sourceOffset + 3];
    }
  }
  return output;
}

function jpegResponse(bytes: Uint8Array, { width, quality }: ResponsiveImageOptions) {
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error("Responsive image source exceeds the safe byte limit");
  if (!isJpeg(bytes)) throw new Error("The bounded image fallback currently accepts JPEG photography only");

  const input = jpeg.decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: MAX_SOURCE_PIXELS / 1_000_000,
    maxMemoryUsageInMB: 96,
  });
  if (!input.width || !input.height || input.width * input.height > MAX_SOURCE_PIXELS) {
    throw new Error("Responsive image source exceeds the safe pixel limit");
  }

  const targetWidth = Math.max(1, Math.min(input.width, Math.floor(width)));
  const targetHeight = Math.max(1, Math.round(input.height * targetWidth / input.width));
  const resized = resizeRgba(input.data, input.width, input.height, targetWidth, targetHeight);
  const output = jpeg.encode({ data: resized, width: targetWidth, height: targetHeight }, Math.round(quality));
  return bytesResponse(new Uint8Array(output.data), "image/jpeg", "jpeg-js");
}

export async function transformResponsiveImage(
  body: ReadableStream,
  options: ResponsiveImageOptions,
  nativeBinding?: NativeImageBinding,
) {
  const bytes = new Uint8Array(await new Response(body).arrayBuffer());

  if (nativeBinding) {
    try {
      const result = await nativeBinding
        .input(new Blob([bytes]).stream())
        .transform(options.width > 0 ? { width: options.width } : {})
        .output({ format: options.format, quality: options.quality });
      const response = result.response();
      const headers = new Headers(response.headers);
      headers.set("X-VII-Image-Engine", "cloudflare-images");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      console.error("VII native image transform unavailable; using bounded WASM fallback", error);
    }
  }

  return jpegResponse(bytes, options);
}
