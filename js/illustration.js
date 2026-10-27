/*
 * Illustration slot. Each slide gets a square picture.
 *  - If the slide has `art: "illustrations/foo.svg"` that image is used.
 *  - Otherwise a built-in placeholder character is drawn, which reacts to answers
 *    (mood, speech bubble, floating badges, "mystery" silhouette).
 */
window.Illustration = (function () {
  const INK = '#1A1008';
  const HOODIE = '#BDE6E4';
  const HAIR = '#21160F';

  // Badge positions around the head (viewBox 300 x 300)
  const SPOTS = [[38, 104], [64, 58], [236, 58], [262, 104], [44, 160], [256, 160]];

  function face(mood) {
    if (mood === 'neutral') {
      return `<circle cx="134" cy="138" r="4.5" fill="${INK}"/><circle cx="166" cy="138" r="4.5" fill="${INK}"/>
              <path d="M138 165 h24" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    }
    return `<path d="M125 140 q9 -10 18 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>
            <path d="M157 140 q9 -10 18 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>
            <path d="M136 158 q14 14 28 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  }

  function badges(def, answers) {
    if (!def.badges) return '';
    const sel = answers[def.id] || [];
    return def.badges
      .map((b, i) => {
        const [x, y] = SPOTS[i % SPOTS.length];
        const on = sel.includes(b.v);
        return `<g transform="translate(${x} ${y})"><g class="badge${on ? ' on' : ''}">
          <circle r="17" fill="${on ? '#D8453B' : '#FBEDE9'}" stroke="${on ? INK : '#7A6361'}" stroke-width="3"/>
          <text y="6" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="18" fill="${on ? '#fff' : '#D8806F'}">${b.g}</text>
        </g></g>`;
      })
      .join('');
  }

  function bubble(text) {
    if (!text) return '';
    const w = Math.max(90, text.length * 13 + 30);
    return `<g transform="translate(${290 - w} 16)"><g class="bubble">
      <path d="M${w - 40} 44 L${w - 14} 74 L${w - 14} 44 Z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <rect width="${w}" height="50" rx="14" fill="#fff" stroke="${INK}" stroke-width="4"/>
      <path d="M${w - 38} 47 H${w - 16}" stroke="#fff" stroke-width="7"/>
      <text x="${w / 2}" y="31" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="19" fill="${INK}">${text}</text>
    </g></g>`;
  }

  function character(def, answers, mood, skin) {
    const mystery = def.mystery && !answers[def.id];
    const braid = [0, 1, 2, 3, 4].map((i) => `<ellipse cx="${116 + i * 1.5}" cy="${168 + i * 13}" rx="11" ry="9" fill="${HAIR}" stroke="${INK}" stroke-width="3" transform="rotate(${i % 2 ? 14 : -14} ${116 + i * 1.5} ${168 + i * 13})"/>`).join('');
    return `<g class="char${mystery ? ' mystery' : ''}" ${mystery ? 'opacity=".55" style="filter:grayscale(1)"' : ''}>
      <path d="M26 300 C34 232 78 206 150 206 C222 206 266 232 274 300 Z" fill="${mystery ? '#9A9A8C' : HOODIE}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M112 212 C128 240 172 240 188 212" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <path d="M150 238 V300" stroke="${INK}" stroke-width="5"/>
      <rect x="132" y="186" width="36" height="30" rx="10" fill="${skin}" stroke="${INK}" stroke-width="5"/>
      ${braid}
      <ellipse cx="150" cy="138" rx="52" ry="58" fill="${skin}" stroke="${INK}" stroke-width="5"/>
      <path d="M96 132 C84 62 128 50 152 50 C186 50 218 72 204 132 C196 108 176 96 150 96 C124 96 104 108 96 132 Z" fill="${HAIR}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      ${face(mood)}
    </g>`;
  }

  function svg(def, answers) {
    const val = (x) => (typeof x === 'function' ? x(answers) : x);
    const mood = val(def.mood) || 'happy';
    const skin = def.skin || '#6B3A22';
    const scene = def.scene || '#E7D3C1';
    const mystery = def.mystery && !answers[def.id];
    return `<svg viewBox="0 0 300 300" role="img" aria-label="Illustration placeholder" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice">
      <rect width="300" height="300" fill="${scene}"/>
      ${def.type === 'outro' ? sparkles() : ''}
      ${character(def, answers, mood, skin)}
      ${mystery ? `<text x="150" y="168" text-anchor="middle" font-family="Fraunces, serif" font-weight="900" font-size="150" fill="${INK}">?</text>` : ''}
      ${badges(def, answers)}
      ${bubble(val(def.bubble))}
    </svg>`;
  }

  function sparkles() {
    const pts = [[48, 70], [250, 60], [70, 200], [240, 190], [150, 30]];
    return pts.map(([x, y], i) => `<path transform="translate(${x} ${y}) scale(${0.8 + (i % 3) * 0.25})" d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`).join('');
  }

  // Returns inner HTML for the picture frame (without the tag label).
  function render(def, answers) {
    if (def.art) return `<img src="${def.art}" alt="" />`;
    return svg(def, answers);
  }

  return { render };
})();
