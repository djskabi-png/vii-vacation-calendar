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

/**
 * Keep image decoding outside the application Worker.
 *
 * Cloudflare Workers have a 128 MB isolate limit. Decoding a photograph to
 * RGBA in JavaScript can consume almost the entire budget and terminate an
 * unrelated RSC request sharing the isolate. The platform image binding owns
 * that allocation outside this Worker. If it rejects, vinext catches the error
 * and refetches the source image without an in-process decode fallback.
 */
export async function transformResponsiveImage(
  body: ReadableStream,
  options: ResponsiveImageOptions,
  nativeBinding?: NativeImageBinding,
) {
  if (!nativeBinding) {
    throw new Error("Native image transform binding is unavailable");
  }

  const result = await nativeBinding
    .input(body)
    .transform(options.width > 0 ? { width: options.width } : {})
    .output({ format: options.format, quality: options.quality });
  const response = result.response();
  if (!response.ok) throw new Error(`Native image transform returned ${response.status}`);
  const headers = new Headers(response.headers);
  headers.set("X-VII-Image-Engine", "cloudflare-images");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
