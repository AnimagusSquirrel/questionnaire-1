/*
 * The questionnaire. One object per slide, shown in this order.
 *
 * Types:  intro | group | choice | multi | slider | likert | text | outro
 * Common: id, eyebrow ("Question 3"), title, hint, tag (label on the picture),
 *         scene (picture background colour), mood, skin, art (path to your own
 *         illustration, e.g. "illustrations/q3.svg"; null = built-in placeholder),
 *         showIf(answers) to skip a slide, insight(answers) -> { html, sub }
 *
 * All benchmark numbers (BENCH) are PLACEHOLDERS. Replace with real data later.
 */
(function () {
  const COLORS = {
    tan: '#E7D3C1', peach: '#F3D5C8', sage: '#DADCC8', rose: '#E8C5C2', sky: '#CFE3E6', butter: '#F1E4B8',
  };

  const DECADES = [
    { v: 'teens', l: 'Teens' },
    { v: '20s', l: '20s' },
    { v: '30s', l: '30s' },
    { v: '40s', l: '40s' },
    { v: '50s', l: '50s' },
    { v: '60s', l: '60s' },
    { v: '70s', l: '70s+' },
  ];
  const decadeIndex = (v) => DECADES.findIndex((d) => d.v === v);
  const decadeLabel = (v) => (v === 'teens' ? 'teens' : v === '70s' ? '70s+' : v);
  const yourDecade = (v) => (v === 'teens' ? 'your teens' : 'your ' + decadeLabel(v));

  // PLACEHOLDER benchmarks (percent of respondents)
  const BENCH = {
    happiest: { teens: 14, '20s': 29, '30s': 27, '40s': 14, '50s': 8, '60s': 4, '70s': 2, toss: 2 },
    defined: { freedom: 31, relationships: 44, financial: 18, work: 37, health: 22, learning: 19, other: 6 },
    middleAgedYes: 36,
    middleAgeMedian: 43,
    control: [6, 14, 31, 33, 16],
    happyToday: 6.8,
    future: { '30s': 22, '40s': 24, '50s': 17, '60s': 9, '70s': 4, behind: 24 },
  };

  const pct = (n) => (window.SURVEY_CONFIG.SHOW_BENCHMARKS ? n : null);
  const list = (arr) => (arr.length < 2 ? arr[0] : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);

  window.SURVEY_COLORS = COLORS;
  window.SURVEY_DECADES = DECADES;
  window.decadeIndex = decadeIndex;

  window.SURVEY_SLIDES = [
    {
      id: 'intro',
      type: 'intro',
      tag: 'Welcome',
      scene: COLORS.tan,
      mood: 'happy',
      eyebrow: 'A short questionnaire',
      title: 'How old do you feel, and when were you happiest?',
      hint: 'A handful of quick questions, under two minutes. Click an answer, then use the arrow keys or the buttons to move on.',
      cta: 'Start',
    },

    {
      id: 'decades',
      type: 'group',
      eyebrow: 'Questions {n} and {n+1}',
      title: 'Which decade of your life are you in right now? And which has been your happiest so far?',
      hint: 'Pick one on each row.',
      scene: COLORS.tan,
      mood: 'happy',
      tag: (a) => (a.decadeHappiest ? (a.decadeHappiest === 'toss' ? 'Happiest: too close to call' : 'Happiest: ' + yourDecade(a.decadeHappiest)) : 'Your decades'),
      fields: [
        { key: 'decadeNow', label: 'Which decade are you in now?', options: DECADES },
        {
          key: 'decadeHappiest',
          label: 'Your happiest so far',
          options: DECADES.concat([{ v: 'toss', l: 'Too close to call', wide: true }]),
          // can't have been happiest in a decade you haven't reached
          disabled: (a, o) => !!a.decadeNow && o.v !== 'toss' && decadeIndex(o.v) > decadeIndex(a.decadeNow),
        },
      ],
      insight: (a) => {
        if (!a.decadeNow || !a.decadeHappiest) return null;
        if (a.decadeHappiest === 'toss') return { html: 'Too close to call. Fair enough.', sub: 'Plenty of people say the same.' };
        const p = pct(BENCH.happiest[a.decadeHappiest]);
        return {
          html: `You said <b>${yourDecade(a.decadeHappiest)}</b>.` + (p ? ` <b>${p}%</b> of readers said the same.` : ''),
          sub: a.decadeNow === a.decadeHappiest ? 'And you are in it right now.' : 'Your answers are saved as you go.',
        };
      },
    },

    {
      id: 'defined',
      type: 'multi',
      max: 2,
      eyebrow: 'Question {n}',
      title: 'What most defined your happiest decade? Pick up to two.',
      hint: 'Pick up to two.',
      label: 'What defined it?',
      scene: COLORS.peach,
      mood: 'happy',
      tag: 'Your good decade',
      badges: [
        { v: 'relationships', g: '♥' },
        { v: 'financial', g: '$' },
        { v: 'health', g: '+' },
        { v: 'work', g: '★' },
        { v: 'learning', g: '✦' },
        { v: 'freedom', g: '↗' },
      ],
      options: [
        { v: 'freedom', l: 'Freedom and fewer obligations' },
        { v: 'relationships', l: 'Relationships or family' },
        { v: 'financial', l: 'Financial security' },
        { v: 'work', l: 'Work or building something' },
        { v: 'health', l: 'Health and energy' },
        { v: 'learning', l: 'Learning or discovery' },
        { v: 'other', l: 'Other' },
      ],
      insight: (a) => {
        const sel = a.defined || [];
        if (!sel.length) return null;
        const opts = window.SURVEY_SLIDES.find((s) => s.id === 'defined').options;
        const labels = sel.map((v) => '<b>' + opts.find((o) => o.v === v).l.toLowerCase() + '</b>');
        const ps = sel.map((v) => pct(BENCH.defined[v]));
        return {
          html: `You picked ${list(labels)}` + (ps[0] ? ` (${list(ps.map((p) => p + '%'))} of readers did too).` : '.'),
          sub: sel.length < 2 ? 'You can pick one more.' : null,
        };
      },
    },

    {
      id: 'middleAged',
      type: 'choice',
      eyebrow: 'Question {n}',
      title: 'Have you ever felt middle-aged?',
      hint: 'Answer honestly. Nobody is checking your birth certificate.',
      label: 'Have you felt it?',
      scene: COLORS.rose,
      skin: '#CF8B5C',
      mood: (a) => (a.middleAged === 'no' ? 'neutral' : 'happy'),
      tag: 'The moment',
      bubble: (a) => (a.middleAged === 'yes' ? 'Hi aunty!' : a.middleAged === 'no' ? 'Not yet!' : null),
      options: [
        { v: 'yes', l: 'Yes' },
        { v: 'no', l: 'No, not yet' },
      ],
      insight: (a) => {
        if (!a.middleAged) return null;
        if (a.middleAged === 'yes') {
          const p = pct(BENCH.middleAgedYes);
          return { html: 'You have' + (p ? `, like <b>${p}%</b> of readers.` : '.'), sub: 'Next, when it first hit.' };
        }
        const p = pct(100 - BENCH.middleAgedYes);
        return { html: 'Not yet' + (p ? `, like <b>${p}%</b> of readers.` : '.'), sub: 'Enjoy it.' };
      },
    },

    {
      id: 'middleAgeAge',
      type: 'slider',
      eyebrow: 'Question {n}',
      title: 'At what age did you first feel middle-aged?',
      hint: 'Drag the slider to the age it first happened.',
      label: 'I first felt it at',
      unit: 'years old',
      min: 15,
      max: 75,
      start: 25,
      scene: COLORS.rose,
      skin: '#CF8B5C',
      mood: 'neutral',
      tag: 'First time',
      showIf: (a) => a.middleAged === 'yes',
      insight: (a) => {
        if (a.middleAgeAge == null) return null;
        const diff = BENCH.middleAgeMedian - a.middleAgeAge;
        const cmp = diff > 0 ? `so you got there <b>${diff} years earlier</b> than most.` : diff < 0 ? `so you got there <b>${-diff} years later</b> than most.` : 'so you are right on the median.';
        return {
          html: `You felt it at <b>${a.middleAgeAge}</b>.` + (window.SURVEY_CONFIG.SHOW_BENCHMARKS ? ` Half of readers had felt it by ${BENCH.middleAgeMedian}, ${cmp}` : ''),
          sub: null,
        };
      },
    },

    {
      id: 'control',
      type: 'likert',
      eyebrow: 'Question {n}',
      title: 'I feel in control of the direction my life is taking.',
      hint: 'From strongly disagree to strongly agree.',
      label: 'How much do you agree?',
      scale: 5,
      ends: ['Strongly disagree', 'Strongly agree'],
      scene: COLORS.sky,
      mood: (a) => (a.control && a.control <= 2 ? 'neutral' : 'happy'),
      tag: 'In the driver’s seat',
      insight: (a) => {
        if (!a.control) return null;
        const agree = BENCH.control[3] + BENCH.control[4];
        const mine = a.control >= 4 ? 'You agree' : a.control === 3 ? 'You are on the fence' : 'You disagree';
        return {
          html: `${mine}.` + (window.SURVEY_CONFIG.SHOW_BENCHMARKS ? ` <b>${agree}%</b> of readers agree.` : ''),
          sub: null,
        };
      },
    },

    {
      id: 'happyToday',
      type: 'slider',
      eyebrow: 'Question {n}',
      title: 'How happy are you with your life right now?',
      hint: 'Zero is miserable, ten is as good as it gets.',
      label: 'Right now I am',
      unit: 'out of 10',
      min: 0,
      max: 10,
      start: 5,
      scene: COLORS.butter,
      mood: (a) => (a.happyToday != null && a.happyToday <= 3 ? 'neutral' : 'happy'),
      tag: 'Today',
      insight: (a) => {
        if (a.happyToday == null) return null;
        const d = Math.round((a.happyToday - BENCH.happyToday) * 10) / 10;
        const rel = d > 0 ? 'above' : d < 0 ? 'below' : 'right on';
        return {
          html: `You said <b>${a.happyToday}</b>.` + (window.SURVEY_CONFIG.SHOW_BENCHMARKS ? ` The typical reader says ${BENCH.happyToday}, so you are ${d === 0 ? rel : Math.abs(d) + ' ' + rel}.` : ''),
          sub: null,
        };
      },
    },

    {
      id: 'future',
      type: 'choice',
      eyebrow: 'Question {n}',
      title: 'Looking ahead, which decade do you expect will be your happiest?',
      hint: 'Pick one.',
      label: 'The decade you expect to be your happiest',
      scene: COLORS.sage,
      mystery: true,
      mood: 'happy',
      tag: (a) => (a.future ? (a.future === 'behind' ? 'Looking back' : 'Looking ahead: ' + yourDecade(a.future)) : 'Looking ahead'),
      options: DECADES.map((d) => ({ ...d })).concat([{ v: 'behind', l: 'It’s behind me', wide: true }]),
      // decades already gone can't be the future
      disabled: (a, o) => !!a.decadeNow && o.v !== 'behind' && decadeIndex(o.v) < decadeIndex(a.decadeNow),
      insight: (a) => {
        if (!a.future) return null;
        if (a.future === 'behind') return { html: 'You think your best decade is behind you.', sub: 'Worth checking in again in five years.' };
        const p = pct(BENCH.future[a.future]);
        return { html: `You are betting on <b>${yourDecade(a.future)}</b>.` + (p ? ` So are <b>${p}%</b> of readers.` : ''), sub: null };
      },
    },

    {
      id: 'youngerSelf',
      type: 'text',
      optional: true,
      eyebrow: 'Question {n}, optional',
      title: 'What would you tell your younger self?',
      hint: 'One line is plenty. You can skip this one.',
      label: 'Your note',
      placeholder: 'Type here…',
      maxLength: 280,
      scene: COLORS.peach,
      mood: 'happy',
      tag: 'Note to self',
      insight: (a) => (a.youngerSelf && a.youngerSelf.trim() ? { html: 'Noted. Thank you.', sub: null } : null),
    },

    {
      id: 'outro',
      type: 'outro',
      eyebrow: 'All done',
      title: 'Thank you.',
      hint: 'Your answers have been recorded.',
      scene: COLORS.rose,
      mood: 'happy',
      tag: 'Finished',
    },
  ];
})();
