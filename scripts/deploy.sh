#!/usr/bin/env bash
# Full deploy pipeline for MiraiHub Front: optional version bump, web build +
# deploy, Android APK build + deploy. Mirrors the manual sequence used for
# every release so far — see MiraiHub-Front/README.md and the version-bump
# convention in feedback_miraihub_versioning.
#
# Usage:
#   ./scripts/deploy.sh none                                    # redeploy only, no version bump
#   ./scripts/deploy.sh patch "Fixed the X bug" "Cleaned up Y"
#   ./scripts/deploy.sh minor "Added Z feature"
set -euo pipefail

FRONT_DIR="/home/denanz/MiraiHub-Front"
DEPLOY_TARGET="/home/denanz/services/html/anixartex"
ANDROID_HOME_PATH="/home/denanz/android-sdk"
JAVA_HOME_PATH="/usr/lib/jvm/java-21-openjdk-amd64"

BUMP="${1:-}"
shift || true

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "none" ]]; then
  echo "Usage: $0 <patch|minor|none> [\"changelog line\" ...]" >&2
  exit 1
fi

cd "$FRONT_DIR"

if [[ "$BUMP" != "none" ]]; then
  if [[ $# -eq 0 ]]; then
    echo "Provide at least one changelog line when bumping the version." >&2
    exit 1
  fi
  echo "== bumping version ($BUMP) =="
  node scripts/bump-version.mjs "$BUMP" "$@"
fi

echo "== typecheck =="
npx tsc --noEmit

echo "== build web =="
npm run build

echo "== deploy web =="
rsync -a --delete --exclude=prototype --exclude=mirai.apk dist/ "$DEPLOY_TARGET/"

echo "== sync android =="
npx cap sync android

echo "== build apk =="
(cd android && ANDROID_HOME="$ANDROID_HOME_PATH" JAVA_HOME="$JAVA_HOME_PATH" ./gradlew assembleRelease --no-daemon)

APK_BUILT="android/app/build/outputs/apk/release/app-release.apk"

# Страховка: если keystore.properties не нашёлся, gradle соберёт неподписанный APK
# (имя тогда оканчивается на -unsigned). Такой файл нельзя установить, и уехать
# в прод он не должен — лучше упасть здесь, чем раздавать битое обновление.
if [ ! -f "$APK_BUILT" ]; then
  echo "ERROR: $APK_BUILT не собран — вероятно, нет android/keystore.properties" >&2
  exit 1
fi
# build-tools может быть установлено несколько версий, поэтому берём самую свежую
# явно: голый глоб развернулся бы в несколько путей и сломал вызов.
APKSIGNER="$(ls -d "$ANDROID_HOME_PATH"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)"
if [ -z "$APKSIGNER" ]; then
  echo "ERROR: apksigner не найден в $ANDROID_HOME_PATH/build-tools" >&2
  exit 1
fi
if ! "$APKSIGNER" verify "$APK_BUILT" >/dev/null 2>&1; then
  echo "ERROR: APK не подписан или подпись невалидна — выкат остановлен" >&2
  exit 1
fi
echo "подпись: $("$APKSIGNER" verify --print-certs "$APK_BUILT" | grep -m1 'certificate DN')"

cp "$APK_BUILT" "$DEPLOY_TARGET/mirai.apk"

# Уведомление об обновлении внутри приложения. Без этого шага пользователи не
# увидят предложение обновиться и останутся на старом APK.
if [ -f app-version.json ]; then
  echo "== publish app-version.json =="
  docker cp app-version.json miraihub:/app/.state/app-version.json
  docker exec miraihub sh -c 'cat /app/.state/app-version.json' | head -3
fi

echo "== done =="
grep -m1 "versionName" android/app/build.gradle
diff -q dist/index.html "$DEPLOY_TARGET/index.html" >/dev/null && echo "web index in sync" || echo "WARNING: web index mismatch"
