"""SEO/AEO smoke tests against an isolated PHP app and test database.

Run: python3 tests/seo_aeo.py
Requires PHP CLI, PDO SQLite, and the same extensions as tests/integration.py.
No production database or booking data is touched.
"""
import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from integration import Client, ROOT


def run():
    with tempfile.TemporaryDirectory(prefix="selam-seo-") as folder:
        tmp = Path(folder)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        env = dict(
            os.environ,
            APP_ENV="testing",
            APP_URL=base,
            APP_INDEXING="true",
            APP_KEY="test-key-" + "x" * 56,
            DB_DSN="sqlite:" + str(tmp / "test.sqlite"),
            APP_DATA_DIR=str(tmp / "data"),
            APP_PRIVATE_DIR=str(tmp / "config"),
            MAIL_TRANSPORT="log",
        )
        subprocess.run(
            ["php", "tests/fixture.php"],
            cwd=ROOT, env=env, check=True, capture_output=True,
        )
        log = open(tmp / "php-server.log", "w")
        server = subprocess.Popen(
            ["php", "-S", f"127.0.0.1:{port}", "-t", "public", "public/router.php"],
            cwd=ROOT, env=env, stdout=log, stderr=log,
        )
        try:
            for _ in range(60):
                try:
                    urlopen(base + "/api/health", timeout=1).close()
                    break
                except (OSError, URLError):
                    time.sleep(0.1)
            client = Client(base)
            home = client.call("/")
            assert "<h1>Manual &amp; Automatic Driving Lessons in Sheffield</h1>" in home
            assert 'application/ld+json' in home
            assert '"LocalBusiness"' in home and '"EducationalOrganization"' in home
            assert "Does Selam Driving School offer manual and automatic lessons in Sheffield?" in home
            assert "Is my driving lesson confirmed when I submit a booking request?" in home
            meta = client.call("/api/seo?path=/")
            assert "Driving Lessons in Sheffield" in meta["title"]
            assert meta["canonical"] == base + "/"
            assert meta["robots"].startswith("index")
            assert any(x.get("@type") == "DrivingSchool" for x in meta["schema"]["@graph"])
            lessons = client.call("/lessons")
            assert "Manual &amp; Automatic Driving Lessons in Sheffield" in lessons
            for kind in ("manual", "automatic"):
                route = "/" + kind + "-driving-lessons-sheffield"
                landing = client.call(route)
                assert "<h1>" + kind.capitalize() + " Driving Lessons in Sheffield</h1>" in landing
                assert 'application/ld+json' in landing
                assert "Frequently asked questions" in landing
                assert "lesson_type=" + kind in landing
                assert "Request " + kind.capitalize() + " Lessons" in landing
                page_meta = client.call("/api/seo?path=" + route)
                assert page_meta["canonical"] == base + route
                assert page_meta["robots"].startswith("index")
                assert page_meta["guide"]["booking_type"] == kind
                types = [node.get("@type") for node in page_meta["schema"]["@graph"]]
                assert "LocalBusiness" in next(t for t in types if isinstance(t, list))
                assert "Service" in types
                assert "FAQPage" in types
                assert "DrivingSchool" not in types
            assert "/manual-driving-lessons-sheffield" in lessons
            assert "/automatic-driving-lessons-sheffield" in lessons
            sitemap = client.call("/sitemap.xml")
            assert base + "/lessons" in sitemap
            assert base + "/prices" in sitemap
            assert base + "/manual-driving-lessons-sheffield" in sitemap
            assert base + "/automatic-driving-lessons-sheffield" in sitemap
            assert base + "/login" not in sitemap
            robots = client.call("/robots.txt")
            assert "Sitemap: " + base + "/sitemap.xml" in robots
            assert "Disallow: /api/" in robots
            private = client.call("/api/seo?path=/login")
            assert private["robots"] == "noindex, nofollow"
            print("PASS SEO/AEO: crawl metadata, schema, FAQs, sitemap, and private-page noindex")
        finally:
            server.terminate()
            server.wait(timeout=10)
            log.close()


if __name__ == "__main__":
    run()
