"""firestore.rules를 Firebase에 배포합니다(gcloud 로그인만으로). 사용: python3 scripts/deploy_rules.py"""
import json, subprocess, sys
from pathlib import Path

PROJECT = 'taesan-academy'
TOKEN = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()
src = (Path(__file__).resolve().parent.parent / 'firestore.rules').read_text(encoding='utf-8')

def call(method, url, body):
    out = subprocess.run(['curl', '-sS', '-X', method, url, '-H', f'Authorization: Bearer {TOKEN}', '-H', 'Content-Type: application/json',
                          '-H', f'x-goog-user-project: {PROJECT}', '-d', json.dumps(body), '-w', '\n%{http_code}'], capture_output=True).stdout.decode()
    txt, _, code = out.rpartition('\n')
    if not code.startswith('2'):
        sys.exit(f'{code} {txt}')
    return json.loads(txt or '{}')

API = f'https://firebaserules.googleapis.com/v1/projects/{PROJECT}'
rs = call('POST', f'{API}/rulesets', {'source': {'files': [{'name': 'firestore.rules', 'content': src}]}})['name']
call('PATCH', f'{API}/releases/cloud.firestore', {'release': {'name': f'projects/{PROJECT}/releases/cloud.firestore', 'rulesetName': rs}})
print('보안 규칙 배포 완료:', rs)
