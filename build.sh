#!/usr/bin/env bash
set -euo pipefail

# 스크립트가 있는 디렉터리 기준으로 실행
cd "$(dirname "$0")"

RELEASE_DIR="release"
# 기존 release 폴더 정리 후 재생성
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# 실행에 필요한 파일만 복사
cp style.css "$RELEASE_DIR/"
cp app.js    "$RELEASE_DIR/"

# index.html에서 tests.js 스크립트 태그 제거 후 복사
grep -v 'tests\.js' index.html > "$RELEASE_DIR/index.html"

echo "빌드 완료: $RELEASE_DIR/"
ls -lh "$RELEASE_DIR/"
