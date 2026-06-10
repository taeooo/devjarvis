from app.screen_analysis.prompt_builder import sanitize_screen_text


def test_sanitize_screen_text_redacts_sensitive_patterns() -> None:
    text = """
    password=super-secret
    Authorization: Bearer abc.def.ghi
    token: eyJabc.def.ghi
    email test@example.com
    C:\\Users\\taeo\\project\\app.py
    server 192.168.0.10
    """

    result = sanitize_screen_text(text, max_chars=1000)

    assert "super-secret" not in result.text
    assert "abc.def.ghi" not in result.text
    assert "test@example.com" not in result.text
    assert "taeo" not in result.text
    assert "192.168.0.10" not in result.text
    assert "<redacted>" in result.text
    assert "<redacted-email>" in result.text
    assert "<ip-address>" in result.text
    assert result.warnings


def test_sanitize_screen_text_truncates_input() -> None:
    result = sanitize_screen_text("a" * 120, max_chars=50)

    assert len(result.text) == 50
    assert "truncated" in " ".join(result.warnings).lower()
