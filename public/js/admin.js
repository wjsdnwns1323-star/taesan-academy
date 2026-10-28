// 관리자: 회원 관리(정보 열람·정지·권한), 글 관리(승인·신고·숨김·삭제), 배너(표지) 편집
import * as be from './backend.js';
import { BOARDS } from './boards.js';
import { esc, $, $$, ago, fullDate, toast, icon, empty, pageHead, tagHtml, safeImg, confirmBox } from './ui.js';

export async function renderAdmin(ctx) {
  const { view, q } = ctx;
  if (!be.isAdmin()) { view.innerHTML = `${pageHead('관리자')}${empty('관리자만 볼 수 있습니다', 'lock')}`; return; }
  const tab = ['users', 'posts', 'cover'].includes(q.get('tab')) ? q.get('tab') : 'users';
  const tabs = [['users', '회원 관리'], ['posts', '글 관리'], ['cover', '배너']];
  view.innerHTML = `${pageHead('관리자', { actions: '<a class="btn line keep" href="#/write?board=notice">공지 쓰기</a>' })}
    <nav class="tabs">${tabs.map(([id, n]) => `<a href="#/admin?tab=${id}" class="${id === tab ? 'on' : ''}">${n}</a>`).join('')}</nav>
    <div id="ab"><div class="loading">불러오는 중</div></div>`;
  const box = $('#ab');
  if (tab === 'users') await usersTab(ctx, box);
  if (tab === 'posts') await postsTab(ctx, box);
  if (tab === 'cover') await coverTab(ctx, box);
}

/* ---------------- 회원 관리 ---------------- */
async function usersTab(ctx, box) {
  const users = (await be.listUsers()).sort((a, b) => b.createdAt - a.createdAt);
  if (!ctx.alive()) return;
  const privs = new Map(await Promise.all(users.map(async (u) => [u.id, await be.getPrivate(u.id).catch(() => null)])));
  if (!ctx.alive()) return;
  box.innerHTML = `<div class="toolbar"><input class="input" id="uf" placeholder="아이디·닉네임·이름·휴대폰 검색" aria-label="회원 검색"></div>
    <p class="hint" style="margin-bottom:12px">회원 <b class="num" style="color:var(--g900)">${users.length}</b>명 · 개인정보는 학원 업무에만 사용하고 외부로 옮기지 마세요.</p>
    <table class="admin-table"><thead><tr><th>회원</th><th>이름</th><th>휴대폰</th><th>성별·나이</th><th>구분</th><th>가입일</th><th>상태</th><th></th></tr></thead>
    <tbody id="ut">${users.map((u) => {
      const p = privs.get(u.id) || {};
      const key = `${u.username} ${u.nickname} ${p.realName || ''} ${p.phone || ''}`.toLowerCase();
      return `<tr data-u="${esc(u.id)}" data-k="${esc(key)}">
        <td><b data-uid="${esc(u.id)}">${esc(u.nickname)}</b><span class="sub">@${esc(u.username)}</span></td>
        <td class="nowrap" data-label="이름">${esc(p.realName || '-')}</td><td class="nowrap num" data-label="휴대폰">${esc(p.phone || '-')}</td>
        <td class="nowrap" data-label="성별·나이">${esc(p.gender || '-')}${p.age ? ` · ${p.age}세` : ''}</td>
        <td class="nowrap" data-label="구분">${esc(p.memberType || u.grade)}${p.childGrade ? `<span class="sub">자녀 ${esc(p.childGrade)}</span>` : (p.memberType === '학생' ? `<span class="sub">${esc(u.grade)}</span>` : '')}</td>
        <td class="nowrap num" data-label="가입일">${u.createdAt ? fullDate(u.createdAt) : '-'}</td>
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
    <div class="cover cover-prev" id="cprev"><div class="cover-in"><p class="cover-eyebrow">TAESAN ADMISSIONS</p><h1 class="cover-title" id="pv-t"></h1><p class="cover-sub" id="pv-s"></p></div></div>
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
    $('#cprev').style.backgroundImage = image && !f.noimg.checked ? `linear-gradient(90deg, rgba(14, 26, 54, 0.82), rgba(14, 26, 54, 0.4)), url("${safeImg(image)}")` : '';
  };
  pv();
  f.addEventListener('input', pv);
  f.file.addEventListener('change', async () => {
    const file = f.file.files[0];
    if (!file) return;
    image = await be.blobToDataUrl(await be.shrinkImage(file, 1800, 0.8));
    if (image.length > 900000) image = await be.blobToDataUrl(await be.shrinkImage(file, 1400, 0.7));
    f.noimg.checked = false; pv();
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await be.saveCover({ text: f.text.value.trim(), sub: f.sub.value.trim(), image: f.noimg.checked ? '' : image });
      toast('저장했습니다'); setTimeout(() => location.reload(), 600);
    } catch (err) { $('#cerr').textContent = be.errorText(err); }
  });
}
