import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import TrailsPage from "../../page";
import { findDepthTopic, trailDepthTopics } from "../../../lib/world-depth-topics";
import { worldDepthCopy } from "../../../lib/world-depth-copy";

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const topic = findDepthTopic(trailDepthTopics, (await params).topic);
  if (!topic) notFound();
  const copy = worldDepthCopy(topic.label, (await headers()).get("x-vii-locale"), "trails");
  return { title: { absolute: `${copy.title} | V For Vacation` }, description: copy.description, alternates: { canonical: `/trails/explore/${topic.slug}` } };
}

export default async function TrailTopicPage({ params, searchParams }: { params: Promise<{ topic: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const topic = findDepthTopic(trailDepthTopics, (await params).topic);
  if (!topic) notFound();
  const query = await searchParams;
  const explicit = Object.fromEntries(Object.entries(query || {}).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]]));
  if (Object.entries(topic.params).some(([key, value]) => Object.hasOwn(explicit, key) && explicit[key] !== value)) {
    const locale = (await headers()).get("x-vii-locale");
    const prefix = locale && ["en", "ru", "fr"].includes(locale) ? `/${locale}` : "";
    redirect(`${prefix}/trails?${new URLSearchParams({ ...topic.params, ...explicit }).toString()}`);
  }
  return <TrailsPage topic={topic} />;
}
