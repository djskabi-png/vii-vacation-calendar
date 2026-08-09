import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JoinPage from "../page";
import { joinWorlds, type JoinWorld } from "../worlds";

type Props = { params: Promise<{ world: string }> };

function isJoinWorld(value: string): value is JoinWorld {
  return joinWorlds.includes(value as JoinWorld);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { world } = await params;
  if (!isJoinWorld(world)) return {};
  const labels: Record<JoinWorld, string> = {
    providers: "ספקים ונותני שירות",
    vacation: "נופש ומקומות אירוח",
    events: "מתחמי אירועים",
    spa: "ספא וטיפולים",
    hourly: "חדרים לפי שעה",
    activities: "אטרקציות וחוויות",
  };
  const label = labels[world];
  return {
    title: `הצטרפות לוי פור ויקיישן, ${label}`,
    description: `מסלול ההצטרפות המתאים לעסקים בתחום ${label}, עם טופס והמשך טיפול מותאם.`,
    alternates: { canonical: `/join/${world}` },
  };
}

export default async function JoinWorldPage({ params }: Props) {
  const { world } = await params;
  if (!isJoinWorld(world)) notFound();
  return <JoinPage initialWorld={world} />;
}
