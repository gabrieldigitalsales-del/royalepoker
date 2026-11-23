import { housePresets } from "./local-rules.mjs";
const games = [];
function add(id, name, family, limit, rule, max = 6) {
  games.push({ id, name, family, limit, rule, max, version: 1 });
}
add(
  "texas",
  "Texas Hold’em",
  "Hold’em",
  "NL",
  "Duas cartas próprias e cinco comunitárias. Vale a melhor combinação de cinco.",
  10,
);
add(
  "limit",
  "Limit Hold’em",
  "Hold’em",
  "FL",
  "Texas Hold’em com apostas fixas por rodada.",
  10,
);
add(
  "short",
  "Short Deck 6+",
  "Hold’em",
  "NL",
  "Baralho de 36 cartas, blinds, flush supera full house e A-6-7-8-9 forma sequência.",
);
for (const [id, name, when] of [
  ["pine", "Pineapple", "antes da primeira aposta"],
  ["crazy", "Crazy Pineapple", "depois das apostas do flop"],
])
  add(
    id,
    name,
    "Hold’em",
    "NL",
    "Receba três cartas e descarte uma " + when + ".",
  );
add(
  "super",
  "Super Hold’em",
  "Hold’em",
  "NL",
  "Três cartas próprias sem descarte. Monte a melhor mão de cinco.",
  10,
);
add(
  "watermelon",
  "Watermelon",
  "Hold’em",
  "NL",
  "Quatro cartas próprias. Descarte uma após as apostas do flop e outra após as apostas do turn.",
  10,
);
export const dealerGames = [
  "texas",
  "super",
  "crazy",
  "watermelon",
  "om4",
  "om5",
  "om6",
  "om5db",
  "om6db",
  "draw",
  "om3",
  "cour",
  "om7",
];
for (const n of [3, 4, 5, 6, 7])
  for (const low of n === 3 || n === 7 ? [false] : [false, true])
    add(
      "om" + n + (low ? "lo" : ""),
      n === 5 && low
        ? "Big O · Omaha 5 Hi-Lo"
        : "Omaha " + n + (low ? " Hi-Lo" : " High"),
      "Omaha",
      "PL",
      "Use exatamente duas das " +
        n +
        " cartas próprias e três comunitárias." +
        (low
          ? " A melhor baixa com cinco valores distintos até 8 recebe metade do pote."
          : ""),
      n <= 4 ? 10 : 6,
    );
for (const n of [5,6]) add("om"+n+"db", "Omaha "+n+" · Double Board", "Omaha", "PL", "Receba "+n+" cartas fechadas e jogue em dois bordos independentes de cinco cartas. Cada bordo disputa metade dos potes principal e laterais.", 6);
add(
  "oe",
  "Omaha 8-or-Better",
  "Omaha",
  "FL",
  "Omaha de quatro cartas com pote High/Low e apostas fixas.",
);
for (const low of [false, true])
  add(
    "cour" + (low ? "lo" : ""),
    "Courchevel" + (low ? " Hi-Lo" : ""),
    "Omaha",
    "PL",
    "Cinco cartas próprias. A primeira carta do flop fica visível antes da primeira aposta. Use duas próprias e três comunitárias." +
      (low ? " Baixa até 8 divide o pote." : ""),
  );
for (const [id, name, rule] of [
  ["stud5", "Five Card Stud", "Uma carta fechada e quatro abertas."],
  ["stud", "Seven Card Stud", "Três cartas fechadas e quatro abertas."],
  [
    "studlo",
    "Stud Hi-Lo 8",
    "Pote dividido entre high e baixa qualificada até 8.",
  ],
  [
    "razz",
    "Razz",
    "Vence a menor mão A–5. Sequências e flushes não contam contra.",
  ],
])
  add(id, name, "Stud", "FL", rule + " Ante e bring-in.");
for (const [id, name, rule, limit] of [
  ["draw", "Five Card Draw", "Uma troca. Vence a melhor mão alta.", "NL"],
  [
    "single",
    "2–7 Single Draw",
    "Uma troca. Ás alto, sequências e flushes contam contra.",
    "NL",
  ],
  [
    "triple",
    "2–7 Triple Draw",
    "Três trocas. Melhor baixa 7-5-4-3-2 sem flush.",
    "FL",
  ],
  ["ace", "A–5 Lowball", "Uma troca, ás baixo. Melhor mão A-2-3-4-5.", "NL"],
  [
    "badugi",
    "Badugi",
    "Três trocas. Priorize quatro naipes e valores distintos e depois a menor carta alta.",
    "FL",
  ],
  [
    "badacey",
    "Badacey",
    "Metade pela baixa A–5, metade pelo Badugi com ás baixo.",
    "FL",
  ],
  [
    "badeucey",
    "Badeucey",
    "Metade pela baixa 2–7, metade pelo Badugi com ás alto.",
    "FL",
  ],
  [
    "drawmaha",
    "Drawmaha",
    "Troque até cinco cartas após as apostas do flop. Divida o pote entre Omaha e a mão própria de cinco cartas.",
    "PL",
  ],
])
  add(id, name, "Draw", limit, rule, id === "drawmaha" ? 4 : 5);
for (const [id, name] of [
  ["chinese", "Poker chinês fechado"],
  ["ofc", "Open-Face Chinese"],
  ["ofcp", "OFC Pineapple"],
])
  add(
    id,
    name,
    "Chinês",
    "PTS",
    "Monte frente (3), meio (5) e fundo (5), em ordem crescente de força. Pontuação 1–6 com royalties e Fantasyland no OFC.",
    id === "chinese" ? 4 : 3,
  );
export const rotations = {
  horse: ["limit", "oe", "razz", "stud", "studlo"],
  eight: ["triple", "limit", "oe", "razz", "stud", "studlo", "texas", "om4"],
};
for (const [id, name] of [
  ["horse", "H.O.R.S.E."],
  ["eight", "8-Game"],
  ["custom", "Rotação personalizada"],
  ["choice", "Dealer’s Choice"],
])
  add(
    id,
    name,
    "Mistos",
    "MIX",
    "A modalidade muda entre mãos. A mesa mostra a sequência ou a escolha do dealer.",
    id === "choice" ? 10 : 5,
  );
export const catalog = Object.fromEntries(games.map((g) => [g.id, g]));

for (const preset of housePresets) {
  const base = catalog[preset.base];
  if (
    !base ||
    base.family === "Mistos" ||
    catalog[preset.id] ||
    !/^[a-z][a-z0-9-]{1,30}$/.test(preset.id) ||
    !Number.isInteger(preset.max) ||
    preset.max < 2 ||
    preset.max > base.max
  )
    throw Error("Regra da casa inválida: " + preset.id);
  catalog[preset.id] = { ...base, ...preset };
}
