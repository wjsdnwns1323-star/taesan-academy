"""커뮤니티 관리자 계정을 만듭니다(이미 있는 아이디면 관리자로 바꿉니다). 사용: python3 scripts/create_admin.py

비밀번호는 화면에 보이지 않게 입력받고, 어디에도 저장하지 않습니다.
"""
import getpass
import re
import sys
import time
from urllib.parse import quote
from fb import PROJECT, LOGIN_DOMAIN, FS, call, fs_fields

# 이미 가입한 아이디를 관리자로 바꿀 때: python3 scripts/create_admin.py 아이디
if len(sys.argv) > 1:
    username = sys.argv[1].strip().lower()
    email = f'{username}@{LOGIN_DOMAIN}'
    u = call('POST', f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:lookup', {'email': [email]}).get('users')
    if not u:
        sys.exit('그 아이디로 가입한 계정이 없습니다.')
    call('PATCH', f'{FS}/users/{u[0]["localId"]}?updateMask.fieldPaths=role', fs_fields({'role': 'admin'}))
    print(f'{username} 계정을 관리자로 바꿨습니다.')
    sys.exit(0)
username = input('관리자 아이디(영문 소문자·숫자·_ 4~20자): ').strip().lower()
if not re.fullmatch(r'[a-z0-9_]{4,20}', username):
    sys.exit('아이디 형식이 맞지 않습니다.')
nickname = input('닉네임(커뮤니티에 보이는 이름, 예: 태산관리자): ').strip()
if not (2 <= len(nickname) <= 12) or '/' in nickname or ' ' in nickname:
    sys.exit('닉네임은 띄어쓰기·/ 없이 2~12자입니다.')
email = f'{username}@{LOGIN_DOMAIN}'
AUTH = f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}'

found = call('POST', f'{AUTH}/accounts:lookup', {'email': [email]}).get('users')
if found:
    uid = found[0]['localId']
    print('이미 있는 아이디입니다. 관리자로 바꿉니다.')
else:
    pw = getpass.getpass('비밀번호(8자 이상, 화면에 안 보임): ')
    if len(pw) < 8 or pw != getpass.getpass('비밀번호 확인: '):
        sys.exit('비밀번호가 8자 미만이거나 확인이 맞지 않습니다.')
    uid = call('POST', f'{AUTH}/accounts', {'email': email, 'password': pw, 'emailVerified': True})['localId']
    print('로그인 계정 생성 완료')

owner = call('GET', f'{FS}/nicknames/{quote(nickname)}', ok404=True)
if owner and owner['fields']['uid']['stringValue'] != uid:
    sys.exit('다른 회원이 쓰는 닉네임입니다. 다른 닉네임을 정해 주세요.')
user = call('GET', f'{FS}/users/{uid}', ok404=True)
data = {'username': username, 'nickname': nickname, 'grade': '기타', 'role': 'admin', 'banned': False,
        'createdAt': int(time.time() * 1000)}
if user:
    old = user['fields'].get('nickname', {}).get('stringValue')
    data['createdAt'] = int(user['fields'].get('createdAt', {}).get('integerValue', data['createdAt']))
    if old and old != nickname:
        call('DELETE', f'{FS}/nicknames/{quote(old)}', ok404=True)
call('PATCH', f'{FS}/users/{uid}', fs_fields(data))
call('PATCH', f'{FS}/nicknames/{quote(nickname)}', fs_fields({'uid': uid}))
print(f'관리자 준비 완료: 아이디 {username} / 닉네임 {nickname}')
print('사이트에서 이 아이디로 로그인하면 전체 메뉴 > 관리자 화면이 보입니다.')
