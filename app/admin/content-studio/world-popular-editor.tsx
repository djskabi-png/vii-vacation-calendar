"use client";
import { worldPopularSearchItems, type HomeDiscoveryItem } from '../../lib/homepage-presentation';
import { popularSearchWorlds, type PopularSearchWorld } from '../../lib/world-popular-search-defaults';
import styles from './content-studio-extras.module.css';

export function editablePopularItems(attributes:Record<string,string>,world:PopularSearchWorld):HomeDiscoveryItem[] {
  const key=popularSearchWorlds.find(item=>item.id===world)!.attribute;
  try {
    const raw=JSON.parse(attributes[key]);
    if(Array.isArray(raw) && raw.every(row=>row && typeof row==='object' && ['id','label','href','image'].every(key=>typeof row[key]==='string')))return raw.map(row=>({...row,note:typeof row.note==='string'?row.note:'',visible:row.visible!==false}));
  } catch { /* Initial missing/invalid source uses the same world fallback. */ }
  return worldPopularSearchItems(attributes,world);
}

export function WorldPopularEditor({world,onWorldChange,attributes,onChange,disabled}:{world:PopularSearchWorld;onWorldChange:(world:PopularSearchWorld)=>void;attributes:Record<string,string>;onChange:(attributes:Record<string,string>)=>void;disabled:boolean}) {
  const definition=popularSearchWorlds.find(item=>item.id===world)!;
  const items=editablePopularItems(attributes,world);
  const save=(next:HomeDiscoveryItem[])=>{if(!disabled)onChange({...attributes,[definition.attribute]:JSON.stringify(next),[definition.attribute+'Version']:'2'});};
  const edit=<K extends keyof HomeDiscoveryItem>(index:number,key:K,value:HomeDiscoveryItem[K])=>save(items.map((item,i)=>i===index?{...item,[key]:value}:item));
  const move=(index:number,delta:number)=>{const target=index+delta;if(target<0||target>=items.length)return;const next=[...items];[next[index],next[target]]=[next[target],next[index]];save(next);};
  return <fieldset className={styles.homeDeals} disabled={disabled}>
    <legend>חיפושים נפוצים</legend>
    <label className={styles.periodLabel}><span>עולם</span><select value={world} onChange={event=>onWorldChange(event.target.value as PopularSearchWorld)}>{popularSearchWorlds.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div className={styles.discoveryControlList}>{items.map((item,index)=><section className={styles.discoveryControlRow} key={item.id} aria-label={item.label}>
      <label className={styles.visibilityToggle}><input type="checkbox" checked={item.visible} onChange={event=>edit(index,'visible',event.target.checked)}/><span>מוצג באתר</span></label>
      <label><span>כותרת</span><input value={item.label} maxLength={70} onChange={event=>edit(index,'label',event.target.value)}/></label>
      <label><span>טקסט קצר</span><input value={item.note} maxLength={120} onChange={event=>edit(index,'note',event.target.value)}/></label>
      <label><span>קישור</span><input dir="ltr" value={item.href} maxLength={240} onChange={event=>edit(index,'href',event.target.value)}/></label>
      <label><span>תמונה</span><input dir="ltr" value={item.image} maxLength={300} onChange={event=>edit(index,'image',event.target.value)}/></label>
      <label><span>תיאור התמונה</span><input value={item.imageAlt||''} maxLength={160} onChange={event=>edit(index,'imageAlt',event.target.value)}/></label>
      <label><span>פעולה</span><select value={item.action||'link'} onChange={event=>edit(index,'action',event.target.value==='nearby'?'nearby':undefined)}><option value="link">פתיחת קישור</option><option value="nearby">קרוב אליי</option></select></label>
      <div className={styles.orderButtons}><button type="button" disabled={index===0} onClick={()=>move(index,-1)}>העלאה</button><button type="button" disabled={index===items.length-1} onClick={()=>move(index,1)}>הורדה</button><button type="button" onClick={()=>save(items.filter((_,i)=>i!==index))}>הסרה</button></div>
    </section>)}</div>
    <button type="button" className={styles.createButton} onClick={()=>save([...items,{id:`${world}-${crypto.randomUUID()}`,label:'חיפוש חדש',note:'',href:definition.href,image:items[0]?.image||'/media/f18d7c0469633ca0.jpeg',imageAlt:'',visible:true}])}>הוספת חיפוש</button>
  </fieldset>;
}
