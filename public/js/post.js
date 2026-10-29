// 글 보기: 본문·사진·첨부, 좋아요·스크랩·공유, 댓글·답글(고치기·지우기·좋아요·채택·신고), 관리(숨김·삭제·승인), 이전·다음 글
import * as be from './backend.js';
import { BOARDS, DATA_RULES } from './boards.js';
import {
  esc, $, $$, ago, dateTime, shortDate, toast, icon, empty, pageHead, tagHtml, loadImages, linkify, size, safeImg, modal, confirmBox,
  avatarHtml, viewer, pop, copyText, markReadPost, mentionify,
} from './ui.js';

const boardHref = (b) => (b === 'data' ? '#/study' : b === 'notice' ? '#/notices' : `#/community/${b}`);

export async function renderPost(ctx) {
  const { view, arg } = ctx;
  const post = await be.getPost(arg).catch(() => null);
  if (!ctx.alive()) return;
  if (!post) { view.innerHTML = `${pageHead('글을 찾을 수 없습니다')}${empty('삭제되었거나 볼 수 없는 글입니다', 'info')}<p style="text-align:center"><a class="btn line" href="#/community/all">전체글 보기</a></p>`; return; }
  markReadPost(post.id);
  const me = be.currentUser();
  const mine = post.uid === me.uid;
  const admin = be.isAdmin();
  const [liked, comments] = await Promise.all([be.liked(post.id), be.listComments(post.id)]);
  if (!ctx.alive()) return;
  const board = BOARDS[post.board];
  const canReply = be.has('editComment');
  const canMark = be.has('toggleBookmark');
  // @ 뒤에 고를 아이디: 글쓴이와 댓글 쓴 사람(나 빼고)
  const people = () => (canReply ? [...new Set([post.nickname, ...comments.filter((c) => !c.deleted && !c.blocked).map((c) => c.nickname)])].filter((n) => n && n !== me.nickname) : []);

  const status = post.board === 'qna' ? (post.status === 'solved' ? '<span class="tag ok">해결</span>' : '<span class="tag brand">답변 대기</span>') : '';
  const pending = post.board === 'data' && !post.approved && !post.hidden
    ? `<div class="notice-box warn" style="margin-top:20px">${icon('alert')}<div><b>승인 대기 중인 자료입니다.</b> 관리자가 자료실 규칙을 확인한 뒤 공개합니다.${admin ? '' : ' 지금은 작성자와 관리자만 볼 수 있습니다.'}
       ${admin ? '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn sm" id="approve">승인</button><button class="btn sm danger" id="reject">규칙 위반으로 삭제</button></div>' : ''}</div></div>` : '';
  const hiddenNote = post.hidden ? `<div class="notice-box warn" style="margin-top:20px">${icon('lock')}<div><b>숨긴 글입니다.</b> 관리자만 볼 수 있습니다.</div></div>` : '';
  const files = post.files || [];
  const visibleCount = comments.filter((c) => !c.deleted).length;

  dispatchEvent(new CustomEvent('tsc:board', { detail: post.board }));
  view.innerHTML = `<article class="article">
    <header class="article-head">
      <nav class="crumb"><a href="${boardHref(post.board)}">${esc(board?.name || '게시판')}</a>${icon('right')}${tagHtml(post)} ${status}</nav>
      <h1>${esc(post.title)}</h1>
      <div class="article-meta">
        <span class="who">${avatarHtml(post.nickname, post.uid)}<b data-uid="${admin ? esc(post.uid) : ''}">${esc(post.nickname)}</b><span>${esc(post.grade)}</span>
          ${!mine && canReply ? `<button type="button" class="text-btn" id="author-menu" aria-label="${esc(post.nickname)}님 메뉴" aria-haspopup="menu" style="height:24px;padding:0 4px">${icon('more', 'sm')}</button>` : ''}</span>
        <i class="sep"></i><span class="when"><span class="num">${dateTime(post.createdAt)}${post.updatedAt ? ' (수정됨)' : ''}</span><i class="sep"></i><span>조회 <span class="num">${(post.viewCount || 0).toLocaleString()}</span></span></span>
      </div>
      ${pending}${hiddenNote}
    </header>
    <div class="article-body">${linkify(post.body)}</div>
    ${post.images?.length ? `<div class="article-images">${post.images.map((im) => `<img data-file="${esc(im.id)}" alt="첨부 사진" loading="lazy">`).join('')}</div>` : ''}
    ${post.poll ? '<section class="poll" id="poll" aria-label="투표"></section>' : ''}
    ${post.source ? `<p class="source"><b>출처</b>${esc(post.source)}</p>` : ''}
    ${files.length ? `<div class="attach-list"><div class="h">첨부 파일 ${files.length}</div>${files.map((f, i) => `<div class="attach-item">${icon('file')}<span class="nm">${esc(f.name)}</span><small>${size(f.size)}</small>
      <button type="button" class="text-btn" data-dl="${i}">${icon('download', 'sm')}내려받기</button></div>`).join('')}</div>` : ''}
    ${post.board === 'data' ? `<p class="hint" style="margin-bottom:24px">내려받은 자료는 개인 학습에만 써 주세요. ${esc(DATA_RULES[5])}</p>` : ''}
    <div class="article-actions">
      <button type="button" class="like-btn ${liked ? 'on' : ''}" id="like" aria-pressed="${liked}">${icon('heart', 'sm')}좋아요 <span class="num">${post.likeCount || 0}</span></button>
      ${canMark ? `<button type="button" class="like-btn ${post.bookmarked ? 'on' : ''}" id="mark" aria-pressed="${!!post.bookmarked}">${icon('bookmark', 'sm')}스크랩</button>` : ''}
      <button type="button" class="text-btn" id="share" aria-label="링크 복사">${icon('link', 'sm')}<span class="lbl">링크 복사</span></button>
      <span class="tools">
        ${mine ? `<a class="text-btn" href="#/edit/${esc(post.id)}">수정</a>` : ''}
        ${admin ? `<button type="button" class="text-btn" id="hide">${post.hidden ? '다시 공개' : '숨김'}</button>` : ''}
        ${mine || admin ? '<button type="button" class="text-btn danger" id="del">삭제</button>' : ''}
        ${mine ? '' : '<button type="button" class="text-btn" id="report">신고</button>'}
      </span>
    </div>
    ${post.prev || post.next ? `<nav class="post-nav" aria-label="이전·다음 글">
      ${post.next ? `<a href="#/post/${esc(post.next.id)}"><span>${icon('up', 'sm')}다음 글</span><span class="t">${esc(post.next.title)}</span><time>${shortDate(post.next.createdAt)}</time></a>` : ''}
      ${post.prev ? `<a href="#/post/${esc(post.prev.id)}"><span>${icon('down', 'sm')}이전 글</span><span class="t">${esc(post.prev.title)}</span><time>${shortDate(post.prev.createdAt)}</time></a>` : ''}
    </nav>` : ''}
    <div style="display:flex;justify-content:flex-end;padding:8px 0;margin-right:-10px"><a class="text-btn" href="${boardHref(post.board)}">${icon('list', 'sm')}목록</a></div>
    <section class="comments" aria-label="댓글">
      <h2 class="comments-h">댓글<span class="num">${visibleCount}</span></h2>
      <div id="clist"></div>
      ${composer('cform', post.board === 'qna' ? '풀이나 답변을 남겨 주세요' : '댓글을 남겨 주세요')}
    </section>
  </article>`;
  loadImages(view);
  if (post.poll) drawPoll($('#poll'), post, post.poll);
  $$('.article-images img', view).forEach((img) => img.addEventListener('click', () => img.src && viewer(img.src)));

  // 댓글 목록(답글은 원댓글 아래)
  const tops = comments.filter((c) => !c.parentId);
  const kids = (id) => comments.filter((c) => c.parentId === id);
  const one = (c, reply) => {
    const ghost = c.deleted || c.blocked;
    const accepted = post.acceptedCommentId === c.id;
    const own = c.uid === me.uid;
    return `<div class="comment${reply ? ' reply' : ''}${accepted ? ' accepted' : ''}${ghost ? ' ghost' : ''}" data-c="${esc(c.id)}" id="c-${esc(c.id)}">
      ${ghost ? `<span class="avatar" aria-hidden="true">${icon(c.blocked ? 'ban' : 'chat', 'sm')}</span>` : avatarHtml(c.nickname, c.uid)}
      <div>
        ${ghost ? '' : `<div class="comment-head"><b data-uid="${admin ? esc(c.uid) : ''}">${esc(c.nickname)}</b><span>${esc(c.grade)}</span>${c.uid === post.uid ? '<span class="tag brand">작성자</span>' : ''}${accepted ? '<span class="tag ok">채택</span>' : ''}<span class="num">${ago(c.createdAt)}${c.editedAt ? ' · 수정됨' : ''}</span></div>`}
        <div class="comment-body">${c.deleted ? '삭제된 댓글입니다.' : c.blocked ? '차단한 회원의 댓글입니다.' : mentionify(linkify(c.body))}</div>
        ${!ghost && safeImg(c.image) ? `<img class="cimg" src="${safeImg(c.image)}" alt="댓글 사진" loading="lazy">` : ''}
        ${ghost ? '' : `<div class="comment-tools">
          <button type="button" class="text-btn ${c.liked ? 'on' : ''}" data-clike aria-pressed="${!!c.liked}" aria-label="댓글 좋아요">${icon('heart', 'sm')}<span class="num">${c.likeCount || 0}</span></button>
          ${canReply && !reply ? '<button type="button" class="text-btn" data-reply>답글</button>' : ''}
          ${post.board === 'qna' && post.uid === me.uid && !post.acceptedCommentId && !own ? '<button type="button" class="text-btn" data-accept>채택</button>' : ''}
          ${own && canReply ? '<button type="button" class="text-btn" data-cedit>수정</button>' : ''}
          ${own || admin ? '<button type="button" class="text-btn danger" data-cdel>삭제</button>' : ''}
          ${own ? '' : '<button type="button" class="text-btn" data-crep>신고</button>'}
        </div>`}
        <div data-slot></div>
      </div></div>`;
  };
  $('#clist').innerHTML = tops.map((c) => one(c, false) + kids(c.id).map((r) => one(r, true)).join('')).join('')
    || '<p class="hint" style="padding:16px 0">첫 댓글을 남겨 보세요.</p>';
  $$('#clist img.cimg').forEach((img) => img.addEventListener('click', () => viewer(img.src)));
  // 알림에서 들어오면 그 댓글로
  if (location.hash.includes('c=')) document.getElementById(`c-${new URLSearchParams(location.hash.split('?')[1]).get('c')}`)?.scrollIntoView({ block: 'center' });

  // 좋아요·스크랩·공유
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
  let marked = !!post.bookmarked;
  $('#mark')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await be.toggleBookmark(post.id, !marked);
      marked = !marked;
      btn.classList.toggle('on', marked); btn.setAttribute('aria-pressed', marked);
      toast(marked ? '스크랩했어요. 내 정보 > 스크랩에서 볼 수 있어요' : '스크랩을 취소했어요');
    } catch (err) { toast(be.errorText(err)); }
  });
  $('#share').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#/post/${post.id}`;
    if (navigator.share && matchMedia('(max-width: 1023px)').matches) { navigator.share({ title: post.title, url }).catch(() => {}); return; }
    toast(await copyText(url) ? '글 주소를 복사했습니다' : '주소를 복사하지 못했습니다');
  });
  $('#author-menu')?.addEventListener('click', (e) => pop(e.currentTarget, [
    { label: `${post.nickname}님 차단`, icon: 'ban', cls: 'danger', fn: () => blockUser(post.uid, post.nickname) },
  ]));

  // 첨부 내려받기
  $$('[data-dl]', view).forEach((b) => b.addEventListener('click', async () => {
    const f = files[+b.dataset.dl];
    b.disabled = true;
    try {
      const a = document.createElement('a');
      a.href = await be.fileUrl(f.id); a.download = f.name; a.rel = 'noopener'; a.click();
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

  const reload = (cid) => ctx.go(`#/post/${post.id}?r=${Date.now()}${cid ? `&c=${cid}` : ''}`);

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
        likeBtn.classList.toggle('on', on); likeBtn.setAttribute('aria-pressed', on);
        const n = $('.num', likeBtn); n.textContent = +n.textContent + (on ? 1 : -1);
      } else if (e.target.closest('[data-reply]')) {
        const slot = $('[data-slot]', el);
        if (slot.innerHTML) { slot.innerHTML = ''; return; }
        $$('#clist [data-slot]').forEach((s) => { s.innerHTML = ''; });
        slot.innerHTML = `<p class="reply-to">${esc(c.nickname)}님에게 답글</p>${composer('rform', '답글을 남겨 주세요', true)}`;
        wireComposer($('#rform', slot), async (body, image) => { const id = await be.addComment(post, body, image, c.id); reload(id); }, people);
        $('#rform textarea', slot).focus();
      } else if (e.target.closest('[data-cedit]')) {
        const bodyEl = $('.comment-body', el);
        if ($('form', bodyEl)) return;
        bodyEl.innerHTML = `<form class="composer small" data-edit><textarea maxlength="3000" aria-label="댓글 수정">${esc(c.body)}</textarea>
          <div class="composer-bar"><span class="sp"></span><button type="button" class="btn sm line" data-cancel>취소</button><button class="btn sm">저장</button></div></form>`;
        const f = $('form', bodyEl);
        const ta = $('textarea', f);
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
        $('[data-cancel]', f).onclick = () => { bodyEl.innerHTML = mentionify(linkify(c.body)); };
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const v = ta.value.trim();
          if (!v) return;
          try { await be.editComment(post.id, c.id, v); toast('댓글을 고쳤습니다'); reload(c.id); } catch (err) { toast(be.errorText(err)); }
        });
      } else if (e.target.closest('[data-accept]')) {
        if (!await confirmBox('답변 채택', `${c.nickname}님의 답변을 채택합니다. 채택은 바꿀 수 없습니다.`, '채택')) return;
        await be.acceptComment(post, c);
        toast('답변을 채택했습니다'); reload(c.id);
      } else if (e.target.closest('[data-cdel]')) {
        if (!await confirmBox('댓글 삭제', kids(c.id).some((k) => !k.deleted) ? '이 댓글을 삭제합니다. 답글은 남고 이 자리에는 "삭제된 댓글입니다"가 보입니다.' : '이 댓글을 삭제합니다.', '삭제', true)) return;
        await be.deleteComment(post.id, c.id);
        toast('댓글을 삭제했습니다'); reload();
      } else if (e.target.closest('[data-crep]')) {
        await doReport(post, c);
      }
    } catch (err) { toast(be.errorText(err)); }
  });

  wireComposer($('#cform'), async (body, image) => { const id = await be.addComment(post, body, image); reload(id); }, people);
}

// 댓글 입력 상자(사진 1장, 글자 수)
function composer(id, placeholder, small = false) {
  return `<form class="composer${small ? ' small' : ''}" id="${id}">
    <div class="composer-prev hidden" data-prev></div>
    <textarea name="body" rows="2" maxlength="3000" placeholder="${esc(placeholder)}" aria-label="${small ? '답글' : '댓글'}"></textarea>
    <div class="mention-sug hidden" data-sug aria-label="부를 회원"></div>
    <div class="composer-bar"><label>${icon('image', 'sm')}사진<input type="file" accept="image/*" hidden data-img></label><span class="sp"></span><span class="count num" data-count>0/3,000</span><button class="btn sm" data-send>등록</button></div>
  </form>`;
}
// 투표: 아직 안 했고 진행 중이면 고르기, 했거나 끝났으면 결과(글쓴이·관리자는 고르는 칸 옆에 인원도)
function drawPoll(box, post, poll) {
  const end = new Date(poll.endsAt);
  const two = (n) => String(n).padStart(2, '0');
  const when = poll.closed ? '마감됨' : `${end.getMonth() + 1}월 ${end.getDate()}일 ${two(end.getHours())}:${two(end.getMinutes())} 마감`;
  const voting = !poll.mine && !poll.closed;
  const n = (i) => poll.counts?.[i] ?? 0;
  const pct = (i) => (poll.voters ? Math.round((n(i) / poll.voters) * 100) : 0);
  const head = `<div class="poll-h"><b>${icon('poll', 'sm')}투표</b><span>${poll.multi ? '여러 개 선택 · ' : ''}<span class="num">${poll.voters}</span>명 참여 · ${when}</span></div>`;
  if (voting) {
    box.innerHTML = `${head}<form class="poll-list" novalidate>${poll.options.map((o, i) => `<label class="check poll-choice"><input type="${poll.multi ? 'checkbox' : 'radio'}" name="pv" value="${i}"><span>${esc(o)}</span>${poll.counts ? `<small class="num">${n(i)}명</small>` : ''}</label>`).join('')}
      <div class="poll-f"><button class="btn sm" disabled>투표하기</button><small>투표한 뒤에는 바꿀 수 없습니다. 결과는 투표하면 보입니다.</small></div></form>`;
    const f = $('form', box), btn = $('button', f);
    f.addEventListener('change', () => { btn.disabled = !$$('input:checked', f).length; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const choices = $$('input:checked', f).map((x) => +x.value);
      if (!choices.length) return;
      btn.disabled = true;
      try { drawPoll(box, post, await be.votePoll(post.id, choices)); toast('투표했습니다'); } catch (err) { toast(be.errorText(err)); btn.disabled = false; }
    });
    return;
  }
  box.innerHTML = `${head}<ol class="poll-list">${poll.options.map((o, i) => {
    const mine = poll.mine?.includes(i);
    return `<li class="${mine ? 'mine' : ''}"><div class="poll-row"><span class="o">${mine ? icon('check', 'sm') : ''}${esc(o)}</span>${poll.counts ? `<span class="n num">${n(i)}명 · ${pct(i)}%</span>` : ''}</div>
      ${poll.counts ? `<div class="bar" role="img" aria-label="${pct(i)}%"><i style="width:${pct(i)}%"></i></div>` : ''}</li>`;
  }).join('')}</ol>${poll.mine ? '<p class="poll-note">내가 고른 보기에 표시했습니다.</p>' : ''}`;
}

// names(): @ 뒤에 고를 수 있는 아이디(이 글에 글·댓글을 쓴 사람)
function wireComposer(form, onSend, names = () => []) {
  let img = '';
  const ta = $('textarea', form);
  const sug = $('[data-sug]', form);
  const showSug = () => {
    const m = /(?:^|[^a-z0-9_@])@([a-z0-9_]{0,20})$/.exec(ta.value.slice(0, ta.selectionStart));
    const list = m ? names().filter((n) => n.startsWith(m[1]) && n !== m[1]).slice(0, 5) : [];
    sug.innerHTML = list.map((n) => `<button type="button" class="text-btn" data-n="${esc(n)}">@${esc(n)}</button>`).join('');
    sug.classList.toggle('hidden', !list.length);
  };
  sug.addEventListener('mousedown', (e) => e.preventDefault());
  sug.addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    const before = ta.value.slice(0, ta.selectionStart).replace(/@[a-z0-9_]{0,20}$/, `@${b.dataset.n} `);
    ta.value = before + ta.value.slice(ta.selectionStart);
    ta.selectionStart = ta.selectionEnd = before.length;
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  });
  ta.addEventListener('keyup', (e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) showSug(); });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') sug.classList.add('hidden'); });
  const prev = $('[data-prev]', form);
  $('[data-img]', form).addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      img = await be.imageDataUrl(f, 290000, [[900, 0.75], [800, 0.68], [640, 0.6], [480, 0.6]]);
      prev.innerHTML = `<img src="${safeImg(img)}" alt=""><span>사진 1장</span><button type="button" class="text-btn" data-x>빼기</button>`;
      prev.classList.remove('hidden');
      $('[data-x]', prev).onclick = () => { img = ''; prev.classList.add('hidden'); e.target.value = ''; };
    } catch (err) { toast(be.errorText(err)); }
  });
  ta.addEventListener('input', () => {
    ta.style.height = 'auto'; ta.style.height = `${Math.min(240, ta.scrollHeight)}px`;
    $('[data-count]', form).textContent = `${ta.value.length.toLocaleString()}/3,000`;
    showSug();
  });
  // Ctrl+Enter 로 등록
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = ta.value.trim();
    if (!body) { ta.focus(); return; }
    const btn = $('[data-send]', form);
    btn.disabled = true;
    try { await onSend(body, img); } catch (err) { toast(be.errorText(err)); btn.disabled = false; }
  });
}

async function blockUser(uid, nickname) {
  if (!await confirmBox('회원 차단', `앞으로 ${nickname}님의 글과 댓글이 보이지 않습니다. 차단은 내 정보 > 차단한 회원에서 언제든 풀 수 있습니다.`, '차단', true)) return;
  try { await be.setBlock(uid, true); toast(`${nickname}님을 차단했습니다`); location.hash = '#/community/all'; } catch (err) { toast(be.errorText(err)); }
}

const REASONS = ['욕설·비방', '개인정보 노출', '저작권 침해', '음란·불법 내용', '광고·도배', '기타'];
async function doReport(post, comment) {
  const reason = await modal({
    title: comment ? '댓글 신고' : '글 신고',
    body: `<div class="radio-list" role="radiogroup">${REASONS.map((r, i) => `<label><input type="radio" name="reason" value="${r}" ${i ? '' : 'checked'}>${r}</label>`).join('')}</div>
      <textarea class="textarea" name="detail" style="min-height:80px;margin-top:8px;font-size:14px" maxlength="200" placeholder="자세한 내용(선택)"></textarea>
      <p class="hint" style="margin-top:8px">관리자가 확인한 뒤 처리합니다. 누가 신고했는지는 공개하지 않습니다.</p>`,
    buttons: [{ label: '취소', value: null, cls: 'line' }, { label: '신고', value: (box) => {
      const r = $('input[name=reason]:checked', box).value; const d = $('[name=detail]', box).value.trim();
      return d ? `${r}: ${d}` : r;
    } }],
  });
  if (!reason) return;
  try { await be.report({ post, comment, reason: reason.slice(0, 300) }); toast('신고가 접수되었습니다'); } catch (err) { toast(be.errorText(err)); }
}
