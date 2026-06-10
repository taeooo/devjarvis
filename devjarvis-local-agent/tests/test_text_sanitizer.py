from app.services.text_sanitizer import redact_sensitive_text


def test_redact_sensitive_text() -> None:
    text = "password=abc123 token: xyz@example.com Bearer abcdefghijklmnop C:\\Users\\xoomm\\project 192.168.0.10"

    sanitized, warnings = redact_sensitive_text(text, max_chars=500)

    assert "abc123" not in sanitized
    assert "xyz@example.com" not in sanitized
    assert "abcdefghijklmnop" not in sanitized
    assert "xoomm" not in sanitized
    assert "192.168.0.10" not in sanitized
    assert warnings


def test_redact_truncates() -> None:
    sanitized, warnings = redact_sensitive_text("a" * 100, max_chars=10)

    assert sanitized == "a" * 10
    assert "truncated:max_input_chars" in warnings
