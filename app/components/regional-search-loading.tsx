export function RegionalSearchLoading({ title }: { title: string }) {
  return <main id="main-content" className="results-page regional-search-loading" style={{ minHeight: "calc(100svh - 76px)" }} aria-busy="true">
    <section className="results-heading shell"><h1>{title}</h1></section>
    <section className="shell" style={{ display: "flex", gap: 16, overflow: "hidden" }} aria-hidden="true">
      {[0, 1, 2].map(index => <div key={index} style={{ flex: "0 0 min(84vw, 350px)", minWidth: 0, height: 260, borderRadius: 18, background: "#eaf2f1" }} />)}
    </section>
  </main>;
}
