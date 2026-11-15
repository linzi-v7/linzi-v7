// Builds every SVG in assets/. No dependencies. Run: GITHUB_TOKEN=... node scripts/build.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const LOGIN = 'linzi-v7';
const OUT = new URL('../assets/', import.meta.url);
const W = 868;
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";

const THEMES = {
  dark: {
    text: '#e6edf3', muted: '#8b949e', line: 'rgba(139,148,158,.32)', empty: 'rgba(139,148,158,.13)',
    ramp: ['#6b2d0f', '#b54a14', '#f06a1c', '#ffa04d'], hot: '#ffe8d1', accent: '#ff8a3d',
  },
  light: {
    text: '#1f2328', muted: '#59636e', line: 'rgba(89,99,110,.34)', empty: 'rgba(89,99,110,.11)',
    ramp: ['#fbd0ae', '#f79a5e', '#e8590c', '#a63c06'], hot: '#ffb37a', accent: '#c2410c',
  },
};

const GLYPHS = {
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
};

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function svg(height, label, theme, style, body) {
  const t = THEMES[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-label="${esc(label)}">
<style>
.m{font:500 11px ${MONO};letter-spacing:.08em;fill:${t.muted}}
.a{fill:${t.accent}}
.t{fill:${t.text}}
.e{fill:${t.empty}}
${t.ramp.map((c, i) => `.l${i + 1}{fill:${c}}`).join('')}
.c{animation:in .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes in{from{opacity:0;transform:translateY(5px)}}
${style}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
${body}
</svg>
`;
}

function hero(theme) {
  const t = THEMES[theme];
  const cols = 72, rows = 9, pitch = 12, size = 9, top = 34, left = 3;
  const lit = new Set();
  let col = 1;
  for (const word of ['FARIS', 'OSAMA']) {
    for (const ch of word) {
      GLYPHS[ch].forEach((bits, r) => [...bits].forEach((b, c) => b === '1' && lit.add(`${col + c},${r + 1}`)));
      col += 7;
    }
    col += 2;
  }
  const rand = seeded(7);
  let cells = '';
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const on = lit.has(`${c},${r}`);
      const roll = rand();
      const level = on ? (roll < 0.5 ? 3 : 4) : 0;
      const delay = (c * 0.018 + r * 0.012).toFixed(3);
      const sweep = on ? `,sweep${level} 7s ease-in-out ${(1.6 + c * 0.03).toFixed(2)}s infinite` : '';
      cells += `<rect class="c ${level ? `l${level}` : 'e'}" x="${left + c * pitch}" y="${top + r * pitch}" width="${size}" height="${size}" rx="2.2" style="animation:in .5s cubic-bezier(.2,.7,.2,1) ${delay}s both${sweep}"/>`;
    }
  }
  const bottom = top + rows * pitch + 21;
  const legend = [0, 1, 2, 3, 4]
    .map((l, i) => `<rect class="${l ? `l${l}` : 'e'}" x="${W - 108 + i * 13}" y="${bottom - 9}" width="10" height="10" rx="2.5"/>`)
    .join('');
  return svg(bottom + 8, 'Faris Osama, written as a contribution graph', theme,
    `${[2, 3, 4].map((l) => `@keyframes sweep${l}{0%,9%,100%{fill:${t.ramp[l - 1]}}4.5%{fill:${t.hot}}}`).join('')}
.tag{font:500 15px ${SANS};fill:${t.text}}`,
    `<text class="m" x="0" y="14"><tspan class="a">LINZI-V7</tspan>  /  CAIRO, EGYPT</text>
<text class="m" x="${W}" y="14" text-anchor="end">FULL-STACK ENGINEER</text>
${cells}
<text class="tag" x="0" y="${bottom}">Systems that still work when the happy path ends.</text>
<text class="m" x="${W - 118}" y="${bottom}" text-anchor="end">LESS</text>${legend}<text class="m" x="${W}" y="${bottom}" text-anchor="end">MORE</text>`);
}

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function fetchCalendar() {
  const query = `{user(login:"${LOGIN}"){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel weekday}}}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub API: ${res.status} ${JSON.stringify(json.errors ?? json)}`);
  return json.data.user.contributionsCollection.contributionCalendar;
}

function activity(theme, cal) {
  const pitch = 16, size = 13, top = 24;
  const left = Math.round((W - (cal.weeks.length * pitch - 3)) / 2);
  let cells = '', months = '', lastMonth = -1;
  cal.weeks.forEach((week, w) => {
    const month = Number(week.contributionDays[0].date.slice(5, 7)) - 1;
    if (month !== lastMonth && w < cal.weeks.length - 2) {
      if (lastMonth !== -1 || week.contributionDays[0].date.slice(8) <= '07') months += `<text class="m" x="${left + w * pitch}" y="11">${MONTHS[month].toUpperCase()}</text>`;
      lastMonth = month;
    }
    for (const day of week.contributionDays) {
      const level = LEVELS[day.contributionLevel];
      cells += `<rect class="c ${level ? `l${level}` : 'e'}" x="${left + w * pitch}" y="${top + day.weekday * pitch}" width="${size}" height="${size}" rx="3" style="animation-delay:${(w * 0.014 + day.weekday * 0.02).toFixed(3)}s"><title>${day.contributionCount} on ${day.date}</title></rect>`;
    }
  });
  const days = cal.weeks.flatMap((w) => w.contributionDays);
  let streak = 0, longest = 0;
  for (const d of days) { streak = d.contributionCount ? streak + 1 : 0; longest = Math.max(longest, streak); }
  const best = days.reduce((a, b) => (b.contributionCount > a.contributionCount ? b : a));
  const active = days.filter((d) => d.contributionCount).length;
  const stats = [
    [cal.totalContributions.toLocaleString('en-US'), 'CONTRIBUTIONS, LAST 12 MONTHS'],
    [`${active}`, `ACTIVE DAYS OF ${days.length}`],
    [`${longest}`, 'DAYS, LONGEST STREAK'],
    [`${best.contributionCount}`, `BEST DAY, ${Number(best.date.slice(8))} ${MONTHS[Number(best.date.slice(5, 7)) - 1].toUpperCase()}`],
  ];
  const y = top + 7 * pitch + 42;
  const row = stats
    .map(([n, l], i) => `<text class="n${i ? '' : ' a'}" x="${left + i * 217}" y="${y}">${n}</text><text class="m" x="${left + i * 217}" y="${y + 21}">${l}</text>`)
    .join('');
  return svg(y + 30, `${cal.totalContributions} contributions in the last 12 months`, theme,
    `.n{font:700 30px ${SANS};letter-spacing:-.02em;fill:${THEMES[theme].text}}.n.a{fill:${THEMES[theme].accent}}`,
    `${months}${cells}${row}`);
}

// Conway's Game of Life on a torus, seeded with the contribution calendar.
function life(theme, cal) {
  const cols = cal.weeks.length, rows = 7, pitch = 16, size = 13, top = 24, hold = 5, max = 60, step = 0.4;
  const left = Math.round((W - (cols * pitch - 3)) / 2);
  const level = new Map();
  let grid = Array.from({ length: cols }, () => Array(rows).fill(0));
  cal.weeks.forEach((week, c) => week.contributionDays.forEach((d) => {
    if (d.contributionCount) { grid[c][d.weekday] = 1; level.set(`${c},${d.weekday}`, LEVELS[d.contributionLevel]); }
  }));
  const frames = [grid], seen = new Set([grid.flat().join('')]);
  while (frames.length < max) {
    const prev = frames[frames.length - 1];
    const next = prev.map((col, c) => col.map((alive, r) => {
      let n = 0;
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        if (dc || dr) n += prev[(c + dc + cols) % cols][(r + dr + rows) % rows];
      }
      return n === 3 || (alive && n === 2) ? 1 : 0;
    }));
    const key = next.flat().join('');
    if (seen.has(key)) break;
    seen.add(key);
    frames.push(next);
  }
  const total = frames.length + hold - 1;
  let cells = '';
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = left + c * pitch, y = top + r * pitch;
    cells += `<rect class="e" x="${x}" y="${y}" width="${size}" height="${size}" rx="3"/>`;
    const states = frames.map((f) => f[c][r]);
    if (!states.includes(1)) continue;
    const values = [...Array(hold - 1).fill(states[0]), ...states].join(';');
    cells += `<rect class="l${level.get(`${c},${r}`) ?? 2}" x="${x}" y="${y}" width="${size}" height="${size}" rx="3" opacity="${states[0]}"><animate attributeName="opacity" calcMode="discrete" dur="${(total * step).toFixed(1)}s" repeatCount="indefinite" values="${values}"/></rect>`;
  }
  return svg(top + rows * pitch + 1, "Conway's Game of Life, seeded with the contribution graph", theme, '',
    `<text class="m" x="${left}" y="11"><tspan class="a">GAME OF LIFE</tspan>  /  SEEDED WITH THE GRAPH ABOVE</text>
<text class="m" x="${W - left}" y="11" text-anchor="end">B3/S23  /  TORUS ${cols}×${rows}  /  ${frames.length - 1} GENERATIONS</text>
${cells}`);
}

const WORK = [
  {
    file: 'work-multaqa', kicker: '01  /  IN PRODUCTION  /  ERP', title: 'Multaqa',
    desc: ['A multi-company ERP: accounting, HR and payroll,', 'with exact money and strict tenancy.'],
    tags: ['Laravel', 'React', 'Flutter', 'PostgreSQL'],
    nodes: [
      ['Admin SPA', 436, 38, 112], ['Company SPA', 436, 82, 112], ['Flutter app', 436, 126, 112],
      ['Laravel API', 588, 82, 108], ['PostgreSQL', 736, 60, 104], ['Workers', 736, 104, 104],
    ],
    edges: [[0, 3], [1, 3], [2, 3], [3, 4], [3, 5]],
  },
  {
    file: 'work-malaf', kicker: '02  /  IN PRODUCTION  /  DESKTOP', title: 'Malaf',
    desc: ['An offline-first clinic app. Patient records stay', "encrypted on the doctor's own PC."],
    tags: ['Tauri', 'Rust', 'React', 'SQLite'],
    nodes: [
      ['React UI', 436, 82, 92], ['Rust core', 560, 82, 98],
      ['Encrypted SQLite', 692, 38, 148], ['Encrypted backup', 692, 82, 148], ['Signed updates', 692, 126, 148],
    ],
    edges: [[0, 1], [1, 2], [1, 3], [1, 4]],
  },
  {
    file: 'work-questify', kicker: '03  /  OPEN SOURCE  /  MONOREPO', title: 'Questify',
    desc: ['A gamified learning platform: quests, XP, streaks,', 'AI-generated courses and RAG answers.'],
    tags: ['TypeScript', 'Expo', 'Express', 'Prisma', 'PostgreSQL'],
    nodes: [
      ['Expo app', 436, 44, 100], ['Admin SPA', 436, 120, 100], ['Express API', 578, 82, 108],
      ['PostgreSQL', 728, 38, 112], ['Cloudflare R2', 728, 82, 112], ['pg-boss jobs', 728, 126, 112],
    ],
    edges: [[0, 2], [1, 2], [2, 3], [2, 4], [2, 5]],
  },
];

function work(theme, p) {
  const t = THEMES[theme];
  const H = 196, nh = 32;
  let x = 28;
  const tags = p.tags.map((tag) => {
    const w = Math.round(tag.length * 7.3 + 18);
    const out = `<rect x="${x}" y="150" width="${w}" height="22" rx="11" fill="none" stroke="${t.line}"/><text class="m" x="${x + w / 2}" y="165" text-anchor="middle" style="letter-spacing:.02em">${tag}</text>`;
    x += w + 6;
    return out;
  }).join('');
  const edges = p.edges.map(([a, b], i) => {
    const [, ax, ay, aw] = p.nodes[a];
    const [, bx, by] = p.nodes[b];
    const x1 = ax + aw, y1 = ay + nh / 2, y2 = by + nh / 2, mid = (x1 + bx) / 2;
    const d = `M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${bx} ${y2}`;
    return `<path d="${d}" fill="none" stroke="${t.line}"/><path class="f" d="${d}" fill="none" stroke="${t.accent}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 15" style="animation-delay:-${(i * 0.23).toFixed(2)}s"/>`;
  }).join('');
  const nodes = p.nodes.map(([label, nx, ny, nw], i) =>
    `<g class="c" style="animation-delay:${(0.15 + i * 0.07).toFixed(2)}s"><rect class="e" x="${nx}" y="${ny}" width="${nw}" height="${nh}" rx="7" stroke="${t.line}"/><rect class="l${(i % 3) + 2}" x="${nx + 9}" y="${ny + 12}" width="8" height="8" rx="2"/><text class="m t" x="${nx + 24}" y="${ny + 20}" style="letter-spacing:.01em">${esc(label)}</text></g>`).join('');
  return svg(H, `${p.title}: ${p.desc.join(' ')}`, theme,
    `.h{font:700 27px ${SANS};letter-spacing:-.02em;fill:${t.text}}.d{font:400 14.5px ${SANS};fill:${t.muted}}
.f{animation:flow 1.4s linear infinite}@keyframes flow{to{stroke-dashoffset:-18}}`,
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${t.line}"/>
<text class="m a" x="28" y="38">${p.kicker}</text>
<text class="h" x="28" y="76">${esc(p.title)}</text>
${p.desc.map((l, i) => `<text class="d" x="28" y="${104 + i * 21}">${esc(l)}</text>`).join('')}
${tags}${edges}${nodes}`);
}

const STACK = [
  ['INTERFACE', ['TypeScript', 'React', 'TanStack', 'Vite', 'Flutter', 'Expo']],
  ['SERVICE', ['Laravel', 'Node.js', 'Express', 'Rust', 'Tauri']],
  ['DATA', ['PostgreSQL', 'Prisma', 'SQLite']],
  ['RUNTIME', ['Docker', 'Nginx', 'Linux', 'DigitalOcean']],
];

function stack(theme) {
  const t = THEMES[theme];
  const rowH = 48, top = 10, ch = 30, travel = (STACK.length - 1) * rowH;
  const rail = `<path d="M11 ${top + ch / 2}v${travel}" stroke="${t.line}"/>`;
  const rows = STACK.map(([label, items], r) => {
    const y = top + r * rowH;
    let x = 168;
    const chips = items.map((item, i) => {
      const w = Math.round(item.length * 7.7 + 40);
      const out = `<g class="c" style="animation-delay:${(r * 0.12 + i * 0.05).toFixed(2)}s"><rect class="e" x="${x}" y="${y}" width="${w}" height="${ch}" rx="8" stroke="${t.line}"/><rect class="l${((r + i) % 3) + 2}" x="${x + 11}" y="${y + 11}" width="8" height="8" rx="2"/><text class="k" x="${x + 27}" y="${y + 19.5}">${item}</text></g>`;
      x += w + 8;
      return out;
    }).join('');
    return `<rect class="hit" x="6" y="${y + ch / 2 - 5}" width="10" height="10" rx="2.5" style="animation-delay:${r}s"/><text class="m a" x="34" y="${y + 19}">${label}</text>${chips}`;
  }).join('');
  return svg(top * 2 + travel + ch, `Stack: ${STACK.map(([l, i]) => `${l.toLowerCase()}: ${i.join(', ')}`).join('; ')}`, theme,
    `.k{font:500 12.5px ${MONO};fill:${t.text}}
.hit{fill:${t.ramp[2]};animation:hit 4s ease-in-out infinite}@keyframes hit{0%,14%,100%{fill:${t.ramp[2]}}5%{fill:${t.hot}}}
.p{fill:${t.hot};animation:drop 4s linear infinite}@keyframes drop{0%{transform:translateY(0);opacity:1}75%{transform:translateY(${travel}px);opacity:1}76%,100%{transform:translateY(${travel}px);opacity:0}}`,
    `${rail}<rect class="p" x="8.5" y="${top + ch / 2 - 2.5}" width="5" height="5" rx="1.5"/>${rows}`);
}

mkdirSync(OUT, { recursive: true });
const cal = await fetchCalendar();
for (const theme of Object.keys(THEMES)) {
  writeFileSync(new URL(`hero-${theme}.svg`, OUT), hero(theme));
  writeFileSync(new URL(`activity-${theme}.svg`, OUT), activity(theme, cal));
  writeFileSync(new URL(`stack-${theme}.svg`, OUT), stack(theme));
  writeFileSync(new URL(`life-${theme}.svg`, OUT), life(theme, cal));
  for (const p of WORK) writeFileSync(new URL(`${p.file}-${theme}.svg`, OUT), work(theme, p));
}
console.log(`Built assets: ${cal.totalContributions} contributions, ${cal.weeks.length} weeks.`);
