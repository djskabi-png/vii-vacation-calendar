import { readFile, writeFile } from "node:fs/promises";

const source = JSON.parse(await readFile(new URL("../app/data/sergey-place-details.json", import.meta.url), "utf8"));
const index = {};
for (const [slug, detail] of Object.entries(source.details || {})) {
  const rooms = Array.isArray(detail?.rooms) ? detail.rooms : [];
  const bedrooms = rooms.reduce((total, room) => total + (Number(room?.bedrooms) || 0) * (Number(room?.quantity) || 1), 0);
  if (bedrooms > 0) index[slug] = bedrooms;
}
await writeFile(new URL("../app/data/accepted-bedroom-index.json", import.meta.url), `${JSON.stringify(index)}\n`);
console.log(`generated ${Object.keys(index).length} accepted bedroom totals`);
