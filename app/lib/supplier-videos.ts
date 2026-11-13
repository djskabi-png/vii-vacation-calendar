function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function plain(value: unknown) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

export function supplierVideos(value: unknown, poster: string) {
  if (!Array.isArray(value) || !poster) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    const row = record(entry);
    const raw = [row.embedUrl, row.embed_url, row.youtubeUrl, row.youtube_url, row.videoUrl, row.video_url, row.url, row.src]
      .find((item) => typeof item === "string" && item.trim()) as string | undefined;
    if (!raw) return [];
    const candidate = raw.trim();
    const id = candidate.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=))([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/)?.[1]
      || (/^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : "");
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const src = `https://www.youtube-nocookie.com/embed/${id}`;
    return [{ title: plain(row.title) || "סרטון מהמקום", src, poster, note: plain(row.note), verifiedRealVideo: true as const, embedUrl: src }];
  });
}
