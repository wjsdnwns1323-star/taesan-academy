// 글 보기: 본문·사진·파일·좋아요·댓글·답변 채택·신고·관리자 삭제
import * as be from './backend.js';
import { BOARDS, DATA_RULES } from './boards.js';
import { esc, $, $$, ago, toast, backBar, labelHtml, loadImages, linkify, size, safeImg, ICON } from './ui.js';

export async function renderPost(ctx) {
  const { view, arg } = ctx;
  const post = await be.getPost(arg).catch(() => null);
  if (!ctx.alive()) return;
  if (!post) { view.innerHTML = `${backBar('글')}<div class="empty">삭제됐거나 볼 수 없는 글입니다.</div>`; return; }
  const me = be.currentUser();
  const mine = post.uid === me.uid;
  const admin = be.isAdmin();
  const [liked, comments] = await Promise.all([be.liked(post.id), be.listComments(post.id)]);
  if (!ctx.alive()) return;

  const status = post.board === 'qna'
    ? (post.status === 'solved' ? ' <span class="badge solved">해결</span>' : ' <span class="badge open">답변 기다리는 중</span>') : '';
  const pending = post.board === 'data' && !post.approved
    ? `<div class="rules" style="margin-top:12px"><h3>⏳ 승인 대기 중인 자료</h3><p style="margin:0;font-size:14px">관리자가 자료실 규칙에 맞는지 확인한 뒤 공개됩니다.
       ${admin ? '' : '지금은 작성자와 관리자만 볼 수 있어요.'}</p>
       ${admin ? '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn small" id="approve">승인</button><button class="btn small gray" id="reject">규칙 위반으로 삭제</button></div>' : ''}</div>` : '';
  const files = (post.files || []).map((f, i) => `<div class="file">📎 <span class="nm">${esc(f.name)}</span><small>${size(f.size)}</small>
    <button data-dl="${i}">내려받기</button></div>`).join('');

  view.innerHTML = `${backBar(BOARDS[post.board]?.name || '글')}
    <article class="post">
      ${labelHtml(post)}${status}
      <h1>${esc(post.title)}</h1>
      <div class="author" data-uid="${admin ? esc(post.uid) : ''}"><span class="avatar">${esc(post.nickname?.[0] || '?')}</span><div><b>${esc(post.nickname)}</b> · ${esc(post.grade)}<br>${ago(post.createdAt)}${post.updatedAt ? ' · 수정됨' : ''}</div></div>
      ${pending}
      <div class="body">${linkify(post.body)}</div>
      ${post.images?.length ? `<div class="images">${post.images.map((im) => `<img data-file="${esc(im.id)}" alt="첨부 사진">`).join('')}</div>` : ''}
      ${post.source ? `<div class="source">출처: ${esc(post.source)}</div>` : ''}
      ${files ? `<div class="files">${files}</div>` : ''}
      ${post.board === 'data' ? `<p style="font-size:13px;color:var(--muted)">⚠️ 내려받은 자료는 개인 공부에만 쓰고 다른 곳에 다시 올리지 마세요. ${esc(DATA_RULES[5])}</p>` : ''}
      <div class="actions">
        <button class="react ${liked ? 'on' : ''}" id="like" aria-pressed="${liked}">${ICON.heart}<span>${post.likeCount || 0}</span></button>
        <span class="react" style="border:0">${ICON.chat}<span>${comments.length}</span></span>
        <span class="sp"></span>
        ${mine ? `<a class="link-btn" href="#/edit/${post.id}">수정</a>` : ''}
        ${admin ? `<button class="link-btn" id="hide">${post.hidden ? '다시 보이기' : '숨김'}</button>` : ''}
        ${mine || admin ? '<button class="link-btn danger" id="del">삭제</button>' : ''}
        ${mine ? '' : '<button class="link-btn" id="report">신고</button>'}
      </div>
      <section class="comments"><h2>댓글 ${comments.length}</h2><div id="clist"></div>
        <form class="cbox" id="cform">
          <label class="pic" title="사진 붙이기">📷<input type="file" accept="image/*" hidden id="cimg"></label>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="cprev hidden" id="cprev"></div>
          <textarea name="body" rows="1" maxlength="3000" placeholder="${post.board === 'qna' ? '풀이·답변을 남겨 주세요' : '댓글을 남겨 주세요'}"></textarea></div>
          <button class="send">등록</button>
        </form>
      </section>
    </article>`;
  loadImages(view);

  // 댓글 목록
  const likedComments = new Set();
  await Promise.all(comments.map(async (c) => { if (await be.commentLiked(post.id, c.id).catch(() => false)) likedComments.add(c.id); }));
  if (!ctx.alive()) return;
  const canAccept = mine && post.board === 'qna' && !post.acceptedCommentId;
  const sorted = [...comments].sort((a, b) => (b.id === post.acceptedCommentId) - (a.id === post.acceptedCommentId));
  $('#clist').innerHTML = sorted.map((c) => `<div class="comment ${c.id === post.acceptedCommentId ? 'accepted' : ''}" data-c="${esc(c.id)}">
      ${c.id === post.acceptedCommentId ? '<span class="badge solved">✓ 채택된 답변</span>' : ''}
      <div class="author" data-uid="${admin ? esc(c.uid) : ''}"><b>${esc(c.nickname)}</b> · ${esc(c.grade)}${c.uid === post.uid ? ' · <span style="color:var(--accent)">작성자</span>' : ''}</div>
      <div class="body">${linkify(c.body)}</div>
      ${safeImg(c.image) ? `<img src="${safeImg(c.image)}" alt="댓글 사진">` : ''}
      <div class="tools"><span>${ago(c.createdAt)}</span>
        <button data-clike class="${likedComments.has(c.id) ? 'on' : ''}">${ICON.heart}<span>${c.likeCount || 0}</span></button>
        ${canAccept && c.uid !== me.uid ? '<button data-accept class="accept-btn">채택하기</button>' : ''}
        ${c.uid === me.uid || admin ? '<button data-cdel>삭제</button>' : ''}
        ${c.uid === me.uid ? '' : '<button data-crep>신고</button>'}
      </div></div>`).join('') || '<div class="empty" style="padding:24px">첫 댓글을 남겨 보세요</div>';

  // 좋아요
  let isLiked = liked, count = post.likeCount || 0, busy = false;
  $('#like').addEventListener('click', async (e) => {
    if (busy) return;
    busy = true;
    try {
      await be.toggleLike(post.id, !isLiked);
      isLiked = !isLiked; count += isLiked ? 1 : -1;
      e.currentTarget.classList.toggle('on', isLiked);
      $('#like span').textContent = count;
    } catch (err) { toast(be.errorText(err)); }
    busy = false;
  });

  // 파일 내려받기
  $$('[data-dl]', view).forEach((b) => b.addEventListener('click', async () => {
    const f = post.files[+b.dataset.dl];
    b.textContent = '받는 중…';
    try {
      const a = document.createElement('a');
      a.href = await be.fileUrl(f.id); a.download = f.name; a.click();
    } catch (err) { toast(be.errorText(err)); }
    b.textContent = '내려받기';
  }));

  $('#del')?.addEventListener('click', async () => {
    if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
    try { await be.deletePost(post); toast('삭제했어요'); history.back(); } catch (err) { toast(be.errorText(err)); }
  });
  $('#report')?.addEventListener('click', () => doReport(post));
  $('#hide')?.addEventListener('click', async () => {
    try { await be.setHidden(post, !post.hidden); toast(post.hidden ? '다시 보이게 했어요' : '숨겼어요'); ctx.go(`#/post/${post.id}?r=${Date.now()}`); } catch (err) { toast(be.errorText(err)); }
  });
  $('#approve')?.addEventListener('click', async () => {
    try { await be.approvePost(post, true); toast('승인했어요'); ctx.go(`#/post/${post.id}?r=${Date.now()}`); } catch (err) { toast(be.errorText(err)); }
  });
  $('#reject')?.addEventListener('click', async () => {
    if (!confirm('규칙 위반 자료로 삭제할까요? 작성자에게 알림이 갑니다.')) return;
    try { await be.approvePost(post, false); toast('삭제했어요'); ctx.go('#/admin'); } catch (err) { toast(be.errorText(err)); }
  });

  // 댓글 버튼들
  $('#clist').addEventListener('click', async (e) => {
    const el = e.target.closest('[data-c]');
    if (!el) return;
    const c = comments.find((x) => x.id === el.dataset.c);
    try {
      if (e.target.closest('[data-clike]')) {
        const btn = e.target.closest('[data-clike]');
        const on = !btn.classList.contains('on');
        await be.toggleCommentLike(post.id, c.id, on);
        btn.classList.toggle('on', on);
        const sp = $('span', btn); sp.textContent = +sp.textContent + (on ? 1 : -1);
      } else if (e.target.closest('[data-accept]')) {
        if (!confirm(`${c.nickname}님의 답변을 채택할까요? 채택은 바꿀 수 없어요.`)) return;
        await be.acceptComment(post, c);
        toast('채택했어요'); ctx.go(`#/post/${post.id}?r=${Date.now()}`);
      } else if (e.target.closest('[data-cdel]')) {
        if (!confirm('댓글을 삭제할까요?')) return;
        await be.deleteComment(post.id, c.id);
        toast('삭제했어요'); ctx.go(`#/post/${post.id}?r=${Date.now()}`);
      } else if (e.target.closest('[data-crep]')) {
        await doReport(post, c);
      }
    } catch (err) { toast(be.errorText(err)); }
  });

  // 댓글 쓰기(사진 1장 가능)
  let cimg = '';
  $('#cimg').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      cimg = await be.blobToDataUrl(await be.shrinkImage(f, 900, 0.75));
      if (cimg.length > 390000) cimg = await be.blobToDataUrl(await be.shrinkImage(f, 640, 0.6));
      $('#cprev').innerHTML = `<img src="${safeImg(cimg)}" alt=""> 사진 1장 <button type="button" id="cx" class="link-btn">빼기</button>`;
      $('#cprev').classList.remove('hidden');
      $('#cx').onclick = () => { cimg = ''; $('#cprev').classList.add('hidden'); };
    } catch (err) { toast(be.errorText(err)); }
  });
  const ta = $('#cform textarea');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; });
  $('#cform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = ta.value.trim();
    if (!body) { toast('내용을 입력해 주세요'); return; }
    const btn = $('.send', e.target);
    btn.disabled = true;
    try {
      await be.addComment(post, body, cimg);
      ctx.go(`#/post/${post.id}?r=${Date.now()}`);
    } catch (err) { toast(be.errorText(err)); btn.disabled = false; }
  });
}

async function doReport(post, comment) {
  const reason = prompt(`신고 사유를 적어 주세요.\n(예: 욕설·비방, 개인정보 노출, 저작권 침해, 음란물, 광고)`);
  if (!reason?.trim()) return;
  try { await be.report({ post, comment, reason: reason.trim().slice(0, 300) }); toast('신고했어요. 관리자가 확인할게요.'); } catch (err) { toast(be.errorText(err)); }
}
