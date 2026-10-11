filepath = "frontend/src/components/public/HeroCarousel.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    '<div className="container-page lg:!pl-2 lg:!pr-14 relative z-10 w-full py-12 lg:py-24">',
    '<div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 relative z-10 w-full py-12 lg:py-24">'
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
