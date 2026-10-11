filepath = "frontend/src/components/layout/Navbar.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('<div className="max-w-[85rem] mx-auto px-4 sm:px-6 lg:px-8">', '<div className="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8">')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
