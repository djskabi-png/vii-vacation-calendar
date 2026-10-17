type Language = "he" | "en" | "ru" | "fr";
const messages: Record<string, Record<Language, string>> = {
  "לא הצלחנו לקרוא את הקבצים שנבחרו": { he: "לא הצלחנו לפתוח את הקבצים. בחרו אותם שוב.", en: "We could not open the files. Please select them again.", ru: "Не удалось открыть файлы. Выберите их ещё раз.", fr: "Impossible d’ouvrir les fichiers. Veuillez les sélectionner à nouveau." },
  "יש להשלים את כל שדות החובה ולאשר את תנאי השליחה": { he: "השלימו את שדות החובה ואשרו את תנאי השליחה.", en: "Complete the required fields and accept the submission terms.", ru: "Заполните обязательные поля и подтвердите условия отправки.", fr: "Remplissez les champs obligatoires et acceptez les conditions d’envoi." },
  "תאריך הביקור לא יכול להיות בעתיד": { he: "בחרו תאריך ביקור שכבר עבר.", en: "Choose a visit date that is not in the future.", ru: "Дата посещения не может быть в будущем.", fr: "La date de visite ne peut pas être dans le futur." },
  "אפשר לצרף עד 8 תמונות": { he: "אפשר לצרף עד 8 תמונות.", en: "You can attach up to 8 photos.", ru: "Можно прикрепить до 8 фотографий.", fr: "Vous pouvez joindre jusqu’à 8 photos." },
  "כל תמונה חייבת להיות מסוג נתמך ובגודל של עד 8 מגה": { he: "בחרו תמונות בפורמט נתמך, עד 8 מגה לכל תמונה.", en: "Choose photos in a supported format, up to 8 MB each.", ru: "Выберите фотографии в поддерживаемом формате, до 8 МБ каждая.", fr: "Choisissez des photos dans un format accepté, de 8 Mo maximum chacune." },
  "האסמכתה חייבת להיות תמונה או מסמך בגודל של עד 10 מגה": { he: "צרפו אסמכתה כתמונה או כמסמך, עד 10 מגה.", en: "Attach your proof of visit as an image or document, up to 10 MB.", ru: "Прикрепите подтверждение посещения в виде изображения или документа размером до 10 МБ.", fr: "Joignez un justificatif de visite sous forme d’image ou de document, de 10 Mo maximum." },
  "הגודל הכולל של הקבצים גדול מדי": { he: "הקבצים גדולים מדי. הסירו חלק מהם או בחרו קבצים קטנים יותר.", en: "The files are too large in total. Remove some or choose smaller files.", ru: "Общий размер файлов слишком большой. Удалите часть файлов или выберите файлы меньшего размера.", fr: "Le volume total des fichiers est trop important. Retirez-en quelques-uns ou choisissez des fichiers plus petits." },
};

// Only known visitor validation messages may cross the response-to-UI boundary.
export function publicReviewError(message: unknown, language: Language, fallback: string) {
  return typeof message === "string" && Object.hasOwn(messages, message) ? messages[message][language] : fallback;
}
