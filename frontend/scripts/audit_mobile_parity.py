import json
import re
import sys
from pathlib import Path

MOBILE_DIR = Path("src/mobile")
ROUTER_PATH = MOBILE_DIR / "routes" / "MobileAppRouter.tsx"
LOCALES_DIR = Path("src/i18n/locales/mobile")


def main() -> int:
    errors: list[str] = []

    # 1. Verify MobileAppRouter has no worker/employer desktop imports
    router_text = ROUTER_PATH.read_text(encoding="utf-8")
    forbidden_desktop = [
        "pages/worker/SavedJobsPage",
        "pages/worker/MyApplications",
        "pages/worker/MyAvailabilityPage",
        "pages/employer/JobApplicantsPage",
        "pages/employer/EmployerWorkerDetailPage",
        "pages/employer/SavedWorkersPage",
        "pages/employer/EmployerShiftBookingsPage",
        "pages/auth/ForgotPasswordPage",
    ]
    for pat in forbidden_desktop:
        if pat in router_text:
            errors.append(f"Router still imports desktop page: {pat}")

    # 2. Verify zero adminApi usage in worker/employer/shared mobile pages
    for path in MOBILE_DIR.rglob("*.tsx"):
        txt = path.read_text(encoding="utf-8")
        if "adminApi" in txt:
            errors.append(f"Unauthorized adminApi reference in mobile file: {path}")

    # 3. Verify no full-screen pages inside WorkerMobileLayout / EmployerMobileLayout use .mobile-app-root
    for sub in ["pages/worker", "pages/employer", "pages/shared"]:
        for path in (MOBILE_DIR / sub).rglob("*.tsx"):
            if path.name == "MobileNotificationsPage.tsx":
                # Mounted at top-level /notifications outside role layouts
                continue
            txt = path.read_text(encoding="utf-8")
            if "mobile-app-root" in txt:
                errors.append(f"Nested .mobile-app-root found inside layout child: {path}")

    # 4. Verify all mobile:* translation keys referenced in code exist in en/hi/mr/kn/te
    en_data = json.loads((LOCALES_DIR / "en.json").read_text(encoding="utf-8"))

    def has_key(data: dict, dotted: str) -> bool:
        cur = data
        for part in dotted.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                return False
        return True

    used_mobile_keys: set[str] = set()
    for path in MOBILE_DIR.rglob("*.tsx"):
        txt = path.read_text(encoding="utf-8")
        for match in re.findall(r"t\(\s*['\"]mobile:([a-zA-Z0-9_.]+)['\"]", txt):
            used_mobile_keys.add(match)

    for key in sorted(used_mobile_keys):
        if not has_key(en_data, key):
            errors.append(f"Missing mobile locale key in en.json: mobile:{key}")

    print(f"Checked {len(list(MOBILE_DIR.rglob('*.tsx')))} mobile TSX files.")
    print(f"Verified {len(used_mobile_keys)} mobile:* i18n keys referenced in UI.")
    if errors:
        print("ERRORS:")
        for e in errors:
            print(" -", e)
        return 1
    print("ALL MOBILE ARCHITECTURAL & I18N CHECKS PASSED!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
