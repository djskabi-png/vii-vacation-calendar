import type { Metadata } from "next";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { HomeLiveDeals } from "../components/home-live-deals";
import { PageShell } from "../components/page-shell";
import { StructuredData } from "../components/structured-data";
import { localizedPath } from "../i18n/locale-routing";
import { serverPublicCopy } from "../i18n/server-public-copy";
import { breadcrumbSchema, faqSchema } from "../lib/seo";
import "../holidays/holiday-world.css";
import "./last-minute.css";

const copy = {
  he: {
    title: "נופש ברגע האחרון",
    metaTitle: "נופש ברגע האחרון | מקומות פנויים ומחירים לתאריך הקרוב",
    description: "מקומות נופש פנויים לתאריך הקרוב עם מחירים מעודכנים, תמונות ודרך ישירה לבדוק את המקום ולהמשיך להזמנה.",
    eyebrow: "החופשה הקרובה מתחילה עכשיו",
    intro: "בודקים מקומות פנויים ללילה הקרוב, משווים מחיר ותנאים וממשיכים למקום שמתאים לכם.",
    proof: ["זמינות לתאריך הקרוב", "מחיר לכל השהייה", "בדיקה נוספת לפני הזמנה"],
    resultsTitle: "מקומות פנויים ברגע האחרון",
    allResults: "לכל התוצאות לתאריך הקרוב",
    storyEyebrow: "ספונטניים, אבל בוחרים נכון",
    storyTitle: "איך סוגרים חופשה קרובה בלי לנחש?",
    storyBody: "ההצעות בעמוד מבוססות על בדיקת זמינות לתאריך הקרוב. המחיר מוצג לכל השהייה ולהרכב שנבדק. לפני ההזמנה מבצעים בדיקה נוספת מול המקום כדי לוודא שהחדר, המחיר והתנאים עדיין מתאימים.",
    steps: [["בוחרים מקום", "משווים תמונות, מיקום, מתקנים ומחיר."], ["פותחים את הפרטים", "רואים את החדר והתנאים של ההצעה."], ["מאמתים ומזמינים", "הזמינות והמחיר נבדקים שוב לפני הסגירה."]],
    faqEyebrow: "לפני שיוצאים",
    faqTitle: "שאלות על נופש ברגע האחרון",
    faqs: [["לאילו תאריכים מוצגות ההצעות?", "העמוד מציג מקומות שנבדקו ללילה הקרוב. התאריכים המדויקים מופיעים בכל כרטיס ובעמוד המקום."], ["המחיר שמופיע הוא ללילה או לכל השהייה?", "המחיר בכרטיס מוצג לכל השהייה ולהרכב שנבדק, אלא אם מצוין אחרת במפורש."], ["האם המקום נשאר פנוי עד שאזמין?", "זמינות ברגע האחרון יכולה להשתנות במהירות, ולכן מתבצעת בדיקה נוספת בעמוד המקום ולפני ההזמנה."]],
    imageAlt: "מרפסת נופש מול הים עם תיק מוכן ליציאה קרובה"
  },
  en: {
    title: "Last-minute stays", metaTitle: "Last-minute stays | Availability and prices for the next night", description: "Available stays for the next night with current prices, photos and a direct path to verify and book.", eyebrow: "Your next break can start now", intro: "See stays available for the next night, compare prices and details, and continue with the place that suits you.", proof: ["Near-term availability", "Full-stay price", "Rechecked before booking"], resultsTitle: "Available last-minute stays", allResults: "See all results for these dates", storyEyebrow: "Spontaneous, with the facts in hand", storyTitle: "How do you book a near-term stay with confidence?", storyBody: "Offers on this page are based on an availability check for the next night. The displayed price covers the checked stay and party. Availability, room, price and terms are checked again before booking.", steps: [["Choose a place", "Compare photos, location, features and price."], ["Open the details", "Review the room and offer terms."], ["Verify and book", "Availability and price are checked again before confirmation."]], faqEyebrow: "Before you go", faqTitle: "Last-minute stay questions", faqs: [["Which dates are shown?", "The page shows places checked for the next night. Exact dates appear on every card and place page."], ["Is the price per night or for the full stay?", "The card price is for the checked stay and party unless clearly stated otherwise."], ["Will the place remain available until I book?", "Last-minute availability can change quickly, so it is checked again on the place page and before booking."]], imageAlt: "A seaside vacation terrace with a bag ready for a spontaneous getaway"
  },
  ru: {
    title: "Отдых в последний момент", metaTitle: "Отдых в последний момент | Наличие и цены на ближайшую ночь", description: "Свободные варианты на ближайшую ночь с актуальными ценами, фотографиями и прямым переходом к проверке и бронированию.", eyebrow: "Ближайший отдых может начаться сейчас", intro: "Смотрите варианты на ближайшую ночь, сравнивайте цены и условия и переходите к подходящему месту.", proof: ["Наличие на ближайшую дату", "Цена за весь период", "Повторная проверка перед бронью"], resultsTitle: "Свободные варианты в последний момент", allResults: "Все результаты на эти даты", storyEyebrow: "Спонтанно, но осознанно", storyTitle: "Как уверенно выбрать отдых на ближайшую дату?", storyBody: "Предложения основаны на проверке наличия на ближайшую ночь. Цена указана за проверенный период и состав гостей. Перед бронированием номер, цена и условия проверяются снова.", steps: [["Выберите место", "Сравните фотографии, расположение, удобства и цену."], ["Откройте подробности", "Проверьте номер и условия предложения."], ["Проверьте и бронируйте", "Наличие и цена подтверждаются еще раз."]], faqEyebrow: "Перед поездкой", faqTitle: "Вопросы об отдыхе в последний момент", faqs: [["На какие даты показаны предложения?", "Показаны места, проверенные на ближайшую ночь. Точные даты указаны в карточке и на странице места."], ["Цена указана за ночь или за весь период?", "Цена в карточке относится ко всему проверенному периоду и составу гостей, если не указано иное."], ["Останется ли место свободным до бронирования?", "Наличие может быстро меняться, поэтому оно проверяется повторно на странице места и перед бронированием."]], imageAlt: "Терраса у моря и дорожная сумка для спонтанной поездки"
  },
  fr: {
    title: "Séjours de dernière minute", metaTitle: "Séjours de dernière minute | Disponibilités et prix pour la prochaine nuit", description: "Des séjours disponibles pour la prochaine nuit, avec prix actuels, photos et accès direct à la vérification et à la réservation.", eyebrow: "Votre prochaine escapade peut commencer maintenant", intro: "Découvrez les séjours disponibles pour la prochaine nuit, comparez les prix et les détails, puis choisissez le lieu qui vous convient.", proof: ["Disponibilité à court terme", "Prix du séjour complet", "Nouvelle vérification avant réservation"], resultsTitle: "Séjours disponibles à la dernière minute", allResults: "Voir tous les résultats pour ces dates", storyEyebrow: "Spontané, avec les bonnes informations", storyTitle: "Comment réserver sereinement un séjour proche?", storyBody: "Les offres reposent sur une vérification des disponibilités pour la prochaine nuit. Le prix affiché couvre le séjour et le groupe vérifiés. La chambre, le prix et les conditions sont contrôlés de nouveau avant la réservation.", steps: [["Choisissez un lieu", "Comparez les photos, l’emplacement, les équipements et le prix."], ["Ouvrez les détails", "Consultez la chambre et les conditions de l’offre."], ["Vérifiez et réservez", "La disponibilité et le prix sont confirmés à nouveau."]], faqEyebrow: "Avant de partir", faqTitle: "Questions sur les séjours de dernière minute", faqs: [["Quelles dates sont affichées?", "La page présente les lieux vérifiés pour la prochaine nuit. Les dates exactes figurent sur chaque carte et page de lieu."], ["Le prix est-il par nuit ou pour tout le séjour?", "Le prix de la carte couvre le séjour et le groupe vérifiés, sauf indication contraire."], ["Le lieu restera-t-il disponible jusqu’à ma réservation?", "Les disponibilités peuvent changer rapidement; elles sont donc vérifiées à nouveau sur la page du lieu et avant la réservation."]], imageAlt: "Terrasse de vacances face à la mer avec un sac prêt pour une escapade spontanée"
  }
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const { language } = await serverPublicCopy();
  const text = copy[language];
  const canonical = localizedPath("/last-minute", language);
  return { title: text.metaTitle, description: text.description, alternates: { canonical }, openGraph: { type: "website", url: canonical, title: text.metaTitle, description: text.description, images: [{ url: "/images/last-minute/last-minute-escape.webp", alt: text.imageAlt }] } };
}

export default async function LastMinutePage() {
  const { language, translate } = await serverPublicCopy();
  const text = copy[language];
  const breadcrumbs = [{ name: translate("ראשי"), path: "/" }, { name: text.title, path: "/last-minute" }];
  const faqs = text.faqs.map(([question, answer]) => ({ question, answer }));
  return <PageShell variant="vacation" footerTopic="vacation-villas">
    <main id="main-content" className="holiday-world last-minute-world">
      <StructuredData data={breadcrumbSchema(breadcrumbs)} />
      <StructuredData data={faqSchema(faqs)} />
      <section className="holiday-hero last-minute-hero"><div className="shell holiday-hero__frame">
        <div className="holiday-hero__content"><BreadcrumbTrail items={[{ name: translate("ראשי"), path: "/" }, { name: text.title }]} /><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{text.intro}</p><div className="holiday-hero__proof" aria-label={text.title}>{text.proof.map((item) => <span key={item}>{item}</span>)}</div></div>
        <div className="holiday-hero__media"><picture><source media="(max-width: 760px)" srcSet="/images/last-minute/last-minute-escape-mobile.webp" /><img src="/images/last-minute/last-minute-escape.webp" alt={text.imageAlt} width="1600" height="900" loading="eager" fetchPriority="high" decoding="async" /></picture></div>
      </div></section>
      <HomeLiveDeals fixedPeriod="tomorrow" sectionTitle={text.resultsTitle} allLinkLabel={text.allResults} />
      <section className="section shell holiday-story last-minute-story" aria-labelledby="last-minute-story-title"><div><span className="eyebrow">{text.storyEyebrow}</span><h2 id="last-minute-story-title">{text.storyTitle}</h2><p>{text.storyBody}</p></div><ol>{text.steps.map(([title, body], index) => <li key={title}><b>0{index + 1}</b><span><strong>{title}</strong>{body}</span></li>)}</ol></section>
      <section className="section section-tint holiday-faq last-minute-faq"><div className="shell"><div className="holiday-section-head"><div><span className="eyebrow">{text.faqEyebrow}</span><h2>{text.faqTitle}</h2></div></div><div className="holiday-faq__list">{faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
  </PageShell>;
}
