from app.core.security import is_loopback_client, is_loopback_host_header


def test_loopback_client_detection() -> None:
    assert is_loopback_client("127.0.0.1")
    assert is_loopback_client("::1")
    assert not is_loopback_client("192.168.0.10")


def test_loopback_host_header_detection() -> None:
    assert is_loopback_host_header("127.0.0.1:17997")
    assert is_loopback_host_header("localhost:17997")
    assert not is_loopback_host_header("192.168.0.9:17997")
