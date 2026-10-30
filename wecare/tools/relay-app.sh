#!/bin/sh
# Runs tools/relay.py as "WeCare Relay.app", so a Mac can stand in for the
# third phone. Why an app: macOS kills a process that touches Bluetooth unless
# the app responsible for it declares Bluetooth use, and from a shell that app
# is the terminal. A bundle opened with `open` is its own responsible app.
#
#   SDK=~/offline-protocol-sdk tools/relay-app.sh     # log: /tmp/cr-relay.log
#   pkill -f tools/relay.py                           # stop
set -e
SDK=${SDK:-$HOME/offline-protocol-sdk}
PY="$SDK/bindings/python/.venv/bin/python"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/relay.py"
APP=/tmp/WeCareRelay.app
[ -x "$PY" ] || { echo "No SDK Python at $PY (see bindings/python/README.md)"; exit 1; }

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
# A compiled launcher, not a shell script: Launch Services refuses (-10669) a
# bundle whose executable is a script. It stays the parent, so the relay it
# spawns keeps this app as its responsible process.
cat > /tmp/cr-relay-launcher.c <<EOF
#include <fcntl.h>
#include <spawn.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>
extern char **environ;
int main(void) {
  setenv("PYTHONUNBUFFERED", "1", 1);
  int fd = open("/tmp/cr-relay.log", O_WRONLY | O_CREAT | O_TRUNC, 0644);
  dup2(fd, 1); dup2(fd, 2);
  char *argv[] = {"python", "$SCRIPT", 0};
  pid_t pid;
  if (posix_spawn(&pid, "$PY", 0, 0, argv, environ) != 0) return 1;
  int status; waitpid(pid, &status, 0);
  return WEXITSTATUS(status);
}
EOF
clang -O2 -o "$APP/Contents/MacOS/relay" /tmp/cr-relay-launcher.c
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.mizanxali.wecare.relay</string>
  <key>CFBundleName</key><string>WeCare Relay</string>
  <key>CFBundleExecutable</key><string>relay</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
  <key>NSBluetoothAlwaysUsageDescription</key><string>WeCare Relay carries sealed visit records between nearby phones.</string>
</dict></plist>
EOF
codesign --force --sign - "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP"
open -n "$APP"
echo "WeCare Relay started. Watch: tail -f /tmp/cr-relay.log"
