"""보안 규칙(firestore.rules)을 배포하고 '아이디·비밀번호 로그인'을 켭니다. 사용: python3 scripts/deploy_rules.py"""
from pathlib import Path
from fb import PROJECT, call

src = (Path(__file__).resolve().parent.parent / 'firestore.rules').read_text(encoding='utf-8')
API = f'https://firebaserules.googleapis.com/v1/projects/{PROJECT}'
rs = call('POST', f'{API}/rulesets', {'source': {'files': [{'name': 'firestore.rules', 'content': src}]}})['name']
call('PATCH', f'{API}/releases/cloud.firestore', {'release': {'name': f'projects/{PROJECT}/releases/cloud.firestore', 'rulesetName': rs}})
print('보안 규칙 배포 완료:', rs)

# 이메일/비밀번호 로그인 켜기(아이디는 내부적으로 '아이디@LOGIN_DOMAIN' 이메일로 저장됩니다)
call('PATCH', f'https://identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired',
     {'signIn': {'email': {'enabled': True, 'passwordRequired': True}}})
print('아이디·비밀번호 로그인 켜기 완료')
