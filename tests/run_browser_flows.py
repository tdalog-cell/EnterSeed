"""Run browser_flows.py with a fresh local server and disposable test records.

Launch Node directly so Windows cleanup also stops the actual server process.
The generic shell-based server helper can leave its Node child running on Windows.
"""
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

root = Path(__file__).resolve().parents[1]
preview = root / '.preview'
preview.mkdir(exist_ok=True)
fixture = Path(tempfile.mkdtemp(prefix='browser-test-', dir=preview))
with socket.socket() as listener:
    listener.bind(('127.0.0.1', 0))
    port = listener.getsockname()[1]
env = {**os.environ, 'DATABASE_PATH': str(fixture / 'test.sqlite'), 'PORT': str(port),
       'TEST_BASE_URL': f'http://127.0.0.1:{port}', 'NODE_ENV': 'production',
       'GEMINI_API_KEY': '', 'RESEND_API_KEY': '', 'ADMIN_API_KEY': ''}
bundled_python = preview / 'python'
if bundled_python.exists():
    env['PYTHONPATH'] = str(bundled_python) + os.pathsep + env.get('PYTHONPATH', '')

with (fixture / 'server.log').open('w', encoding='utf-8') as log:
    server = subprocess.Popen(['node', '--import', 'tsx', 'server.ts'], cwd=root,
                              env=env, stdout=log, stderr=log,
                              creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        for attempt in range(100):
            if server.poll() is not None:
                raise RuntimeError(f'Test server stopped. See {fixture / "server.log"}')
            try:
                with urllib.request.urlopen(env['TEST_BASE_URL'] + '/api/health', timeout=1) as response:
                    if response.status == 200: break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('Test server did not become ready.')
        result = subprocess.run([sys.executable, 'tests/browser_flows.py'], cwd=root, env=env)
    finally:
        server.terminate()
        try: server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()
sys.exit(result.returncode)
