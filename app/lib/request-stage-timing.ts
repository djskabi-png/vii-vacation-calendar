/** Numeric, bounded timings only: never record query values, tokens or user data. */
export function requestStageTiming(clock: () => number = () => performance.now()) {
  const started=clock();
  const stages=new Map<string,number>();
  return {
    async measure<T>(name: string, work: () => Promise<T>): Promise<T> {
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(name)) throw new Error('invalid_timing_stage');
      const before=clock();
      try { return await work(); }
      finally { if (stages.has(name) || stages.size<12) stages.set(name,(stages.get(name)||0)+Math.max(0,clock()-before)); }
    },
    header() {
      return [...stages, ['request',Math.max(0,clock()-started)] as const]
        .map(([name,value])=>`${name};dur=${value.toFixed(1)}`).join(', ');
    },
  };
}
