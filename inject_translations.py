import json
import glob
import os

keys = {
    "worker.availability": {
        "en": "My Availability",
        "hi": "मेरी उपलब्धता",
        "mr": "माझी उपलब्धता",
        "kn": "ನನ್ನ ಲಭ್ಯತೆ",
        "te": "నా లభ్యత"
    },
    "worker.shifts": {
        "en": "My Shifts",
        "hi": "मेरी शिफ्ट्स",
        "mr": "माझ्या शिफ्ट्स",
        "kn": "ನನ್ನ ಶಿಫ್ಟ್‌ಗಳು",
        "te": "నా షిఫ్ట్‌లు"
    },
    "employer.shifts": {
        "en": "Shift Management",
        "hi": "शिफ्ट प्रबंधन",
        "mr": "शिफ्ट व्यवस्थापन",
        "kn": "ಶಿಫ್ಟ್ ನಿರ್ವಹಣೆ",
        "te": "షిఫ్ట్ నిర్వహణ"
    },
    "action.requestShift": {
        "en": "Request Shift",
        "hi": "शिफ्ट का अनुरोध करें",
        "mr": "शिफ्टची विनंती करा",
        "kn": "ಶಿಫ್ಟ್ ವಿನಂತಿಸಿ",
        "te": "షిఫ్ట్ అభ్యర్థించండి"
    }
}

for lang in ["en", "hi", "mr", "kn", "te"]:
    filepath = f"frontend/src/i18n/locales/{lang}.json"
    if not os.path.exists(filepath):
        continue
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    for key_path, translations in keys.items():
        parts = key_path.split('.')
        current = data
        for i, part in enumerate(parts):
            if i == len(parts) - 1:
                current[part] = translations[lang]
            else:
                if part not in current:
                    current[part] = {}
                current = current[part]
                
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("Translations injected.")
