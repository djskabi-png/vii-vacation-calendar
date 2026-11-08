"use client";
import Link from 'next/link';
import {useState} from 'react';
import {ArrowLeft,Search,Pencil,Database,Eye} from 'lucide-react';
import {useAdminAccess} from '../admin-access-context';
import {adminRouteAllowed,type AdminAccess} from '../../lib/admin-permissions';
import styles from './editing.module.css';

export const editingTools=[
 {id:'content',group:'תוכן ועיצוב',title:'טקסטים, כותרות ושפות',description:'תוכן עמודים, שאלות ותשובות וגרסאות בשפות האתר.',href:'/admin/content-studio',source:false},
 {id:'popular',group:'תוכן ועיצוב',title:'חיפושים נפוצים',description:'הצעות בכל עולם, סדר, תמונה וקישור.',href:'/admin/content-studio?popularWorld=spa',source:false},
 {id:'navigation',group:'תוכן ועיצוב',title:'תפריטים, פוטר ותמונות תוכן',description:'עריכת פריטי התוכן והקישורים המנוהלים בסטודיו.',href:'/admin/content-studio',source:false},
 {id:'worlds',group:'תוכן ועיצוב',title:'עולמות האתר',description:'בחירת העולמות הפעילים והנראות שלהם באתר.',href:'/admin/worlds',source:false},
 {id:'pages',group:'חיפוש וגילוי',title:'עמודי חיפוש ואישורים',description:'עמודים קיימים באתר, הצעות חדשות, תוכן ופרסום.',href:'/admin/search-pages',source:false},
 {id:'weights',group:'חיפוש וגילוי',title:'משקלים וחשיפות',description:'משקל, תוקף וסטטוס של קידומי מקומות בכל עולם.',href:'/admin/discovery-promotions',source:false},
 {id:'geography',group:'חיפוש וגילוי',title:'ערים, אזורים ומיקומים',description:'שמות, שיוך אזורים, כתובות ומיקומים מאומתים.',href:'/admin/geography',source:false},
 {id:'redirects',group:'חיפוש וגילוי',title:'כתובות והפניות',description:'ניהול כתובות ישנות והפניות לעמוד המתאים.',href:'/admin/redirects',source:false},
 {id:'catalogs',group:'מידע ותפעול',title:'עסקים, יחידות וגלריות ספקים',description:'זמינות, מחיר, פרטי קשר ותמונות של יחידות מגיעים מהספק. כאן מנהלים את המשיכה והאבחון.',href:'/admin/catalog-sync',source:true},
 {id:'operations',group:'מידע ותפעול',title:'הזמנות וחוות דעת',description:'טיפול בפעולות, סטטוסים ואסמכתאות קיימות.',href:'/admin/operations',source:false},
 {id:'users',group:'מידע ותפעול',title:'משתמשים והרשאות',description:'גישה לאזורי ניהול ולפעולות עריכה, לפי תפקיד.',href:'/admin/users',source:false},
] as const;
export function editingToolsForAccess(access:AdminAccess,query=''){
 const needle=query.trim();
 return editingTools.filter(tool=>adminRouteAllowed(access,tool.href.split('?')[0])&&(!needle||[tool.title,tool.description,tool.group].join(' ').includes(needle))).map(tool=>({...tool,canEdit:!tool.source&&adminRouteAllowed(access,tool.href.split('?')[0],'POST')}));
}
export default function EditingHub(){
 const access=useAdminAccess(),[query,setQuery]=useState(''),tools=editingToolsForAccess(access,query);
 const groups=[...new Set(tools.map(tool=>tool.group))];
 return <main className={styles.hub} dir="rtl"><header><span>V Control</span><h1>מרכז עריכה</h1><p>בחרו את החלק באתר שתרצו לשנות.</p><label><Search size={19}/><span className={styles.hidden}>חיפוש אזור עריכה</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="תוכן, תמונות, חיפוש, משקלים..."/></label></header>
 {groups.map(group=><section key={group}><h2>{group}</h2><div className={styles.grid}>{tools.filter(tool=>tool.group===group).map(tool=><Link key={tool.id} href={tool.href} prefetch={false} className={styles.tool}><span className={styles.icon}>{tool.source?<Database/>:tool.canEdit?<Pencil/>:<Eye/>}</span><span><strong>{tool.title}</strong><small>{tool.description}</small><b>{tool.source?'מנוהל אצל הספק':tool.canEdit?'פתיחת עריכה':'פתיחה לצפייה'}</b></span><ArrowLeft size={18}/></Link>)}</div></section>)}
 {!tools.length?<p role="status">לא נמצאו אזורי ניהול שמתאימים לחיפוש ולהרשאות שלכם.</p>:null}
 </main>;
}
