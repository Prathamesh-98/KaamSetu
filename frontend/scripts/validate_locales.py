import json
import re
import sys
from pathlib import Path

locales_dir = Path(__file__).resolve().parent.parent / "src" / "i18n" / "locales"
languages = ["en", "hi", "mr", "kn", "te"]

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

print("=== KAAMSETU LOCALE VALIDATION AUDIT ===")

errors = []
namespaces = [
    ("translation", locales_dir),
    ("mobile", locales_dir / "mobile"),
]

total_keys_checked = 0

for ns_name, ns_dir in namespaces:
    if not ns_dir.exists():
        errors.append(f"[{ns_name}] Directory {ns_dir} does not exist!")
        continue

    flattened_data = {}
    for lang in languages:
        fpath = ns_dir / f"{lang}.json"
        if not fpath.exists():
            errors.append(f"[{ns_name}/{lang.upper()}] {fpath} does not exist!")
            continue
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
                flattened_data[lang] = flatten_dict(data)
                print(f"[{ns_name}:{lang.upper()}] Valid JSON | Leaf keys: {len(flattened_data[lang])}")
        except Exception as e:
            errors.append(f"[{ns_name}/{lang.upper()}] Error parsing {fpath}: {e}")

    if len(flattened_data) == len(languages):
        en_keys = set(flattened_data["en"].keys())
        total_keys_checked += len(en_keys)

        for lang in ["hi", "mr", "kn", "te"]:
            curr_keys = set(flattened_data[lang].keys())
            missing_in_lang = en_keys - curr_keys
            extra_in_lang = curr_keys - en_keys
            if missing_in_lang:
                errors.append(f"[{ns_name}:{lang.upper()}] Missing {len(missing_in_lang)} keys present in EN: {list(missing_in_lang)[:5]}")
            if extra_in_lang:
                errors.append(f"[{ns_name}:{lang.upper()}] Has {len(extra_in_lang)} extra keys not in EN: {list(extra_in_lang)[:5]}")

        for lang in languages:
            flat = flattened_data[lang]
            for k, v in flat.items():
                if not str(v).strip():
                    errors.append(f"[{ns_name}:{lang.upper()}] Key '{k}' is empty!")
                if lang != "en":
                    en_val = flattened_data["en"].get(k, "")
                    en_vars = extract_interpolation_vars(en_val)
                    lang_vars = extract_interpolation_vars(v)
                    if en_vars != lang_vars:
                        errors.append(f"[{ns_name}:{lang.upper()}] Key '{k}' interpolation mismatch! EN has {en_vars}, {lang} has {lang_vars}")

print("\n--- VALIDATION SUMMARY ---")
if errors:
    print(f"FAILED with {len(errors)} error(s):")
    for err in errors:
        print(f"  - {err}")
    sys.exit(1)
else:
    print(f"SUCCESS: 100% key parity across all 5 locales ({total_keys_checked} total leaf keys per language across translation + mobile)!")
    print("Zero missing keys, zero empty translations, 100% interpolation placeholder consistency.")
    sys.exit(0)
