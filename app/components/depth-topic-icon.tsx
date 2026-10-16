import { Waves, Bath, Heart, Utensils, Music, Camera, Flower2, Wine, PartyPopper, Accessibility, ParkingCircle, KeyRound, Wallet, Flame, Trees, Landmark, Sailboat, Sun, Mountain, UsersRound, Building2, House, Flower, Clock3, Sparkles, Compass, Footprints } from "lucide-react";

const icons = { pool: Waves, bath: Bath, heart: Heart, meal: Utensils, music: Music, camera: Camera, flower: Flower2, bar: Wine, party: PartyPopper, access: Accessibility, parking: ParkingCircle, key: KeyRound, wallet: Wallet, heat: Flame, forest: Trees, landmark: Landmark, coast: Sailboat, sun: Sun, mountain: Mountain, people: UsersRound, hotel: Building2, house: House, spa: Flower, clock: Clock3, spark: Sparkles, compass: Compass, foot: Footprints };

export function DepthTopicIcon({ topic }: { topic: string }) {
  const Icon = topic === "city" ? Building2 : icons[topic as keyof typeof icons] || Compass;
  return <span className="search-depth__discovery-icon" data-depth-topic={topic} aria-hidden="true"><Icon strokeWidth={1.7} /></span>;
}
