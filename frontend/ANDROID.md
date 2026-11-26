# KaamSetu Android prototype

This branch packages the existing Vite React UI into a local Capacitor Android WebView. No remote website wrapper or new database is required.

## Windows build
Install Node.js 22 (22.12+), Android Studio, JDK 21 and Android SDK 35. Configure JAVA_HOME and ANDROID_HOME and accept Android SDK licenses. From the repository root run:

```powershell
powershell -ExecutionPolicy Bypass -File frontend/scripts/build-android.ps1
```

The script uses the existing web lockfile, installs pinned Capacitor 7.0.0 packages without changing it, builds with the public Render API URL, generates the native project if absent and builds a debug APK. Install the APK on a test device or emulator. No signing secrets or database credentials belong in the frontend.

## Backend prerequisite
The live backend must allow the exact Capacitor origin https://localhost alongside the existing web frontend. This branch includes that change; it is not deployed until reviewed and merged. Alternatively the existing FRONTEND_URL setting accepts comma-separated origins.

## Acceptance checks
Test worker/employer/admin login, registration, logout, cold starts, navigation/back button, job search, applications, chat, notifications, localization, maps/location and file uploads on an Android device. Browser APIs and native permissions may need further integration; push notifications, secure token storage, app branding and release signing are not implemented. Existing localStorage auth is retained for compatibility, not a production security recommendation. Resolve existing database access controls before real-user distribution. Debug APK is for testing only.
