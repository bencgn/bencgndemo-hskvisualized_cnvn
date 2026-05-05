import json
import re
import sys
import unicodedata
from collections import defaultdict

import fitz

sys.stdout.reconfigure(encoding="utf-8")

PDF_PATH = "hsk-words-visualized.pdf"
OUT_PATH = "pdf-hsk-words.json"
HSK_PATH = "complete-hsk.min.json"
CVDICT_PATH = "CVDICT.u8"

CELL = 30
TEXT_OFFSET_X = 10
TEXT_OFFSET_Y = 15.7360610961914
ORIGIN_X = 72
ORIGIN_Y = 65
RADICAL_REPLACEMENTS = str.maketrans(
    {
        "⻋": "车",
        "⼈": "人",
        "⼑": "刀",
        "⼏": "几",
        "⺠": "民",
        "⻄": "西",
        "⻅": "见",
        "⻜": "飞",
        "⻓": "长",
        "⻔": "门",
        "⻥": "鱼",
        "⻢": "马",
        "⻦": "鸟",
        "⻆": "角",
        "⻩": "黄",
        "⻚": "页",
        "⻁": "虎",
        "⻘": "青",
        "⻰": "龙",
        "⻉": "贝",
        "⻨": "麦",
        "⻮": "齿",
        "⻝": "食",
        "⻛": "风",
        "⻣": "骨",
        "⻤": "鬼",
        "⻬": "齐",
    }
)


def clean_word(text):
    original = re.sub(r"\s+", "", text.strip())
    normalized = unicodedata.normalize("NFKC", original).translate(RADICAL_REPLACEMENTS)
    if (
        len(original) == 2
        and original[0] != original[1]
        and len(normalized) == 2
        and normalized[0] == normalized[1]
    ):
        return normalized[0]
    return normalized


def compress_repeats(text):
    output = []
    for char in text:
        if not output or output[-1] != char:
            output.append(char)
    return "".join(output)


def load_lexicon():
    words = set()
    with open(HSK_PATH, "r", encoding="utf-8") as file:
        words.update(item["s"] for item in json.load(file))
    with open(CVDICT_PATH, "r", encoding="utf-8") as file:
        for line in file:
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                words.add(unicodedata.normalize("NFKC", parts[1]))
    return words


def level_for_cell(col, row):
    if 0 <= col <= 24 and 0 <= row <= 5:
        return 1
    if 0 <= col <= 24 and 6 <= row <= 11:
        return 2
    if 0 <= col <= 24 and 12 <= row <= 23:
        return 3
    if 25 <= col <= 49 and 0 <= row <= 23:
        return 4
    if 0 <= col <= 49 and 24 <= row <= 49:
        return 5
    if 50 <= col <= 99 and 0 <= row <= 49:
        return 6
    return None


doc = fitz.open(PDF_PATH)
page = doc[0]
cells = defaultdict(list)
lexicon = load_lexicon()

for x0, y0, x1, y1, text, *_ in page.get_text("words"):
    word = clean_word(text)
    if not word:
        continue
    col = round((x0 - ORIGIN_X - TEXT_OFFSET_X) / CELL)
    row = round((y0 - ORIGIN_Y - TEXT_OFFSET_Y) / CELL)
    level = level_for_cell(col, row)
    if level is None:
        continue
    cells[(level, row, col)].append({"word": word, "x": x0, "y": y0})

items = []
for (level, row, col), fragments in cells.items():
    raw_word = "".join(
        fragment["word"] for fragment in sorted(fragments, key=lambda item: (item["y"], item["x"]))
    )
    # PyMuPDF exposes some embedded duplicate glyphs from this PDF, especially at line wraps.
    compressed_word = compress_repeats(raw_word)
    word = raw_word if raw_word in lexicon else compressed_word
    items.append({"level": level, "col": col, "row": row, "word": word})

levels = []
for level in range(1, 7):
    words = [
        item["word"]
        for item in sorted(
            (item for item in items if item["level"] == level),
            key=lambda item: (item["row"], item["col"]),
        )
    ]
    levels.append({"level": level, "count": len(words), "words": words})

output = {"source": PDF_PATH, "levels": levels}
with open(OUT_PATH, "w", encoding="utf-8") as file:
    json.dump(output, file, ensure_ascii=False, separators=(",", ":"))
    file.write("\n")

print(" ".join(f"HSK{item['level']}:{item['count']}" for item in levels))
