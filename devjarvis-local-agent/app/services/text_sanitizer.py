import re

_SECRET_ASSIGNMENT_PATTERN = re.compile(
    r"(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|refresh[_-]?token)\b\s*[:=]\s*([^\s,;]+)"
)
_BEARER_PATTERN = re.compile(r"(?i)\bbearer\s+[a-z0-9._~+/=-]{16,}")
_JWT_PATTERN = re.compile(r"\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b")
_AWS_ACCESS_KEY_PATTERN = re.compile(r"\bA(KIA|SIA)[A-Z0-9]{16}\b")
_EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_IPV4_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_WINDOWS_HOME_PATTERN = re.compile(r"(?i)\bC:\\Users\\[^\\\s]+")
_UNIX_HOME_PATTERN = re.compile(r"(?i)(?<!\w)/(home|Users)/[^/\s]+")


def redact_sensitive_text(text: str, max_chars: int) -> tuple[str, list[str]]:
    warnings: list[str] = []
    sanitized = text

    replacements = [
        (_SECRET_ASSIGNMENT_PATTERN, lambda m: f"{m.group(1)}=<redacted>"),
        (_BEARER_PATTERN, "Bearer <redacted>"),
        (_JWT_PATTERN, "<redacted-jwt>"),
        (_AWS_ACCESS_KEY_PATTERN, "<redacted-aws-key>"),
        (_EMAIL_PATTERN, "<redacted-email>"),
        (_IPV4_PATTERN, "<redacted-ip>"),
        (_WINDOWS_HOME_PATTERN, r"C:\\Users\\<redacted-user>"),
        (_UNIX_HOME_PATTERN, lambda m: f"/{m.group(1)}/<redacted-user>"),
    ]

    for pattern, replacement in replacements:
        updated = pattern.sub(replacement, sanitized)
        if updated != sanitized:
            warnings.append(f"redacted:{pattern.pattern[:32]}")
            sanitized = updated

    if len(sanitized) > max_chars:
        sanitized = sanitized[:max_chars]
        warnings.append("truncated:max_input_chars")

    return sanitized, warnings
