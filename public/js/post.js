// 글 보기: 본문·사진·첨부·좋아요·댓글·답변 채택·신고·관리(숨김·삭제·승인)
import * as be from './backend.js';
import { BOARDS, DATA_RULES } from './boards.js';
import { esc, $, $$, ago, dateTime, toast, icon, empty, pageHead, tagHtml, loadImages, linkify, size, safeImg, modal, confirmBox } from './ui.js';

const boardHref = (b) => (b === 'data' ? '#/study' : b === 'notice' ? '#/notices' : `#/community/${b}`);

export async function renderPost(ctx) {
  const { view, arg } = ctx;
  const post = await be.getPost(arg).catch(() => null);
  if (!ctx.alive()) return;
  if (!post) { view.innerHTML = `${pageHead('글을 찾을 수 없습니다')}${empty('삭제되었거나 볼 수 없는 글입니다', 'info')}`; return; }
  const me = be.currentUser();
  const mine = post.uid === me.uid;
  const admin = be.isAdmin();
  const [liked, comments] = await Promise.all([be.liked(post.id), be.listComments(post.id)]);
  if (!ctx.alive()) return;
  const board = BOARDS[post.board];

  const status = post.board === 'qna' ? (post.status === 'solved' ? '<span class="tag ok">해결</span>' : '<span class="tag brand">답변 대기</span>') : '';
  const pending = post.board === 'data' && !post.approved && !post.hidden
    ? `<div class="notice-box warn" style="margin-top:20px">${icon('alert')}<div><b>승인 대기 중인 자료입니다.</b> 관리자가 자료실 규칙을 확인한 뒤 공개합니다.${admin ? '' : ' 지금은 작성자와 관리자만 볼 수 있습니다.'}
       ${admin ? '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn sm" id="approve">승인</button><button class="btn sm danger" id="reject">규칙 위반으로 삭제</button></div>' : ''}</div></div>` : '';
  const hiddenNote = post.hidden ? `<div class="notice-box warn" style="margin-top:20px">${icon('lock')}<div><b>숨긴 글입니다.</b> 관리자만 볼 수 있습니다.</div></div>` : '';
  const files = post.files || [];

  view.innerHTML = `<article class="article">
    <header class="article-head">
      <nav class="crumb"><a href="${boardHref(post.board)}">${esc(board?.name || '게시판')}</a>${icon('right')}${tagHtml(post)} ${status}</nav>
      <h1>${esc(post.title)}</h1>
      <div class="article-meta">
        <span class="avatar">${esc(post.nickname?.[0] || '?')}</span>
        <b data-uid="${admin ? esc(post.uid) : ''}">${esc(post.nickname)}</b><span>${esc(post.grade)}</span>
        <i class="sep"></i><span class="num">${dateTime(post.createdAt)}${post.updatedAt ? ' (수정됨)' : ''}</span>
        <i class="sep"></i><span>조회 <span class="num">${(post.viewCount || 0).toLocaleString()}</span></span>
      </div>
      ${pending}${hiddenNote}
    </header>
    <div class="article-body">${linkify(post.body)}</div>
    ${post.images?.length ? `<div class="article-images">${post.images.map((im) => `<img data-file="${esc(im.id)}" alt="첨부 사진" loading="lazy">`).join('')}</div>` : ''}
    ${post.source ? `<p class="source"><b>출처</b>${esc(post.source)}</p>` : ''}
    ${files.length ? `<div class="attach-list"><div class="h">첨부 파일 ${files.length}</div>${files.map((f, i) => `<div class="attach-item">${icon('file')}<span class="nm">${esc(f.name)}</span><small>${size(f.size)}</small>
      <button type="button" class="btn sm line" data-dl="${i}">${icon('download', 'sm')}내려받기</button></div>`).join('')}</div>` : ''}
    ${post.board === 'data' ? `<p class="hint" style="margin-bottom:24px">내려받은 자료는 개인 학습에만 사용해 주세요. ${esc(DATA_RULES[5])}</p>` : ''}
    <div class="article-actions">
      <button type="button" class="like-btn ${liked ? 'on' : ''}" id="like" aria-pressed="${liked}">${icon('heart', 'sm')}좋아요 <span class="num">${post.likeCount || 0}</span></button>
      <span class="stat">${icon('chat', 'sm')}댓글 <span class="num">${comments.length}</span></span>
      <span class="sp"></span>
      ${mine ? `<a class="text-btn" href="#/edit/${esc(post.id)}" style="display:inline-flex;align-items:center">수정</a>` : ''}
      ${admin ? `<button type="button" class="text-btn" id="hide">${post.hidden ? '다시 공개' : '숨김'}</button>` : ''}
      ${mine || admin ? '<button type="button" class="text-btn danger" id="del">삭제</button>' : ''}
      ${mine ? '' : '<button type="button" class="text-btn" id="report">신고</button>'}
      <a class="text-btn" href="${boardHref(post.board)}" style="display:inline-flex;align-items:center">목록</a>
    </div>
    <section class="comments">
      <h2 class="comments-h">댓글<span class="num">${comments.length}</span></h2>
      <div id="clist"></div>
      <form class="composer" id="cform">
        <div class="composer-prev hidden" id="cprev"></div>
        <textarea name="body" rows="2" maxlength="3000" placeholder="${post.board === 'qna' ? '풀이나 답변을 남겨 주세요' : '댓글을 남겨 주세요'}" aria-label="댓글"></textarea>
        <div class="composer-bar"><label>${icon('image', 'sm')}사진<input type="file" accept="image/*" hidden id="cimg"></label><span class="sp"></span><button class="btn sm" id="csend">등록</button></div>
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
      <div class="comment-head"><span class="avatar">${esc(c.nickname?.[0] || '?')}</span><b data-uid="${admin ? esc(c.uid) : ''}">${esc(c.nickname)}</b><small>${esc(c.grade)}</small>
        ${c.uid === post.uid ? '<span class="tag brand">작성자</span>' : ''}${c.id === post.acceptedCommentId ? '<span class="tag ok">채택된 답변</span>' : ''}</div>
      <div class="comment-body">${linkify(c.body)}</div>
      ${safeImg(c.image) ? `<img src="${safeImg(c.image)}" alt="댓글 사진">` : ''}
      <div class="comment-tools"><span class="text-btn" style="cursor:default">${ago(c.createdAt)}</span>
        <button type="button" class="text-btn ${likedComments.has(c.id) ? 'on' : ''}" data-clike>${icon('heart', 'sm')}<span class="num">${c.likeCount || 0}</span></button>
        ${canAccept && c.uid !== me.uid ? '<button type="button" class="text-btn" data-accept style="color:var(--green)">채택</button>' : ''}
        ${c.uid === me.uid || admin ? '<button type="button" class="text-btn" data-cdel>삭제</button>' : ''}
        ${c.uid === me.uid ? '' : '<button type="button" class="text-btn" data-crep>신고</button>'}
      </div></div>`).join('') || '<p class="hint" style="padding:16px 0">첫 댓글을 남겨 주세요.</p>';

  // 좋아요
  let isLiked = liked, count = post.likeCount || 0, busy = false;
  $('#like').addEventListener('click', async (e) => {
    if (busy) return;
    busy = true;
    const btn = e.currentTarget;
    try {
      await be.toggleLike(post.id, !isLiked);
      isLiked = !isLiked; count += isLiked ? 1 : -1;
      btn.classList.toggle('on', isLiked); btn.setAttribute('aria-pressed', isLiked);
      $('.num', btn).textContent = count;
    } catch (err) { toast(be.errorText(err)); }
    busy = false;
  });

  // 첨부 내려받기
  $$('[data-dl]', view).forEach((b) => b.addEventListener('click', async () => {
    const f = files[+b.dataset.dl];
    b.disabled = true;
    try {
      const a = document.createElement('a');
      a.href = await be.fileUrl(f.id); a.download = f.name; a.click();
    } catch (err) { toast(be.errorText(err)); }
    b.disabled = false;
  }));

  $('#del')?.addEventListener('click', async () => {
    if (!await confirmBox('글 삭제', '이 글을 삭제합니다. 삭제한 글은 되돌릴 수 없습니다.', '삭제', true)) return;
    try { await be.deletePost(post); toast('글을 삭제했습니다'); location.hash = boardHref(post.board); } catch (err) { toast(be.errorText(err)); }
  });
  $('#report')?.addEventListener('click', () => doReport(post));
  $('#hide')?.addEventListener('click', async () => {
    try { await be.setHidden(post, !post.hidden); toast(post.hidden ? '다시 공개했습니다' : '글을 숨겼습니다'); ctx.go(`#/post/${post.id}?r=${Date.now()}`); } catch (err) { toast(be.errorText(err)); }
  });
  $('#approve')?.addEventListener('click', async () => {
    try { await be.approvePost(post, true); toast('자료를 승인했습니다'); ctx.go(`#/post/${post.id}?r=${Date.now()}`); } catch (err) { toast(be.errorText(err)); }
  });
  $('#reject')?.addEventListener('click', async () => {
    if (!await confirmBox('자료 삭제', '규칙 위반 자료로 삭제하고 작성자에게 알립니다.', '삭제', true)) return;
    try { await be.approvePost(post, false); toast('자료를 삭제했습니다'); ctx.go('#/admin?tab=posts'); } catch (err) { toast(be.errorText(err)); }
  });

  // 댓글 버튼
  $('#clist').addEventListener('click', async (e) => {
    const el = e.target.closest('[data-c]');
    if (!el) return;
    const c = comments.find((x) => x.id === el.dataset.c);
    try {
      const likeBtn = e.target.closest('[data-clike]');
      if (likeBtn) {
        const on = !likeBtn.classList.contains('on');
        await be.toggleCommentLike(post.id, c.id, on);
        likeBtn.classList.toggle('on', on);
        const n = $('.num', likeBtn); n.textContent = +n.textContent + (on ? 1 : -1);
      } else if (e.target.closest('[data-accept]')) {
        if (!await confirmBox('답변 채택', `${c.nickname}님의 답변을 채택합니다. 채택은 바꿀 수 없습니다.`, '채택')) return;
        await be.acceptComment(post, c);
        toast('답변을 채택했습니다'); ctx.go(`#/post/${post.id}?r=${Date.now()}`);
      } else if (e.target.closest('[data-cdel]')) {
        if (!await confirmBox('댓글 삭제', '이 댓글을 삭제합니다.', '삭제', true)) return;
        await be.deleteComment(post.id, c.id);
        toast('댓글을 삭제했습니다'); ctx.go(`#/post/${post.id}?r=${Date.now()}`);
      } else if (e.target.closest('[data-crep]')) {
        await doReport(post, c);
      }
    } catch (err) { toast(be.errorText(err)); }
  });

  // 댓글 쓰기(사진 1장)
  let cimg = '';
  $('#cimg').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      cimg = await be.imageDataUrl(f, 290000, [[900, 0.75], [800, 0.68], [640, 0.6], [480, 0.6]]);
      $('#cprev').innerHTML = `<img src="${safeImg(cimg)}" alt=""><span>사진 1장</span><button type="button" class="text-btn" id="cx">빼기</button>`;
      $('#cprev').classList.remove('hidden');
      $('#cx').onclick = () => { cimg = ''; $('#cprev').classList.add('hidden'); };
    } catch (err) { toast(be.errorText(err)); }
  });
  const ta = $('#cform textarea');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(240, ta.scrollHeight)}px`; });
  $('#cform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = ta.value.trim();
    if (!body) { ta.focus(); return; }
    const btn = $('#csend');
    btn.disabled = true;
    try {
      await be.addComment(post, body, cimg);
      ctx.go(`#/post/${post.id}?r=${Date.now()}`);
    } catch (err) { toast(be.errorText(err)); btn.disabled = false; }
  });
}

const REASONS = ['욕설·비방', '개인정보 노출', '저작권 침해', '음란·불법 내용', '광고·도배', '기타'];
async function doReport(post, comment) {
  const reason = await modal({
    title: comment ? '댓글 신고' : '글 신고',
    body: `<div class="radio-list">${REASONS.map((r, i) => `<label><input type="radio" name="reason" value="${r}" ${i ? '' : 'checked'}>${r}</label>`).join('')}</div>
      <textarea class="textarea" name="detail" style="min-height:80px;margin-top:8px" maxlength="200" placeholder="자세한 내용(선택)"></textarea>`,
    buttons: [{ label: '취소', value: null, cls: 'line' }, { label: '신고', value: (box) => {
      const r = $('input[name=reason]:checked', box).value; const d = $('[name=detail]', box).value.trim();
      return d ? `${r}: ${d}` : r;
    } }],
  });
  if (!reason) return;
  try { await be.report({ post, comment, reason: reason.slice(0, 300) }); toast('신고가 접수되었습니다'); } catch (err) { toast(be.errorText(err)); }
}
