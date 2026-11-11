"""Test UAT indexing controls using the harness's isolated database."""
import socket
import subprocess
import time
from integration import Client, ROOT


def run(env):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
    base=f'http://127.0.0.1:{port}'
    server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t','public','public/router.php'],cwd=ROOT,
                            env=dict(env,APP_URL=base,APP_INDEXING='false'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        client=Client(base)
        for _ in range(60):
            try: client.call('/api/health'); break
            except OSError: time.sleep(.1)
        assert 'Disallow: /' in client.call('/robots.txt')
        client.call('/sitemap.xml',expected=404)
        assert 'noindex, nofollow' in client.call('/')
        assert 'noindex' in client.headers['X-Robots-Tag']
        assert client.call('/api/seo?path=/')['robots']=='noindex, nofollow'
        print('PASS UAT indexing: robots disallow, sitemap disabled, noindex HTTP header and metadata.')
    finally:
        server.terminate(); server.wait(timeout=10)
