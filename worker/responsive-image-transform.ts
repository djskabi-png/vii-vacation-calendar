import { PhotonImage, SamplingFilter, resize } from "@cf-wasm/photon";

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

function isPng(bytes: Uint8Array) {
  return bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}

function photonResponse(bytes: Uint8Array, { width, quality }: ResponsiveImageOptions) {
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error("Responsive image source exceeds the safe byte limit");

  const input = PhotonImage.new_from_byteslice(bytes);
  let output: PhotonImage | undefined;
  try {
    const sourceWidth = input.get_width();
    const sourceHeight = input.get_height();
    if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > MAX_SOURCE_PIXELS) {
      throw new Error("Responsive image source exceeds the safe pixel limit");
    }

    const targetWidth = Math.max(1, Math.min(sourceWidth, Math.floor(width)));
    const targetHeight = Math.max(1, Math.round(sourceHeight * targetWidth / sourceWidth));
    output = resize(input, targetWidth, targetHeight, SamplingFilter.Lanczos3);

    // Photon encodes WebP losslessly, which is often larger than a supplier
    // JPEG. Preserve alpha-capable PNG sources as WebP, and encode ordinary
    // gallery photography as bounded-quality JPEG for a real byte reduction.
    return isPng(bytes)
      ? bytesResponse(output.get_bytes_webp(), "image/webp", "photon-webp")
      : bytesResponse(output.get_bytes_jpeg(Math.round(quality)), "image/jpeg", "photon-jpeg");
  } finally {
    output?.free();
    input.free();
  }
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

  return photonResponse(bytes, options);
}
