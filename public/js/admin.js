// 관리자: 회원 관리(정보 열람·정지·권한), 글 관리(승인·신고·숨김·삭제), 배너(표지) 편집
import * as be from './backend.js';
import { BOARDS } from './boards.js';
import { esc, $, $$, ago, fullDate, toast, icon, empty, pageHead, tagHtml, safeImg, safeLink, confirmBox, dday } from './ui.js';

export async function renderAdmin(ctx) {
  const { view, q } = ctx;
  if (!be.isAdmin()) { view.innerHTML = `${pageHead('관리자')}${empty('관리자만 볼 수 있습니다', 'lock')}`; return; }
  const tabs = [['users', '회원 관리'], ['posts', '글 관리'], ['cover', '표지·안내'], ...(be.has('events') ? [['events', '입시 일정'], ['audit', '열람 기록']] : [])];
  const tab = tabs.some(([id]) => id === q.get('tab')) ? q.get('tab') : 'users';
  view.innerHTML = `${pageHead('관리자', { actions: '<a class="btn line keep" href="#/write?board=notice">공지 쓰기</a>' })}
    <nav class="tabs">${tabs.map(([id, n]) => `<a href="#/admin?tab=${id}" class="${id === tab ? 'on' : ''}">${n}</a>`).join('')}</nav>
    <div id="ab"><div class="loading">불러오는 중</div></div>`;
  const box = $('#ab');
  if (tab === 'users') await usersTab(ctx, box);
  if (tab === 'posts') await postsTab(ctx, box);
  if (tab === 'cover') await coverTab(ctx, box);
  if (tab === 'events') await eventsTab(ctx, box);
  if (tab === 'audit') await auditTab(ctx, box);
}

/* ---------------- 회원 관리 ---------------- */
async function usersTab(ctx, box) {
  const users = (await be.listUsers()).sort((a, b) => b.createdAt - a.createdAt);
  if (!ctx.alive()) return;
  const privs = new Map(await Promise.all(users.map(async (u) => [u.id, u.priv !== undefined ? u.priv : await be.getPrivate(u.id).catch(() => null)])));
  if (!ctx.alive()) return;
  box.innerHTML = `<div class="toolbar"><input class="input" id="uf" placeholder="아이디·닉네임·이름·휴대폰 검색" aria-label="회원 검색"></div>
    <p class="hint" style="margin-bottom:12px">회원 <b class="num" style="color:var(--g900)">${users.length}</b>명 · 개인정보는 학원 업무에만 사용하고 외부로 옮기지 마세요.</p>
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
  const reload = () => ctx.go(`#/admin?tab=events&r=${Date.now()}`);
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
