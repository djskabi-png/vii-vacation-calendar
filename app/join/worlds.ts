export const joinWorlds = ["providers", "vacation", "events", "spa", "hourly", "activities"] as const;
export type JoinWorld = (typeof joinWorlds)[number];
