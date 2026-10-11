filepath = "frontend/src/components/layout/Navbar.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the current div
import re
content = re.sub(
    r'<div className="max-w-\[96rem\] mx-auto px-4 sm:px-6 lg:px-8">',
    '<div className="w-full max-w-[96rem] mx-auto px-4 sm:px-6 lg:pl-[4rem] lg:pr-[2.5rem]">',
    content
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
