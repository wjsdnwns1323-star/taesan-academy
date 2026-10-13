"""Cloud Shell(gcloud 로그인)에서 Firebase REST API를 부르는 공통 도구."""
import json
import subprocess
import sys
import tempfile

PROJECT = 'taesan-academy'
LOGIN_DOMAIN = 'member.taesan-academy.app'  # public/js/config.js 의 LOGIN_DOMAIN 과 같아야 합니다
TOKEN = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()
FS = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'


def call(method, url, body=None, ok404=False):
    """curl로 API를 부릅니다(Cloud Shell에서 urllib가 멈추는 경우가 있어 curl 사용)."""
    cmd = ['curl', '-sS', '-m', '120', '-X', method, url, '-H', f'Authorization: Bearer {TOKEN}',
           '-H', 'Content-Type: application/json', '-H', f'x-goog-user-project: {PROJECT}', '-w', '\n%{http_code}']
    with tempfile.NamedTemporaryFile() as f:
        if body is not None:
            f.write(json.dumps(body).encode()); f.flush(); cmd += ['--data-binary', f'@{f.name}']
        out = subprocess.run(cmd, capture_output=True).stdout.decode()
    txt, _, code = out.rpartition('\n')
    if code == '404' and ok404:
        return None
    if not code.startswith('2'):
        sys.exit(f'{method} {url}\n{code} {txt}')
    return json.loads(txt or '{}')


def fs_value(v):
    if isinstance(v, bool):
        return {'booleanValue': v}
    if isinstance(v, int):
        return {'integerValue': str(v)}
    return {'stringValue': str(v)}


def fs_fields(d):
    return {'fields': {k: fs_value(v) for k, v in d.items()}}
