content = ""
with open("src/main.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if "react-hot-toast" not in content:
    content = content.replace("import AppRouter from './routes/AppRouter'", "import AppRouter from './routes/AppRouter'\nimport { Toaster } from 'react-hot-toast'")
    content = content.replace("<AppRouter />", "<AppRouter />\n        <Toaster position=\"top-right\" />")

with open("src/main.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Added Toaster to main.tsx")
