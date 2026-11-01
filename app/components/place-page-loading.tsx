import "./place-page-loading.css";

export function PlacePageLoading() {
  return <main className="place-page-loading" aria-busy="true" aria-live="polite">
    <span className="sr-only">טוענים את פרטי המקום</span>
    <div className="shell place-page-loading__title">
      <i />
      <b />
      <span />
    </div>
    <div className="shell place-page-loading__gallery" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
    <div className="shell place-page-loading__body" aria-hidden="true">
      <section><b /><span /><span /><span /></section>
      <aside><b /><span /><span /></aside>
    </div>
  </main>;
}
