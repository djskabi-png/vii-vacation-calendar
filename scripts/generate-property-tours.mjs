import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const tours = [
  ["aqua-resort-tour", ["322de460abbda5c6.jpg", "e9cd942a11518461.jpg", "ab778a6145517591.jpg", "26594117388c096a.jpg", "1f3375e65f593e58.jpg"]],
  ["kesem-harimon-tour", ["978e5fd5134b0831.jpeg", "25a3797914ce4ebc.jpeg", "3d2467d61af8c746.jpeg", "63392bf513efc0d8.jpeg", "263f3613d9d7e1ac.jpeg"]],
  ["ahuzat-or-tour", ["9a403cb4d9d1cbde.jpg", "27ea67354de7adf5.jpg", "46795433029f635b.jpg", "f2c974e4edc6e951.jpg", "39a22ff22e8130b5.jpg"]],
  ["ar-suites-tour", ["c3a6274bfd08091a.jpeg", "cfbaafcf99fd6ec5.jpeg", "b60283b7a634cd04.jpeg", "fb2329f74cc92e55.jpeg", "eab56144ac75965f.jpeg"]],
  ["sol-gilgal-tour", ["bc85b10f1d64d6db.jpeg", "78fc8af7d313639d.jpeg", "043d473d475768df.jpeg", "9364ef10c919fddf.jpeg", "24beed85986e4496.jpeg"]],
  ["infinity-suites-tour", ["e65d757e686fda64.jpg", "4fa8dc0cb7d99d59.jpeg", "96d6e3022986cdb8.jpeg", "0c9f94d10a51d32c.jpeg", "8e61695d7524a310.jpeg"]],
  ["magic-garden-gefen-tour", ["231b0e706cc61cc1.jpg", "fa2f2bbd00f4e98b.jpg", "122679201a6d4958.jpg", "7ce2e9ab4ab99755.jpg", "58af829dd9a3a209.jpg"]],
  ["anael-estate-tour", ["f18d7c0469633ca0.jpeg", "8ac8a179f674fd0b.jpeg", "e8bfa1908a5718a1.jpeg", "7ec9bd469f615590.jpeg", "98723ca0b7e64cb5.jpeg"]],
  ["perfumes-villa-tour", ["69e3820a7e10bc39.jpeg", "d0884a4074adf164.jpeg", "17b60333b3f4b544.jpeg", "13f80a1579a643a1.jpeg", "422f8615ae7df2c6.jpeg"]],
  ["perfumes-villa-bedrooms", ["7567d48a2013fbb4.jpeg", "2f7676f977ecf219.jpeg", "c3ee9aa0fa56ea8e.jpeg", "f20cb9a07739bca1.jpeg", "1e1de19070a64e75.jpeg", "a51703b37e470c27.jpeg", "b71298f91a04d2d7.jpeg", "ba3670b131318b2d.jpeg", "e5020496e30e7dc0.jpeg"]],
  ["rose-estate-tour", ["cf58dc69af40c772.jpg", "78ad6fb57aff8002.jpg", "318cc18bc4802985.jpg", "0893cb9de7ce9600.jpg", "0654386871fb5427.jpg"]],
];

const mediaRoot = resolve("public/media");
const outputRoot = resolve("public/media/tours");
await mkdir(outputRoot, { recursive: true });

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}

for (const [name, images] of tours) {
  const inputs = images.flatMap((image) => ["-loop", "1", "-t", "1.6", "-i", resolve(mediaRoot, image)]);
  const normalized = images.map((_, index) => `[${index}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=25[v${index}]`);
  const concatInputs = images.map((_, index) => `[v${index}]`).join("");
  const filter = `${normalized.join(";")};${concatInputs}concat=n=${images.length}:v=1:a=0,format=yuv420p,fade=t=in:st=0:d=0.45[outv]`;
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", filter, "-map", "[outv]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-movflags", "+faststart", "-an",
    resolve(outputRoot, `${name}.mp4`),
  ]);
}

console.log(JSON.stringify({ tours: tours.length, output: outputRoot }));
