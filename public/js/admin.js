// 관리자: 회원 관리(정보 열람·정지·권한), 글 관리(승인·신고·숨김·삭제), 배너(표지) 편집
import * as be from './backend.js';
import { BOARDS } from './boards.js';
import { PROMOS, TEACHERS, loadPromos } from './ads.js';
import { ACADEMY_BAND } from './config.js';
import { esc, $, $$, ago, fullDate, toast, icon, empty, pageHead, tagHtml, safeImg, safeLink, confirmBox, dday, resetBanners } from './ui.js';

export async function renderAdmin(ctx) {
  const { view, q } = ctx;
  if (!be.isAdmin()) { view.innerHTML = `${pageHead('관리자')}${empty('관리자만 볼 수 있습니다', 'lock')}`; return; }
  const tabs = [['home', '현황'], ['users', '회원 관리'], ['posts', '글 관리'], ['cover', '표지·안내'], ...(be.has('events') ? [['ads', '광고'], ['events', '입시 일정'], ['audit', '열람 기록']] : [])];
  const tab = tabs.some(([id]) => id === q.get('tab')) ? q.get('tab') : 'home';
  view.innerHTML = `${pageHead('관리자', { actions: '<a class="btn line keep" href="#/write?board=notice">공지 쓰기</a>' })}
    <nav class="tabs">${tabs.map(([id, n]) => `<a href="#/admin?tab=${id}" class="${id === tab ? 'on' : ''}">${n}</a>`).join('')}</nav>
    <div id="ab"><div class="loading">불러오는 중</div></div>`;
  const box = $('#ab');
  if (tab === 'home') await overviewTab(ctx, box);
  if (tab === 'users') await usersTab(ctx, box);
  if (tab === 'posts') await postsTab(ctx, box);
  if (tab === 'cover') await coverTab(ctx, box);
  if (tab === 'ads') await adsTab(ctx, box);
  if (tab === 'events') await eventsTab(ctx, box);
  if (tab === 'audit') await auditTab(ctx, box);
}

/* ---------------- 현황: 회원·글 수, 처리할 일, 최근 14일 새 글 ---------------- */
async function overviewTab(ctx, box) {
  const [users, posts, pending, reports] = await Promise.all([be.listUsers({ withPrivate: false }), be.listPosts({ limit: 500 }), be.listPending(), be.listReports()]);
  if (!ctx.alive()) return;
  const DAY = 86400000;
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const today = day0.getTime(), week = today - 6 * DAY, month = today - 29 * DAY;
  const days = Array.from({ length: 14 }, (_, i) => today - (13 - i) * DAY);
  const counts = days.map((d) => posts.filter((p) => p.createdAt >= d && p.createdAt < d + DAY).length);
  const max = Math.max(...counts);
  const label = (d) => { const x = new Date(d); return `${x.getMonth() + 1}월 ${x.getDate()}일`; };
  const peak = counts.indexOf(max);
  const byBoard = Object.entries(posts.filter((p) => p.createdAt >= month).reduce((m, p) => ({ ...m, [p.board]: (m[p.board] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const stat = (dt, dd, sub) => `<div><dt>${dt}</dt><dd class="num">${dd.toLocaleString()}</dd><small>${sub}</small></div>`;
  box.innerHTML = `<dl class="ov-stats">
      ${stat('전체 회원', users.length, `최근 7일 가입 <b class="num">${users.filter((u) => u.createdAt >= week).length}</b>`)}
      ${stat('오늘 새 글', counts[13], `최근 7일 <b class="num">${counts.slice(7).reduce((a, b) => a + b, 0)}</b>`)}
      ${stat('승인 대기 자료', pending.length, pending.length ? '<a href="#/admin?tab=posts">확인하러 가기</a>' : '처리할 자료 없음')}
      ${stat('열린 신고', reports.length, reports.length ? '<a href="#/admin?tab=posts">확인하러 가기</a>' : '처리할 신고 없음')}
    </dl>
    <section class="admin-section"><h2>최근 14일 새 글</h2>
      <div class="ov-chart">
        <div class="ov-plot" role="img" aria-label="최근 14일 새 글 수, 가장 많은 날 ${label(days[peak])} ${max}개">
          ${max ? `<span class="ov-max num">${max}</span>` : ''}
          ${counts.map((n, i) => `<div class="ov-bar${i === 13 ? ' today' : ''}" tabindex="0" data-tip="${label(days[i])} · 새 글 ${n}개" aria-label="${label(days[i])} ${n}개">
            ${n && (i === peak || i === 13) ? `<b class="num">${n}</b>` : ''}<i style="height:${max ? Math.round((n / max) * 100) : 0}%"></i></div>`).join('')}
        </div>
        <div class="ov-x">${days.map((d, i) => `<span class="${i % 4 === 1 ? '' : 'sm-hide'}">${i === 13 ? '오늘' : i % 2 === 1 ? `${new Date(d).getMonth() + 1}/${new Date(d).getDate()}` : ''}</span>`).join('')}</div>
        <p class="ov-read hint" aria-live="polite">막대에 손가락이나 마우스를 올리면 그날 글 수가 보입니다.</p>
      </div>
      <details class="ov-table"><summary>표로 보기</summary>
        <table class="mini-table"><thead><tr><th>날짜</th><th class="r">새 글</th></tr></thead><tbody>${days.map((d, i) => `<tr><td>${label(d)}</td><td class="r num">${counts[i]}</td></tr>`).reverse().join('')}</tbody></table></details>
      ${posts.length >= 500 ? '<p class="hint">최근 글 500개로 셉니다.</p>' : ''}
    </section>
    <section class="admin-section"><h2>게시판별 새 글 <span>최근 30일</span></h2>
      ${byBoard.length ? `<table class="mini-table ov-boards"><tbody>${byBoard.map(([b, n]) => `<tr><td>${esc(BOARDS[b]?.name || b)}</td><td class="r num">${n}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">최근 30일 동안 올라온 글이 없습니다.</p>'}
    </section>`;
  const read = $('.ov-read', box);
  const show = (e) => { const b = e.target.closest('.ov-bar'); if (b) read.textContent = b.dataset.tip; };
  $('.ov-plot', box).addEventListener('pointerover', show);
  $('.ov-plot', box).addEventListener('focusin', show);
}

/* ---------------- 회원 관리 ---------------- */
async function usersTab(ctx, box) {
  const users = (await be.listUsers()).sort((a, b) => b.createdAt - a.createdAt);
  if (!ctx.alive()) return;
  const privs = new Map(await Promise.all(users.map(async (u) => [u.id, u.priv !== undefined ? u.priv : await be.getPrivate(u.id).catch(() => null)])));
  if (!ctx.alive()) return;
  box.innerHTML = `<div class="toolbar"><input class="input" id="uf" placeholder="아이디·닉네임·이름·휴대폰 검색" aria-label="회원 검색"></div>
    <p class="hint" style="margin-bottom:12px">회원 <b class="num" style="color:var(--text)">${users.length}</b>명 · 개인정보는 학원 업무에만 사용하고 외부로 옮기지 마세요.</p>
    <table class="admin-table"><thead><tr><th>회원</th><th>이름</th><th>휴대폰</th><th>성별</th><th class="r">나이</th><th>구분</th><th class="r">가입일</th><th>상태</th><th></th></tr></thead>
    <tbody id="ut">${users.map((u) => {
      const p = privs.get(u.id) || {};
      const key = `${u.username} ${u.nickname} ${p.realName || ''} ${p.phone || ''}`.toLowerCase();
      return `<tr data-u="${esc(u.id)}" data-k="${esc(key)}">
        <td><b data-uid="${esc(u.id)}">${esc(u.nickname)}</b><span class="sub">@${esc(u.username)}</span></td>
        <td class="nowrap" data-label="이름">${esc(p.realName || '-')}</td><td class="nowrap num" data-label="휴대폰">${esc(p.phone || '-')}</td>
        <td class="nowrap" data-label="성별">${esc(p.gender || '-')}</td><td class="nowrap num r" data-label="나이">${p.age ? `${p.age}세` : '-'}</td>
        <td class="nowrap" data-label="구분">${esc(p.memberType || u.grade)}${p.childGrade ? `<span class="sub">자녀 ${esc(p.childGrade)}</span>` : (p.memberType === '학생' ? `<span class="sub">${esc(u.grade)}</span>` : '')}</td>
        <td class="nowrap num r" data-label="가입일">${u.createdAt ? fullDate(u.createdAt) : '-'}</td>
        <td class="nowrap" data-label="상태">${u.role === 'admin' ? '<span class="tag brand">관리자</span>' : ''}${u.banned ? '<span class="tag notice">정지</span>' : (u.role === 'admin' ? '' : '<span class="tag">정상</span>')}</td>
        <td>${u.id === be.currentUser().uid ? '' : `<div class="ops"><button type="button" class="btn sm line" data-a="role">${u.role === 'admin' ? '관리자 해제' : '관리자 지정'}</button>
          <button type="button" class="btn sm ${u.banned ? 'line' : 'danger'}" data-a="ban">${u.banned ? '정지 해제' : '이용 정지'}</button></div>`}</td></tr>`;
    }).join('')}</tbody></table>`;
  $('#uf').addEventListener('input', (e) => {
    const k = e.target.value.trim().toLowerCase();
    $$('#ut tr').forEach((tr) => tr.classList.toggle('hidden', !!k && !tr.dataset.k.includes(k)));
  });
  $('#ut').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'), tr = e.target.closest('[data-u]');
    if (!b || !tr) return;
    const u = users.find((x) => x.id === tr.dataset.u);
    try {
      if (b.dataset.a === 'ban' && await confirmBox(u.banned ? '정지 해제' : '이용 정지', `${u.nickname}님을 ${u.banned ? '정지 해제' : '이용 정지'}합니다.`, '확인', !u.banned)) {
        await be.setUserFlags(u.id, { banned: !u.banned }); toast('변경했습니다'); ctx.go(`#/admin?tab=users&r=${Date.now()}`);
      }
      if (b.dataset.a === 'role' && await confirmBox('권한 변경', `${u.nickname}님을 ${u.role === 'admin' ? '일반 회원으로' : '관리자로'} 변경합니다.`)) {
        await be.setUserFlags(u.id, { role: u.role === 'admin' ? 'member' : 'admin' }); toast('변경했습니다'); ctx.go(`#/admin?tab=users&r=${Date.now()}`);
      }
    } catch (err) { toast(be.errorText(err)); }
  });
}

/* ---------------- 글 관리 ---------------- */
async function postsTab(ctx, box) {
  const [pending, reports, recent, hidden] = await Promise.all([be.listPending(), be.listReports(), be.listPosts({ limit: 100 }), be.listHidden()]);
  if (!ctx.alive()) return;
  const row = (p, ops) => `<tr data-p="${esc(p.id)}"><td style="width:96px">${tagHtml(p)}</td>
    <td><a href="#/post/${esc(p.id)}"><b>${esc(p.title)}</b></a><span class="sub">${esc(BOARDS[p.board]?.name || '')} · ${esc(p.nickname)} · ${ago(p.createdAt)} · 조회 ${p.viewCount || 0} · 댓글 ${p.commentCount || 0}</span></td>
    <td><div class="ops">${ops}</div></td></tr>`;
  const del = '<button type="button" class="btn sm danger" data-del>삭제</button>';
  const section = (title, n, html, none) => `<section class="admin-section"><h2>${title}<span class="num">${n}</span></h2>${n ? `<table class="admin-table"><tbody>${html}</tbody></table>` : `<p class="hint">${none}</p>`}</section>`;
  box.innerHTML = section('승인 대기 자료', pending.length, pending.map((p) => row(p, `<button type="button" class="btn sm" data-ok>승인</button>${del}`)).join(''), '승인을 기다리는 자료가 없습니다.')
    + section('신고', reports.length, reports.map((r) => `<tr data-r="${esc(r.id)}"><td style="width:96px"><span class="tag notice">${r.commentId ? '댓글' : '글'}</span></td>
        <td><b>${esc(r.reason)}</b><span class="sub">${esc(r.target)} · 글: ${esc(r.postTitle)} · ${ago(r.createdAt)}</span></td>
        <td><div class="ops"><a class="btn sm line" href="#/post/${esc(r.postId)}">글 보기</a><button type="button" class="btn sm" data-done>처리 완료</button></div></td></tr>`).join(''), '접수된 신고가 없습니다.')
    + section('숨긴 글', hidden.length, hidden.map((p) => row(p, `<button type="button" class="btn sm line" data-show>다시 공개</button>${del}`)).join(''), '숨긴 글이 없습니다.')
    + section('최근 글', recent.length, recent.map((p) => row(p, `<button type="button" class="btn sm line" data-hide>숨김</button>${del}`)).join(''), '등록된 글이 없습니다.');
  const all = [...pending, ...recent, ...hidden];
  box.addEventListener('click', async (e) => {
    try {
      const r = e.target.closest('[data-r]');
      if (r && e.target.closest('[data-done]')) { await be.closeReport(r.dataset.r); r.remove(); toast('처리 완료로 바꿨습니다'); return; }
      const it = e.target.closest('[data-p]');
      if (!it) return;
      const p = all.find((x) => x.id === it.dataset.p);
      if (e.target.closest('[data-show]')) { await be.setHidden(p, false); toast('다시 공개했습니다'); ctx.go(`#/admin?tab=posts&r=${Date.now()}`); }
      if (e.target.closest('[data-hide]') && await confirmBox('글 숨기기', `'${p.title}' 글을 숨깁니다.`, '숨기기')) { await be.setHidden(p, true); toast('글을 숨겼습니다'); ctx.go(`#/admin?tab=posts&r=${Date.now()}`); }
      if (e.target.closest('[data-ok]')) { await be.approvePost(p, true); toast('자료를 승인했습니다'); ctx.go(`#/admin?tab=posts&r=${Date.now()}`); }
      if (e.target.closest('[data-del]') && await confirmBox('글 삭제', `'${p.title}' 글을 삭제합니다. 삭제한 글은 되돌릴 수 없습니다.`, '삭제', true)) {
        await be.deletePost(p); it.remove(); toast('글을 삭제했습니다');
      }
    } catch (err) { toast(be.errorText(err)); }
  });
}

/* ---------------- 배너(표지) ---------------- */
async function coverTab(ctx, box) {
  const cur = (await be.listBanners()).find((b) => b.id === 'cover') || {};
  if (!ctx.alive()) return;
  box.innerHTML = `<div class="form-page" style="margin-top:24px"><form class="form-card" id="cf">
    <div class="cover cover-prev" id="cprev"><p class="cover-title" id="pv-t"></p><p class="cover-sub" id="pv-s"></p></div>
    <p class="hint">홈 맨 위에 보이는 표지입니다. 사진을 넣으면 글자가 잘 보이도록 왼쪽이 어둡게 덮입니다.</p>
    <div class="form-section">
      <div class="field"><label class="lbl" for="c-t">제목</label><input id="c-t" name="text" maxlength="30" value="${esc(cur.text || '태산입시')}"></div>
      <div class="field"><label class="lbl" for="c-s">설명</label><input id="c-s" name="sub" maxlength="100" value="${esc(cur.sub || '대전 학생과 학부모가 입시 정보와 고민을 나누는 곳')}"></div>
      <div class="field"><span>배경 사진 <small>가로로 긴 사진 권장 · 자동으로 줄여 저장합니다</small></span>
        <label class="add-file">${icon('image', 'sm')}사진 선택<input type="file" accept="image/*" name="file" hidden></label></div>
      <label class="check"><input type="checkbox" name="noimg">배경 사진 없이 기본 색 사용</label>
    </div>
    <p class="err" id="cerr"></p>
    <div class="form-actions"><button class="btn lg">저장</button></div></form></div>`;
  const f = $('#cf');
  let image = cur.image || '';
  const pv = () => {
    $('#pv-t').textContent = f.text.value; $('#pv-s').textContent = f.sub.value;
    const on = image && !f.noimg.checked;
    $('#cprev').classList.toggle('photo', !!on);
    $('#cprev').style.backgroundImage = on ? `linear-gradient(90deg, rgba(12, 22, 46, 0.78), rgba(12, 22, 46, 0.35)), url("${safeImg(image)}")` : '';
  };
  pv();
  f.addEventListener('input', pv);
  f.file.addEventListener('change', async () => {
    const file = f.file.files[0];
    if (!file) return;
    try {
      image = await be.imageDataUrl(file, 370000, [[1800, 0.8], [1600, 0.72], [1400, 0.68], [1200, 0.62], [1000, 0.6]]);
      f.noimg.checked = false; pv(); $('#cerr').textContent = '';
    } catch (err) { $('#cerr').textContent = be.errorText(err); }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await be.saveCover({ text: f.text.value.trim(), sub: f.sub.value.trim(), image: f.noimg.checked ? '' : image });
      toast('저장했습니다'); setTimeout(() => location.reload(), 600);
    } catch (err) { $('#cerr').textContent = be.errorText(err); }
  });
}

/* ---------------- 홍보 광고 문구 ---------------- */
// 광고 하나 = 칸 묶음 하나. 저장하면 목록 전체를 한 번에 올림
const TONES = [['navy', '남색'], ['ink', '검정'], ['teal', '청록']];
const adCard = (a, i) => `<fieldset class="form-card ad-edit" data-i="${i}">
  <legend>광고 ${i + 1}</legend>
  <div class="grid-2">
    <div class="field"><label class="lbl">제목 <small>사진 광고에 크게 · 줄바꿈 가능 · 40자</small></label><textarea name="title" rows="2" maxlength="40" required>${esc(a.title || '')}</textarea></div>
    <div class="field"><label class="lbl">짧은 제목 <small>오른쪽·휴대폰용 · 30자</small></label><textarea name="short" rows="2" maxlength="30">${esc(a.short || '')}</textarea></div>
  </div>
  <div class="grid-2">
    <div class="field"><label class="lbl">한 줄 문구 <small>오른쪽 남색 띠 · 30자</small></label><input name="hook" maxlength="30" value="${esc(a.hook || '')}" required></div>
    <div class="field"><label class="lbl">날짜·장소 <small>' · '로 나누면 그 자리에서 줄바꿈</small></label><input name="when" maxlength="40" value="${esc(a.when || '')}"></div>
  </div>
  <div class="grid-2">
    <div class="field"><label class="lbl">꼬리표 <small>예: 예비고1</small></label><input name="tag" maxlength="12" value="${esc(a.tag || '')}"></div>
    <div class="field"><label class="lbl">강사·담당 <small>예: 영어 이건준</small></label><input name="by" maxlength="20" value="${esc(a.by || '')}"></div>
  </div>
  <div class="field"><label class="lbl">누르면 열 주소 <small>밴드 글 주소 · 비우면 태산학원 밴드</small></label><input name="link" maxlength="300" placeholder="https://band.us/..." value="${esc(a.link || '')}"></div>
  <div class="field"><span class="lbl">선생님 사진 <small>둘까지 · 고르지 않으면 글자 광고에만 나옴</small></span>
    <div class="inline wrap">${Object.entries(TEACHERS).map(([id, n]) => `<label class="check"><input type="checkbox" name="who" value="${id}"${a.who?.includes(id) ? ' checked' : ''}>${esc(n)}</label>`).join('')}</div></div>
  <div class="inline wrap"><span class="lbl">바탕색</span>${TONES.map(([v, n]) => `<label class="check"><input type="radio" name="tone-${i}" value="${v}"${(a.tone || 'navy') === v ? ' checked' : ''}>${n}</label>`).join('')}
    <span style="flex:1"></span><button type="button" class="btn sm line" data-up>위로</button><button type="button" class="btn sm danger" data-del>삭제</button></div>
</fieldset>`;

async function adsTab(ctx, box) {
  const [banners, draft] = await Promise.all([be.listBanners(), be.getAdsDraft().catch(() => null)]);
  const saved = banners.find((b) => b.id === 'ads');
  if (!ctx.alive()) return;
  let items = (saved?.items?.length ? saved.items : PROMOS).map((a) => ({ ...a, link: a.link || (a.post ? `${ACADEMY_BAND}/${a.post}` : '') }));
  const read = () => $$('.ad-edit', box).map((fs, i) => ({
    id: items[i]?.id || `ad${Date.now().toString(36)}${i}`,
    title: fs.querySelector('[name=title]').value, short: fs.querySelector('[name=short]').value, hook: fs.querySelector('[name=hook]').value,
    when: fs.querySelector('[name=when]').value, tag: fs.querySelector('[name=tag]').value, by: fs.querySelector('[name=by]').value,
    link: fs.querySelector('[name=link]').value.trim(), who: $$('[name=who]:checked', fs).map((c) => c.value).slice(0, 2),
    tone: fs.querySelector(`[name=tone-${i}]:checked`)?.value || 'navy',
  }));
  const draw = () => {
    box.innerHTML = `<div class="form-page" style="margin-top:24px">
      <p class="hint" style="margin-bottom:12px">홈 가운데·오른쪽에 차례로 나오는 태산학원 광고입니다. ${saved ? '관리자가 고친 목록이 쓰이고 있습니다.' : '지금은 기본 광고가 나오고 있습니다.'} 고친 뒤 맨 아래 '저장'을 눌러야 사이트에 반영됩니다. 실적 문구는 확인된 숫자만 넣어 주세요.</p>
      ${draft?.items?.length ? `<div class="ad-draft"><p><strong>AI 초안 ${draft.items.length}개</strong> · ${esc(fullDate(draft.createdAt))} · 밴드 최근 글 ${draft.posts || 0}개로 만듦<br><small>불러오면 아래 목록이 초안으로 바뀝니다. 숫자·날짜를 밴드 글과 맞춰 본 뒤 '저장'을 눌러야 사이트에 나옵니다.</small></p><button type="button" class="btn line" id="ad-draft">AI 초안 불러오기</button></div>` : ''}
      <form id="adf" novalidate style="display:grid;gap:16px">${items.map(adCard).join('')}
        <div class="form-actions"><button type="button" class="btn line" id="ad-add">광고 추가</button>${saved ? '<button type="button" class="btn line" id="ad-reset">기본 광고로 되돌리기</button>' : ''}<span style="flex:1"></span><p class="err" id="aderr"></p><button class="btn lg">저장</button></div></form></div>`;
  };
  draw();
  box.addEventListener('click', async (e) => {
    const fs = e.target.closest('.ad-edit'), i = fs ? +fs.dataset.i : -1;
    if (e.target.closest('#ad-draft')) { items = draft.items.map((a) => ({ ...a })); draw(); toast('초안을 불러왔습니다. 확인 후 저장해 주세요'); return; }
    if (e.target.closest('#ad-add')) { if (items.length >= 20) return toast('광고는 20개까지입니다'); items = [...read(), { tone: 'navy', who: [] }]; draw(); $$('.ad-edit', box).at(-1).scrollIntoView({ block: 'center' }); }
    else if (e.target.closest('[data-del]')) { items = read(); items.splice(i, 1); draw(); }
    else if (e.target.closest('[data-up]') && i > 0) { items = read(); [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); }
    else if (e.target.closest('#ad-reset')) {
      if (!await confirmBox('기본 광고로 되돌리기', '고친 광고 목록을 지우고 처음 넣어 둔 광고로 돌아갑니다.', '되돌리기', true)) return;
      try { await be.deleteBanner('ads'); resetBanners(); toast('되돌렸습니다'); ctx.go(`#/admin?tab=ads&r=${Date.now()}`); } catch (err) { toast(be.errorText(err)); }
    }
  });
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    items = read();
    const bad = items.findIndex((a) => !a.title.trim() || !a.hook.trim());
    if (bad >= 0) { $('#aderr').textContent = `${bad + 1}번째 광고의 제목과 한 줄 문구를 입력해 주세요.`; return; }
    try { await be.saveAds(items); resetBanners(); await loadPromos(); toast('저장했습니다. 홈에서 바로 보입니다'); ctx.go(`#/admin?tab=ads&r=${Date.now()}`); }
    catch (err) { $('#aderr').textContent = be.errorText(err); }
  });
}

/* ---------------- 입시 일정(홈의 D-day) ---------------- */
async function eventsTab(ctx, box) {
  const all = await be.listBanners();
  if (!ctx.alive()) return;
  const events = all.filter((b) => b.kind === 'event').sort((a, b) => a.date.localeCompare(b.date));
  const texts = all.filter((b) => b.kind === 'text');
  box.innerHTML = `<div class="form-page" style="margin-top:24px">
    <section class="admin-section"><h2>입시 일정 추가</h2>
      <p class="hint" style="margin-bottom:12px">홈의 '입시 일정'에 D-day와 함께 보입니다. 지난 일정은 홈에서 자동으로 빠집니다. 날짜는 공식 발표를 확인해 넣어 주세요.</p>
      <form class="form-card" id="ef" novalidate style="gap:16px">
        <div class="grid-2"><div class="field"><label class="lbl" for="e-date">날짜</label><input id="e-date" name="date" type="date" required></div>
          <div class="field"><label class="lbl" for="e-text">이름</label><input id="e-text" name="text" maxlength="40" placeholder="예: 대학수학능력시험" required></div></div>
        <div class="field"><label class="lbl" for="e-link">링크 <small>선택 · https:// 또는 #/ 로 시작</small></label><input id="e-link" name="link" maxlength="300" placeholder="#/notices"></div>
        <p class="err" id="eerr"></p><div class="form-actions"><button class="btn">추가</button></div></form></section>
    <section class="admin-section"><h2>등록한 일정<span class="num">${events.length}</span></h2>
      ${events.length ? `<table class="admin-table"><thead><tr><th class="r">날짜</th><th class="r">D-day</th><th>이름</th><th></th></tr></thead><tbody>${events.map((e) => `<tr data-id="${esc(e.id)}">
        <td class="num r nowrap" data-label="날짜">${esc(e.date)}</td><td class="num r nowrap" data-label="D-day">${dday(e.date) || '지남'}</td><td>${esc(e.text)}${safeLink(e.link) ? `<span class="sub">${esc(e.link)}</span>` : ''}</td>
        <td><div class="ops"><button type="button" class="btn sm danger" data-del>삭제</button></div></td></tr>`).join('')}</tbody></table>` : '<p class="hint">등록한 일정이 없습니다.</p>'}</section>
    <section class="admin-section"><h2>맨 위 안내 문구<span class="num">${texts.length}</span></h2>
      <p class="hint" style="margin-bottom:12px">모든 화면 맨 위에 한 줄로 보입니다. 여러 개면 6초마다 바뀝니다.</p>
      <form class="inline" id="tf" style="max-width:640px"><input class="input" name="text" maxlength="100" placeholder="예: 11월 고입 설명회 신청을 받습니다"><input class="input" name="link" maxlength="300" placeholder="링크(선택)" style="max-width:180px"><button class="btn line">추가</button></form>
      ${texts.length ? `<table class="admin-table" style="margin-top:12px"><tbody>${texts.map((t) => `<tr data-id="${esc(t.id)}"><td>${esc(t.text)}${safeLink(t.link) ? `<span class="sub">${esc(t.link)}</span>` : ''}</td><td><div class="ops"><button type="button" class="btn sm danger" data-del>삭제</button></div></td></tr>`).join('')}</tbody></table>` : ''}
    </section></div>`;
  const reload = () => { resetBanners(); ctx.go(`#/admin?tab=events&r=${Date.now()}`); };
  $('#ef').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.date.value || !f.text.value.trim()) { $('#eerr').textContent = '날짜와 이름을 입력해 주세요.'; return; }
    try { await be.addBanner({ kind: 'event', date: f.date.value, text: f.text.value.trim(), link: f.link.value.trim() }); toast('일정을 추가했습니다'); reload(); } catch (err) { $('#eerr').textContent = be.errorText(err); }
  });
  $('#tf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.text.value.trim()) return;
    try { await be.addBanner({ kind: 'text', text: f.text.value.trim(), link: f.link.value.trim() }); toast('안내 문구를 추가했습니다'); reload(); } catch (err) { toast(be.errorText(err)); }
  });
  box.addEventListener('click', async (e) => {
    const tr = e.target.closest('[data-id]');
    if (!tr || !e.target.closest('[data-del]')) return;
    if (!await confirmBox('삭제', '이 항목을 삭제합니다.', '삭제', true)) return;
    try { await be.deleteBanner(tr.dataset.id); toast('삭제했습니다'); reload(); } catch (err) { toast(be.errorText(err)); }
  });
}

/* ---------------- 개인정보 열람 기록(2년 보관) ---------------- */
const ACTIONS = { 'list-private': '회원 목록(개인정보 포함) 열람', 'view-private': '회원 개인정보 열람', 'set-banned': '이용 정지·해제', 'set-role': '권한 변경', 'set-role,banned': '권한·정지 변경' };
async function auditTab(ctx, box) {
  const month = /^\d{4}-\d{2}$/.test(ctx.q.get('m') || '') ? ctx.q.get('m') : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7);
  const [list, users] = await Promise.all([be.listAudit(month), be.listUsers({ withPrivate: false }).catch(() => [])]);
  if (!ctx.alive()) return;
  const name = new Map(users.map((u) => [u.uid, u.nickname]));
  const pad = (n) => String(n).padStart(2, '0');
  const at = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  box.innerHTML = `<div class="toolbar"><input class="input" type="month" id="am" value="${month}" aria-label="달" style="max-width:200px"><span class="hint">관리자가 회원 개인정보를 보거나 바꾼 기록입니다. 법에 따라 2년 동안 보관하고 지울 수 없습니다.</span></div>
    ${list.length ? `<table class="admin-table"><thead><tr><th class="r">시각</th><th>관리자</th><th>한 일</th><th>대상</th></tr></thead><tbody>${list.map((l) => `<tr>
      <td class="num r nowrap" data-label="시각">${at(l.at)}</td><td data-label="관리자">@${esc(l.admin)}</td><td data-label="한 일">${esc(ACTIONS[l.action] || l.action)}${l.count > 1 ? ` <span class="sub">${l.count}명</span>` : ''}</td>
      <td data-label="대상">${l.target === 'members' ? '전체 회원' : esc(name.get(l.target) || '탈퇴한 회원')}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">이 달의 기록이 없습니다.</p>'}`;
  $('#am').addEventListener('change', (e) => ctx.go(`#/admin?tab=audit&m=${e.target.value}`));
}
