"""Isolated integration checks for moderated review photos and photo-led blog posts.

Requires PHP CLI with GD, PDO SQLite, mbstring, and fileinfo.
No production data is accessed.
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


def photo_fixture(path: Path) -> bytes:
    php = """
    $image=imagecreatetruecolor(32,24);
    $colour=imagecolorallocate($image,140,40,50);
    imagefilledrectangle($image,0,0,31,23,$colour);
    imagepng($image,$argv[1]);
    imagedestroy($image);
    """
    subprocess.run(["php", "-r", php, str(path)], check=True)
    return path.read_bytes()


def multipart(fields, photo: bytes, field_name="photo") -> tuple[bytes, str]:
    boundary = "----SelamReviewImageTest"
    data = bytearray()
    for key, value in fields.items():
        data.extend((
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n"
            f"{value}\r\n"
        ).encode())
    data.extend((
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field_name}"; filename="lesson.png"\r\n'
        'Content-Type: image/png\r\n\r\n'
    ).encode())
    data.extend(photo)
    data.extend(f"\r\n--{boundary}--\r\n".encode())
    return bytes(data), f"multipart/form-data; boundary={boundary}"


def run():
    with tempfile.TemporaryDirectory(prefix="selam-review-blog-") as folder:
        temp = Path(folder)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        env = dict(
            os.environ,
            APP_ENV="testing",
            APP_URL=base,
            APP_KEY="test-key-" + "x" * 56,
            DB_DSN="sqlite:" + str(temp / "site.sqlite"),
            APP_DATA_DIR=str(temp / "data"),
            APP_PRIVATE_DIR=str(temp / "config"),
            MAIL_TRANSPORT="log",
        )
        subprocess.run(["php", "tests/fixture.php"], env=env, cwd=ROOT, check=True, capture_output=True)
        output = open(temp / "server.log", "w")
        server = subprocess.Popen(
            ["php", "-S", f"127.0.0.1:{port}", "-t", "public", "public/router.php"],
            env=env, cwd=ROOT, stdout=output, stderr=output,
        )
        try:
            for _ in range(80):
                try:
                    urlopen(base + "/api/health", timeout=1).close()
                    break
                except (OSError, URLError):
                    time.sleep(.1)
            admin = Client(base)
            guest = Client(base)
            admin.login("admin")

            draft = {
                "slug": "sheffield-driving-tips",
                "title": "Driving Tips in Sheffield",
                "excerpt": "Advice for learners practising on Sheffield roads.",
                "body": "Start with a safe routine.\nPractise in suitable conditions.",
                "cover_image_url": None,
                "image_alt": None,
                "is_published": False,
            }
            guest.call("/api/blog/posts", "POST", draft, expected=403)
            created = admin.call("/api/blog/posts", "POST", draft)
            assert created["is_published"] == 0
            guest.call("/api/blog/posts/sheffield-driving-tips", expected=404)
            assert "sheffield-driving-tips" not in guest.call("/sitemap.xml")
            draft["is_published"] = True
            published = admin.call("/api/blog/posts/" + str(created["id"]), "PUT", draft)
            assert published["is_published"] == 1
            assert guest.call("/api/blog/posts/sheffield-driving-tips")["title"] == draft["title"]
            assert "Driving Tips in Sheffield" in guest.call("/blog")
            article = guest.call("/blog/sheffield-driving-tips")
            assert "BlogPosting" in article and "Start with a safe routine" in article
            assert "sheffield-driving-tips" in guest.call("/sitemap.xml")
            pic = photo_fixture(temp / "sample.png")
            upload_raw, upload_type = multipart({}, pic, "file")
            uploaded = admin.call(
                "/api/media/upload-photo",
                "POST", raw=upload_raw, headers={"Content-Type": upload_type},
            )
            assert uploaded["url"].startswith("/media/")
            draft["cover_image_url"] = uploaded["url"]
            draft["image_alt"] = "Learner driving practice photo"
            published = admin.call("/api/blog/posts/" + str(created["id"]), "PUT", draft)
            assert published["cover_image_url"] == uploaded["url"]
            assert "og:image" in guest.call("/blog/sheffield-driving-tips")
            guest.call("/api" + uploaded["url"])
            assert guest.headers["Content-Type"].startswith("image/png")
            draft["cover_image_url"] = "https://untrusted.example/unsafe.svg"
            draft["image_alt"] = "Test"
            admin.call("/api/blog/posts/" + str(created["id"]), "PUT", draft, expected=422)

            fields = {
                "author": "Test Learner", "email": "test@example.test",
                "rating": "5", "testimonial": "A very helpful instructor and clear lessons.",
                "photo_consent": "1",
            }
            raw, content_type = multipart(fields, pic)
            submitted = guest.call(
                "/api/cms/pages/reviews/testimonials/submit",
                "POST", raw=raw, headers={"Content-Type": content_type},
            )
            review_id = submitted["submission_id"]
            url = "/api/media/reviews/" + str(review_id)
            guest.call(url, expected=404)
            result = admin.call("/api/cms/pages/reviews/testimonials/submissions")
            assert any(item["id"] == review_id and item["photo_url"] for item in result)
            admin.call(url)
            assert admin.headers["Content-Type"].startswith("image/jpeg")
            assert all(item.get("author") != "Test Learner" for item in guest.call("/api/cms/pages/reviews/testimonials")["items"])
            admin.call(
                "/api/cms/pages/reviews/testimonials/submissions/" + str(review_id),
                "PATCH", {"status": "approved"},
            )
            guest.call(url)
            assert guest.headers["Content-Type"].startswith("image/jpeg")
            assert any(item.get("photo_url") for item in guest.call("/api/cms/pages/reviews/testimonials")["items"])
            # Published client reviews must not become editable CMS-curated entries.
            assert guest.call("/api/cms/pages/reviews/testimonials?managed=1", expected=403)
            assert admin.call("/api/cms/pages/reviews/testimonials?managed=1")["items"] == []

            fields["photo_consent"] = "0"
            raw, content_type = multipart(fields, pic)
            guest.call(
                "/api/cms/pages/reviews/testimonials/submit",
                "POST", raw=raw, headers={"Content-Type": content_type}, expected=422,
            )
            print("PASS blog publishing, noindex draft behaviour, image validation, photo consent and review moderation")
        finally:
            server.terminate()
            server.wait(timeout=10)
            output.close()


if __name__ == "__main__":
    run()
