export default function Loading() {
  return <main id="main-content" className="global-route-loading" aria-busy="true" aria-label="טוענים את העמוד">
    <div className="global-route-loading__mark" aria-hidden="true"><span /><span /><span /></div>
    <div className="global-route-loading__hero" aria-hidden="true"><i /><i /></div>
    <div className="global-route-loading__cards" aria-hidden="true"><i /><i /><i /></div>
  </main>;
}
