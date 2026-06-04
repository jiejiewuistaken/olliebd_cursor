// Compatibility layer for older preview modules that imported postprocessing
// effects from Drei. Current code imports Bloom directly from
// @react-three/postprocessing, but this keeps stale dev entrypoints from
// crashing while Vite/browser caches settle.
// @ts-ignore - use Drei's runtime entry directly to avoid alias recursion.
export * from '../node_modules/@react-three/drei/index.js';
export { Bloom, EffectComposer } from '@react-three/postprocessing';
