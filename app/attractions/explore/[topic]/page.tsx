import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import AttractionsPage from "../../page";
import { activityDepthTopics, findDepthTopic } from "../../../lib/world-depth-topics";
import { activityMatchesTopic } from "../../../lib/activity-discovery-taxonomy";
import { paidAttractions } from "../../../data/world-data";
import { managedDiscoveryItems } from "../../../lib/managed-public-content";
import { worldDepthCopy } from "../../../lib/world-depth-copy";

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const topic = findDepthTopic(activityDepthTopics, (await params).topic);
  if (!topic) notFound();
  const active = (await managedDiscoveryItems(paidAttractions, "attractions")).some(item => activityMatchesTopic(item, topic.params));
  const copy = worldDepthCopy(topic.label, (await headers()).get("x-vii-locale"), "activities");
  return { title: { absolute: `${copy.title} | V For Vacation` }, description: copy.description, alternates: { canonical: `/attractions/explore/${topic.slug}` }, ...(active ? {} : { robots: { index: false, follow: true } }) };
}

export default async function AttractionTopicPage({ params, searchParams }: { params: Promise<{ topic: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const topic = findDepthTopic(activityDepthTopics, (await params).topic);
  if (!topic) notFound();
  const query = await searchParams;
  const explicit = Object.fromEntries(Object.entries(query || {}).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]]));
  if (Object.entries(topic.params).some(([key, value]) => Object.hasOwn(explicit, key) && explicit[key] !== value)) {
    const locale = (await headers()).get("x-vii-locale");
    const prefix = locale && ["en", "ru", "fr"].includes(locale) ? `/${locale}` : "";
    redirect(`${prefix}/attractions?${new URLSearchParams({ ...topic.params, ...explicit }).toString()}`);
  }
  return <AttractionsPage topic={topic} />;
}
