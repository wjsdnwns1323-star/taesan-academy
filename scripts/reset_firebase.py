"""기존 Firebase 데이터를 모두 지웁니다(되돌릴 수 없음). 사용: python3 scripts/reset_firebase.py

- Firestore의 모든 문서(하위 컬렉션 포함)
- Authentication의 모든 로그인 계정
지우기 전에 프로젝트 ID를 직접 입력해야 진행됩니다.
"""
import sys
from urllib.parse import quote
from fb import PROJECT, FS, call

ROOT = FS.rsplit('/documents', 1)[0] + '/documents'
print(f'⚠️  {PROJECT} 프로젝트의 Firestore 데이터와 로그인 계정을 전부 지웁니다. 되돌릴 수 없습니다.')
if input(f'계속하려면 프로젝트 ID({PROJECT})를 그대로 입력하세요: ').strip() != PROJECT:
    sys.exit('취소했습니다.')

def collections(parent):
    out, token = [], ''
    while True:
        r = call('POST', f'{parent}:listCollectionIds', {'pageSize': 300, 'pageToken': token}, ok404=True) or {}
        out += r.get('collectionIds', [])
        token = r.get('nextPageToken')
        if not token:
            return out

def wipe(parent):
    n = 0
    for col in collections(parent):
        while True:
            r = call('GET', f'{parent}/{quote(col)}?pageSize=300&showMissing=true&mask.fieldPaths=__name__')
            docs = r.get('documents', [])
            if not docs:
                break
            for d in docs:
                path = d['name'].split('/documents/', 1)[1]
                url = f'{ROOT}/' + '/'.join(quote(p) for p in path.split('/'))
                n += wipe(url)
                call('DELETE', url, ok404=True)
                n += 1
    return n

print(f'Firestore 문서 {wipe(ROOT)}개 삭제')

AUTH = f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}'
total = 0
while True:
    users = call('GET', f'{AUTH}/accounts:batchGet?maxResults=1000').get('users', [])
    if not users:
        break
    call('POST', f'{AUTH}/accounts:batchDelete', {'localIds': [u['localId'] for u in users], 'force': True})
    total += len(users)
print(f'로그인 계정 {total}개 삭제')
print('초기화 완료. 이어서 deploy_rules.py → deploy_hosting.py → create_admin.py 순서로 실행하세요.')
