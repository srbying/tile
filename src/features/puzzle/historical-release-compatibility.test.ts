import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { dailyPuzzleFromId } from './daily-puzzle-generator';

// Full serialized releases recorded from main at 375dc65 before delivery changes.
// A content correction needs a new version and a retained historical replay path;
// do not regenerate these fingerprints to accept changes behind existing IDs.
it.each([
  [1, 67, 'f7cdf8285c6648729138651772e2313273fd035ec05185c08fa7c5e3af7168d8'],
  [2, 45, '2c4f2271634f5fe18f89d109c46649dc11df8877cd70b8374fa310069f4f8763'],
  [3, 45, '22f020da196b8453025b11c17063a92edc62311b751458f6e484792db51e023d'],
] as const)('preserves every v%s release payload', (version, variations, fingerprint) => {
  const releases = [];
  for (let variation = 0; variation < variations; variation++) {
    for (let scramble = 0; scramble < 4; scramble++) {
      const release = dailyPuzzleFromId(`daily-v${version}-2026-10-19-${variation}-${scramble}`);
      expect(release).not.toBeNull();
      releases.push(release);
    }
  }
  expect(createHash('sha256').update(JSON.stringify(releases)).digest('hex')).toBe(fingerprint);
}, 30000);
