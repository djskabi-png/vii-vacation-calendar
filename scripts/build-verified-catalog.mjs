import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const mediaRoot = path.join(root, "public", "media", "verified");
const outputPath = path.join(root, "app", "data", "verified-catalog.json");

const regions = {
  north: { label: "צפון", lat: 32.85, lng: 35.18 },
  center: { label: "מרכז", lat: 32.08, lng: 34.82 },
  south: { label: "דרום ונגב", lat: 31.25, lng: 34.79 },
  jerusalem: { label: "ירושלים", lat: 31.78, lng: 35.22 },
  eilat: { label: "אילת והסביבה", lat: 29.56, lng: 34.95 },
  haifa: { label: "חיפה", lat: 32.79, lng: 34.99 },
  kinneret: { label: "כנרת", lat: 32.79, lng: 35.54 },
  telaviv: { label: "תל אביב", lat: 32.08, lng: 34.78 },
};

const spaPages = [
  ["north", "https://www.spaplus.co.il/north"],
  ["center", "https://www.spaplus.co.il/Center"],
  ["south", "https://www.spaplus.co.il/South"],
  ["jerusalem", "https://www.spaplus.co.il/Jerusalem"],
  ["eilat", "https://www.spaplus.co.il/Eilat"],
  ["haifa", "https://www.spaplus.co.il/Haifa"],
  ["kinneret", "https://www.spaplus.co.il/Tiberias"],
  ["telaviv", "https://www.spaplus.co.il/Tel_Aviv"],
];

const roomPages = {
  hourly: [
    ["north", "https://roomsvip.com/search/North/100038521"],
    ["center", "https://roomsvip.com/search/Center/100038522"],
    ["south", "https://roomsvip.com/search/South/100038523"],
  ],
  vacation: [
    ["north", "https://www.vii.co.il/s/?marea=1"],
    ["center", "https://www.vii.co.il/s/?marea=2"],
    ["south", "https://www.vii.co.il/s/?marea=3"],
  ],
  events: [
    ["north", "https://www.vii.co.il/events/s/?marea=1"],
    ["center", "https://www.vii.co.il/events/s/?marea=2"],
    ["south", "https://www.vii.co.il/events/s/?marea=3"],
  ],
};

// Some active RoomsVIP properties have complete public detail pages but are not
// returned by the broad regional results page. Keep them here so the catalog
// stays source-backed without fabricating records or misclassifying regions.
const hourlyDetailSources = [
  {
    id: "hourly-aria-spa",
    regionKey: "south",
    name: "אריא ספא",
    location: "אשדוד",
    area: "דרום ונגב",
    sourceUrl: "https://roomsvip.com/Aria_Spa",
    sourceName: "RoomsVIP",
    guests: 2,
    price: 150,
    lat: 31.8044,
    lng: 34.6553,
  },
  {
    id: "hourly-neve-bar",
    regionKey: "south",
    name: "נווה בר - מלון בוטיק בכפר",
    location: "נווה מבטח",
    area: "דרום ונגב",
    sourceUrl: "https://roomsvip.com/neve_bar",
    sourceName: "RoomsVIP",
    guests: 2,
    price: 250,
    lat: 31.8057,
    lng: 34.7387,
  },
];

const attractionSources = [
  { id: "kfar-blum-kayaks", regionKey: "north", name: "קייקי כפר בלום", location: "כפר בלום", area: "צפון", sourceUrl: "https://www.kayaks.co.il/", description: "שייט קיאקים וחוויות מים בגליל העליון, עם מסלולים למשפחות, לקבוצות ולימי גיבוש.", features: ["שייט קיאקים", "משפחות וקבוצות", "רכישת כרטיסים"], lat: 33.1718, lng: 35.6084 },
  { id: "aqua-kef", regionKey: "north", name: "אקווה כיף", location: "טבריה", area: "כנרת", sourceUrl: "https://aquakef.co.il/", description: "פארק מים צף בחוף גנים בכנרת עם מסלול מכשולים, קארטינג ימי, חוף רחצה ומתחם אוכל.", features: ["פארק מים צף", "קארטינג ימי", "חוף רחצה"], lat: 32.7787, lng: 35.5414 },
  { id: "hamat-gader", regionKey: "north", name: "חמת גדר", location: "חמת גדר", area: "כנרת והעמקים", sourceUrl: "https://hamat-gader.com/", description: "אתר מרחצאות ומעיינות חמים עם בריכות, מתחמי ספא ואטרקציות עונתיות לכל המשפחה.", features: ["מעיינות חמים", "בריכות", "רכישת כרטיסים"], lat: 32.6836, lng: 35.6648 },
  { id: "haifa-museums", regionKey: "north", name: "מוזיאוני חיפה", location: "חיפה", area: "חיפה", sourceUrl: "https://www.hms.org.il/", description: "מערך של שישה מוזיאונים בחיפה, ובהם אמנות, תרבות יפנית, ים, עיר והיסטוריה מקומית.", features: ["שישה מוזיאונים", "תערוכות", "רכישת כרטיסים"], lat: 32.8157, lng: 34.9889 },
  { id: "madatech-haifa", regionKey: "north", name: "מדעטק", location: "חיפה", area: "חיפה", sourceUrl: "https://www.madatech.org.il/", description: "המוזיאון הלאומי למדע, טכנולוגיה וחלל בחיפה עם תערוכות אינטראקטיביות ופעילויות למשפחות.", features: ["מוזיאון מדע", "תערוכות אינטראקטיביות", "משפחות"], lat: 32.8112, lng: 34.9983 },
  { id: "safari-ramat-gan", regionKey: "center", name: "הספארי ברמת גן", location: "רמת גן", area: "מרכז", sourceUrl: "https://www.safari.co.il/", description: "מרכז זואולוגי עם שטח פתוח לנסיעה וגן חיות, סיורים ופעילויות לקהל הרחב.", features: ["ספארי", "גן חיות", "רכישת כרטיסים"], lat: 32.0464, lng: 34.8217 },
  { id: "luna-park-tel-aviv", regionKey: "center", name: "לונה פארק תל אביב", location: "תל אביב", area: "מרכז", sourceUrl: "https://lunapark.co.il/", description: "פארק שעשועים בתל אביב עם מתקנים לקטנטנים, למשפחות ולחובבי אקסטרים.", features: ["פארק שעשועים", "מתקני אקסטרים", "משפחות"], lat: 32.1057, lng: 34.8104 },
  { id: "superland", regionKey: "center", name: "סופרלנד", location: "ראשון לציון", area: "מרכז", sourceUrl: "https://www.superland.co.il/", description: "פארק שעשועים בראשון לציון עם מתקני משפחות, ילדים ואקסטרים.", features: ["פארק שעשועים", "מתקנים למשפחות", "רכישת כרטיסים"], lat: 31.9786, lng: 34.7448 },
  { id: "steinhardt-museum", regionKey: "center", name: "מוזיאון הטבע ע״ש שטיינהרדט", location: "תל אביב", area: "מרכז", sourceUrl: "https://smnh.tau.ac.il/", description: "מוזיאון טבע באוניברסיטת תל אביב עם תערוכות על מגוון ביולוגי, בעלי חיים וסביבת ישראל.", features: ["מוזיאון טבע", "תערוכות", "פעילות למשפחות"], lat: 32.1137, lng: 34.8045 },
  { id: "tel-aviv-museum", regionKey: "center", name: "מוזיאון תל אביב לאמנות", location: "תל אביב", area: "מרכז", sourceUrl: "https://www.tamuseum.org.il/he/", description: "מוזיאון אמנות מרכזי עם תערוכות קבועות ומתחלפות, פעילויות וסדנאות לקהל הרחב.", features: ["אמנות", "תערוכות", "רכישת כרטיסים"], lat: 32.0775, lng: 34.7868 },
  { id: "timna-park", regionKey: "south", name: "פארק תמנע", location: "הערבה הדרומית", area: "אילת והסביבה", sourceUrl: "https://parktimna.co.il/", description: "פארק מדברי רחב ידיים עם עמודי שלמה, הקשתות, אגם תמנע ומסלולי נסיעה והליכה.", features: ["טבע מדברי", "מסלולים", "רכישת כרטיסים"], lat: 29.7895, lng: 34.9879 },
  { id: "underwater-observatory", regionKey: "south", name: "פארק המצפה התת ימי", location: "אילת", area: "אילת והסביבה", sourceUrl: "https://coralworld.co.il/", description: "פארק ימי בחוף האלמוגים עם מצפה תת ימי, אקווריומים, כרישים וצבי ים.", features: ["מצפה תת ימי", "אקווריומים", "רכישת כרטיסים"], lat: 29.5041, lng: 34.9181 },
  { id: "dolphin-reef", regionKey: "south", name: "ריף הדולפינים", location: "אילת", area: "אילת והסביבה", sourceUrl: "https://www.dolphinreef.co.il/", description: "אתר ימי טבעי באילת עם תצפית בדולפינים, חוף, צלילות ופעילויות מודרכות.", features: ["דולפינים", "חוף", "פעילויות מים"], lat: 29.5263, lng: 34.9360 },
  { id: "camel-ranch-eilat", regionKey: "south", name: "חוות הגמלים אילת", location: "אילת", area: "אילת והסביבה", sourceUrl: "https://www.camel-ranch.co.il/", description: "חווה מדברית בהרי אילת עם טיולי גמלים, פעילויות שטח וחוויות לקבוצות ולמשפחות.", features: ["טיולי גמלים", "מדבר", "משפחות וקבוצות"], lat: 29.5791, lng: 34.9505 },
  { id: "carasso-science-park", regionKey: "south", name: "פארק קרסו למדע", location: "באר שבע", area: "דרום ונגב", sourceUrl: "https://sci-park.co.il/", description: "מוזיאון מדע וטכנולוגיה בבאר שבע עם תערוכות אינטראקטיביות וגן מדעי.", features: ["מוזיאון מדע", "תערוכות אינטראקטיביות", "רכישת כרטיסים"], lat: 31.2389, lng: 34.7879 },
];

const decode = (value = "") => value
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
  .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

const slugify = (url) => (new URL(url).pathname.split("/").filter(Boolean).pop() || "place")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "VII catalog builder" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function extractImages(raw, baseUrl) {
  const urls = [];
  const jsonMatch = raw.match(/data-imgs='(\{[^']+\})'/);
  if (jsonMatch) {
    try { urls.push(...Object.values(JSON.parse(jsonMatch[1].replaceAll("\\/", "/")))); } catch {}
  }
  const listMatch = raw.match(/data-imgs="([^"]+)"|data-imgs='([^']+)'/);
  if (listMatch) urls.push(...(listMatch[1] || listMatch[2]).match(/https?:\/\/[^,'"\s]+|\/gallery\/[^,'"\s]+/g) || []);
  urls.push(...[...raw.matchAll(/(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp))/gi)].map((match) => match[1]));
  urls.push(...[...raw.matchAll(/url\(["']?([^"')]+\.(?:jpe?g|png|webp)(?:\?[^"')]*)?)["']?\)/gi)].map((match) => match[1]));
  return [...new Set(urls.map((url) => new URL(url, baseUrl).href))].slice(0, 6);
}

function parseRoomCards(html, baseUrl, world, regionKey) {
  const chunks = html.split(/(?=<div[^>]+class=["'][^"']*room-box)/i);
  const found = [];
  for (const chunk of chunks) {
    const link = chunk.match(/class=["'][^"']*room-main-link[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link || !decode(link[2])) continue;
    const sourceUrl = new URL(link[1], baseUrl).href;
    const images = extractImages(chunk, baseUrl);
    if (!images.length) continue;
    const location = decode(chunk.match(/<div class=["']areas["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]) || regions[regionKey].label;
    const guests = Number(chunk.match(/(?:עד\s*<span>)?(\d+)\s*<\/span>\s*אורחים/i)?.[1] || chunk.match(/עד\s*(\d+)\s*אורחים/i)?.[1] || (world === "events" ? 40 : 10));
    const price = Number(chunk.match(/<span>₪<\/span>\s*([\d,]+)/i)?.[1]?.replaceAll(",", "") || 0) || undefined;
    const lat = Number(chunk.match(/data-gpslat=["']([^"']+)/i)?.[1]) || regions[regionKey].lat;
    const lng = Number(chunk.match(/data-gpslong=["']([^"']+)/i)?.[1]) || regions[regionKey].lng;
    found.push({ id: `${world}-${slugify(sourceUrl)}`, sourceUrl, sourceName: world === "hourly" ? "RoomsVIP" : "VII", name: decode(link[2]), location, area: regions[regionKey].label, regionKey, guests, price, lat, lng, remoteImages: images });
  }
  return [...new Map(found.map((item) => [item.sourceUrl, item])).values()].slice(0, 12);
}

function parseSpaCards(html, regionKey) {
  const chunks = html.split(/(?=<div\s+class=["']spa-box)/i);
  const found = [];
  for (const chunk of chunks) {
    const sourceUrl = chunk.match(/data-link=["'](https:\/\/www\.spaplus\.co\.il\/[^"']+)/i)?.[1];
    const name = decode(chunk.match(/<span class=["']title["']>([\s\S]*?)<\/span>/i)?.[1]);
    if (!sourceUrl || !name) continue;
    const remoteImages = extractImages(chunk, sourceUrl);
    if (remoteImages.length < 4) continue;
    const location = decode(chunk.match(/<span class=["']area["']>([\s\S]*?)<\/span>/i)?.[1]) || regions[regionKey].label;
    const price = Number(chunk.match(/<strong>₪\s*([\d,]+)/i)?.[1]?.replaceAll(",", "") || 0) || undefined;
    const rating = Number(chunk.match(/<span class=["']rank["'][^>]*>[\s\S]*?<\/i>\s*([\d.]+)/i)?.[1] || 0) || undefined;
    found.push({ id: `spa-${slugify(sourceUrl)}`, sourceUrl, sourceName: "Spa Plus", name, location, area: regions[regionKey].label, regionKey, price, rating, lat: regions[regionKey].lat, lng: regions[regionKey].lng, remoteImages });
  }
  return [...new Map(found.map((item) => [item.sourceUrl, item])).values()].slice(0, 15);
}

async function enrich(item, world) {
  const html = await fetchText(item.sourceUrl);
  const description = decode(html.match(/<meta[^>]+name=["']description["'][^>]+content="([^"]+)/i)?.[1] || html.match(/<meta[^>]+content="([^"]+)"[^>]+name=["']description/i)?.[1] || html.match(/<meta[^>]+name=["']description["'][^>]+content='([^']+)/i)?.[1]);
  const checkedLabels = [...html.matchAll(/<input(?=[^>]*checked)[^>]*>\s*<label[^>]*>([\s\S]*?)<\/label>/gi)].map((m) => decode(m[1])).filter(Boolean);
  const packageTitles = [...html.matchAll(/MainPageTitle:\s*["']([^"']+)/g)].map((m) => decode(m[1])).filter(Boolean).slice(0, 4);
  const packagePrices = [...html.matchAll(/price:\s*(\d+)/g)].map((m) => Number(m[1])).filter(Boolean).slice(0, 4);
  const detailImages = extractImages(html, item.sourceUrl);
  const imageSources = [...new Set([...item.remoteImages, ...detailImages])];
  const localImages = [];
  await mkdir(path.join(mediaRoot, world), { recursive: true });
  for (const [index, remote] of imageSources.slice(0, 6).entries()) {
    if (localImages.length >= 4) break;
    const ext = (new URL(remote).pathname.match(/\.(jpe?g|png|webp)$/i)?.[1] || "jpg").toLowerCase();
    const filename = `${item.id}-${localImages.length + 1}.${ext}`;
    const target = path.join(mediaRoot, world, filename);
    const response = await fetch(remote, { headers: { "user-agent": "VII catalog builder" } });
    if (!response.ok) continue;
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
    localImages.push(`/media/verified/${world}/${filename}`);
  }
  const defaultFeatures = world === "spa"
    ? ["טיפולי ספא", "חבילות ליחיד ולזוג", "הזמנה מקוונת"]
    : world === "hourly"
      ? ["שהייה לפי שעה", "פרטיות", "בחירת משך שהייה"]
      : world === "events"
        ? ["אירועים פרטיים", "בדיקת זמינות", `עד ${item.guests} אורחים`]
        : world === "attractions"
          ? ["פעילות בתשלום", "פרטים מלאים", "בדיקת אפשרויות הזמנה"]
          : ["נופש", "בדיקת זמינות", `עד ${item.guests} אורחים`];
  const features = [...new Set([...(item.features || []), ...checkedLabels, ...defaultFeatures])].filter(Boolean).slice(0, 8);
  return {
    ...item,
    remoteImages: undefined,
    image: localImages[0],
    images: localImages,
    description: item.description || description || `${item.name} ב${item.location}. כל פרטי המקום, האפשרויות ודרך ההזמנה מרוכזים בעמוד אחד.`,
    features,
    packages: packageTitles.map((title, index) => ({ id: `${item.id}-package-${index + 1}`, title, audience: "לפי החבילה", price: packagePrices[index] ? `החל מ-${packagePrices[index]} ₪` : "מחיר מוצג בבחירת מועד", duration: "לפי החבילה", includes: checkedLabels.slice(0, 4) })),
  };
}

const catalog = { spa: [], hourly: [], vacation: [], events: [], attractions: [] };
const seenByWorld = { spa: new Set(), hourly: new Set(), vacation: new Set(), events: new Set(), attractions: new Set() };
for (const [regionKey, url] of spaPages) {
  const selected = parseSpaCards(await fetchText(url), regionKey).filter((item) => !seenByWorld.spa.has(item.sourceUrl)).slice(0, 5);
  selected.forEach((item) => seenByWorld.spa.add(item.sourceUrl));
  catalog.spa.push(...selected);
}
for (const [world, pages] of Object.entries(roomPages)) for (const [regionKey, url] of pages) {
  const selected = parseRoomCards(await fetchText(url), url, world, regionKey).filter((item) => !seenByWorld[world].has(item.sourceUrl)).slice(0, 5);
  selected.forEach((item) => seenByWorld[world].add(item.sourceUrl));
  catalog[world].push(...selected);
}

for (const item of hourlyDetailSources) {
  if (seenByWorld.hourly.has(item.sourceUrl)) continue;
  const html = await fetchText(item.sourceUrl);
  const remoteImages = extractImages(html, item.sourceUrl);
  if (remoteImages.length < 3) continue;
  seenByWorld.hourly.add(item.sourceUrl);
  catalog.hourly.push({ ...item, remoteImages });
}

for (const item of attractionSources) {
  try {
    const html = await fetchText(item.sourceUrl);
    const remoteImages = extractImages(html, item.sourceUrl);
    catalog.attractions.push({ ...item, sourceName: `האתר הרשמי של ${item.name}`, remoteImages });
  } catch (error) {
    console.warn(`Skipping attraction ${item.name}: ${error.message}`);
  }
}

for (const world of Object.keys(catalog)) {
  const unique = catalog[world];
  const enriched = [];
  for (let index = 0; index < unique.length; index += 5) enriched.push(...await Promise.all(unique.slice(index, index + 5).map((item) => enrich(item, world))));
  catalog[world] = enriched.filter((item) => item.images.length >= (world === "attractions" ? 2 : world === "hourly" ? 3 : 4));
}

await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...catalog }, null, 2)}\n`, "utf8");
console.log(Object.fromEntries(Object.entries(catalog).map(([key, value]) => [key, value.length])));
