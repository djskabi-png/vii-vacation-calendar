"use client";
import { useState } from "react";
import { useAdminCanEdit } from "../admin-access-context.tsx";
import styles from "./quality.module.css";

export type BrowserProfileOption = {profileId:string;world:string;device:string;scenario:string};
export type BrowserProfileOptions = {enabled:boolean;profiles:BrowserProfileOption[]};
const worlds:Record<string,string>={vacations:'נופש',events:'אירועים',hourly:'לפי שעה',spa:'ספא',providers:'ספקים',activities:'אטרקציות',trails:'מסלולי טיול',global:'דף הבית'};
const devices:Record<string,string>={desktop:'מחשב',mobile:'נייד'};
const scenarios:Record<string,string>={'world-shell':'פתיחת עולם','map-open-close':'פתיחת מפה וסגירתה','responsive-shell':'התאמת העמוד למסך','gallery-next':'מעבר תמונה בגלריה'};

export default function BrowserProfileControl({options,disabled,onRun,initialProfileId}:{options:BrowserProfileOptions;disabled:boolean;onRun:(profileId:string)=>void;initialProfileId?:string}) {
  const canEdit=useAdminCanEdit();
  const initial=options.profiles.find(p=>p.profileId===initialProfileId);
  const [world,setWorld]=useState(initial?.world||'vacations');
  const [device,setDevice]=useState(initial?.device||'mobile');
  const [scenario,setScenario]=useState(initial?.scenario||'world-shell');
  const available=options.profiles.filter(p=>p.world===world&&p.device===device);
  const selected=available.find(p=>p.scenario===scenario)||available.find(p=>p.scenario==='world-shell')||available[0];
  const blocked=disabled||!canEdit||!options.enabled||!selected;
  function run(){if(blocked||!selected)return;onRun(selected.profileId);}
  return <section className={`${styles.section} ${styles.browserSection}`} aria-label="בדיקות דפדפן">
    <h2>בדיקות דפדפן</h2>
    <p>בודקים פעולה אמיתית בעמוד, בנפרד מבדיקות השרת והנתונים.</p>
    {!options.enabled?<p role="status">בדיקות הדפדפן עדיין לא הופעלו בסביבה הזאת.</p>:null}
    <div className={styles.browserControls}>
      <label>עולם הבדיקה <select value={world} disabled={disabled} onChange={event=>setWorld(event.target.value)}>{Object.entries(worlds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>מסך הבדיקה <select value={device} disabled={disabled} onChange={event=>setDevice(event.target.value)}>{Object.entries(devices).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>מה לבדוק <select value={selected?.scenario||''} disabled={disabled||!selected} onChange={event=>setScenario(event.target.value)}>{available.map(p=><option key={p.profileId} value={p.scenario}>{scenarios[p.scenario]||'תרחיש בדיקה'}</option>)}</select></label>
      <button type="button" disabled={blocked} onClick={run}>הפעלת בדיקת דפדפן</button>
    </div>
  </section>;
}
