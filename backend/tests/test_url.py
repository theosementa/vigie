import pytest

from app.services.url import InvalidUrlError, extract_youtube_id, is_public_ip, normalize_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("HTTPS://Example.COM/Path/", "https://example.com/Path"),
        ("https://example.com/", "https://example.com"),
        ("https://example.com/a?utm_source=x&b=1&utm_medium=y", "https://example.com/a?b=1"),
        ("https://example.com/a?fbclid=abc&gclid=def", "https://example.com/a"),
        ("https://example.com/a#section", "https://example.com/a"),
        ("https://example.com:443/a", "https://example.com/a"),
        ("http://example.com:8080/a/", "http://example.com:8080/a"),
        ("example.com/post", "https://example.com/post"),
        ("  https://example.com/x  ", "https://example.com/x"),
        ("https://example.com/a?q=1&UTM_Campaign=z", "https://example.com/a?q=1"),
    ],
)
def test_normalize_generic(raw, expected):
    assert normalize_url(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "https://youtu.be/dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ?t=42",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&utm_source=x",
        "https://youtube.com/watch?v=dQw4w9WgXcQ#t=1",
        "HTTP://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ],
)
def test_normalize_youtube(raw):
    assert normalize_url(raw) == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_youtube_non_video_pages_are_kept():
    assert extract_youtube_id("https://www.youtube.com/@channel") is None
    assert normalize_url("https://www.youtube.com/@Channel/") == "https://www.youtube.com/@Channel"


@pytest.mark.parametrize(
    "raw", ["", "   ", "ftp://example.com/x", "javascript:alert(1)", "https://"]
)
def test_normalize_rejects_invalid(raw):
    with pytest.raises(InvalidUrlError):
        normalize_url(raw)


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",
        "10.1.2.3",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "0.0.0.0",
        "::1",
        "fe80::1",
        "fc00::1",
        "::ffff:10.0.0.1",
        "100.64.0.1",
        "224.0.0.1",
        "garbage",
    ],
)
def test_private_ips_rejected(ip):
    assert not is_public_ip(ip)


@pytest.mark.parametrize("ip", ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])
def test_public_ips_accepted(ip):
    assert is_public_ip(ip)
