// 관리자 화면: 자료 승인, 신고 처리, 회원 관리(권한·정지·개인정보 보기), 공지 쓰기
import * as be from './backend.js';
import { esc, $, $$, ago, toast, backBar, itemHtml, safeImg } from './ui.js';

export async function renderAdmin(ctx) {
  const { view, q } = ctx;
  if (!be.isAdmin()) { view.innerHTML = `${backBar('관리자')}<div class="empty">관리자만 볼 수 있어요.</div>`; return; }
  const tab = q.get('tab') || 'users';
  const tabs = [['users', '회원 관리'], ['posts', '글 관리']];
  view.innerHTML = `${backBar('관리자', '<a class="btn small" href="#/write?board=notice" style="display:grid;place-items:center">공지 쓰기</a>')}
    <nav class="tabs">${tabs.map(([id, n]) => `<a href="#/admin?tab=${id}" class="${id === tab ? 'on' : ''}">${n}</a>`).join('')}</nav>
    <div id="ab"><div class="loading">불러오는 중…</div></div>`;
  const box = $('#ab');

  if (tab === 'posts') {
    const [pending, reports, recent] = await Promise.all([be.listPending(), be.listReports(), be.listPosts({ limit: 100 })]);
    if (!ctx.alive()) return;
    const row = (p) => `<div class="admin-item" data-p="${esc(p.id)}"><div><span class="tag t-${esc(p.board)}">${esc(p.board === 'notice' ? '공지' : p.board)}</span> <b>${esc(p.title)}</b></div>
      <div style="color:var(--muted);font-size:13px">${esc(p.nickname)} · ${ago(p.createdAt)} · 조회 ${p.viewCount || 0} · 댓글 ${p.commentCount || 0}</div>
      <div class="btns"><a class="btn small gray" href="#/post/${esc(p.id)}" style="display:grid;place-items:center">보기</a>
      ${p.board === 'data' && !p.approved ? '<button class="btn small" data-ok>승인</button>' : ''}<button class="btn small dark" data-del>삭제</button></div></div>`;
    box.innerHTML = `<div class="admin-box">
      <h3 class="adm-h">승인 기다리는 자료 (${pending.length})</h3>${pending.map(row).join('') || '<div class="empty">올라온 글이 없어요</div>'}
      <h3 class="adm-h">신고 (${reports.length})</h3>${reports.map((r) => `<div class="admin-item" data-r="${esc(r.id)}">
        <div><b>${esc(r.reason)}</b> <small style="color:var(--muted)">· ${ago(r.createdAt)}</small></div>
        <div style="color:var(--sub);font-size:14px">${r.commentId ? '댓글' : '글'}: ${esc(r.target)} / 글 제목: ${esc(r.postTitle)}</div>
        <div class="btns"><a class="btn small gray" href="#/post/${esc(r.postId)}" style="display:grid;place-items:center">글 열기</a><button class="btn small dark" data-done>처리 완료</button></div></div>`).join('') || '<div class="empty">새 신고가 없어요</div>'}
      <h3 class="adm-h">최근 글 (${recent.length})</h3>${recent.map(row).join('') || '<div class="empty">올라온 글이 없어요</div>'}</div>`;
    const all = [...pending, ...recent];
    box.addEventListener('click', async (e) => {
      try {
        const r = e.target.closest('[data-r]');
        if (r && e.target.closest('[data-done]')) { await be.closeReport(r.dataset.r); r.remove(); toast('처리했어요'); return; }
        const it = e.target.closest('[data-p]');
        if (!it) return;
        const p = all.find((x) => x.id === it.dataset.p);
        if (e.target.closest('[data-ok]')) { await be.approvePost(p, true); toast('승인했어요'); ctx.go(`#/admin?tab=posts&r=${Date.now()}`); }
        if (e.target.closest('[data-del]')) {
          if (!confirm(`'${p.title}' 글을 삭제할까요? 되돌릴 수 없어요.`)) return;
          await be.deletePost(p); it.remove(); toast('삭제했어요');
        }
      } catch (err) { toast(be.errorText(err)); }
    });
  }

  if (tab === 'users') {
    const users = await be.listUsers();
    if (!ctx.alive()) return;
    box.innerHTML = `<div class="card"><p>회원 ${users.length}명. 실명·전화번호는 <b>정보 보기</b>를 눌렀을 때만 불러와요. 개인정보는 학원 업무에만 쓰고 밖으로 옮기지 마세요.</p></div>
      <div class="search-box"><input class="input" id="uf" placeholder="아이디·닉네임으로 찾기"></div>
      <div class="admin-box"><table class="table"><thead><tr><th>회원</th><th>상태</th><th></th></tr></thead><tbody id="ut">
      ${users.sort((a, b) => b.createdAt - a.createdAt).map((u) => `<tr data-u="${esc(u.id)}" data-k="${esc(`${u.username} ${u.nickname}`.toLowerCase())}">
        <td><b>${esc(u.nickname)}</b> · ${esc(u.grade)}<br><small style="color:var(--muted)">@${esc(u.username)} · ${ago(u.createdAt)} 가입</small><div class="priv" style="font-size:13px;color:var(--sub)"></div></td>
        <td>${u.role === 'admin' ? '<span class="badge open">관리자</span>' : '회원'}${u.banned ? '<br><span class="badge" style="color:var(--danger)">정지</span>' : ''}</td>
        <td><div class="btns" style="display:flex;flex-direction:column;gap:6px">
          <button class="btn small gray" data-a="priv">정보 보기</button>
          ${u.id === be.currentUser().uid ? '' : `<button class="btn small gray" data-a="ban">${u.banned ? '정지 해제' : '이용 정지'}</button>
          <button class="btn small gray" data-a="role">${u.role === 'admin' ? '관리자 해제' : '관리자 지정'}</button>`}
        </div></td></tr>`).join('')}</tbody></table></div>`;
    $('#uf').addEventListener('input', (e) => {
      const k = e.target.value.trim().toLowerCase();
      $$('#ut tr').forEach((tr) => tr.classList.toggle('hidden', !!k && !tr.dataset.k.includes(k)));
    });
    $('#ut').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'), tr = e.target.closest('[data-u]');
      if (!b || !tr) return;
      const u = users.find((x) => x.id === tr.dataset.u);
      try {
        if (b.dataset.a === 'priv') {
          const p = await be.getPrivate(u.id);
          $('.priv', tr).innerHTML = p ? `실명 ${esc(p.realName)} · ${esc(p.phone)} · ${esc(p.gender || '')} · ${esc(p.age)}세 · ${esc(p.memberType || '')}${p.childGrade ? `(자녀 ${esc(p.childGrade)})` : ''}${p.guardianConsent ? ' · 보호자 동의' : ''}` : '개인정보 없음';
        } else if (b.dataset.a === 'ban') {
          if (!confirm(`${u.nickname}님을 ${u.banned ? '정지 해제' : '이용 정지'}할까요?`)) return;
          await be.setUserFlags(u.id, { banned: !u.banned });
          toast('바꿨어요'); ctx.go(`#/admin?tab=users&r=${Date.now()}`);
        } else if (b.dataset.a === 'role') {
          if (!confirm(`${u.nickname}님을 ${u.role === 'admin' ? '일반 회원으로' : '관리자로'} 바꿀까요?`)) return;
          await be.setUserFlags(u.id, { role: u.role === 'admin' ? 'member' : 'admin' });
          toast('바꿨어요'); ctx.go(`#/admin?tab=users&r=${Date.now()}`);
        }
      } catch (err) { toast(be.errorText(err)); }
    });
  }
}
