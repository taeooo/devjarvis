from __future__ import annotations

import re
from dataclasses import dataclass

_SECRET_ASSIGNMENT_PATTERN = re.compile(
    r"(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\b\s*[:=]\s*([^\s,;]+)"
)
_BEARER_PATTERN = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._\-~+/]+=*")
_JWT_PATTERN = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")
_AWS_ACCESS_KEY_PATTERN = re.compile(r"\b(AKIA|ASIA)[A-Z0-9]{16}\b")
_EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_WINDOWS_USER_PATH_PATTERN = re.compile(r"(?i)\b([A-Z]:\\Users\\)([^\\\s]+)")
_UNIX_HOME_PATH_PATTERN = re.compile(r"(?<!\w)(/home/)([^/\s]+)")
_IPV4_PATTERN = re.compile(r"\b(?!(?:127|0)\.)(?:\d{1,3}\.){3}\d{1,3}\b")

_MAX_ACTION_ITEMS = 4


@dataclass(frozen=True)
class SanitizedScreenText:
    text: str
    warnings: list[str]
    original_length: int
    sanitized_length: int


def sanitize_screen_text(text: str, max_chars: int) -> SanitizedScreenText:
    normalized = _normalize_text(text)
    warnings: list[str] = []

    sanitized = normalized
    sanitized, count = _SECRET_ASSIGNMENT_PATTERN.subn(lambda m: f"{m.group(1)}=<redacted>", sanitized)
    if count:
        warnings.append("Sensitive key/value patterns were redacted before analysis.")

    sanitized, count = _BEARER_PATTERN.subn("Bearer <redacted>", sanitized)
    if count:
        warnings.append("Bearer token patterns were redacted before analysis.")

    sanitized, count = _JWT_PATTERN.subn("<redacted-jwt>", sanitized)
    if count:
        warnings.append("JWT-like token patterns were redacted before analysis.")

    sanitized, count = _AWS_ACCESS_KEY_PATTERN.subn("<redacted-aws-key>", sanitized)
    if count:
        warnings.append("Cloud access key patterns were redacted before analysis.")

    sanitized, count = _EMAIL_PATTERN.subn("<redacted-email>", sanitized)
    if count:
        warnings.append("Email addresses were redacted before analysis.")

    sanitized, count = _WINDOWS_USER_PATH_PATTERN.subn(r"\1<user>", sanitized)
    sanitized, unix_count = _UNIX_HOME_PATH_PATTERN.subn(r"\1<user>", sanitized)
    if count or unix_count:
        warnings.append("User home path segments were redacted before analysis.")

    sanitized, count = _IPV4_PATTERN.subn("<ip-address>", sanitized)
    if count:
        warnings.append("IP address patterns were redacted before analysis.")

    if len(sanitized) > max_chars:
        sanitized = sanitized[:max_chars].rstrip()
        warnings.append("OCR text was truncated before analysis.")

    return SanitizedScreenText(
        text=sanitized,
        warnings=warnings,
        original_length=len(normalized),
        sanitized_length=len(sanitized),
    )


def build_screen_analysis_messages(intent: str, context_mode: str, ocr_text: str) -> list[dict[str, str]]:
    task = _intent_task(intent)
    system = (
        "You are DevJarvis, a local desktop AI assistant for developer screen analysis. "
        "Use only the provided OCR text. The OCR text may be incomplete or noisy. "
        "Never invent file contents, secrets, logs, or stack frames that are not present. "
        "If evidence is insufficient, state uncertainty clearly. "
        "Return strict JSON only. Do not wrap it in Markdown. "
        "The JSON schema is: "
        '{"title":"string","summary":"string","detail":"string","actionItems":["string"]}. '
        f"actionItems must contain at most {_MAX_ACTION_ITEMS} concise items. "
        "Do not include sensitive credentials, tokens, emails, or private IPs in the output."
    )
    user = (
        f"Task: {task}\n"
        f"Context mode: {context_mode}\n\n"
        "Sanitized OCR text:\n"
        "---\n"
        f"{ocr_text}\n"
        "---"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _intent_task(intent: str) -> str:
    if intent == "screen_translate":
        return "Translate the meaningful screen text into Korean and preserve technical terms when useful."
    if intent == "screen_summary":
        return "Summarize the current screen in Korean with the most important information first."
    if intent == "screen_error_analysis":
        return "Diagnose visible errors in Korean, identify likely causes, and suggest safe next checks."
    if intent == "project_diagnosis":
        return "Summarize the visible project-related issue in Korean and state what project context is still needed."
    if intent == "log_analysis":
        return "Analyze visible logs in Korean, identify error signals, and suggest safe next checks."
    return "Respond to the screen-related command in Korean."


def _normalize_text(value: str) -> str:
    return "\n".join(line.strip() for line in value.replace("\u0000", " ").splitlines() if line.strip()).strip()
