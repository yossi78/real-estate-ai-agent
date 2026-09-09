#!/usr/bin/env python3
"""Keep an ngrok tunnel to the Vite frontend alive and sync its URL into README.md."""

from __future__ import annotations

import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
PID_FILE = ROOT / ".ngrok-watchdog.pid"
LOG_FILE = ROOT / ".ngrok-watchdog.log"
NGROK_API = "http://127.0.0.1:4040/api/tunnels"
LOCAL_PORT = os.environ.get("NGROK_LOCAL_PORT", "5173")
INTERVAL_SEC = 1

DASHBOARD_RE = re.compile(r"(- Dashboard: )https://\S+")
HEALTH_RE = re.compile(r"(- Health: )https://\S+/health")


def log(message: str) -> None:
    line = time.strftime("%Y-%m-%d %H:%M:%S") + f" {message}\n"
    try:
        with LOG_FILE.open("a", encoding="utf-8") as handle:
            handle.write(line)
    except OSError:
        pass


def pid_is_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def read_pid(path: Path) -> int | None:
    try:
        raw = path.read_text(encoding="utf-8").strip()
        return int(raw) if raw else None
    except (OSError, ValueError):
        return None


def watchdog_running() -> int | None:
    pid = read_pid(PID_FILE)
    if pid and pid_is_alive(pid) and pid != os.getpid():
        return pid
    return None


def ngrok_running() -> bool:
    try:
        result = subprocess.run(
            ["pgrep", "-x", "ngrok"],
            check=False,
            capture_output=True,
        )
    except OSError:
        return False
    return result.returncode == 0


def public_url() -> str | None:
    try:
        with urllib.request.urlopen(NGROK_API, timeout=0.8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    for tunnel in payload.get("tunnels", []):
        url = tunnel.get("public_url") or ""
        if isinstance(url, str) and url.startswith("https://"):
            return url.rstrip("/")
    return None


def start_ngrok() -> None:
    if ngrok_running():
        return
    log(f"starting ngrok http {LOCAL_PORT}")
    ngrok_log = (ROOT / ".ngrok.log").open("a", encoding="utf-8")
    subprocess.Popen(
        ["ngrok", "http", LOCAL_PORT, "--log=stdout"],
        stdout=ngrok_log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        cwd=str(ROOT),
    )


def update_readme(url: str) -> None:
    try:
        text = README.read_text(encoding="utf-8")
    except OSError as error:
        log(f"readme read failed: {error}")
        return
    updated = DASHBOARD_RE.sub(rf"\g<1>{url}", text, count=1)
    updated = HEALTH_RE.sub(rf"\g<1>{url}/health", updated, count=1)
    if updated == text:
        return
    tmp = README.with_name(".README.md.tmp")
    tmp.write_text(updated, encoding="utf-8")
    tmp.replace(README)
    log(f"readme updated {url}")


def daemonize() -> None:
    if os.fork() > 0:
        os._exit(0)
    os.setsid()
    if os.fork() > 0:
        os._exit(0)
    os.chdir(str(ROOT))
    os.umask(0)
    sys.stdin.close()
    log_handle = LOG_FILE.open("a", encoding="utf-8")
    os.dup2(log_handle.fileno(), 1)
    os.dup2(log_handle.fileno(), 2)


def stop() -> int:
    pid = watchdog_running()
    if not pid:
        print("ngrok watchdog is not running")
        return 0
    os.kill(pid, signal.SIGTERM)
    for _ in range(20):
        if not pid_is_alive(pid):
            break
        time.sleep(0.1)
    PID_FILE.unlink(missing_ok=True)
    print(f"stopped ngrok watchdog (pid {pid})")
    return 0


def loop() -> None:
    last_url: str | None = None
    log("watchdog started")
    while True:
        url = public_url()
        if url:
            if url != last_url:
                update_readme(url)
                last_url = url
                log(f"tunnel ok {url}")
        else:
            start_ngrok()
        time.sleep(INTERVAL_SEC)


def main() -> int:
    args = sys.argv[1:]
    if "--stop" in args:
        return stop()
    existing = watchdog_running()
    if existing:
        print(f"ngrok watchdog already running (pid {existing})")
        return 0
    if "--foreground" not in args:
        daemonize()
    PID_FILE.write_text(str(os.getpid()), encoding="utf-8")
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    try:
        loop()
    finally:
        if read_pid(PID_FILE) == os.getpid():
            PID_FILE.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
