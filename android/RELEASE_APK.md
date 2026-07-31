# Building a signed release APK (Healthy Hub)

Output: `android/app/build/outputs/apk/release/app-release.apk` — signed, self-contained, installable on any Android 6+ device.

## 0. Prerequisites (local machine, one time)
- Java JDK 17
- Android Studio / Android SDK (compileSdk 35)
- Project exported to GitHub and cloned locally, then `npm install`

## 1. Create your keystore (one time — back it up!)
```bash
cd android
keytool -genkey -v -keystore healthyhub-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias healthyhub
```
Losing this file means you can never update the app on Play Store.

## 2. Add your credentials
```bash
cp keystore.properties.example keystore.properties
# edit keystore.properties with your real passwords
```
`keystore.properties` and `*.jks` are git-ignored.

CI alternative — set env vars instead of the file:
`ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## 3. Build the web bundle in PROD mode
Do **not** set `CAP_ENV=dev` — the APK must ship bundled assets, not the sandbox URL.
```bash
npm run build
npx cap sync android
```

## 4. Assemble the signed APK
```bash
npm run android:release
# = cd android && ./gradlew clean assembleRelease
```
Result: `android/app/build/outputs/apk/release/app-release.apk`

Install it directly:
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## 5. Verify the signature
```bash
$ANDROID_HOME/build-tools/35.0.0/apksigner verify --print-certs \
  android/app/build/outputs/apk/release/app-release.apk
```

## Play Store bundle (optional)
```bash
cd android && ./gradlew bundleRelease
# android/app/build/outputs/bundle/release/app-release.aab
```

## Notes
- `applicationId` is `app.healthyhub.mobile`. Change it before your first Play Store upload if you want a different id — it can never be changed afterwards.
- Bump `versionCode` / `versionName` in `android/app/build.gradle` for every new release.
- If Gradle warns "No release keystore found", step 2 was skipped and the APK will be unsigned.
