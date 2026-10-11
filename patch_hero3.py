filepath = "frontend/src/components/public/HeroCarousel.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re
content = re.sub(
    r'<div className="max-w-\[90rem\] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 relative z-10 w-full py-12 lg:py-24">',
    '<div className="w-full max-w-[96rem] mx-auto px-4 sm:px-6 lg:pl-[3.5rem] lg:pr-[3.5rem] relative z-10 py-12 lg:py-24">',
    content
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
