export const EXPERIENCE_STAGE_EVENT = 'vii:experience-stage';
export type ExperienceStage = 'map_ready' | 'gallery_ready' | 'results_ready';
export function signalExperienceStage(metric: ExperienceStage, phase: 'start' | 'ready' | 'error' | 'cancelled', scope = '') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EXPERIENCE_STAGE_EVENT, { detail: { metric, phase, scope } }));
}
