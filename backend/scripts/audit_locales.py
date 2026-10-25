import json
import re
from pathlib import Path

locales_dir = Path("frontend/src/i18n/locales")
langs = ["en", "hi", "mr", "kn", "te"]

def flatten_dict(d, prefix=""):
    items = {}
    for k, v in d.items():
        new_k = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.update(flatten_dict(v, new_k))
        else:
            items[new_k] = v
    return items

def extract_interpolation_vars(text):
    if not isinstance(text, str):
        return set()
    return set(re.findall(r"\{\{([^}]+)\}\}", text))

data = {}
flattened = {}

print("1. Parsing JSON files...")
for lang in langs:
    path = locales_dir / f"{lang}.json"
    try:
        with open(path, "r", encoding="utf-8") as f:
            data[lang] = json.load(f)
            flattened[lang] = flatten_dict(data[lang])
            print(f"  {lang}.json: valid JSON, {len(flattened[lang])} leaf keys.")
    except Exception as e:
        print(f"  ERROR reading {lang}.json: {e}")

en_keys = set(flattened.get("en", {}).keys())

print("\n2. Key Parity Check against en.json:")
for lang in ["hi", "mr", "kn", "te"]:
    lang_keys = set(flattened.get(lang, {}).keys())
    missing = en_keys - lang_keys
    extra = lang_keys - en_keys
    print(f"  {lang}: {len(missing)} missing keys, {len(extra)} extra keys.")
    if missing:
        print(f"    Sample missing ({min(10, len(missing))}): {list(missing)[:10]}")

print("\n3. Interpolation Variable Consistency:")
for lang in ["hi", "mr", "kn", "te"]:
    mismatches = []
    for k in en_keys:
        if k in flattened.get(lang, {}):
            en_vars = extract_interpolation_vars(flattened["en"][k])
            lang_vars = extract_interpolation_vars(flattened[lang][k])
            if en_vars != lang_vars:
                mismatches.append((k, en_vars, lang_vars))
    print(f"  {lang}: {len(mismatches)} interpolation variable mismatches.")
    for m in mismatches[:5]:
        print(f"    Key '{m[0]}': EN={m[1]} vs {lang}={m[2]}")

print("\n4. Scanning Codebase for Used Keys...")
src_dir = Path("frontend/src")
used_keys = set()
hardcoded_candidates = []

t_pattern = re.compile(r"""(?:t\(\s*['"]([^'"]+)['"]|i18nKey=['"]([^'"]+)['"])""")

for f in src_dir.rglob("*.tsx"):
    try:
        txt = f.read_text(encoding="utf-8")
        for match in t_pattern.finditer(txt):
            key = match.group(1) or match.group(2)
            if key:
                used_keys.add(key)
    except Exception:
        pass

for f in src_dir.rglob("*.ts"):
    if "locales" in str(f):
        continue
    try:
        txt = f.read_text(encoding="utf-8")
        for match in t_pattern.finditer(txt):
            key = match.group(1) or match.group(2)
            if key:
                used_keys.add(key)
    except Exception:
        pass

missing_in_en = used_keys - en_keys
# Filter dynamic keys like categories.${cat} or templates
static_missing_in_en = [k for k in missing_in_en if not ("$" in k or "{" in k)]
print(f"  Total distinct translation keys referenced in code: {len(used_keys)}")
print(f"  Referenced keys missing in en.json: {len(static_missing_in_en)}")
if static_missing_in_en:
    print(f"  Missing referenced keys sample: {static_missing_in_en[:20]}")

unused_en = en_keys - used_keys
print(f"  Keys in en.json not directly matched statically: {len(unused_en)}")
