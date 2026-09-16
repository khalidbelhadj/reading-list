#!/usr/bin/env bun
/**
 * Generate the Tabler icons the macOS app uses: one SVG per icon under
 * mac/Sources/ReadingList/Resources/Icons, plus a Swift enum naming them.
 * The set is every Tabler icon the web app imports (every `IconX` in
 * components/, app/ and lib/), so both apps draw the same rounded strokes.
 *
 *   bun run mac:icons
 */
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = path.join(root, "mac/Sources/ReadingList/Resources/Icons");
const SWIFT_FILE = path.join(
  root,
  "mac/Sources/ReadingList/DesignKit/TablerIcon.generated.swift",
);

type IconNode = [string, Record<string, string>];
const readNodes = (file: string) =>
  JSON.parse(
    readFileSync(path.join(root, "node_modules/@tabler/icons", file), "utf8"),
  ) as Record<string, IconNode[]>;
const outline = readNodes("tabler-nodes-outline.json");
const filled = readNodes("tabler-nodes-filled.json");

// Not icons: IconProps is a type, IconClaude is an inline brand SVG.
const NOT_ICONS = new Set(["Props", "Claude"]);

// Icons of our own, beside Tabler's: the Claude spark from
// components/app/item-menu.tsx, kept in its brand colour (not a template).
const CUSTOM: Array<{ caseName: string; file: string; svg: string }> = [
  {
    caseName: "google",
    file: "google",
    svg: `<svg version="1.1" viewBox="0 0 268.1522 273.8827" overflow="hidden" xml:space="preserve" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="a">
      <stop offset="0" stop-color="#0fbc5c"/>
      <stop offset="1" stop-color="#0cba65"/>
    </linearGradient>
    <linearGradient id="g">
      <stop offset=".2312727" stop-color="#0fbc5f"/>
      <stop offset=".3115468" stop-color="#0fbc5f"/>
      <stop offset=".3660131" stop-color="#0fbc5e"/>
      <stop offset=".4575163" stop-color="#0fbc5d"/>
      <stop offset=".540305" stop-color="#12bc58"/>
      <stop offset=".6993464" stop-color="#28bf3c"/>
      <stop offset=".7712418" stop-color="#38c02b"/>
      <stop offset=".8605665" stop-color="#52c218"/>
      <stop offset=".9150327" stop-color="#67c30f"/>
      <stop offset="1" stop-color="#86c504"/>
    </linearGradient>
    <linearGradient id="h">
      <stop offset=".1416122" stop-color="#1abd4d"/>
      <stop offset=".2475151" stop-color="#6ec30d"/>
      <stop offset=".3115468" stop-color="#8ac502"/>
      <stop offset=".3660131" stop-color="#a2c600"/>
      <stop offset=".4456735" stop-color="#c8c903"/>
      <stop offset=".540305" stop-color="#ebcb03"/>
      <stop offset=".6156363" stop-color="#f7cd07"/>
      <stop offset=".6993454" stop-color="#fdcd04"/>
      <stop offset=".7712418" stop-color="#fdce05"/>
      <stop offset=".8605661" stop-color="#ffce0a"/>
    </linearGradient>
    <linearGradient id="f">
      <stop offset=".3159041" stop-color="#ff4c3c"/>
      <stop offset=".6038179" stop-color="#ff692c"/>
      <stop offset=".7268366" stop-color="#ff7825"/>
      <stop offset=".884534" stop-color="#ff8d1b"/>
      <stop offset="1" stop-color="#ff9f13"/>
    </linearGradient>
    <linearGradient id="b">
      <stop offset=".2312727" stop-color="#ff4541"/>
      <stop offset=".3115468" stop-color="#ff4540"/>
      <stop offset=".4575163" stop-color="#ff4640"/>
      <stop offset=".540305" stop-color="#ff473f"/>
      <stop offset=".6993464" stop-color="#ff5138"/>
      <stop offset=".7712418" stop-color="#ff5b33"/>
      <stop offset=".8605665" stop-color="#ff6c29"/>
      <stop offset="1" stop-color="#ff8c18"/>
    </linearGradient>
    <linearGradient id="d">
      <stop offset=".4084578" stop-color="#fb4e5a"/>
      <stop offset="1" stop-color="#ff4540"/>
    </linearGradient>
    <linearGradient id="c">
      <stop offset=".1315461" stop-color="#0cba65"/>
      <stop offset=".2097843" stop-color="#0bb86d"/>
      <stop offset=".2972969" stop-color="#09b479"/>
      <stop offset=".3962575" stop-color="#08ad93"/>
      <stop offset=".4771242" stop-color="#0aa6a9"/>
      <stop offset=".5684245" stop-color="#0d9cc6"/>
      <stop offset=".667385" stop-color="#1893dd"/>
      <stop offset=".7687273" stop-color="#258bf1"/>
      <stop offset=".8585063" stop-color="#3086ff"/>
    </linearGradient>
    <linearGradient id="e">
      <stop offset=".3660131" stop-color="#ff4e3a"/>
      <stop offset=".4575163" stop-color="#ff8a1b"/>
      <stop offset=".540305" stop-color="#ffa312"/>
      <stop offset=".6156363" stop-color="#ffb60c"/>
      <stop offset=".7712418" stop-color="#ffcd0a"/>
      <stop offset=".8605665" stop-color="#fecf0a"/>
      <stop offset=".9150327" stop-color="#fecf08"/>
      <stop offset="1" stop-color="#fdcd01"/>
    </linearGradient>
    <linearGradient xlink:href="#a" id="s" x1="219.6997" y1="329.5351" x2="254.4673" y2="329.5351" gradientUnits="userSpaceOnUse"/>
    <radialGradient xlink:href="#b" id="m" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-1.936885,1.043001,1.455731,2.555422,290.5254,-400.6338)" cx="109.6267" cy="135.8619" fx="109.6267" fy="135.8619" r="71.46001"/>
    <radialGradient xlink:href="#c" id="n" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-3.512595,-4.45809,-1.692547,1.260616,870.8006,191.554)" cx="45.25866" cy="279.2738" fx="45.25866" fy="279.2738" r="71.46001"/>
    <radialGradient xlink:href="#d" id="l" cx="304.0166" cy="118.0089" fx="304.0166" fy="118.0089" r="47.85445" gradientTransform="matrix(2.064353,-4.926832e-6,-2.901531e-6,2.592041,-297.6788,-151.7469)" gradientUnits="userSpaceOnUse"/>
    <radialGradient xlink:href="#e" id="o" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-0.2485783,2.083138,2.962486,0.3341668,-255.1463,-331.1636)" cx="181.001" cy="177.2013" fx="181.001" fy="177.2013" r="71.46001"/>
    <radialGradient xlink:href="#f" id="p" cx="207.6733" cy="108.0972" fx="207.6733" fy="108.0972" r="41.1025" gradientTransform="matrix(-1.249206,1.343263,-3.896837,-3.425693,880.5011,194.9051)" gradientUnits="userSpaceOnUse"/>
    <radialGradient xlink:href="#g" id="r" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-1.936885,-1.043001,1.455731,-2.555422,290.5254,838.6834)" cx="109.6267" cy="135.8619" fx="109.6267" fy="135.8619" r="71.46001"/>
    <radialGradient xlink:href="#h" id="j" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-0.081402,-1.93722,2.926737,-0.1162508,-215.1345,632.8606)" cx="154.8697" cy="145.9691" fx="154.8697" fy="145.9691" r="71.46001"/>
    <filter id="q" x="-.04842873" y="-.0582241" width="1.096857" height="1.116448" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="1.700914"/>
    </filter>
    <filter id="k" x="-.01670084" y="-.01009856" width="1.033402" height="1.020197" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation=".2419367"/>
    </filter>
    <clipPath clipPathUnits="userSpaceOnUse" id="i">
      <path d="M371.3784 193.2406H237.0825v53.4375h77.167c-1.2405 7.5627-4.0259 15.0024-8.1049 21.7862-4.6734 7.7723-10.4511 13.6895-16.373 18.1957-17.7389 13.4983-38.42 16.2584-52.7828 16.2584-36.2824 0-67.2833-23.2865-79.2844-54.9287-.4843-1.1482-.8059-2.3344-1.1975-3.5068-2.652-8.0533-4.101-16.5825-4.101-25.4474 0-9.226 1.5691-18.0575 4.4301-26.3985 11.2851-32.8967 42.9849-57.4674 80.1789-57.4674 7.4811 0 14.6854.8843 21.5173 2.6481 15.6135 4.0309 26.6578 11.9698 33.4252 18.2494l40.834-39.7111c-24.839-22.616-57.2194-36.3201-95.8444-36.3201-30.8782-.00066-59.3863 9.55308-82.7477 25.6992-18.9454 13.0941-34.4833 30.6254-44.9695 50.9861-9.75366 18.8785-15.09441 39.7994-15.09441 62.2934 0 22.495 5.34891 43.6334 15.10261 62.3374v.126c10.3023 19.8567 25.3678 36.9537 43.6783 49.9878 15.9962 11.3866 44.6789 26.5516 84.0307 26.5516 22.6301 0 42.6867-4.0517 60.3748-11.6447 12.76-5.4775 24.0655-12.6217 34.3012-21.8036 13.5247-12.1323 24.1168-27.1388 31.3465-44.4041 7.2297-17.2654 11.097-36.7895 11.097-57.957 0-9.858-.9971-19.8694-2.6881-28.9684Z" fill="#000"/>
    </clipPath>
  </defs>
  <g transform="matrix(0.957922,0,0,0.985255,-90.17436,-78.85577)">
    <g clip-path="url(#i)">
      <path d="M92.07563 219.9585c.14844 22.14 6.5014 44.983 16.11767 63.4234v.1269c6.9482 13.3919 16.4444 23.9704 27.2604 34.4518l65.326-23.67c-12.3593-6.2344-14.2452-10.0546-23.1048-17.0253-9.0537-9.0658-15.8015-19.4735-20.0038-31.677h-.1693l.1693-.1269c-2.7646-8.0587-3.0373-16.6129-3.1393-25.5029Z" fill="url(#j)" filter="url(#k)"/>
      <path d="M237.0835 79.02491c-6.4568 22.52569-3.988 44.42139 0 57.16129 7.4561.0055 14.6388.8881 21.4494 2.6464 15.6135 4.0309 26.6566 11.97 33.424 18.2496l41.8794-40.7256c-24.8094-22.58904-54.6663-37.2961-96.7528-37.33169Z" fill="url(#l)" filter="url(#k)"/>
      <path d="M236.9434 78.84678c-31.6709-.00068-60.9107 9.79833-84.8718 26.35902-8.8968 6.149-17.0612 13.2521-24.3311 21.1509-1.9045 17.7429 14.2569 39.5507 46.2615 39.3702 15.5284-17.9373 38.4946-29.5427 64.0561-29.5427.0233 0 .046.0019.0693.002l-1.0439-57.33536c-.0472-.00003-.0929-.00406-.1401-.00406Z" fill="url(#m)" filter="url(#k)"/>
      <path d="m341.4751 226.3788-28.2685 19.2848c-1.2405 7.5627-4.0278 15.0023-8.1068 21.7861-4.6734 7.7723-10.4506 13.6898-16.3725 18.196-17.7022 13.4704-38.3286 16.2439-52.6877 16.2553-14.8415 25.1018-17.4435 37.6749 1.0439 57.9342 22.8762-.0167 43.157-4.1174 61.0458-11.7965 12.9312-5.551 24.3879-12.7913 34.7609-22.0964 13.7061-12.295 24.4421-27.5034 31.7688-45.0003 7.3267-17.497 11.2446-37.2822 11.2446-58.7336Z" fill="url(#n)" filter="url(#k)"/>
      <path d="M234.9956 191.2104v57.4981h136.0062c1.1962-7.8745 5.1523-18.0644 5.1523-26.5001 0-9.858-.9963-21.899-2.6873-30.998Z" fill="#3086ff" filter="url(#k)"/>
      <path d="M128.3894 124.3268c-8.393 9.1191-15.5632 19.326-21.2483 30.3646-9.75351 18.8785-15.09402 41.8295-15.09402 64.3235 0 .317.02642.6271.02855.9436 4.31953 8.2244 59.66647 6.6495 62.45617 0-.0035-.3103-.0387-.6128-.0387-.9238 0-9.226 1.5696-16.0262 4.4306-24.3672 3.5294-10.2885 9.0557-19.7628 16.1223-27.9257 1.6019-2.0309 5.8748-6.3969 7.1214-9.0157.4749-.9975-.8621-1.5574-.9369-1.9085-.0836-.3927-1.8762-.0769-2.2778-.3694-1.2751-.9288-3.8001-1.4138-5.3334-1.8449-3.2772-.9215-8.7085-2.9536-11.7252-5.0601-9.5357-6.6586-24.417-14.6122-33.5047-24.2164Z" fill="url(#o)" filter="url(#k)"/>
      <path d="M162.0989 155.8569c22.1123 13.3013 28.4714-6.7139 43.173-12.9771L179.698 90.21568c-9.4075 3.92642-18.2957 8.80465-26.5426 14.50442-12.316 8.5122-23.192 18.8995-32.1763 30.7204Z" fill="url(#p)" filter="url(#q)"/>
      <path d="M171.0987 290.222c-29.6829 10.6413-34.3299 11.023-37.0622 29.2903 5.2213 5.0597 10.8312 9.74 16.7926 13.9835 15.9962 11.3867 46.766 26.5517 86.1178 26.5517.0462 0 .0904-.004.1366-.004v-59.1574c-.0298.0001-.064.002-.0938.002-14.7359 0-26.5113-3.8435-38.5848-10.5273-2.9768-1.6479-8.3775 2.7772-11.1229.799-3.7865-2.7284-12.8991 2.3508-16.1833-.9378Z" fill="url(#r)" filter="url(#k)"/>
      <path d="M219.6997 299.0227v59.9959c5.506.6402 11.2361 1.0289 17.2472 1.0289 6.0259 0 11.8556-.3073 17.5204-.8723v-59.7481c-6.3482 1.0777-12.3272 1.461-17.4776 1.461-5.9318 0-11.7005-.6858-17.29-1.8654Z" opacity=".5" fill="url(#s)" filter="url(#k)"/>
    </g>
  </g>
</svg>\n`,
  },
  {
    caseName: "claude",
    file: "claude",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#cc785c"><path d="${"m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z"}"/></svg>\n`,
  },
];

// Bolder strokes the web passes as `stroke={3}` / `stroke={2.5}` get their
// own files, since an SVG file carries one stroke width.
const VARIANTS: Array<{ name: string; stroke: number; file: string }> = [
  { name: "Check", stroke: 3, file: "check-bold" },
  { name: "Check", stroke: 2.5, file: "check-medium" },
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });

const usedNames = new Set<string>();
for (const dir of ["components", "app", "lib"]) {
  for (const file of walk(path.join(root, dir))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bIcon([A-Z][A-Za-z0-9]*)\b/g)) {
      const name = match[1];
      if (name !== undefined && !NOT_ICONS.has(name)) usedNames.add(name);
    }
  }
}

// IconArrowBackUp -> arrow-back-up, IconH1 -> h-1, IconLoader2 -> loader-2.
const kebab = (pascal: string) =>
  pascal
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();

const camel = (pascal: string) => pascal[0]?.toLowerCase() + pascal.slice(1);

const svg = (nodes: IconNode[], isFilled: boolean, stroke: number) => {
  const body = nodes
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .map(([key, value]) => `${key}="${value}"`)
          .join(" ")}/>`,
    )
    .join("");
  const paint = isFilled
    ? 'fill="#000" stroke="none"'
    : `fill="none" stroke="#000" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ${paint}>${body}</svg>\n`;
};

type Entry = {
  caseName: string;
  file: string;
  nodes: IconNode[];
  isFilled: boolean;
  stroke: number;
};

const resolve = (
  name: string,
): { nodes: IconNode[]; isFilled: boolean } | null => {
  const isFilled = name.endsWith("Filled");
  const key = kebab(isFilled ? name.slice(0, -"Filled".length) : name);
  const nodes = isFilled ? filled[key] : outline[key];
  return nodes ? { nodes, isFilled } : null;
};

const entries: Entry[] = [];
const missing: string[] = [];
for (const name of [...usedNames].sort()) {
  const resolved = resolve(name);
  if (!resolved) {
    missing.push(name);
    continue;
  }
  entries.push({
    caseName: camel(name),
    file: kebab(name),
    nodes: resolved.nodes,
    isFilled: resolved.isFilled,
    stroke: 2,
  });
}
for (const variant of VARIANTS) {
  const resolved = resolve(variant.name);
  if (!resolved) {
    missing.push(variant.name);
    continue;
  }
  entries.push({
    caseName: camel(
      variant.file.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
    ),
    file: variant.file,
    nodes: resolved.nodes,
    isFilled: resolved.isFilled,
    stroke: variant.stroke,
  });
}
if (missing.length > 0) {
  console.error(`No Tabler icon for: ${missing.join(", ")}`);
  process.exit(1);
}

rmSync(ICONS_DIR, { recursive: true, force: true });
mkdirSync(ICONS_DIR, { recursive: true });
for (const entry of entries) {
  writeFileSync(
    path.join(ICONS_DIR, `${entry.file}.svg`),
    svg(entry.nodes, entry.isFilled, entry.stroke),
  );
}
for (const custom of CUSTOM) {
  writeFileSync(path.join(ICONS_DIR, `${custom.file}.svg`), custom.svg);
}

const swift = [
  "// Generated by scripts/mac-icons.ts (bun run mac:icons). Do not edit.",
  "//",
  "// Every Tabler icon the web app imports, as an SVG in Resources/Icons.",
  "",
  "enum TablerIcon: String, CaseIterable {",
  ...entries.map((entry) => `    case ${entry.caseName} = "${entry.file}"`),
  ...CUSTOM.map((custom) => `    case ${custom.caseName} = "${custom.file}"`),
  "}",
  "",
].join("\n");
mkdirSync(path.dirname(SWIFT_FILE), { recursive: true });
writeFileSync(SWIFT_FILE, swift);
console.log(
  `${entries.length + CUSTOM.length} icons -> ${path.relative(root, ICONS_DIR)}`,
);
