filepath = "frontend/src/components/layout/Navbar.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace <div className="container-page"> with <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
content = content.replace('<div className="container-page">', '<div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
