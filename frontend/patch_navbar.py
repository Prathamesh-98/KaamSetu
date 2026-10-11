filepath = "src/components/layout/Navbar.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

if "import NotificationDropdown" not in content:
    content = content.replace(
        "import LanguageSelector from './LanguageSelector'",
        "import LanguageSelector from './LanguageSelector'\nimport NotificationDropdown from './NotificationDropdown'"
    )

    content = content.replace(
        "<LanguageSelector isTransparent={isTransparent} />\n                <div className=\"flex items-center gap-2\">",
        "<LanguageSelector isTransparent={isTransparent} />\n                <NotificationDropdown isTransparent={isTransparent} />\n                <div className=\"flex items-center gap-2\">"
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Added NotificationDropdown to Navbar")
