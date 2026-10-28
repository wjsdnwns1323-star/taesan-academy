// 글쓰기·글 수정: 게시판·말머리, 제목·내용, 사진(여러 장)·파일 첨부, 자료실 규칙 동의
import * as be from './backend.js';
import { BOARDS, DATA_RULES, DATA_AGREES, WRITE_BOARDS } from './boards.js';
import { LIMITS, QNA_OPEN } from './config.js';
import { esc, $, $$, toast, icon, empty, pageHead, size, safeImg } from './ui.js';

export async function renderWrite(ctx, editing) {
  const { view, q } = ctx;
  const me = be.currentUser();
  let post = null;
  if (editing) {
    post = await be.getPost(ctx.arg);
    if (!ctx.alive()) return;
    if (!post || post.uid !== me.uid) { view.innerHTML = `${pageHead('글 수정')}${empty('직접 쓴 글만 수정할 수 있습니다', 'lock')}`; return; }
  }
  if (me.banned) { view.innerHTML = `${pageHead('글쓰기')}${empty('이용이 정지된 계정은 글을 쓸 수 없습니다', 'lock')}`; return; }

  const boards = [...WRITE_BOARDS, ...(QNA_OPEN ? ['qna'] : []), ...(be.isAdmin() ? ['notice'] : [])];
  let board = post?.board || (boards.includes(q.get('board')) ? q.get('board') : 'talk');
  let cat = post?.category || q.get('category') || '';
  // 사진·파일: { kind: 'old', ...meta } 또는 { kind: 'new', file, url }
  const images = (post?.images || []).map((m) => ({ kind: 'old', ...m }));
  const files = (post?.files || []).map((m) => ({ kind: 'old', ...m }));

  view.innerHTML = `<div class="form-page">${pageHead(editing ? '글 수정' : '글쓰기')}
    <form class="form-card" id="wf" novalidate>
      <div class="form-section">
        <div class="field"><label class="lbl" for="w-board">게시판</label>
          <select id="w-board" name="board" ${editing ? 'disabled' : ''}>${boards.map((b) => `<option value="${b}" ${b === board ? 'selected' : ''}>${BOARDS[b].name}</option>`).join('')}</select></div>
        <div class="field"><span id="cat-label">말머리</span><div class="segmented" id="cats" role="radiogroup"></div></div>
        ${be.isAdmin() && !editing ? '<label class="check"><input type="checkbox" name="pinned">이 게시판 공지로 등록(목록 맨 위에 고정)</label>' : ''}
      </div>
      <div id="data-rules" class="hidden"></div>
      <div class="form-section">
        <div class="field"><label class="lbl" for="w-title">제목<span class="req">*</span></label><input id="w-title" name="title" maxlength="100" value="${esc(post?.title || '')}" placeholder="제목을 입력하세요"></div>
        <div class="field"><label class="lbl" for="w-body">내용<span class="req">*</span></label><textarea id="w-body" name="body" maxlength="10000" placeholder="내용을 입력하세요">${esc(post?.body || '')}</textarea>
          <small>다른 사람의 실명·학교·연락처·얼굴 사진은 올리지 마세요.</small></div>
        <div class="field hidden" id="source-box"><label class="lbl" for="w-source">출처<span class="req">*</span></label>
          <input id="w-source" name="source" maxlength="200" value="${esc(post?.source || '')}" placeholder="예: 직접 작성, ○○고 가정통신문(학교 공개 자료)">
          <small>직접 만든 자료는 '직접 작성'으로 적어 주세요.</small></div>
      </div>
      <div class="form-section">
        <div class="field"><span>사진 <small>최대 ${LIMITS.images}장 · 자동으로 줄여 올립니다</small></span>
          <div class="attach" id="imgs"></div><small>내용 칸에 사진을 붙여넣거나, 이 화면에 파일을 끌어 놓아도 됩니다.</small>
          <label class="add-file">${icon('image', 'sm')}사진 추가<input type="file" accept="image/*" multiple hidden id="img-in"></label></div>
        <div class="field"><span>파일 <small>최대 ${LIMITS.files}개 · 1개당 ${LIMITS.fileMB}MB</small></span>
          <div class="attach" id="fls"></div>
          <label class="add-file">${icon('clip', 'sm')}파일 추가<input type="file" multiple hidden id="file-in"></label></div>
      </div>
      <p class="err" id="err"></p>
      <div class="form-actions"><span class="draft num" id="draft" aria-live="polite"></span><button type="button" class="btn line lg" data-back>취소</button><button class="btn lg" id="submit">${editing ? '수정 완료' : '등록'}</button></div>
    </form></div>`;

  const form = $('#wf');
  const drawBoard = () => {
    const b = BOARDS[board];
    if (!b.categories.some((c) => c.id === cat)) cat = b.categories[0].id;
    $('#cat-label').textContent = board === 'qna' ? '과목' : '말머리';
    $('#cats').innerHTML = b.categories.map((c) => `<button type="button" role="radio" aria-checked="${c.id === cat}" class="${c.id === cat ? 'on' : ''}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('');
    $('#source-box').classList.toggle('hidden', board !== 'data');
    const dr = $('#data-rules');
    dr.classList.toggle('hidden', board !== 'data');
    dr.innerHTML = board === 'data'
      ? `<div class="form-section"><div class="notice-box warn">${icon('alert')}<div><b>자료실 규칙</b><ol>${DATA_RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></div></div>
         <div class="agree">${DATA_AGREES.map((a, i) => `<label class="check"><input type="checkbox" name="agree${i}">${esc(a)}</label>`).join('')}</div></div>`
      : '';
  };
  drawBoard();
  form.board.addEventListener('change', () => { board = form.board.value; drawBoard(); });
  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    cat = b.dataset.cat;
    $$('#cats button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
  });

  const drawAttach = () => {
    $('#imgs').innerHTML = images.map((im, i) => `<div class="a"><img ${im.kind === 'new' ? `src="${im.url}"` : `data-file="${esc(im.id)}"`} alt=""><button type="button" class="x" data-ri="${i}" aria-label="사진 빼기">${icon('x')}</button></div>`).join('');
    $('#fls').innerHTML = files.map((f, i) => `<div class="a f">${icon('file', 'sm')}<span>${esc(f.name)}</span><small>${size(f.size)}</small><button type="button" class="x" data-rf="${i}" aria-label="파일 빼기">${icon('x')}</button></div>`).join('');
    $$('#imgs img[data-file]').forEach(async (img) => { try { img.src = await be.fileUrl(img.dataset.file); } catch { /* 미리보기 실패 무시 */ } });
  };
  drawAttach();
  $('#imgs').addEventListener('click', (e) => { const b = e.target.closest('[data-ri]'); if (b) { images.splice(+b.dataset.ri, 1); drawAttach(); } });
  $('#fls').addEventListener('click', (e) => { const b = e.target.closest('[data-rf]'); if (b) { files.splice(+b.dataset.rf, 1); drawAttach(); } });
  const addImages = (list) => {
    for (const f of list) {
      if (images.length >= LIMITS.images) { toast(`사진은 ${LIMITS.images}장까지 올릴 수 있습니다`); break; }
      if (!f.type.startsWith('image/')) { toast(`${f.name}은(는) 사진 파일이 아닙니다`); continue; }
      images.push({ kind: 'new', file: f, name: f.name || '붙여넣은 사진.jpg', url: URL.createObjectURL(f) });
    }
    drawAttach();
  };
  const addFiles = (list) => {
    for (const f of list) {
      if (files.length >= LIMITS.files) { toast(`파일은 ${LIMITS.files}개까지 올릴 수 있습니다`); break; }
      if (f.size > LIMITS.fileMB * 1024 * 1024) { toast(`${f.name}은(는) ${LIMITS.fileMB}MB를 넘어 올릴 수 없습니다`); continue; }
      files.push({ kind: 'new', file: f, name: f.name, size: f.size });
    }
    drawAttach();
  };
  $('#img-in').addEventListener('change', (e) => { addImages([...e.target.files]); e.target.value = ''; });
  $('#file-in').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
  // 내용 칸에 사진 붙여넣기, 글쓰기 칸에 끌어 놓기(사진은 사진으로, 나머지는 첨부 파일로)
  form.body.addEventListener('paste', (e) => {
    const pics = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (pics.length) { e.preventDefault(); addImages(pics); toast(`사진 ${pics.length}장을 붙였습니다`); }
  });
  form.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); form.classList.add('drop-on'); } });
  form.addEventListener('dragleave', (e) => { if (!form.contains(e.relatedTarget)) form.classList.remove('drop-on'); });
  form.addEventListener('drop', (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault(); form.classList.remove('drop-on');
    const all = [...e.dataTransfer.files];
    addImages(all.filter((f) => f.type.startsWith('image/')));
    addFiles(all.filter((f) => !f.type.startsWith('image/')));
  });

  // 임시 저장(새 글만, 이 브라우저에): 3초마다, 등록하면 지움
  const DRAFT = `tsc:draft:${me.uid}`;
  const saveDraft = () => {
    if (editing) return;
    const d = { board, cat, title: form.title.value, body: form.body.value, source: form.source.value, at: Date.now() };
    try {
      if (d.title.trim() || d.body.trim()) { localStorage.setItem(DRAFT, JSON.stringify(d)); $('#draft').textContent = `임시 저장됨 ${new Date(d.at).toTimeString().slice(0, 5)}`; }
    } catch { /* 저장소 사용 불가 */ }
  };
  if (!editing) {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT)); } catch { /* 없음 */ }
    if (d && (d.title || d.body) && Date.now() - d.at < 14 * 86400000) {
      const box = document.createElement('div');
      box.className = 'notice-box';
      box.style.marginBottom = '16px';
      box.innerHTML = `${icon('info')}<div style="flex:1">쓰다 만 글이 있어요: <b>${esc(d.title || '(제목 없음)')}</b> <span class="hint">${new Date(d.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn sm" data-restore>이어서 쓰기</button><button type="button" class="btn sm line" data-drop>지우기</button></div></div>`;
      form.before(box);
      box.querySelector('[data-restore]').onclick = () => {
        if (boards.includes(d.board)) { board = d.board; form.board.value = board; }
        cat = d.cat; drawBoard();
        form.title.value = d.title || ''; form.body.value = d.body || ''; form.source.value = d.source || '';
        box.remove(); form.body.focus();
      };
      box.querySelector('[data-drop]').onclick = () => { try { localStorage.removeItem(DRAFT); } catch { /* 무시 */ } box.remove(); };
    }
    let timer = null;
    form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(saveDraft, 3000); });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err');
    const title = form.title.value.trim(), body = form.body.value.trim(), source = form.source.value.trim();
    const fail = (m, el) => { err.textContent = m; el?.focus(); };
    err.textContent = '';
    if (!title) return fail('제목을 입력해 주세요.', form.title);
    if (!body && !images.length && !files.length) return fail('내용을 입력해 주세요.', form.body);
    if (board === 'data') {
      if (!source) return fail('자료실 글은 출처를 적어야 합니다.', form.source);
      if (DATA_AGREES.some((_, i) => !form[`agree${i}`].checked)) return fail('자료실 규칙 확인 항목에 모두 동의해 주세요.');
    }
    const btn = $('#submit');
    btn.disabled = true;
    const step = (t) => { btn.textContent = t; };
    try {
      // 1) 사진을 줄여 올리고, 첫 사진으로 목록 미리보기를 만듭니다
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
      // 2) 파일
      const fileMetas = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.kind === 'old') { fileMetas.push({ id: f.id, name: f.name, size: f.size, type: f.type || '' }); continue; }
        const meta = await be.uploadFile(f.file, f.name, (r) => step(`파일 올리는 중 ${i + 1}/${files.length} · ${Math.round(r * 100)}%`));
        fileMetas.push({ id: meta.id, name: meta.name, size: meta.size, type: meta.type });
      }
      step('저장하는 중');
      const data = { title, body, category: cat, thumb: safeImg(thumb), images: imgMetas, files: fileMetas, source: board === 'data' ? source : '' };
      if (!editing && form.pinned?.checked) data.pinned = true;
      let id = post?.id;
      if (editing) await be.updatePost(id, { ...data, approved: board !== 'data' || (be.isAdmin() && !!post.approved) });
      else id = await be.createPost({ ...data, board });
      try { if (!editing) localStorage.removeItem(DRAFT); } catch { /* 무시 */ }
      toast(board === 'data' && !be.isAdmin() ? '자료를 올렸습니다. 관리자 확인 후 공개됩니다.' : editing ? '수정했습니다' : '글을 등록했습니다');
      location.replace(`#/post/${id}`);
    } catch (e2) {
      console.error(e2);
      err.textContent = be.errorText(e2);
      btn.disabled = false;
      step(editing ? '수정 완료' : '등록');
    }
  });
}
