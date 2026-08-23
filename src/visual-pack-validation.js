export const VISUAL_PACK_1 = Object.freeze({
  requiredTextures: Object.freeze([
    'vp1-cottage',
    'tree',
    'rock',
    'vp1-well',
    'vp1-path',
    'vp1-vegetation',
  ]),
  presentation: Object.freeze({
    cottage: { width: 252, height: 210, originX: 0.5, originY: 0.86 },
    tree: { width: 166, height: 230, originX: 0.5, originY: 0.92 },
    rock: { width: 126, height: 96, originX: 0.5, originY: 0.86 },
    well: { width: 112, height: 112, originX: 0.5, originY: 0.78 },
    path: { width: 230, height: 150, originX: 0.5, originY: 0.5 },
    vegetation: { width: 110, height: 78, originX: 0.5, originY: 0.85 },
  }),
});

export function validateVisualPack1(scene, loadErrors = []) {
  const missing = VISUAL_PACK_1.requiredTextures.filter((key) => !scene.textures.exists(key));
  const errors = [...new Set(loadErrors.filter(Boolean))];
  const valid = missing.length === 0 && errors.length === 0;

  const report = Object.freeze({
    pack: 'Visual Pack 1',
    valid,
    missing: Object.freeze(missing),
    loadErrors: Object.freeze(errors),
    releaseId: window.__THE_VILLAGER_RELEASE__?.releaseId ?? 'unknown',
  });

  window.__THE_VILLAGER_VISUAL_VALIDATION__ = report;
  if (!valid) console.error('[Visual Pack 1] validation failed', report);
  else console.info('[Visual Pack 1] validation passed', report);
  return report;
}
