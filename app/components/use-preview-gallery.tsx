"use client";

import { useEffect, useRef, useState, type SetStateAction } from "react";
import { findReadyPreviewImage, previewImageLoader } from "../lib/preview-image-loader";
import { defaultCardImageSizes, isOptimizableCardMedia, responsiveCardMedia } from "../lib/responsive-media";
import { useSiteLanguage } from "../i18n/locale-provider";

function previewLoadSource(src: string) {
  return responsiveCardMedia(src);
}

async function loadPreviewImage(src: string, urgent = true) {
  const media = previewLoadSource(src);
  const ready = await previewImageLoader.load(media.src, urgent, { srcSet: media.srcSet, sizes: defaultCardImageSizes });
  // A derivative failure must retain the same supplier photo's original fallback.
  return ready || (isOptimizableCardMedia(src) && await previewImageLoader.load(src, urgent));
}

export function usePreviewGallery(images: string[]) {
  const imageKey = images.join("\n");
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const wanted = useRef(0);
  const request = useRef(0);
  const alive = useRef(true);
  const [state, setState] = useState({ key: imageKey, index: 0, pending: false, error: false });
  // A new listing must never briefly display the previous listing's photo/index.
  const imageIndex = state.key === imageKey ? state.index : 0;

  useEffect(() => {
    alive.current = true;
    wanted.current = 0;
    request.current++;
    setState((current) => current.key === imageKey ? current : { key: imageKey, index: 0, pending: false, error: false });
    return () => { alive.current = false; request.current++; };
  }, [imageKey]);

  function setImageIndex(update: SetStateAction<number>) {
    const target = Math.max(0, Math.min(imagesRef.current.length - 1,
      typeof update === "function" ? update(wanted.current) : update));
    if (!imagesRef.current[target]) return;
    const token = ++request.current;
    wanted.current = target;
    if (target === imageIndex) {
      setState({ key: imageKey, index: imageIndex, pending: false, error: false });
      return;
    }
    // Move the visible frame immediately. Waiting for the derivative before
    // updating made every arrow tap feel stalled on a cold image/cache miss.
    // The loader still verifies the target and can fall back if it is broken.
    setState({ key: imageKey, index: target, pending: true, error: false });
    const direction: -1 | 1 = target >= imageIndex ? 1 : -1;
    void findReadyPreviewImage(imagesRef.current, target, direction,
      (src) => loadPreviewImage(src)).then((readyIndex) => {
      if (!alive.current || token !== request.current) return;
      wanted.current = readyIndex ?? imageIndex;
      setState({ key: imageKey, index: readyIndex ?? imageIndex, pending: false, error: readyIndex === null });
    });
  }

  function warmImages() {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
    for (const index of [wanted.current + 1, wanted.current + 2, wanted.current - 1]) {
      const src = imagesRef.current[index];
      if (src) void loadPreviewImage(src, false);
    }
  }

  return { imageIndex, navigationIndex: state.key === imageKey ? wanted.current : 0, setImageIndex, warmImages, pending: state.key === imageKey && state.pending, error: state.key === imageKey && state.error };
}

const statusCopy = {
  he: { loading: "טוענים תמונה", shortError: "לא נטען", error: "התמונה לא נטענה. אפשר לנסות שוב באמצעות החץ." },
  en: { loading: "Loading photo", shortError: "Not loaded", error: "The photo did not load. Use the arrow to try again." },
  ru: { loading: "Загружаем фото", shortError: "Ошибка", error: "Не удалось загрузить фото. Нажмите стрелку, чтобы повторить." },
  fr: { loading: "Chargement de la photo", shortError: "Échec", error: "La photo n’a pas pu être chargée. Réessayez avec la flèche." },
};

export function PreviewGalleryStatus({ pending, error }: { pending: boolean; error: boolean }) {
  const { language } = useSiteLanguage();
  const copy = statusCopy[language];
  return <>
    {pending ? <span className="preview-gallery-loading" role="status" aria-label={copy.loading}><span aria-hidden="true" /></span> : null}
    {error ? <span className="preview-gallery-error" role="status" title={copy.error}><span aria-hidden="true">{copy.shortError}</span><span className="sr-only">{copy.error}</span></span> : null}
  </>;
}
