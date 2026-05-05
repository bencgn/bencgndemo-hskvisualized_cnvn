const fs = require("fs");

const pdfWordsPath = "pdf-hsk-words.json";
const hsk = JSON.parse(fs.readFileSync("complete-hsk.min.json", "utf8"));
const cvdictLines = fs
  .readFileSync("CVDICT.u8", "utf8")
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#"));

const viBySimplified = new Map();
const cvdictBySimplified = new Map();

for (const line of cvdictLines) {
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
  if (!match) continue;
  const simplified = match[2];
  const numberedPinyin = match[3];
  const meanings = match[4]
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!viBySimplified.has(simplified)) viBySimplified.set(simplified, []);
  viBySimplified.get(simplified).push(...meanings);
  if (!cvdictBySimplified.has(simplified)) {
    cvdictBySimplified.set(simplified, { numberedPinyin, meanings: [] });
  }
  cvdictBySimplified.get(simplified).meanings.push(...meanings);
}

const unique = (items) => [...new Set(items.filter(Boolean))];

const hskBySimplified = new Map(hsk.map((entry) => [entry.s, entry]));

function makeWord(word, level, wordIndex) {
  const entry = hskBySimplified.get(word);
  const forms = entry?.f || [];
  const first = forms[0] || {};
  const cvdict = cvdictBySimplified.get(word);
  const english = unique(forms.flatMap((form) => form.m || [])).slice(0, 6);
  const vietnamese = unique(viBySimplified.get(word) || []).slice(0, 6);

  return {
    id: `hsk${level}-${wordIndex + 1}`,
    level,
    hanzi: word,
    traditional: first.t || "",
    pinyin: first.i?.y || cvdict?.numberedPinyin || "",
    pinyinNumbered: first.i?.n || cvdict?.numberedPinyin || "",
    vietnamese,
    english,
    partOfSpeech: entry?.p || [],
    frequency: entry?.q || null,
    source: entry ? "complete-hsk-vocabulary+CVDICT" : "PDF+CVDICT",
  };
}

const pdfWords = fs.existsSync(pdfWordsPath)
  ? JSON.parse(fs.readFileSync(pdfWordsPath, "utf8"))
  : null;

const levels = Array.from({ length: 6 }, (_, index) => {
  const level = index + 1;
  const sourceWords = pdfWords?.levels?.find((item) => item.level === level)?.words;
  const words = sourceWords
    ? sourceWords.map((word, wordIndex) => makeWord(word, level, wordIndex))
    : hsk
        .filter((entry) => entry.l.includes(`o${level}`))
        .sort((a, b) => {
          const ay = a.f[0]?.i?.y || "";
          const by = b.f[0]?.i?.y || "";
          return ay.localeCompare(by, "vi") || a.s.localeCompare(b.s, "zh-Hans-CN");
        })
        .map((entry, wordIndex) => makeWord(entry.s, level, wordIndex));

  return {
    level,
    label: `HSK ${level}`,
    count: words.length,
    words,
  };
});

const output = {
  generatedAt: new Date().toISOString(),
  sources: [
    {
      name: "hsk-words-visualized.pdf",
      url: "local PDF",
      license: "user-provided source layout",
    },
    {
      name: "complete-hsk-vocabulary",
      url: "https://github.com/drkameleon/complete-hsk-vocabulary",
      license: "MIT",
    },
    {
      name: "CVDICT",
      url: "https://github.com/ph0ngp/CVDICT",
      license: "CC BY-SA 4.0",
    },
  ],
  levels,
};

fs.writeFileSync("hsk-vocab.json", `${JSON.stringify(output)}\n`, "utf8");

const total = levels.reduce((sum, level) => sum + level.count, 0);
const viTotal = levels.reduce(
  (sum, level) => sum + level.words.filter((word) => word.vietnamese.length).length,
  0,
);
console.log(`Wrote hsk-vocab.json with ${total} words, ${viTotal} Vietnamese matches.`);
