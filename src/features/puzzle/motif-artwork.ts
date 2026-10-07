import type { Motif } from './puzzle.types.js';

export interface MotifArtwork {
  readonly label: string;
  readonly paths: readonly string[];
  readonly lineCap?: 'square' | 'round';
  readonly lineJoin?: 'miter' | 'round';
}

export const motifArtwork: Record<Motif, MotifArtwork> = {
  "meander": { label: "Angular maze", paths: ["M20 20H80V80H40V45H60V60"] },
  "chevron": { label: "Double chevron", paths: ["M22 24L50 48L78 24", "M22 50L50 74L78 50"] },
  "diamond": { label: "Nested diamonds", paths: ["M50 16L84 50L50 84L16 50Z", "M50 37L63 50L50 63L37 50Z"] },
  "rosette": { label: "Petal rosette", paths: ["M50 50C24 49 22 23 42 20C52 19 56 31 50 50", "M50 50C51 24 77 22 80 42C81 52 69 56 50 50", "M50 50C76 51 78 77 58 80C48 81 44 69 50 50", "M50 50C49 76 23 78 20 58C19 48 31 44 50 50", "M50 43A7 7 0 1 0 50 57A7 7 0 1 0 50 43"] },
  "sunburst": { label: "Sunburst", paths: ["M50 12L56 38L78 22L64 44L89 50L64 56L78 78L56 64L50 89L44 64L22 78L36 56L11 50L36 44L22 22L44 38Z", "M50 39L61 50L50 61L39 50Z"] },
  "scallop": { label: "Scalloped arches", paths: ["M17 76V53C17 35 31 21 50 21C69 21 83 35 83 53V76", "M29 76V56C29 44 38 35 50 35C62 35 71 44 71 56V76", "M41 76V59C41 54 45 50 50 50C55 50 59 54 59 59V76", "M17 76H83"] },
  "wave": { label: "Tidal waves", paths: ["M15 30C25 18 35 18 45 30C55 42 65 42 75 30C79 25 82 23 86 23", "M14 50C24 38 34 38 44 50C54 62 64 62 74 50C79 44 82 43 86 43", "M14 70C24 58 34 58 44 70C54 82 64 82 74 70C79 64 82 63 86 63"] },
  "lattice": { label: "Woven lattice", paths: ["M20 20L80 80M50 16L84 50L50 84L16 50Z", "M20 80L80 20M50 16L16 50L50 84L84 50Z", "M50 16V84M16 50H84"] },
  "pinwheel": { label: "Pinwheel", paths: ["M50 50C34 45 29 30 38 19C48 7 61 18 57 36C73 29 85 37 81 50C77 64 61 61 50 50", "M50 50C55 66 70 71 81 62C93 52 82 39 64 43C71 27 63 15 50 19C36 23 39 39 50 50", "M50 50L50 19M50 50L81 50M50 50L50 81M50 50L19 50"] },
  "compass": { label: "Eight-point compass", paths: ["M50 12L59 41L86 24L68 50L88 68L59 59L50 88L41 59L14 76L32 50L12 32L41 41Z", "M50 33L67 50L50 67L33 50Z"] },
  "lantern": { label: "Lantern arches", paths: ["M25 78V48C25 34 36 22 50 22C64 22 75 34 75 48V78Z", "M36 78V49C36 41 42 34 50 34C58 34 64 41 64 49V78", "M50 22V13M40 78H60M43 88H57"] },
  "interlock": { label: "Linked ovals", paths: ["M18 50C18 28 36 20 50 50C64 80 82 72 82 50C82 28 64 20 50 50C36 80 18 72 18 50Z", "M50 17V83"] },
  "leaf": { label: "Olive sprig", paths: ["M24 80C38 62 54 43 78 20", "M35 65C21 62 17 51 20 41C33 42 41 50 35 65Z", "M48 51C44 37 51 28 62 25C66 38 61 47 48 51Z", "M59 38C58 26 66 19 78 18C79 30 72 37 59 38Z", "M27 75L19 74M40 59L32 58"] },
  "shell": { label: "Shell fan", paths: ["M17 77C20 48 32 27 50 17C68 27 80 48 83 77Z", "M50 17L50 77M50 17L28 77M50 17L72 77M50 17L17 77M50 17L83 77", "M23 62H77"] },
  "braid": { label: "Braided loop", paths: ["M20 33C20 20 37 18 44 29L56 48C63 59 80 57 80 44C80 31 63 29 56 40L44 59C37 70 20 68 20 55C20 42 37 40 44 51", "M20 45C20 32 37 30 44 41L56 60C63 71 80 69 80 56"] },
  "hex-blossom": { label: "Hexagonal bloom", paths: ["M50 14L78 30V62L50 78L22 62V30Z", "M50 28L65 37V55L50 64L35 55V37Z", "M50 14V28M78 30L65 37M78 62L65 55M50 78V64M22 62L35 55M22 30L35 37"] },
  "fan": { label: "Layered fan", paths: ["M18 78C18 45 31 23 50 16C69 23 82 45 82 78", "M27 78C27 52 36 35 50 28C64 35 73 52 73 78", "M37 78C37 59 42 47 50 42C58 47 63 59 63 78", "M18 78H82", "M50 16V78"] },
  "prism": { label: "Prismatic ridge", paths: ["M14 72L34 30L50 58L66 22L86 72Z", "M25 72L34 49L43 72M57 72L66 41L77 72", "M14 81H86"] },
  "crescent": { label: "Crescent arcs", paths: ["M67 17C42 18 24 34 24 51C24 68 42 82 67 83C52 73 46 63 46 50C46 37 52 27 67 17Z", "M75 29C64 36 59 43 59 51C59 59 64 66 75 72"] },
  "lotus": { label: "Lotus", paths: ["M50 76C28 72 18 55 21 37C39 41 49 54 50 76Z", "M50 76C72 72 82 55 79 37C61 41 51 54 50 76Z", "M50 76C34 57 37 31 50 17C63 31 66 57 50 76Z", "M28 80H72M36 87H64"] },
  "mosaic-cross": { label: "Mosaic cross", paths: ["M42 14H58V39H83V55H58V82H42V55H17V39H42Z", "M50 28L61 47L50 66L39 47Z", "M17 14L32 29M83 14L68 29M17 82L32 67M83 82L68 67"] },
  "squiggle-sway": { label: "Sway", paths: ["M22 16C42 21 11 36 31 50C51 64 20 79 40 84", "M50 16C70 21 39 36 59 50C79 64 48 79 68 84", "M78 16C98 21 67 36 87 50C100 60 79 79 88 84"], lineCap: 'round', lineJoin: 'round' },
  "squiggle-loops": { label: "Looping ribbons", paths: ["M16 43C16 21 39 21 39 43C39 65 62 65 62 43C62 21 85 21 85 43", "M16 58C16 80 39 80 39 58C39 36 62 36 62 58C62 80 85 80 85 58"], lineCap: 'round', lineJoin: 'round' },
  "squiggle-coil": { label: "Winding coil", paths: ["M17 55C10 29 34 12 58 21C83 30 88 59 69 75C50 91 25 78 30 56C34 39 52 34 62 45C72 57 63 68 52 65C44 63 43 56 49 52"], lineCap: 'round', lineJoin: 'round' },
  "waveform-sine": { label: "Sine dip", paths: ["M12 50C27 50 26 78 42 78C58 78 57 22 72 22C86 22 84 50 94 50"], lineCap: 'round', lineJoin: 'round' },
  "waveform-crest": { label: "Stepped crest", paths: ["M12 75C23 75 24 57 34 50C42 44 51 50 60 46C69 42 70 19 82 18C92 17 91 46 96 52"], lineCap: 'round', lineJoin: 'round' },
  "waveform-swell": { label: "Soft swell", paths: ["M12 80C27 74 30 30 45 22C56 16 68 20 73 35C81 59 87 70 96 70"], lineCap: 'round', lineJoin: 'round' },
  "waveform-flick": { label: "Trough & flick", paths: ["M12 24C23 25 27 72 42 77C58 83 58 47 73 46C83 45 85 60 94 61"], lineCap: 'round', lineJoin: 'round' },
  "waveform-double": { label: "Double wave", paths: ["M12 58C22 58 24 34 35 34C46 34 47 66 58 66C69 66 70 28 81 28C89 28 91 50 96 52"], lineCap: 'round', lineJoin: 'round' },
  "waveform-shelf": { label: "Shelf fall", paths: ["M12 50H33C42 50 41 24 54 24H69C82 24 80 72 94 78"], lineCap: 'round', lineJoin: 'round' },
};
