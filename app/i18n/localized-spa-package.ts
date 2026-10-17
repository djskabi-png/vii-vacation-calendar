import type { SiteLanguage } from "./locale-routing";
type PackageFacts = { title:string; durationMinutes:number|null; people:number|null; group?:boolean };
// A reviewed complete translation takes precedence. A new supplier title gets
// a concise title built only from its explicit facts, never partial Hebrew.
export function localizedSpaPackageTitle(pack:PackageFacts, language:SiteLanguage, translate:(source:string)=>string) {
 if(language==="he") return pack.title;
 const translated=translate(pack.title);
 if(translated && !/[\u0590-\u05ff]/.test(translated)) return translated;
 const terms={
  en:{spa:"Spa package",massage:"Massage",japanese:"Japanese head massage",head:"Head massage",thai:"Thai massage",foot:"Foot massage",solo:"for one",couple:"for two",group:"for a group",minutes:"min",breakfast:"breakfast",coffee:"coffee and a pastry",facilities:"spa access",suite:"private suite"},
  fr:{spa:"Forfait spa",massage:"Massage",japanese:"Massage japonais du cuir chevelu",head:"Massage du cuir chevelu",thai:"Massage thaï",foot:"Massage des pieds",solo:"solo",couple:"en duo",group:"en groupe",minutes:"min",breakfast:"petit-déjeuner",coffee:"café et pâtisserie",facilities:"accès au spa",suite:"suite privée"},
  ru:{spa:"Спа-пакет",massage:"Массаж",japanese:"Японский массаж головы",head:"Массаж головы",thai:"Тайский массаж",foot:"Массаж стоп",solo:"для одного",couple:"для двоих",group:"для группы",minutes:"мин",breakfast:"завтрак",coffee:"кофе и выпечка",facilities:"доступ в спа",suite:"отдельный люкс"},
 }[language];
 const name=/ראש יפני|יפני.*ראש/.test(pack.title)?terms.japanese:/עיסוי ראש/.test(pack.title)?terms.head:/תאילנדי/.test(pack.title)?terms.thai:/FOOT\s*MASSAGE|עיסוי.*רגליים/i.test(pack.title)?terms.foot:/עיסוי|massage/i.test(pack.title)?terms.massage:terms.spa;
 const audience=pack.group||(pack.people??0)>=3?terms.group:pack.people===2?terms.couple:pack.people===1?terms.solo:"";
 const extras=[/ארוחת בוקר/.test(pack.title)?terms.breakfast:"",/קפה ומאפה/.test(pack.title)?terms.coffee:"",/שימוש במתקני הספא/.test(pack.title)?terms.facilities:"",/שהייה בסוויטה פרטית/.test(pack.title)?terms.suite:""].filter(Boolean);
 return `${name}${pack.durationMinutes?` ${pack.durationMinutes} ${terms.minutes}`:""}${audience?` · ${audience}`:""}${extras.length?` + ${extras.join(" + ")}`:""}`;
}

export function spaDealPeople(count:number,language:SiteLanguage) {
 if(language==="he") return `${count} ${count===1?"אורח":"אורחים"}`;
 if(language==="en") return `${count} ${count===1?"guest":"guests"}`;
 if(language==="fr") return `${count} ${count===1?"personne":"personnes"}`;
 const plural=new Intl.PluralRules("ru").select(count);
 return `${count} ${plural==="one"?"гость":plural==="few"?"гостя":"гостей"}`;
}
