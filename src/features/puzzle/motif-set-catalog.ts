import type { Motif } from './puzzle.types.js';

export interface MotifSet {
  readonly id: number;
  readonly name: string;
  readonly motifs: readonly Motif[];
}

export const motifSets: readonly MotifSet[] = [
  { id: 1, name: 'Courtyard', motifs: ['meander', 'chevron', 'diamond'] },
  { id: 2, name: 'Bloom', motifs: ['rosette', 'sunburst', 'scallop'] },
  { id: 3, name: 'Motion', motifs: ['wave', 'lattice', 'pinwheel'] },
  { id: 4, name: 'Navigation', motifs: ['compass', 'lantern', 'interlock'] },
  { id: 5, name: 'Garden', motifs: ['leaf', 'shell', 'braid'] },
  { id: 6, name: 'Architecture', motifs: ['hex-blossom', 'fan', 'prism'] },
  { id: 7, name: 'Celestial', motifs: ['crescent', 'lotus', 'mosaic-cross'] },
  { id: 8, name: 'Squiggles', motifs: ['squiggle-sway', 'squiggle-loops', 'squiggle-coil'] },
  {
    id: 9,
    name: 'Waveforms',
    motifs: ['waveform-sine', 'waveform-crest', 'waveform-swell', 'waveform-flick', 'waveform-double', 'waveform-shelf'],
  },
];

export function getMotifSet(id: number): MotifSet {
  const set = motifSets.find((candidate) => candidate.id === id);
  if (!set) throw new RangeError(`Unknown motif set: ${id}`);
  return set;
}
