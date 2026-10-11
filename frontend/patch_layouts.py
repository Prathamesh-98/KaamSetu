import re

for layout in ["src/layouts/WorkerLayout.tsx", "src/layouts/EmployerLayout.tsx"]:
    with open(layout, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "import NotificationDropdown" not in content:
        content = content.replace(
            "import LanguageSelector from '../components/layout/LanguageSelector'",
            "import LanguageSelector from '../components/layout/LanguageSelector'\nimport NotificationDropdown from '../components/layout/NotificationDropdown'"
        )

        pattern = r'<button className="p-2 rounded-full text-gray-400 hover:text-\[#2455E8\] hover:bg-gray-50 \s*transition-colors relative">\s*<Bell className="w-5 h-5" />\s*</button>'
        
        content = re.sub(pattern, '<NotificationDropdown isTransparent={false} />', content)
        
        with open(layout, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Patched {layout}")
