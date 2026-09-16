#!/bin/sh
# Build the Swift package and assemble a runnable .app at mac/build/ReadingList.app.
# `bun run mac build` / `bun run mac run` call this; it also works on its own.
#
#   sh mac/scripts/bundle.sh          # debug (the debug control socket is compiled in)
#   sh mac/scripts/bundle.sh release
set -eu
cd "$(dirname "$0")/.."
CONFIG="${1:-debug}"

# The markdown editor page the app hosts in a web view (editor-host/).
(cd .. && bun run --silent build:editor >/dev/null)
swift build -c "$CONFIG" --product ReadingList
BIN_DIR="$(# The markdown editor page the app hosts in a web view (editor-host/).
(cd .. && bun run --silent build:editor >/dev/null)
swift build -c "$CONFIG" --product ReadingList --show-bin-path)"

APP="build/ReadingList.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/ReadingList" "$APP/Contents/MacOS/ReadingList"
# SwiftPM resource bundles (fonts, assets) ride along in Contents/Resources.
for bundle in "$BIN_DIR"/*.bundle; do
  [ -e "$bundle" ] && cp -R "$bundle" "$APP/Contents/Resources/"
done
# The plist is written for the dev bundle (its own id and url scheme); a
# release build takes the real ones.
if [ "$CONFIG" = "release" ]; then
  sed -e 's/readinglist-mac-dev/readinglist-mac/' -e 's/com.khalidbelhadj.readinglist.dev/com.khalidbelhadj.readinglist/' -e 's/Reading List Dev/Reading List/' Info.plist > "$APP/Contents/Info.plist"
else
  cp Info.plist "$APP/Contents/Info.plist"
fi
# Ad-hoc signature: enough for the app to launch as a bundle on this machine.
codesign --force --sign - "$APP" >/dev/null 2>&1
# Tell LaunchServices about this bundle (its url scheme in particular), so
# the sign-in deep link reaches it rather than an older copy.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true
echo "built $APP ($CONFIG)"
