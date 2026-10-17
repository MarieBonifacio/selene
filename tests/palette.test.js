/* La couleur d'accent (A67) : chaque palette, en clair comme en sombre, doit se voir, se distinguer des autres et rester
   lisible. Les valeurs sont lues dans src/shell.html ; les seuils viennent de WCAG (contraste) et de la distance
   perceptuelle ΔE2000 (sous 2, l'œil ne voit pas la différence ; 10, deux couleurs nettement distinctes).
   Ce qu'on vérifie : le texte posé sur l'accent (bouton principal, surbrillance de recherche) ; l'accent loin du gris des
   textes secondaires (sinon un repère se lit comme un texte atténué) ; deux palettes jamais confondues. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('src/shell.html', 'utf8');
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = h => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const lab = h => {
  const [r, g, b] = hex(h).map(lin), f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const X = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047), Y = f(r * 0.2126 + g * 0.7152 + b * 0.0722), Z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
};
// CIEDE2000 (Sharma, Wu et Dalal, 2005).
function deltaE(c1, c2) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2), rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => { const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
  let dhp = h2p - h1p; if (C1p * C2p === 0) dhp = 0; else if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
  const dLp = L2 - L1, dCp = C2p - C1p, dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p; if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360; hbp /= 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)), RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + 0.015 * (Lbp - 50) ** 2 / Math.sqrt(20 + (Lbp - 50) ** 2), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T, RT = -Math.sin(2 * dTh * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}
// Le fond et le gris des textes secondaires : la première valeur est celle du clair, la suivante celle du sombre.
const tokens = name => [...css.matchAll(new RegExp(`--${name}:(#[0-9a-f]{6})`, 'g'))].map(m => m[1]);
const [bgLight, bgDark] = tokens('bg'), [mutedLight, mutedDark] = tokens('muted');
// Chaque palette se déclare par sa propre règle (les pastilles des Réglages l'utilisent aussi : A67).
const palettes = Object.fromEntries([...css.matchAll(/\[data-palette="(\w+)"\]\{--acc-l:(#[0-9a-f]{6});--acc-d:(#[0-9a-f]{6})\}/g)].map(m => [m[1], { clair: m[2], sombre: m[3] }]));
const modes = [['clair', bgLight, mutedLight], ['sombre', bgDark, mutedDark]];

test('chaque palette se déclare par sa propre règle, Nigredo comprise (TU-PAL-01)', () => {
  assert.deepEqual(Object.keys(palettes).sort(), ['albedo', 'citrinitas', 'nigredo', 'rubedo']);
  assert.ok(bgLight && bgDark && mutedLight && mutedDark, 'fond et gris lus, en clair et en sombre');
});

test('le texte posé sur l’accent atteint 4,5:1, dans chaque palette et chaque mode (WCAG 1.4.3 ; TU-PAL-02)', () => {
  for (const [p, v] of Object.entries(palettes)) for (const [mode, bg] of modes) {
    const r = contrast(v[mode], bg);
    assert.ok(r >= 4.5, `${p}, ${mode} : ${v[mode]} sur ${bg}, ${r.toFixed(2)}:1`);
  }
});

test('l’accent se distingue du gris des textes secondaires (ΔE2000 ≥ 10 ; TU-PAL-03)', () => {
  for (const [p, v] of Object.entries(palettes)) for (const [mode, , muted] of modes) {
    const d = deltaE(v[mode], muted);
    assert.ok(d >= 10, `${p}, ${mode} : ${v[mode]} contre ${muted}, ΔE ${d.toFixed(1)}`);
  }
});

test('deux palettes ne se confondent jamais (ΔE2000 ≥ 15 ; TU-PAL-04)', () => {
  const ids = Object.keys(palettes);
  for (const [mode] of modes) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const d = deltaE(palettes[ids[i]][mode], palettes[ids[j]][mode]);
    assert.ok(d >= 15, `${mode} : ${ids[i]} et ${ids[j]}, ΔE ${d.toFixed(1)}`);
  }
});

test('l’outil de mesure : deux couleurs identiques à 0, noir et blanc vers 100, noir sur blanc à 21:1 (TU-PAL-05)', () => {
  assert.equal(deltaE('#5a6a5c', '#5a6a5c'), 0);
  assert.ok(deltaE('#000000', '#ffffff') > 99 && deltaE('#000000', '#ffffff') < 101, 'noir et blanc : environ 100');
  assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 1e-9, 'noir sur blanc : 21:1');
});
