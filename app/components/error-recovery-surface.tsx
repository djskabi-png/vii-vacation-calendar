"use client";

type RecoveryLabels = {
  title: string;
  body: string;
  status: string;
  retry: string;
  home: string;
  preserved: string;
};

const recoveryCss = `
@font-face{font-family:Rubik;src:url('/fonts/rubik/rubik-hebrew-v31.woff2') format('woff2');font-style:normal;font-weight:400 900;font-display:swap}
*{box-sizing:border-box}
.vii-recovery{min-height:100svh;display:grid;place-items:center;padding:clamp(20px,5vw,64px);background:radial-gradient(circle at 50% 14%,rgba(255,202,79,.22),transparent 27%),radial-gradient(circle at 12% 72%,rgba(111,218,210,.25),transparent 32%),#f5faf9;color:#11363d;font-family:Rubik,Heebo,Arial,sans-serif;text-align:center}
.vii-recovery__card{width:min(680px,100%);display:grid;justify-items:center;gap:18px;padding:clamp(26px,6vw,52px);border:1px solid rgba(9,111,119,.16);border-radius:32px;background:rgba(255,255,255,.94);box-shadow:0 26px 80px rgba(15,70,74,.13)}
.vii-recovery__brand{width:108px;height:82px;display:grid;place-items:center;border-radius:24px;background:#fff;box-shadow:0 12px 34px rgba(20,87,91,.1)}
.vii-recovery__brand img{display:block;width:82px;height:auto}
.vii-recovery__status{display:inline-flex;align-items:center;gap:9px;min-height:36px;padding:7px 14px;border-radius:999px;background:#e7f6f4;color:#087482;font-size:.84rem;font-weight:800}
.vii-recovery__status i{width:9px;height:9px;border-radius:50%;background:#0a8992;box-shadow:0 0 0 6px rgba(10,137,146,.1);animation:vii-recovery-pulse 1s ease-in-out infinite}
.vii-recovery__card h1{max-width:520px;margin:2px 0 0;font-size:clamp(1.65rem,5vw,2.55rem);line-height:1.14;letter-spacing:-.035em}
.vii-recovery__card p{max-width:510px;margin:0;color:#587178;font-size:clamp(.94rem,2.6vw,1.05rem);line-height:1.65}
.vii-recovery__progress{width:min(430px,100%);height:8px;overflow:hidden;border-radius:999px;background:#e4efee}
.vii-recovery__progress span{display:block;width:38%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#087c86,#2c9fca);animation:vii-recovery-track 1.25s ease-in-out infinite}
.vii-recovery__actions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:2px}
.vii-recovery__action{min-height:48px;display:inline-flex;align-items:center;justify-content:center;padding:0 22px;border:1px solid #0a7c86;border-radius:15px;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}
.vii-recovery__action--primary{color:#fff;background:linear-gradient(135deg,#087b84,#238fc4);box-shadow:0 10px 24px rgba(16,126,143,.2)}
.vii-recovery__action--secondary{color:#0b6972;background:#fff}
.vii-recovery__preserved{display:flex;align-items:center;gap:7px;color:#6c8186;font-size:.78rem;font-weight:600}
.vii-recovery__preserved i{width:7px;height:7px;border-radius:50%;background:#27a36d}
@keyframes vii-recovery-pulse{50%{transform:scale(.68);opacity:.55}}
@keyframes vii-recovery-track{0%{transform:translateX(175%)}100%{transform:translateX(-275%)}}
@media(max-width:560px){.vii-recovery{place-items:start center;padding:22px 14px}.vii-recovery__card{border-radius:25px;gap:15px}.vii-recovery__actions{width:100%}.vii-recovery__action{flex:1 1 140px}.vii-recovery__brand{width:94px;height:72px}.vii-recovery__brand img{width:72px}}
@media(prefers-reduced-motion:reduce){.vii-recovery__status i,.vii-recovery__progress span{animation:none}.vii-recovery__progress span{width:65%}}
`;

export function ErrorRecoverySurface({ labels, recovering, onRetry }: { labels: RecoveryLabels; recovering: boolean; onRetry: () => void }) {
  return <main className="vii-recovery" id="main-content" aria-busy={recovering ? "true" : undefined}>
    <style dangerouslySetInnerHTML={{ __html: recoveryCss }} />
    <section className="vii-recovery__card" role={recovering ? "status" : "alert"} aria-live={recovering ? "polite" : "assertive"}>
      <span className="vii-recovery__brand">
        {/* A raw image is intentional: this surface must also survive a broken app router. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vii-logo.png" width="82" height="63" alt="V For Vacation" title="V For Vacation" />
      </span>
      <span className="vii-recovery__status"><i aria-hidden="true" />{labels.status}</span>
      <h1>{labels.title}</h1>
      <p>{labels.body}</p>
      {recovering ? <div className="vii-recovery__progress" aria-hidden="true"><span /></div> : <div className="vii-recovery__actions">
        <button className="vii-recovery__action vii-recovery__action--primary" type="button" onClick={onRetry}>{labels.retry}</button>
        {/* Hard navigation is intentional for recovery from a broken app router. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="vii-recovery__action vii-recovery__action--secondary" href="/">{labels.home}</a>
      </div>}
      <small className="vii-recovery__preserved"><i aria-hidden="true" />{labels.preserved}</small>
    </section>
  </main>;
}
