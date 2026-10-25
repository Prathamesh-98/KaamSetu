import re
from pathlib import Path

src_dir = Path("frontend/src")
public_dir = Path("frontend/public")

image_names = [
    "mechanic", "electrical-team", "textile-worker", "carpenter",
    "plumber", "brick-workers", "agricultural-workers", "electrician",
    "construction", "farming", "electrical", "tech", "domestic",
    "driving", "painting", "hero"
]

pattern = re.compile(r"""(?:['"`])(/images/[^'"`]+)(?:['"`])""")

refs = []
for file in list(src_dir.rglob("*.tsx")) + list(src_dir.rglob("*.ts")) + list(public_dir.rglob("*.html")):
    try:
        content = file.read_text(encoding="utf-8")
        for idx, line in enumerate(content.splitlines(), 1):
            for m in pattern.finditer(line):
                refs.append({
                    "file": str(file),
                    "line": idx,
                    "match": m.group(1),
                    "text": line.strip()
                })
    except Exception:
        pass

print(f"Found {len(refs)} image references:")
for r in refs:
    print(f"{r['file']}:{r['line']} -> {r['match']}")
