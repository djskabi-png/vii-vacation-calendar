import engineDefinition from '../../vii-quality-browser/engine-definition.json' with {type:'json'};
export const browserEngineVersion=engineDefinition.sha256;
export type BrowserWorld = "vacations" | "events" | "hourly" | "spa";
export type BrowserDevice = "desktop" | "mobile";
export type BrowserScenario = "world-shell" | "map-open-close" | "responsive-shell" | "gallery-next";
export type BrowserProfile = Readonly<{
  profileId: string; definitionVersion: string; engineVersion:string;world: BrowserWorld; device: BrowserDevice;
  scenario: BrowserScenario; boxIds: readonly string[]; requirementIds: readonly string[];
  timeoutMs: number; maxRequests: number; gallery?: boolean;
}>;

const worlds: BrowserWorld[] = ["vacations", "events", "hourly", "spa"];
const devices: BrowserDevice[] = ["desktop", "mobile"];
const scenarios: BrowserScenario[] = ["world-shell", "map-open-close", "responsive-shell"];
const definitionVersion = `browser-profile-v1.${browserEngineVersion}`;
const profiles: BrowserProfile[] = [];
for (const world of worlds) for (const device of devices) for (const scenario of scenarios) profiles.push({
  profileId: `${world}-${device}-${scenario}`, definitionVersion,engineVersion:browserEngineVersion, world, device, scenario,
  boxIds: [world, "quality-browser", ...(scenario === "map-open-close" ? ["maps"] : [])], requirementIds: scenario === "map-open-close" ? ["V06", "Q14", "Q16"] : ["V05", "Q14", "Q16"],
  timeoutMs: 45_000, maxRequests: 180,
});
for (const device of devices) profiles.push({
  profileId: `vacations-${device}-gallery-next`, definitionVersion,engineVersion:browserEngineVersion, world: "vacations", device, scenario: "gallery-next", gallery: true,
  boxIds: ["vacations", "quality-browser"], requirementIds: ["V08", "Q14", "Q16"], timeoutMs: 45_000, maxRequests: 180,
});

export const browserProfiles: readonly BrowserProfile[] = Object.freeze(profiles.map(profile => Object.freeze({ ...profile, boxIds: Object.freeze([...profile.boxIds]), requirementIds: Object.freeze([...profile.requirementIds]) })));
const byId = new Map(browserProfiles.map(profile => [profile.profileId, profile]));
export function browserProfile(profileId: string): BrowserProfile | null { return byId.get(profileId) || null; }
export function isBrowserProfile(value: unknown): value is BrowserProfile {
  return !!value && typeof value === "object" && byId.get((value as { profileId?: unknown }).profileId as string) === value;
}
