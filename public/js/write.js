// 글쓰기·글 고치기: 게시판·말머리, 사진(여러 장), 파일 첨부, 자료실 규칙 동의
import * as be from './backend.js';
import { BOARDS, DATA_RULES, DATA_AGREES } from './boards.js';
import { LIMITS } from './config.js';
import { esc, $, $$, toast, backBar, size, safeImg } from './ui.js';

export async function renderWrite(ctx, editing) {
  const { view, q } = ctx;
  const me = be.currentUser();
  let post = null;
  if (editing) {
    post = await be.getPost(ctx.arg);
    if (!ctx.alive()) return;
    if (!post || post.uid !== me.uid) { view.innerHTML = `${backBar('글 고치기')}<div class="empty">내가 쓴 글만 고칠 수 있어요.</div>`; return; }
  }
  if (me.banned) { view.innerHTML = `${backBar('글쓰기')}<div class="empty">이용이 정지된 계정이라 글을 쓸 수 없어요.</div>`; return; }

  const boards = ['talk', 'study', 'qna', 'data', ...(be.isAdmin() ? ['notice'] : [])];
  let board = post?.board || (boards.includes(q.get('board')) ? q.get('board') : 'talk');
  let cat = post?.category || q.get('category') || '';
  // 사진·파일: { kind: 'old', ...meta } 또는 { kind: 'new', file, url }
  let images = (post?.images || []).map((m) => ({ kind: 'old', ...m }));
  let files = (post?.files || []).map((m) => ({ kind: 'old', ...m }));

  view.innerHTML = `${backBar(editing ? '글 고치기' : '글쓰기')}
    <form class="form" id="wf" novalidate>
      <label class="field"><span>게시판</span>
        <select name="board" ${editing ? 'disabled' : ''}>${boards.map((b) => `<option value="${b}" ${b === board ? 'selected' : ''}>${BOARDS[b].name}</option>`).join('')}</select></label>
      <div class="field"><span id="cat-label">말머리</span><div class="chips" id="cats" style="padding:0;flex-wrap:wrap"></div></div>
      <div id="data-rules"></div>
      <label class="field"><span>제목</span><input class="input" name="title" maxlength="100" value="${esc(post?.title || '')}" placeholder="제목을 입력하세요"></label>
      <label class="field"><span>내용</span><textarea name="body" maxlength="10000" placeholder="내용을 입력하세요">${esc(post?.body || '')}</textarea>
        <small>다른 사람의 실명·학교·연락처·얼굴 사진을 올리지 마세요.</small></label>
      <div class="field" id="source-box"><span>출처 <b style="color:var(--danger)">*</b></span>
        <input class="input" name="source" maxlength="200" value="${esc(post?.source || '')}" placeholder="예: 직접 작성 / ○○고 가정통신문(학교 공개자료)">
        <small>직접 만들었다면 '직접 작성'이라고 적어 주세요.</small></div>
      <div class="field"><span>사진 <small>(최대 ${LIMITS.images}장, 자동으로 줄여서 올려요)</small></span>
        <div class="attach" id="imgs"></div>
        <label class="add-btn" style="display:inline-grid;place-items:center;width:max-content">＋ 사진 추가<input type="file" accept="image/*" multiple hidden id="img-in"></label></div>
      <div class="field"><span>파일 <small>(최대 ${LIMITS.files}개, 1개당 ${LIMITS.fileMB}MB까지)</small></span>
        <div class="attach" id="fls"></div>
        <label class="add-btn" style="display:inline-grid;place-items:center;width:max-content">＋ 파일 추가<input type="file" multiple hidden id="file-in"></label></div>
      <p class="err" id="err"></p>
      <button class="btn" id="submit">${editing ? '고친 내용 저장' : '올리기'}</button>
    </form>`;

  const form = $('#wf');
  const drawBoard = () => {
    const b = BOARDS[board];
    if (!b.categories.some((c) => c.id === cat)) cat = b.categories[0].id;
    $('#cat-label').textContent = board === 'qna' ? '과목' : '말머리';
    $('#cats').innerHTML = b.categories.map((c) => `<button type="button" class="chip ${c.id === cat ? 'on' : ''}" data-cat="${esc(c.id)}">${board === 'qna' ? '' : c.icon} ${esc(c.name)}</button>`).join('');
    $('#source-box').classList.toggle('hidden', board !== 'data');
    $('#data-rules').innerHTML = board === 'data'
      ? `<div class="rules"><h3>⚠️ 자료실 규칙 — 올리기 전에 꼭 읽어 주세요</h3><ol>${DATA_RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></div>
         <div class="field">${DATA_AGREES.map((a, i) => `<label class="check"><input type="checkbox" name="agree${i}"> ${esc(a)}</label>`).join('')}</div>`
      : '';
  };
  drawBoard();
  form.board.addEventListener('change', () => { board = form.board.value; drawBoard(); });
  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    cat = b.dataset.cat;
    $$('#cats .chip').forEach((x) => x.classList.toggle('on', x === b));
  });

  const drawAttach = () => {
    $('#imgs').innerHTML = images.map((im, i) => `<div class="a"><img ${im.kind === 'new' ? `src="${im.url}"` : `data-file="${esc(im.id)}"`} alt=""><button type="button" class="x" data-ri="${i}" aria-label="빼기">✕</button></div>`).join('');
    $('#fls').innerHTML = files.map((f, i) => `<div class="a f">📎 ${esc(f.name)} <small>${size(f.size)}</small><button type="button" class="x" data-rf="${i}" aria-label="빼기">✕</button></div>`).join('');
    $$('#imgs img[data-file]').forEach(async (img) => { try { img.src = await be.fileUrl(img.dataset.file); } catch { /* 미리보기 실패 무시 */ } });
  };
  drawAttach();
  $('#imgs').addEventListener('click', (e) => { const b = e.target.closest('[data-ri]'); if (b) { images.splice(+b.dataset.ri, 1); drawAttach(); } });
  $('#fls').addEventListener('click', (e) => { const b = e.target.closest('[data-rf]'); if (b) { files.splice(+b.dataset.rf, 1); drawAttach(); } });
  $('#img-in').addEventListener('change', (e) => {
    for (const f of e.target.files) {
      if (images.length >= LIMITS.images) { toast(`사진은 ${LIMITS.images}장까지예요`); break; }
      if (!f.type.startsWith('image/')) { toast(`${f.name}: 사진 파일이 아니에요`); continue; }
      images.push({ kind: 'new', file: f, name: f.name, url: URL.createObjectURL(f) });
    }
    e.target.value = '';
    drawAttach();
  });
  $('#file-in').addEventListener('change', (e) => {
    for (const f of e.target.files) {
      if (files.length >= LIMITS.files) { toast(`파일은 ${LIMITS.files}개까지예요`); break; }
      if (f.size > LIMITS.fileMB * 1024 * 1024) { toast(`${f.name}: ${LIMITS.fileMB}MB보다 커서 올릴 수 없어요`); continue; }
      files.push({ kind: 'new', file: f, name: f.name, size: f.size });
    }
    e.target.value = '';
    drawAttach();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err');
    const title = form.title.value.trim(), body = form.body.value.trim(), source = form.source.value.trim();
    err.textContent = '';
    if (!title) { err.textContent = '제목을 입력해 주세요.'; return; }
    if (!body && !images.length && !files.length) { err.textContent = '내용을 입력해 주세요.'; return; }
    if (board === 'data') {
      if (!source) { err.textContent = '자료실 글은 출처를 꼭 적어야 해요.'; return; }
      if (DATA_AGREES.some((_, i) => !form[`agree${i}`].checked)) { err.textContent = '자료실 규칙 확인 항목에 모두 체크해 주세요.'; return; }
    }
    const btn = $('#submit');
    btn.disabled = true;
    const step = (t) => { btn.textContent = t; };
    try {
      // 1) 사진 줄여서 올리기, 첫 사진으로 목록용 미리보기 만들기
      const imgMetas = [];
      let thumb = editing && images[0]?.kind === 'old' && images[0].id === post.images?.[0]?.id ? post.thumb : '';
      for (let i = 0; i < images.length; i++) {
        const im = images[i];
        if (im.kind === 'old') { imgMetas.push({ id: im.id, name: im.name, size: im.size }); continue; }
        step(`사진 올리는 중 ${i + 1}/${images.length}`);
        const small = await be.shrinkImage(im.file);
        const meta = await be.uploadFile(small, im.name.replace(/\.[^.]+$/, '') + '.jpg');
        imgMetas.push({ id: meta.id, name: meta.name, size: meta.size });
        if (i === 0) thumb = await be.blobToDataUrl(await be.shrinkImage(im.file, 480, 0.7));
      }
      if (!images.length) thumb = '';
      // 2) 파일 올리기
      const fileMetas = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.kind === 'old') { fileMetas.push({ id: f.id, name: f.name, size: f.size, type: f.type || '' }); continue; }
        const meta = await be.uploadFile(f.file, f.name, (r) => step(`파일 올리는 중 ${i + 1}/${files.length} (${Math.round(r * 100)}%)`));
        fileMetas.push({ id: meta.id, name: meta.name, size: meta.size, type: meta.type });
      }
      step('저장하는 중…');
      const data = { title, body, category: cat, thumb: safeImg(thumb), images: imgMetas, files: fileMetas, source: board === 'data' ? source : '' };
      let id = post?.id;
      if (editing) {
        await be.updatePost(id, { ...data, approved: board !== 'data' || (be.isAdmin() && !!post.approved) });
      } else {
        id = await be.createPost({ ...data, board });
      }
      toast(board === 'data' && !be.isAdmin() ? '자료를 올렸어요. 관리자 확인 후 공개돼요.' : editing ? '고쳤어요' : '올렸어요');
      location.replace(`#/post/${id}`);
    } catch (e2) {
      console.error(e2);
      err.textContent = be.errorText(e2);
      btn.disabled = false;
      step(editing ? '고친 내용 저장' : '올리기');
    }
  });
}
