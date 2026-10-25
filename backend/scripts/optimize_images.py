import os
from pathlib import Path
from PIL import Image

images_dir = Path("frontend/public/images")
primary_files = [
    "mechanic.jpg.jpg",
    "electrical-team.jpg.jpg",
    "textile-worker.jpg.jpg",
    "carpenter.jpg.jpg",
    "plumber.jpg.jpg",
    "brick-workers.jpg.jpg",
    "agricultural-workers.jpg.jpg",
    "electrician.jpg.jpg"
]

workers_dir = images_dir / "workers"
worker_files = [f.name for f in workers_dir.glob("*.jpg") if not f.name.endswith(".webp")]

results = []

print("=== OPTIMIZING PRIMARY HERO/CATEGORY ASSETS ===")
for fname in primary_files:
    in_path = images_dir / fname
    if not in_path.exists():
        print(f"Skipping {fname}, does not exist")
        continue
    
    orig_size = in_path.stat().st_size
    base_name = fname.replace(".jpg.jpg", "")
    webp_out = images_dir / f"{base_name}.webp"
    clean_jpg_out = images_dir / f"{base_name}.jpg"
    
    with Image.open(in_path) as im:
        orig_w, orig_h = im.size
        # Resize if width > 1920
        if orig_w > 1920:
            new_w = 1920
            new_h = int(orig_h * (1920 / orig_w))
            im_resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
        else:
            new_w, new_h = orig_w, orig_h
            im_resized = im.copy()
        
        # Save as WebP
        im_resized.save(webp_out, format="WEBP", quality=82, method=6)
        webp_size = webp_out.stat().st_size
        
        # Also save clean jpg fallback
        im_resized.save(clean_jpg_out, format="JPEG", quality=82, optimize=True)
        jpg_size = clean_jpg_out.stat().st_size

    results.append({
        "name": fname,
        "base_name": base_name,
        "type": "primary",
        "orig_dim": f"{orig_w}x{orig_h}",
        "new_dim": f"{new_w}x{new_h}",
        "orig_size": orig_size,
        "webp_size": webp_size,
        "savings_pct": round((1 - (webp_size / orig_size)) * 100, 2)
    })
    print(f"Processed {fname}: {orig_size:,} B -> {webp_size:,} B WebP ({results[-1]['savings_pct']}% saved)")

print("\n=== OPTIMIZING WORKER THUMBNAILS ===")
for fname in worker_files:
    in_path = workers_dir / fname
    orig_size = in_path.stat().st_size
    base_name = in_path.stem
    webp_out = workers_dir / f"{base_name}.webp"
    
    with Image.open(in_path) as im:
        orig_w, orig_h = im.size
        if orig_w > 1024 or orig_h > 1024:
            scale = min(1024 / orig_w, 1024 / orig_h)
            new_w = int(orig_w * scale)
            new_h = int(orig_h * scale)
            im_resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
        else:
            new_w, new_h = orig_w, orig_h
            im_resized = im.copy()
        
        im_resized.save(webp_out, format="WEBP", quality=82, method=6)
        webp_size = webp_out.stat().st_size

    results.append({
        "name": f"workers/{fname}",
        "base_name": base_name,
        "type": "worker",
        "orig_dim": f"{orig_w}x{orig_h}",
        "new_dim": f"{new_w}x{new_h}",
        "orig_size": orig_size,
        "webp_size": webp_size,
        "savings_pct": round((1 - (webp_size / orig_size)) * 100, 2)
    })
    print(f"Processed workers/{fname}: {orig_size:,} B -> {webp_size:,} B WebP ({results[-1]['savings_pct']}% saved)")

total_orig = sum(r["orig_size"] for r in results)
total_webp = sum(r["webp_size"] for r in results)
overall_savings = round((1 - (total_webp / total_orig)) * 100, 2)

print(f"\nTOTAL BEFORE: {total_orig:,} bytes ({round(total_orig/(1024*1024), 2)} MB)")
print(f"TOTAL AFTER (WebP): {total_webp:,} bytes ({round(total_webp/(1024*1024), 2)} MB)")
print(f"TOTAL SAVED: {round(overall_savings, 2)}% reduction!")

import json
with open("backend/scripts/optimization_metrics.json", "w") as f:
    json.dump({
        "total_orig_bytes": total_orig,
        "total_webp_bytes": total_webp,
        "savings_pct": overall_savings,
        "items": results
    }, f, indent=2)
