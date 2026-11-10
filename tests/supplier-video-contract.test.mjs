import assert from "node:assert/strict";
import test from "node:test";
import { supplierVideos } from "../app/data/supplier-place-detail.ts";

test("supplier video fields are normalized to safe nocookie embeds", () => {
  const result = supplierVideos([{ youtube_url: "https://youtu.be/WNhfp-IKebA", title: "וידאו" }], "/api/vii/media/hero.jpg");
  assert.equal(result[0].embedUrl, "https://www.youtube-nocookie.com/embed/WNhfp-IKebA");
  assert.equal(result[0].verifiedRealVideo, true);
});
