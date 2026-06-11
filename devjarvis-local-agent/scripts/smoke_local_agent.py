from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

DEFAULT_BASE_URL = "http://127.0.0.1:17997"
DEFAULT_TIMEOUT_SECONDS = 3.0


@dataclass(frozen=True)
class SmokeCheck:
    name: str
    path: str
    method: str = "GET"
    body: dict[str, Any] | None = None
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS


def main() -> int:
    parser = argparse.ArgumentParser(description="Run DevJarvis Local Agent loopback smoke checks.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    if not _is_loopback_base_url(base_url):
        print("FAIL base-url must point to localhost or 127.0.0.1", file=sys.stderr)
        return 2

    checks = [
        SmokeCheck("app health", "/health"),
        SmokeCheck("ocr health", "/internal/local-ocr/health"),
        SmokeCheck("llm health", "/internal/local-llm/health"),
        SmokeCheck(
            "deterministic math",
            "/internal/local-llm/analyze",
            method="POST",
            body={
                "commandId": "smoke-local-math",
                "intent": "screen_math_solver",
                "text": "12 × 3 + 4 =",
                "context": "inputSource=smoke_test",
            },
            timeout_seconds=10.0,
        ),
    ]

    failed = False
    for check in checks:
        try:
            payload = _request_json(base_url, check)
            _assert_success_payload(check, payload)
            print(f"OK   {check.name}")
        except Exception as error:  # noqa: BLE001 - smoke script should print concise failures.
            failed = True
            print(f"FAIL {check.name}: {error}", file=sys.stderr)

    return 1 if failed else 0


def _request_json(base_url: str, check: SmokeCheck) -> dict[str, Any]:
    data = None
    headers = {"Accept": "application/json"}
    if check.body is not None:
        data = json.dumps(check.body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        f"{base_url}{check.path}",
        data=data,
        headers=headers,
        method=check.method,
    )

    try:
        with urllib.request.urlopen(request, timeout=check.timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {body[:240]}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(str(error.reason)) from error


def _assert_success_payload(check: SmokeCheck, payload: dict[str, Any]) -> None:
    if payload.get("success") is not True:
        raise RuntimeError(payload.get("error") or "success flag is not true")

    data = payload.get("data")
    if not isinstance(data, dict):
        raise RuntimeError("data object is missing")

    if check.name == "app health":
        if data.get("status") != "UP" or data.get("loopbackOnly") is not True:
            raise RuntimeError("app health does not confirm loopback-only UP state")

    if check.name == "deterministic math":
        summary = str(data.get("summary") or "")
        detail = str(data.get("detail") or "")
        if "40" not in f"{summary}\n{detail}":
            raise RuntimeError("math smoke check did not return the expected result")


def _is_loopback_base_url(value: str) -> bool:
    return value.startswith("http://127.0.0.1:") or value.startswith("http://localhost:")


if __name__ == "__main__":
    raise SystemExit(main())
