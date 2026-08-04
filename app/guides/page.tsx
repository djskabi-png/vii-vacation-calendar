/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { guides } from "../data/site-data";
export default function GuidesPage(){return <PageShell><main id="main-content"><section className="inner-hero shell"><span className="eyebrow">מתכננים חופשה</span><h1>מדריכים, רעיונות והמלצות</h1><p>מידע שימושי שיעזור לבחור אזור, מקום והרכב שמתאימים לכם.</p></section><section className="section shell article-grid">{guides.map((item,index)=><article key={item.title} className={index===0?"featured":""}><img src={item.image} alt=""/><div><span className="eyebrow">{item.category}</span><h2>{item.title}</h2><p>{item.excerpt}</p><Link href={`/guides/article/?id=${index}`}>לקריאת המדריך</Link></div></article>)}</section></main></PageShell>}
