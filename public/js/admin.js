// 관리자 화면: 자료 승인, 신고 처리, 회원 관리(권한·정지·개인정보 보기), 공지 쓰기
import * as be from './backend.js';
import { esc, $, $$, ago, toast, backBar, itemHtml, safeImg } from './ui.js';

export async function renderAdmin(ctx) {
  const { view, q } = ctx;
  if (!be.isAdmin()) { view.innerHTML = `${backBar('관리자')}<div class="empty">관리자만 볼 수 있어요.</div>`; return; }
  const tab = q.get('tab') || 'pending';
  const tabs = [['pending', '자료 승인'], ['reports', '신고'], ['users', '회원'], ['banners', '배너·안내']];
  view.innerHTML = `${backBar('관리자', '<a class="btn small" href="#/write?board=notice" style="display:grid;place-items:center">공지 쓰기</a>')}
    <nav class="tabs">${tabs.map(([id, n]) => `<a href="#/admin?tab=${id}" class="${id === tab ? 'on' : ''}">${n}</a>`).join('')}</nav>
    <div id="ab"><div class="loading">불러오는 중…</div></div>`;
  const box = $('#ab');

  if (tab === 'pending') {
    const list = await be.listPending();
    if (!ctx.alive()) return;
    box.innerHTML = `<div class="card"><p>자료실에 올라온 자료는 여기서 승인해야 공개돼요. 글을 열어 파일을 확인한 뒤 <b>승인</b> 또는 <b>규칙 위반으로 삭제</b>를 누르세요.</p></div>
      <div class="post-list">${list.map(itemHtml).join('') || '<div class="empty">승인 기다리는 자료가 없어요</div>'}</div>`;
  }

  if (tab === 'reports') {
    const list = await be.listReports();
    if (!ctx.alive()) return;
    box.innerHTML = `<div class="admin-box">${list.map((r) => `<div class="admin-item" data-r="${esc(r.id)}">
        <div><b>${esc(r.reason)}</b> <small style="color:var(--muted)">· ${ago(r.createdAt)}</small></div>
        <div style="color:var(--sub);font-size:14px">${r.commentId ? '댓글' : '글'}: ${esc(r.target)}<br>글 제목: ${esc(r.postTitle)}</div>
        <div class="btns"><a class="btn small gray" href="#/post/${esc(r.postId)}" style="display:grid;place-items:center">글 열기</a><button class="btn small dark" data-done>처리 완료</button></div>
      </div>`).join('') || '<div class="empty">새 신고가 없어요</div>'}</div>`;
    box.addEventListener('click', async (e) => {
      const it = e.target.closest('[data-r]');
      if (!it || !e.target.closest('[data-done]')) return;
      try { await be.closeReport(it.dataset.r); it.remove(); toast('처리했어요'); } catch (err) { toast(be.errorText(err)); }
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
          $('.priv', tr).innerHTML = p ? `실명 ${esc(p.realName)} · ${esc(p.phone)} · ${esc(p.age)}세${p.guardianConsent ? ' · 보호자 동의' : ''}` : '개인정보 없음';
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

  if (tab === 'banners') {
    const list = await be.listBanners();
    if (!ctx.alive()) return;
    box.innerHTML = `<form class="form" id="bf">
        <div class="card" style="margin:0"><p><b>배너</b>는 홈·게시판 위에 넘겨 보는 사진이고, <b>상단 안내</b>는 맨 위 띠에 돌아가며 나오는 한 줄 글이에요. 링크는 사이트 안 주소(#/…)나 https:// 주소만 쓸 수 있어요.</p></div>
        <label class="field"><span>종류</span><select name="kind"><option value="image">배너(사진)</option><option value="text">상단 안내(글)</option></select></label>
        <label class="field" id="b-img"><span>배너 사진 <small>(가로로 긴 사진 권장, 자동으로 줄여요)</small></span><input type="file" accept="image/*" name="file"></label>
        <label class="field"><span>글 <small>(상단 안내 문구 / 배너 설명)</small></span><input class="input" name="text" maxlength="100"></label>
        <label class="field"><span>누르면 갈 곳 <small>(선택)</small></span><input class="input" name="link" maxlength="300" placeholder="예: #/community/news 또는 https://…"></label>
        <p class="err" id="berr"></p><button class="btn">추가</button></form>
      <div class="admin-box">${list.map((b) => `<div class="admin-item" data-b="${esc(b.id)}">
          ${b.kind === 'image' ? `<img src="${safeImg(b.image)}" alt="" style="max-height:120px;border-radius:10px;object-fit:cover">` : '<b>상단 안내</b>'}
          <div>${esc(b.text)} <small style="color:var(--muted)">${esc(b.link)}</small></div>
          <div class="btns"><button class="btn small gray" data-del>삭제</button></div></div>`).join('') || '<div class="empty">아직 없어요</div>'}</div>`;
    const f = $('#bf');
    f.kind.addEventListener('change', () => $('#b-img').classList.toggle('hidden', f.kind.value !== 'image'));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const link = f.link.value.trim();
      try {
        if (link && !/^(#\/|https:\/\/)/.test(link)) throw new Error('링크는 #/ 또는 https:// 로 시작해야 해요.');
        let image = '';
        if (f.kind.value === 'image') {
          const file = f.file.files[0];
          if (!file) throw new Error('배너 사진을 골라 주세요.');
          image = await be.blobToDataUrl(await be.shrinkImage(file, 1600, 0.8));
          if (image.length > 900000) image = await be.blobToDataUrl(await be.shrinkImage(file, 1200, 0.7));
        } else if (!f.text.value.trim()) throw new Error('상단 안내 문구를 적어 주세요.');
        await be.addBanner({ kind: f.kind.value, image, text: f.text.value.trim(), link });
        toast('추가했어요. 새로고침하면 보여요.'); ctx.go(`#/admin?tab=banners&r=${Date.now()}`);
      } catch (err) { $('#berr').textContent = be.errorText(err); }
    });
    box.addEventListener('click', async (e) => {
      const it = e.target.closest('[data-b]');
      if (!it || !e.target.closest('[data-del]') || !confirm('삭제할까요?')) return;
      try { await be.deleteBanner(it.dataset.b); it.remove(); toast('삭제했어요'); } catch (err) { toast(be.errorText(err)); }
    });
  }
}
