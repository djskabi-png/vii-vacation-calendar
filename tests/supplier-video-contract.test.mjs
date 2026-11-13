import assert from "node:assert/strict";
import test from "node:test";
import { supplierVideos } from "../app/data/supplier-place-detail.ts";

test("supplier video fields are normalized to safe nocookie embeds", () => {
  const result = supplierVideos([{ youtube_url: "https://youtu.be/WNhfp-IKebA", title: "וידאו" }], "/api/vii/media/hero.jpg");
  assert.equal(result[0].embedUrl, "https://www.youtube-nocookie.com/embed/WNhfp-IKebA");
  assert.equal(result[0].verifiedRealVideo, true);
});

test("supplier videos reject unsafe or non-video YouTube URLs and deduplicate IDs", () => {
  const result = supplierVideos([
    { url: "https://www.youtube.com/channel/not-a-video" },
    { url: "https://evil.example/embed/WNhfp-IKebA" },
    { url: "https://youtu.be/WNhfp-IKebA" },
    { embed_url: "https://www.youtube.com/embed/WNhfp-IKebA?autoplay=1" },
  ], "/api/vii/media/hero.jpg");
  assert.deepEqual(result.map((video) => video.embedUrl), ["https://www.youtube-nocookie.com/embed/WNhfp-IKebA"]);
});
