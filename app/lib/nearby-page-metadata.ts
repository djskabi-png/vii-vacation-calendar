import type { Metadata } from "next";
import { serverLocalePath, serverPublicCopy } from "../i18n/server-public-copy";
export async function nearbyPageMetadata(path: string, titleSource: string, descriptionSource: string): Promise<Metadata> { const { translate } = await serverPublicCopy(); const title = translate(titleSource); const description = translate(descriptionSource); const canonical = await serverLocalePath(path); return { title, description, alternates: { canonical }, openGraph: { type: "website", url: canonical, title, description } }; }
