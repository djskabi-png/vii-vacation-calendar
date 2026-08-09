"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { type SiteLanguage, useSiteLanguage } from "../i18n/locale-provider";

type Intent = "join" | "providers" | "trails" | "activities" | "hourly" | "spa" | "events" | "stay" | "support" | "fallback";
type Place = { he: string; en: string; ru: string; fr: string; aliases: string[] };
type Action = { href: string; label: string };
type Message = { id: number; role: "agent" | "guest"; text: string; action?: Action };

const serviceWhatsappNumber = "972542298986";

const places: Place[] = [
  { he: "אילת", en: "Eilat", ru: "Эйлат", fr: "Eilat", aliases: ["אילת", "eilat", "эйлат", "eïlat"] },
  { he: "צפון", en: "Northern Israel", ru: "север Израиля", fr: "le nord d’Israël", aliases: ["צפון", "north", "север", "nord"] },
  { he: "גליל", en: "the Galilee", ru: "Галилея", fr: "la Galilée", aliases: ["גליל", "galilee", "galil", "галиле", "galilée"] },
  { he: "כנרת", en: "the Sea of Galilee", ru: "Кинерет", fr: "le lac de Tibériade", aliases: ["כנרת", "kinneret", "sea of galilee", "кинерет", "tibériade"] },
  { he: "מרכז", en: "Central Israel", ru: "центр Израиля", fr: "le centre d’Israël", aliases: ["מרכז", "center", "central", "центр", "centre"] },
  { he: "ירושלים", en: "Jerusalem", ru: "Иерусалим", fr: "Jérusalem", aliases: ["ירושלים", "jerusalem", "иерусалим", "jérusalem"] },
  { he: "דרום", en: "Southern Israel", ru: "юг Израиля", fr: "le sud d’Israël", aliases: ["דרום", "south", "юг", "sud"] },
  { he: "ים המלח", en: "the Dead Sea", ru: "Мёртвое море", fr: "la mer Morte", aliases: ["ים המלח", "dead sea", "мёртвое море", "mer morte"] },
  { he: "נתניה", en: "Netanya", ru: "Нетания", fr: "Netanya", aliases: ["נתניה", "netanya", "нетания"] },
  { he: "קיסריה", en: "Caesarea", ru: "Кесария", fr: "Césarée", aliases: ["קיסריה", "caesarea", "кесария", "césarée"] },
];

const ui = {
  he: {
    aria: "הנציג החכם של האתר", title: "נציג החופשה של וי", status: "זמין עכשיו באתר", close: "סגירת הנציג",
    introTitle: "מתכננים משהו טוב?", introBody: "דברו איתי חופשי, אני מכיר את כל העולמות באתר.", topics: "נושאים נפוצים",
    inputLabel: "כתבו לנציג מה תרצו למצוא", placeholder: "אפשר לכתוב לי הכל...", send: "שליחת הודעה",
    footer: "רוצים להמשיך עם שירות הלקוחות?", whatsapp: "מעבר לוואטסאפ", triggerTop: "נציג החופשה שלכם", triggerBottom: "איך אפשר לעזור?", unread: "הודעה חדשה",
    opening: "היי, אני הנציג החכם של וי. ספרו לי בחופשיות מה אתם מתכננים, למי, איפה ומתי. אעזור לכם להתמקד ואמצא את העמוד הנכון באתר.",
    quick: ["מחפשים נופש", "אירוע או חגיגה", "ספא או יום כיף", "אטרקציות באזור", "חדר לכמה שעות"],
    whatsappEmpty: "היי, הגעתי מהנציג החכם באתר VII ואשמח לעזרה.", whatsappWith: "היי, דיברתי עם הנציג החכם באתר VII. אני מחפש/ת: ",
  },
  en: {
    aria: "Site concierge", title: "Your VII vacation concierge", status: "Online on the site", close: "Close concierge",
    introTitle: "Planning something special?", introBody: "Tell me freely. I know every part of the site.", topics: "Popular topics",
    inputLabel: "Tell the concierge what you want to find", placeholder: "You can ask me anything...", send: "Send message",
    footer: "Prefer customer service?", whatsapp: "Continue on WhatsApp", triggerTop: "Your vacation concierge", triggerBottom: "How can I help?", unread: "New message",
    opening: "Hi, I’m VII’s smart concierge. Tell me what you are planning, for whom, where and when. I’ll help you focus and find the right page on the site.",
    quick: ["Find a vacation", "Event or celebration", "Spa or day pass", "Things to do nearby", "A room for a few hours"],
    whatsappEmpty: "Hi, I came from the smart concierge on the VII website and would like some help.", whatsappWith: "Hi, I spoke with the smart concierge on the VII website. I am looking for: ",
  },
  ru: {
    aria: "Умный консультант сайта", title: "Ваш консультант VII", status: "Сейчас онлайн", close: "Закрыть консультанта",
    introTitle: "Планируете что-то особенное?", introBody: "Пишите свободно. Я знаю все разделы сайта.", topics: "Популярные темы",
    inputLabel: "Напишите консультанту, что вы хотите найти", placeholder: "Спросите меня о чём угодно...", send: "Отправить сообщение",
    footer: "Хотите продолжить со службой поддержки?", whatsapp: "Перейти в WhatsApp", triggerTop: "Ваш консультант по отдыху", triggerBottom: "Чем помочь?", unread: "Новое сообщение",
    opening: "Здравствуйте, я умный консультант VII. Расскажите, что вы планируете, для кого, где и когда. Я помогу уточнить запрос и найти нужную страницу сайта.",
    quick: ["Найти отдых", "Мероприятие", "Спа или день отдыха", "Что делать рядом", "Номер на несколько часов"],
    whatsappEmpty: "Здравствуйте, я пришёл с сайта VII и хотел бы получить помощь.", whatsappWith: "Здравствуйте, я общался с умным консультантом на сайте VII. Я ищу: ",
  },
  fr: {
    aria: "Concierge intelligent du site", title: "Votre concierge VII", status: "Disponible sur le site", close: "Fermer le concierge",
    introTitle: "Vous préparez un beau projet ?", introBody: "Parlez-moi librement. Je connais tous les univers du site.", topics: "Sujets populaires",
    inputLabel: "Dites au concierge ce que vous recherchez", placeholder: "Vous pouvez tout me demander...", send: "Envoyer le message",
    footer: "Vous préférez le service client ?", whatsapp: "Continuer sur WhatsApp", triggerTop: "Votre concierge vacances", triggerBottom: "Comment vous aider ?", unread: "Nouveau message",
    opening: "Bonjour, je suis le concierge intelligent de VII. Dites-moi ce que vous préparez, pour qui, où et quand. Je vous aiderai à préciser votre recherche et à trouver la bonne page.",
    quick: ["Trouver un séjour", "Événement ou fête", "Spa ou journée détente", "Que faire à proximité", "Une chambre pour quelques heures"],
    whatsappEmpty: "Bonjour, je viens du concierge intelligent du site VII et je souhaite être aidé.", whatsappWith: "Bonjour, j’ai échangé avec le concierge intelligent du site VII. Je recherche : ",
  },
} as const;

function matchedPlace(text: string) {
  return places.find((place) => place.aliases.some((alias) => text.includes(alias)));
}

function detectIntent(value: string, previousQuestions: string[]): { intent: Intent; place?: Place } {
  const current = value.toLowerCase();
  const context = [...previousQuestions, value].join(" ").toLowerCase();
  const place = matchedPlace(context);
  if (/פרסום|לפרסם|להצטרף|לצרף עסק|בעל עסק|advertis|list my business|join as a business|реклам|добавить бизнес|publier mon entreprise|inscrire mon entreprise/.test(context)) return { intent: "join", place };
  if (/שף|די.?ג׳יי|צלם|בלונים|ספק|הפעלה|קייטרינג|chef|dj|photograph|cater|supplier|service provider|повар|фотограф|поставщик|traiteur|prestataire/.test(context)) return { intent: "providers", place };
  if (/טיול|מסלול|טבע|נחל|מפל|אגם|חוף|trail|hike|nature|waterfall|river|lake|поход|маршрут|природ|водопад|randonnée|sentier|nature|cascade/.test(context)) return { intent: "trails", place };
  if (/אטרקציה|טרקטורון|סוסים|מסעדה|מה עושים|פעילות|attraction|things to do|activity|restaurant|horse|развлеч|ресторан|activité|attraction|restaurant/.test(context)) return { intent: "activities", place };
  if (/שעה|כמה שעות|אירוח קצר|דיסקרטי|hourly|few hours|short stay|почас|несколько часов|quelques heures|à l'heure/.test(context)) return { intent: "hourly", place };
  if (/ספא|עיסוי|טיפול|יום כיף|spa|massage|day pass|массаж|спа|journée détente/.test(context)) return { intent: "spa", place };
  if (/אירוע|מסיבה|יום הולדת|חתונה|בר מצווה|בת מצווה|חגיגה|event|party|birthday|wedding|мероприят|праздник|свадьб|événement|fête|anniversaire|mariage/.test(context)) return { intent: "events", place };
  if (/נופש|חופשה|וילה|צימר|סוויטה|משפחה|זוג|בריכה|לינה|vacation|holiday|villa|suite|family|couple|pool|stay|отдых|вилл|семь|пара|séjour|vacances|villa|famille|couple/.test(context) || place) return { intent: "stay", place };
  if (/בעיה|עזרה|נציג|שירות|טלפון|וואטסאפ|help|support|agent|phone|whatsapp|помощ|поддерж|aide|assistance/.test(current)) return { intent: "support", place };
  return { intent: "fallback", place };
}

function routeFor(intent: Intent, place?: Place) {
  if (intent === "join") return "/join/";
  if (intent === "providers") return "/providers/";
  if (intent === "trails") return "/trails/";
  if (intent === "activities") return "/attractions/";
  if (intent === "hourly") return "/hourly/";
  if (intent === "spa") return "/spas/";
  if (intent === "events") return "/events/";
  if (intent === "stay") {
    const params = new URLSearchParams();
    if (place) params.set("location", place.he);
    return `/search/${params.size ? `?${params.toString()}` : ""}`;
  }
  return undefined;
}

function localizedReply(intent: Intent, language: SiteLanguage, place?: Place): Omit<Message, "id" | "role"> {
  const location = place?.[language];
  const routes: Record<Exclude<Intent, "support" | "fallback">, Record<SiteLanguage, string>> = {
    join: { he: "להצטרפות בעלי עסקים", en: "Join as a business", ru: "Добавить свой бизнес", fr: "Inscrire votre entreprise" },
    providers: { he: "למציאת ספקים", en: "Find service providers", ru: "Найти специалистов", fr: "Trouver des prestataires" },
    trails: { he: "למסלולי הטיול", en: "Explore hiking routes", ru: "Посмотреть маршруты", fr: "Voir les itinéraires" },
    activities: { he: "לאטרקציות וחוויות", en: "Explore activities", ru: "Посмотреть развлечения", fr: "Voir les activités" },
    hourly: { he: "לחדרים לפי שעה", en: "Find hourly stays", ru: "Найти номер на несколько часов", fr: "Trouver une chambre à l’heure" },
    spa: { he: "לעולם הספא", en: "Explore spa experiences", ru: "Перейти в раздел спа", fr: "Découvrir les spas" },
    events: { he: "לחיפוש מקומות לאירועים", en: "Find event venues", ru: "Найти площадку", fr: "Trouver un lieu événementiel" },
    stay: { he: location ? `לנופש באזור ${location}` : "לחיפוש החופשה", en: location ? `Find stays in ${location}` : "Search for a stay", ru: location ? `Найти отдых: ${location}` : "Найти отдых", fr: location ? `Trouver un séjour à ${location}` : "Rechercher un séjour" },
  };
  const text: Record<Intent, Record<SiteLanguage, string>> = {
    join: { he: "בשמחה. אפשר לבחור את עולם העסק, לראות את מסלולי החשיפה ולהתחיל בהקמת עמוד. הצוות בודק את הפרטים לפני פרסום.", en: "Of course. Choose your business category, compare exposure plans and start building your page. The team reviews the details before publication.", ru: "Конечно. Выберите категорию бизнеса, сравните варианты продвижения и начните создавать страницу. Перед публикацией команда проверит данные.", fr: "Bien sûr. Choisissez votre catégorie, comparez les formules de visibilité et commencez à créer votre page. L’équipe vérifie les informations avant publication." },
    providers: { he: "יש לנו עולם ספקים שמרכז אנשי מקצוע לחופשה ולאירוע. אפשר לבחור תחום ולראות עמוד מלא של כל ספק.", en: "Our services section brings together professionals for vacations and events. Choose a category and view a complete profile for each provider.", ru: "В разделе услуг собраны специалисты для отдыха и мероприятий. Выберите категорию и откройте полный профиль исполнителя.", fr: "Notre univers prestataires réunit des professionnels pour les séjours et les événements. Choisissez un métier et consultez le profil complet de chaque prestataire." },
    trails: { he: "מעולה. ריכזנו מסלולים עצמאיים עם אזור, משך, דרגת קושי והנחיות חשובות. לפני יציאה בודקים גם את המקור הרשמי שמופיע במסלול.", en: "Great. We collected independent routes with region, duration, difficulty and key guidance. Before leaving, also check the official source shown on each route.", ru: "Отлично. У нас есть самостоятельные маршруты с регионом, длительностью, сложностью и важными советами. Перед выходом проверьте официальный источник на странице маршрута.", fr: "Parfait. Nous avons réuni des itinéraires autonomes avec région, durée, difficulté et conseils essentiels. Avant de partir, consultez aussi la source officielle indiquée." },
    activities: { he: "אפשר למצוא חוויות ואטרקציות לפי האזור שבו אתם נופשים, ולשלב אותן בתכנון של היום.", en: "Find experiences and activities near where you are staying and add them to your day plan.", ru: "Найдите развлечения рядом с местом отдыха и добавьте их в план дня.", fr: "Trouvez des expériences et activités près de votre hébergement et ajoutez-les à votre journée." },
    hourly: { he: location ? `הבנתי, אתם מחפשים שהייה קצרה באזור ${location}. בעמוד החדרים לפי שעה אפשר לבחור עיר או אזור ולהמשיך לסינונים.` : "הבנתי, אתם מחפשים שהייה קצרה. בעמוד החדרים לפי שעה בוחרים עיר או אזור, ואז אפשר לדייק את התוצאות.", en: location ? `You are looking for a short stay around ${location}. Choose a city or region on the hourly-stay page, then refine the results.` : "You are looking for a short stay. Choose a city or region on the hourly-stay page, then refine the results.", ru: location ? `Вы ищете короткое проживание в районе ${location}. На странице почасовых номеров выберите город или регион и уточните фильтры.` : "Вы ищете короткое проживание. На странице почасовых номеров выберите город или регион и уточните фильтры.", fr: location ? `Vous cherchez un court séjour autour de ${location}. Choisissez une ville ou une région sur la page des chambres à l’heure, puis affinez les résultats.` : "Vous cherchez un court séjour. Choisissez une ville ou une région sur la page des chambres à l’heure, puis affinez les résultats." },
    spa: { he: location ? `נשמע מצוין. אפשר לבדוק מתחמי ספא באזור ${location}, ולבחור יחיד, זוגי, קבוצה או יום כיף ללא טיפולים.` : "נשמע מצוין. למי מזמינים ובאיזה אזור? אפשר לבחור יחיד, זוגי, קבוצה או יום כיף ללא טיפולים.", en: location ? `Sounds good. Explore spas around ${location} and choose solo, couple, group or a day pass without treatments.` : "Sounds good. Who is it for, and in which area? Choose solo, couple, group or a day pass without treatments.", ru: location ? `Отлично. Посмотрите спа в районе ${location} и выберите вариант для одного, пары, группы или дневной доступ без процедур.` : "Отлично. Для кого и в каком районе? Выберите вариант для одного, пары, группы или дневной доступ без процедур.", fr: location ? `Parfait. Découvrez les spas autour de ${location} et choisissez une formule solo, duo, groupe ou journée sans soin.` : "Parfait. Pour qui et dans quelle région ? Choisissez une formule solo, duo, groupe ou journée sans soin." },
    events: { he: location ? `הבנתי, מחפשים מקום לאירוע באזור ${location}. כדאי להוסיף תאריך משוער וכמות משתתפים כדי לדייק את הבחירה.` : "בשמחה. כתבו לי באיזה אזור, מתי חוגגים וכמה משתתפים צפויים, ואכוון אתכם לתוצאות המתאימות.", en: location ? `You are looking for an event venue around ${location}. Add an approximate date and guest count to refine the options.` : "Tell me the area, celebration date and expected number of guests, and I’ll guide you to the right results.", ru: location ? `Вы ищете площадку для мероприятия в районе ${location}. Добавьте примерную дату и количество гостей, чтобы уточнить выбор.` : "Напишите регион, дату и ожидаемое количество гостей, и я направлю вас к подходящим вариантам.", fr: location ? `Vous cherchez un lieu événementiel autour de ${location}. Ajoutez une date approximative et le nombre de participants pour affiner le choix.` : "Indiquez-moi la région, la date et le nombre de participants prévu, et je vous guiderai vers les bons résultats." },
    stay: { he: location ? `יופי, נתמקד בנופש באזור ${location}. כדאי לבחור גם תאריכים והרכב אורחים כדי לקבל תוצאות רלוונטיות יותר.` : "בשמחה. כתבו לי לאיזה אזור תרצו להגיע, באילו תאריכים וכמה אורחים מגיעים, ואעזור לכם להתמקד.", en: location ? `Great, let’s focus on stays around ${location}. Add dates and your group size for more relevant results.` : "Tell me where you would like to go, your dates and how many guests are coming, and I’ll help you narrow it down.", ru: location ? `Отлично, сосредоточимся на отдыхе в районе ${location}. Добавьте даты и состав гостей для более точных результатов.` : "Напишите, куда вы хотите поехать, даты и количество гостей, и я помогу сузить поиск.", fr: location ? `Parfait, concentrons-nous sur les séjours autour de ${location}. Ajoutez vos dates et la composition du groupe pour des résultats plus pertinents.` : "Dites-moi où vous souhaitez aller, vos dates et le nombre de voyageurs, et je vous aiderai à préciser la recherche." },
    support: { he: "אני כאן כדי לעזור באתר. אם תרצו לעבור לשיחה עם שירות הלקוחות, לחצו על כפתור הוואטסאפ ואעביר גם את תקציר השיחה.", en: "I’m here to help on the site. To continue with customer service, use the WhatsApp button and I’ll include a summary of this conversation.", ru: "Я помогу вам на сайте. Чтобы продолжить со службой поддержки, нажмите WhatsApp, и я добавлю краткое содержание разговора.", fr: "Je suis là pour vous aider sur le site. Pour continuer avec le service client, utilisez le bouton WhatsApp et j’ajouterai un résumé de cette conversation." },
    fallback: { he: "אני איתכם. נסו לכתוב לי אם מדובר בנופש, אירוע, ספא, בילוי באזור או שהייה לפי שעה. אפשר להוסיף אזור, תאריך, כמות אנשים ומה חשוב לכם במקום.", en: "I’m with you. Tell me whether this is a vacation, event, spa visit, nearby activity or hourly stay. Add the area, date, group size and what matters most to you.", ru: "Я с вами. Уточните, нужен ли отдых, мероприятие, спа, развлечение рядом или почасовой номер. Добавьте регион, дату, количество людей и ваши приоритеты.", fr: "Je suis avec vous. Précisez s’il s’agit d’un séjour, d’un événement, d’un spa, d’une activité à proximité ou d’une chambre à l’heure. Ajoutez la région, la date, le nombre de personnes et vos priorités." },
  };
  const href = routeFor(intent, place);
  return { text: text[intent][language], action: href && intent !== "support" && intent !== "fallback" ? { href, label: routes[intent][language] } : undefined };
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.4l1.3-4.7A8.5 8.5 0 1 1 20.5 11.7Z"/><path d="M8.2 7.7c.2-.4.4-.4.7-.4h.4c.2 0 .4.1.5.4l.8 1.9c.1.3 0 .5-.2.7l-.6.7c-.2.2-.2.4-.1.6.6 1.2 1.6 2.2 2.8 2.8.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l1.8.9c.3.1.4.3.4.5 0 .3-.1 1.4-.8 2-.6.5-1.4.8-2.3.6-1.2-.2-2.8-.8-4.5-2.3-2-1.8-3.3-4.1-3.4-5.5-.1-.8.2-1.6.6-2.1.4-.4.8-.5 1-.5"/></svg>;
}

function SendIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 15-7-5 15-2.8-6.2L4 12Z"/><path d="m11.2 13.8 3.2-3.2"/></svg>;
}

function openingMessage(language: SiteLanguage): Message {
  return { id: 1, role: "agent", text: ui[language].opening };
}

export function SmartConcierge() {
  const { language } = useSiteLanguage();
  const copy = ui[language];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([openingMessage(language)]);
  const [unread, setUnread] = useState(false);
  const nextId = useRef(2);
  const activeLanguage = useRef(language);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLanguage.current === language) return;
    activeLanguage.current = language;
    nextId.current = 2;
    setMessages([openingMessage(language)]);
  }, [language]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 120);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function ask(value: string) {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    const previousQuestions = messages.filter((message) => message.role === "guest").map((message) => message.text);
    const guestMessage: Message = { id: nextId.current++, role: "guest", text: cleanValue };
    const detected = detectIntent(cleanValue, previousQuestions);
    const agentMessage: Message = { id: nextId.current++, role: "agent", ...localizedReply(detected.intent, language, detected.place) };
    setMessages((current) => [...current, guestMessage, agentMessage]);
    if (!open) setUnread(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const field = new FormData(form).get("question")?.toString() ?? "";
    ask(field);
    form.reset();
  }

  function toggleOpen() {
    if (!open) setUnread(false);
    setOpen(!open);
  }

  const conversationSummary = messages.filter((message) => message.role === "guest").map((message) => message.text).join(" | ");
  const whatsappText = conversationSummary ? `${copy.whatsappWith}${conversationSummary}` : copy.whatsappEmpty;
  const whatsappHref = `https://wa.me/${serviceWhatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

  return <aside className={`smart-concierge ${open ? "open" : ""}`} aria-label={copy.aria}>
    {open ? <section id="smart-concierge-panel" className="smart-concierge__panel" role="dialog" aria-modal="false" aria-labelledby="smart-concierge-title">
      <header className="smart-concierge__header">
        <div className="smart-concierge__identity"><span className="smart-concierge__avatar" aria-hidden="true">VII<i /></span><div><strong id="smart-concierge-title">{copy.title}</strong><small><i /> {copy.status}</small></div></div>
        <button className="smart-concierge__close" type="button" onClick={() => setOpen(false)} aria-label={copy.close}>×</button>
      </header>
      <div className="smart-concierge__intro"><strong>{copy.introTitle}</strong><span>{copy.introBody}</span></div>
      <div className="smart-concierge__messages" ref={messagesRef} aria-live="polite">
        {messages.map((message) => <div className={`smart-concierge__message smart-concierge__message--${message.role}`} key={message.id}><p>{message.text}</p>{message.action ? <Link href={message.action.href} onClick={() => setOpen(false)}>{message.action.label}<span aria-hidden="true">←</span></Link> : null}</div>)}
      </div>
      <div className="smart-concierge__suggestions" aria-label={copy.topics}>{copy.quick.map((label) => <button key={label} type="button" onClick={() => ask(label)}>{label}</button>)}</div>
      <form onSubmit={submit} className="smart-concierge__form"><label className="sr-only" htmlFor="concierge-question">{copy.inputLabel}</label><input ref={inputRef} id="concierge-question" name="question" placeholder={copy.placeholder} autoComplete="off" /><button type="submit" aria-label={copy.send}><SendIcon /></button></form>
      <footer className="smart-concierge__footer"><span>{copy.footer}</span><a href={whatsappHref} target="_blank" rel="noreferrer"><WhatsAppIcon /> {copy.whatsapp}</a></footer>
    </section> : null}
    <button className="smart-concierge__trigger" type="button" onClick={toggleOpen} aria-expanded={open} aria-controls="smart-concierge-panel" aria-label={`${copy.triggerTop}. ${copy.triggerBottom}${unread ? `. ${copy.unread}` : ""}`}><span className="smart-concierge__trigger-icon" aria-hidden="true"><WhatsAppIcon /><i /></span>{unread ? <i className="smart-concierge__unread" aria-hidden="true" /> : null}</button>
  </aside>;
}
