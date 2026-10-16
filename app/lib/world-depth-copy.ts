import translations from "../data/world-depth-translations.json" with { type: "json" };

export function worldDepthCopy(label: string, language: string | null, world: "activities" | "trails") {
  const locale = language === "en" || language === "ru" || language === "fr" ? language : "he";
  const entry = (translations as Record<string, { en: string; ru: string; fr: string }>)[label];
  const title = locale === "he" ? label : entry?.[locale] || label;
  const support = world === "activities" ? {
    he: "מידע על הפעילות, תמונות ופרטי הזמנה, כדי לבחור חוויה שמתאימה לכם.",
    en: "Explore activities, photos and booking details to find the right experience for you.",
    ru: "Сравните развлечения, фотографии и условия бронирования, чтобы выбрать подходящее впечатление.",
    fr: "Comparez les activités, les photos et les modalités de réservation pour choisir votre expérience.",
  } : {
    he: "בוחרים מסלול לפי דרגת קושי, משך ועונה, ובודקים הנחיות בטיחות ומקורות רשמיים לפני היציאה.",
    en: "Choose a trail by difficulty, duration and season. Check safety guidance and official updates before setting out.",
    ru: "Выберите маршрут по сложности, длительности и сезону. Перед выходом проверьте рекомендации по безопасности и официальные обновления.",
    fr: "Choisissez un itinéraire selon la difficulté, la durée et la saison. Consultez les consignes de sécurité et les informations officielles avant de partir.",
  };
  return { title, description: support[locale] };
}
