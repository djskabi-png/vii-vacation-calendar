"use client";
import { useEffect,useState } from "react";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { properties } from "../data/site-data";
export default function FavoritesPage(){const [ids,setIds]=useState<string[]>([]);useEffect(()=>{const read=()=>setIds(JSON.parse(localStorage.getItem("vii-favourites")||"[]"));read();window.addEventListener("vii-favourites-change",read);return()=>window.removeEventListener("vii-favourites-change",read)},[]);const saved=properties.filter(p=>ids.includes(p.slug));return <PageShell><main id="main-content"><section className="inner-hero shell"><span className="eyebrow">שומרים וחוזרים</span><h1>מקומות שאהבתי</h1><p>כל המקומות ששמרתם מרוכזים כאן להשוואה נוחה.</p></section><section className="section shell">{saved.length?<div className="card-grid">{saved.map(p=><PropertyCard key={p.slug} property={p}/>)}</div>:<div className="empty-state"><h2>עוד לא שמרתם מקומות</h2><p>לחצו על הלב בכרטיס של מקום שאהבתם, והוא יחכה לכם כאן.</p><a className="button primary" href="../search/">למציאת מקום</a></div>}</section></main></PageShell>}
