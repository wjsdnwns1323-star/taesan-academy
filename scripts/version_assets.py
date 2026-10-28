#!/usr/bin/env python3
"""배포할 화면 폴더의 css·js 주소에 버전(?v=)을 붙입니다. 새로 올리면 브라우저가 옛 파일과 섞어 쓰지 않습니다.
사용: python3 scripts/version_assets.py <폴더(기본 public)> <버전>
GitHub Pages 배포(.github/workflows/pages.yml)와 AWS 배포(aws/deploy.sh)가 함께 씁니다."""
import re
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'public')
v = sys.argv[2]
idx = root / 'index.html'
h = idx.read_text()
h = h.replace('href="css/style.css"', f'href="css/style.css?v={v}"').replace('src="js/app.js"', f'src="js/app.js?v={v}"')
# 화면 코드를 처음에 한꺼번에 받기(하나 받고 다음 것 받는 대기 없애기). 체험 모드용 서버 규칙은 필요할 때만 받습니다
skip = {'server-core.js'}
pre = ''.join(f'  <link rel="modulepreload" href="{p.relative_to(root).as_posix()}?v={v}">\n'
              for p in sorted((root / 'js').rglob('*.js')) if p.name not in skip)
h = h.replace('</head>', pre + '</head>')
idx.write_text(h)
pat = re.compile(r"""((?:from\s*|import\(\s*)['"])(\.{1,2}/[^'"?]+\.js)(['"])""")
for p in (root / 'js').rglob('*.js'):
    t = p.read_text()
    n = pat.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={v}{m.group(3)}", t)
    if n != t:
        p.write_text(n)
print(f'버전 {v}: index.html 에 {h.count("?v=" + v)}곳')
