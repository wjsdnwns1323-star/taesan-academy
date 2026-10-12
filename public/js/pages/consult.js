import { backend, getUser, seed } from '../backend.js';
import { esc, $, formData, toast, CONSENT, phoneOk, fmtDate } from '../ui.js';
import { pageHead, clearCache } from './common.js';

const side = (cur) => `<nav class="side-nav" aria-label="상담 메뉴">
  ${[['온라인 상담', '#/consult', 'online'], ['방문 상담 예약', '#/visit', 'visit'], ['자주 묻는 질문', '#/faq', 'faq']].map(([t, h, k]) => `<a href="${h}" ${cur === k ? 'aria-current="page"' : ''}>${t}</a>`).join('')}
</nav>`;

const schoolOptions = (sel = '') => `<option value="">선택</option>${seed.schools.filter((s) => s.id !== '연합반').map((s) => `<option ${sel === s.id ? 'selected' : ''}>${s.id}</option>`).join('')}<option ${sel === '중학교' ? 'selected' : ''}>중학교</option><option ${sel === '기타' ? 'selected' : ''}>기타</option>`;

export async function online({ el }) {
  const u = getUser();
  el.innerHTML = `${pageHead('온라인 상담', '남겨 주신 질문에는 학원에서 답변을 달아 드립니다. 답변은 로그인 후 내 신청 내역에서 볼 수 있습니다.', [['상담'], ['온라인 상담']])}
  <div class="wrap page"><div class="layout-side">${side('online')}<div class="mid">
    ${u ? '' : '<div class="callout">로그인하지 않아도 상담을 남길 수 있지만, 답변을 사이트에서 보려면 <a class="link" href="#/login?next=/consult">로그인</a>해 주세요. 로그인하지 않으면 전화로 답변드립니다.</div>'}
    <form id="cf" class="card" novalidate>
      <div class="row2">
        <label class="field"><span>이름</span><input class="input" name="name" required value="${esc(u?.name || '')}"></label>
        <label class="field"><span>연락처</span><input class="input" name="phone" inputmode="tel" required placeholder="010-0000-0000" value="${esc(u?.phone || '')}"></label>
      </div>
      <div class="row2">
        <label class="field"><span>학교</span><select class="select" name="school">${schoolOptions(u?.school)}</select></label>
        <label class="field"><span>학년</span><select class="select" name="grade"><option value="">선택</option>${['중3', '고1', '고2', '고3'].map((g) => `<option ${u?.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      </div>
      <div class="row2">
        <label class="field"><span>상담 분야</span><select class="select" name="topic"><option>수강 문의</option><option>시간표·반 배정</option><option>설명회·진단고사</option><option>성적·학습 상담</option><option>기타</option></select></label>
        <label class="field"><span>관심 과목</span><select class="select" name="subject"><option value="">선택</option>${seed.subjects.map((s) => `<option>${s}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>제목</span><input class="input" name="title" required maxlength="80"></label>
      <label class="field"><span>내용</span><textarea class="textarea" name="body" required maxlength="2000" placeholder="현재 성적, 고민, 원하는 수업 시간 등을 적어 주세요."></textarea></label>
      ${CONSENT}
      <p class="form-error" aria-live="polite"></p>
      <button class="btn">상담 남기기</button>
    </form>
  </div></div></div>`;
  const f = $('#cf', el);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(f); const err = f.querySelector('.form-error');
    if (!d.name.trim() || !d.title.trim() || !d.body.trim()) return (err.textContent = '이름, 제목, 내용을 입력해 주세요.');
    if (!phoneOk(d.phone)) return (err.textContent = '연락처를 010-0000-0000 형식으로 입력해 주세요.');
    if (!f.agree.checked) return (err.textContent = '개인정보 수집·이용에 동의해 주세요.');
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      delete d.agree;
      await backend.db.add('consults', { ...d, name: d.name.trim(), phone: d.phone.trim(), uid: getUser()?.uid || '', status: '접수', answer: '' });
      clearCache();
      f.outerHTML = `<div class="card" role="status"><h2 style="font-size:20px;font-weight:900;color:var(--ink)">상담을 접수했습니다.</h2><p style="margin-top:8px;color:var(--muted)">${getUser() ? '답변이 달리면 <a class="link" href="#/mypage">내 신청 내역</a>에서 볼 수 있습니다.' : '남겨 주신 연락처로 연락드립니다.'}</p></div>`;
      toast('상담을 접수했습니다.');
    } catch (ex) { err.textContent = `접수하지 못했습니다. ${ex.message}`; btn.disabled = false; }
  };
}

export async function visit({ el }) {
  const u = getUser();
  const today = new Date(); const min = new Date(today.getTime() + 864e5).toISOString().slice(0, 10);
  const slots = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
  el.innerHTML = `${pageHead('방문 상담 예약', '원하는 날짜와 시간을 고르면 학원에서 확인 후 확정 연락을 드립니다.', [['상담'], ['방문 상담 예약']])}
  <div class="wrap page"><div class="layout-side">${side('visit')}<div class="mid">
    <form id="vf" class="card" novalidate>
      <div class="row2">
        <label class="field"><span>학부모·학생 이름</span><input class="input" name="name" required value="${esc(u?.name || '')}"></label>
        <label class="field"><span>연락처</span><input class="input" name="phone" inputmode="tel" required placeholder="010-0000-0000" value="${esc(u?.phone || '')}"></label>
      </div>
      <div class="row2">
        <label class="field"><span>학생 학교</span><select class="select" name="school">${schoolOptions(u?.school)}</select></label>
        <label class="field"><span>학년</span><select class="select" name="grade"><option value="">선택</option>${['중3', '고1', '고2', '고3'].map((g) => `<option ${u?.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      </div>
      <div class="row2">
        <label class="field"><span>희망 날짜</span><input class="input" type="date" name="date" min="${min}" required></label>
        <label class="field"><span>희망 시간</span><select class="select" name="time" required><option value="">선택</option>${slots.map((s) => `<option>${s}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>방문 장소</span><select class="select" name="branch">${seed.site.branches.map((b) => `<option>${esc(b.name)}</option>`).join('')}</select></label>
      <label class="field"><span>상담하고 싶은 내용 <small>(선택)</small></span><textarea class="textarea" name="memo" style="min-height:90px"></textarea></label>
      ${CONSENT}
      <p class="form-error" aria-live="polite"></p>
      <button class="btn">방문 상담 예약하기</button>
    </form>
  </div></div></div>`;
  const f = $('#vf', el);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(f); const err = f.querySelector('.form-error');
    if (!d.name.trim()) return (err.textContent = '이름을 입력해 주세요.');
    if (!phoneOk(d.phone)) return (err.textContent = '연락처를 010-0000-0000 형식으로 입력해 주세요.');
    if (!d.date || !d.time) return (err.textContent = '희망 날짜와 시간을 골라 주세요.');
    if (!f.agree.checked) return (err.textContent = '개인정보 수집·이용에 동의해 주세요.');
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      delete d.agree;
      await backend.db.add('visits', { ...d, name: d.name.trim(), phone: d.phone.trim(), uid: getUser()?.uid || '', status: '접수' });
      clearCache();
      f.outerHTML = `<div class="card" role="status"><h2 style="font-size:20px;font-weight:900;color:var(--ink)">방문 상담을 신청했습니다.</h2><p style="margin-top:8px;color:var(--muted)">${esc(fmtDate(d.date))} ${esc(d.time)} · ${esc(d.branch)}<br>학원에서 확인 후 확정 연락을 드립니다.</p></div>`;
      toast('방문 상담을 신청했습니다.');
    } catch (ex) { err.textContent = `접수하지 못했습니다. ${ex.message}`; btn.disabled = false; }
  };
}
