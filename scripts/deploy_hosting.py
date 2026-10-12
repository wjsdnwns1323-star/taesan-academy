"""Firebase Hosting에 public/ 폴더를 올립니다(firebase-tools 없이, gcloud 로그인만으로).

사용: python3 scripts/deploy_hosting.py [사이트ID]
  - Cloud Shell처럼 gcloud에 로그인된 곳에서 실행합니다.
  - 기본 사이트: taesan-academy  →  https://taesan-academy.web.app
"""
import gzip
import hashlib
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

SITE = sys.argv[1] if len(sys.argv) > 1 else 'taesan-academy'
PROJECT = 'taesan-academy'
API = 'https://firebasehosting.googleapis.com/v1beta1'
ROOT = Path(__file__).resolve().parent.parent / 'public'
TOKEN = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()

CONFIG = {
    'rewrites': [{'glob': '**', 'path': '/index.html'}],
    'headers': [{'glob': '**/*.@(js|css)', 'headers': {'Cache-Control': 'public, max-age=300'}}],
}


def call(method, url, body=None, raw=None, ctype='application/json'):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': f'Bearer {TOKEN}', 'Content-Type': ctype, 'x-goog-user-project': PROJECT,
    })
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode() or '{}'
            return json.loads(txt)
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {url}\n{e.code} {e.read().decode()}')


files, blobs = {}, {}
for p in sorted(ROOT.rglob('*')):
    if p.is_file() and not any(part.startswith('.') for part in p.relative_to(ROOT).parts):
        gz = gzip.compress(p.read_bytes(), mtime=0)
        h = hashlib.sha256(gz).hexdigest()
        files['/' + p.relative_to(ROOT).as_posix()] = h
        blobs[h] = gz
print(f'파일 {len(files)}개 준비')

ver = call('POST', f'{API}/sites/{SITE}/versions', {'config': CONFIG})['name']
res = call('POST', f'{API}/{ver}:populateFiles', {'files': files})
need, upload = res.get('uploadRequiredHashes', []), res.get('uploadUrl')
for i, h in enumerate(need, 1):
    call('POST', f'{upload}/{h}', raw=blobs[h], ctype='application/octet-stream')
print(f'업로드 {len(need)}개 완료')
call('PATCH', f'{API}/{ver}?update_mask=status', {'status': 'FINALIZED'})
call('POST', f'{API}/sites/{SITE}/releases?versionName={ver}', {'message': 'deploy_hosting.py'})
print(f'배포 완료: https://{SITE}.web.app')
