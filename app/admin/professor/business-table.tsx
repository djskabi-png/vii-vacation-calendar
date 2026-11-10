"use client";
import {useState,type ReactNode} from 'react';
import type {ProfessorBusinessRow} from '../../lib/professor-business-breakdown';
import type {ProfessorMetric} from '../../lib/admin-professor-intent';
import styles from '../admin.module.css';
import { CurrencyText } from '../../components/currency-text';

export function professorBusinessWindow(rows:ProfessorBusinessRow[],query:string,page:number,size=20){
 const needle=query.trim().toLocaleLowerCase('he');
 const filtered=needle?rows.filter(row=>[row.name,row.placeId,row.siteID].join(' ').toLocaleLowerCase('he').includes(needle)):rows;
 const pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.max(0,Math.min(page,pages-1));
 return {items:filtered.slice(current*size,(current+1)*size),total:filtered.length,current,pages};
}
export function ProfessorBusinessTable({rows,metrics,labels,renderText}:{rows:ProfessorBusinessRow[];metrics:ProfessorMetric[];labels:Record<ProfessorMetric,string>;renderText:(value:string)=>ReactNode}){
 const [query,setQuery]=useState(''),[page,setPage]=useState(0);
 const view=professorBusinessWindow(rows,query,page);
 const known=rows.filter(row=>metrics.every(metric=>row.values[metric]!=null)).length;
 return <section className={styles.professorBusinesses} aria-label="פירוט לפי עסק">
  <header><div><h3>פירוט לפי עסק</h3><p>{known.toLocaleString('he-IL')} מתוך {rows.length.toLocaleString('he-IL')} עסקים עם נתונים שמורים לטווח שנבחר</p></div><label>חיפוש עסק<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}} placeholder="שם או מזהה עסק"/></label></header>
  <div className={styles.professorTableScroll}><table><thead><tr><th scope="col">עסק</th>{metrics.map(metric=><th scope="col" key={metric}>{renderText(labels[metric])}</th>)}</tr></thead><tbody>{view.items.map(row=><tr key={`${row.world}:${row.placeId}`}><th scope="row">{renderText(row.name)}</th>{metrics.map(metric=><td key={metric}>{metric==='bizRevenue' && row.values[metric]!=null ? <CurrencyText text={`₪ ${row.values[metric]!.toLocaleString('he-IL')}`} /> : renderText(row.values[metric]==null?'לא נשמר':row.values[metric]!.toLocaleString('he-IL'))}</td>)}</tr>)}</tbody></table>{!view.total?<p role="status">לא נמצאו עסקים שמתאימים לחיפוש.</p>:null}</div>
  <footer><span>עמוד {view.current+1} מתוך {view.pages} · {view.total.toLocaleString('he-IL')} עסקים</span><div><button type="button" onClick={()=>setPage(view.current-1)} disabled={!view.current}>הקודם</button><button type="button" onClick={()=>setPage(view.current+1)} disabled={view.current+1>=view.pages}>הבא</button></div></footer>
 </section>;
}
