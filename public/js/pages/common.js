import { backend, getUser } from '../backend.js';
import { esc, modal, toast, formData, CONSENT, phoneOk, statusTag } from '../ui.js';
import { POSTERS, TEACHER_POSTERS, posterCodes, posterUrl } from '../data/posters.js';

// 같은 화면에서 여러 번 읽지 않도록 잠깐 보관
const cache = {};
export async function load(col, opts) {
  const k = col + JSON.stringify(opts || {});
  if (!cache[k] || Date.now() - cache[k].t > 30000) cache[k] = { t: Date.now(), p: backend.db.list(col, opts) };
  return cache[k].p;
}
export const clearCache = () => Object.keys(cache).forEach((k) => delete cache[k]);

export const visible = (rows) => rows.filter((r) => !r.hidden);
export const byOrder = (a, b) => (a.order ?? 999) - (b.order ?? 999);

export function pageHead(title, desc = '', crumbs = []) {
  return `<div class="page-head"><div class="wrap">
    <p class="crumb"><a href="#/">홈</a>${crumbs.map(([t, h]) => ` / ${h ? `<a href="${h}">${esc(t)}</a>` : esc(t)}`).join('')}</p>
    <h1>${esc(title)}</h1>${desc ? `<p>${desc}</p>` : ''}
  </div></div>`;
}

const initials = (name = '') => name.slice(-2);
// 강사 사진: 누끼(투명 배경)·얼굴 높이 맞춘 PNG를 씁니다. 예전 데이터의 .jpg 경로도 같은 PNG로 바꿉니다.
export function photoOf(t) {
  if (!t || !t.photo) return '';
  return /^images\/people\/[\w-]+\.jpe?g$/.test(t.photo) ? t.photo.replace(/\.jpe?g$/, '.png') : t.photo;
}
export function monogram(t) {
  if (t.photo) return `<img src="${esc(photoOf(t))}" alt="${esc(t.name)} 선생님" loading="lazy" onerror="this.onerror=null;this.src=this.src.replace(/\\.png$/,'.jpg')">`;
  return `<span class="mono" aria-hidden="true">${esc(initials(t.name))}</span>`;
}
export function avatar(t) {
  if (t && t.photo) return `<span class="avatar"><img src="${esc(photoOf(t))}" alt="" loading="lazy" onerror="this.onerror=null;this.src=this.src.replace(/\\.png$/,'.jpg')"></span>`;
  return `<span class="avatar" aria-hidden="true">${esc(initials(t?.name || '?'))}</span>`;
}

// 담당 학교 목록에서 학년 태그를 뽑습니다(예: 대성고1 → 고1)
export function gradeTags(t) {
  if (t.grades && t.grades.length) return t.grades;
  const g = new Set();
  (t.schools || []).forEach((s) => { const m = s.match(/고\s?([123])|([123])\s*(?:$|[^\d])/); if (/고3|수능/.test(s)) g.add('고3'); else if (m) g.add(`고${m[1] || m[2]}`); });
  if (/연합|확통|기하|공통수학/.test((t.schools || []).join(' ')) && !g.size) g.add('고1').add('고2');
  if ((t.prehigh || []).length) g.add('예비고1');
  return ['예비고1', '고1', '고2', '고3'].filter((x) => g.has(x));
}

export function teacherCard(t) {
  const line = (t.highlights && t.highlights[0]) || '';
  return `<a class="t-card" href="#/teachers/${esc(t.id)}">
    <span class="tags">${gradeTags(t).map((x) => `<span class="tag">${x}</span>`).join('')}</span>
    <span class="subj">${esc(t.subject)}</span><h3>${esc(t.name)}</h3>
    ${line ? `<p class="hl">${esc(line)}</p>` : ''}
    <span class="ph">${monogram(t)}</span>
  </a>`;
}

export const classLabel = (c) => [c.school || '', c.grade, c.subject, c.title].filter(Boolean).join(' ');

// 수강 신청: 로그인하지 않아도 신청서를 남길 수 있고, 로그인하면 내 신청 내역에서 볼 수 있습니다.
export function applyClass(c) {
  const u = getUser();
  const closed = c.status === '마감' || c.term === 'mid';
  modal({
    title: closed ? '대기 신청' : '수강 신청',
    sub: `${esc(classLabel(c))}<br>${esc(c.teacherName || '')} 선생님 · 개강 ${esc(c.start)} · ${esc(c.time || '시간 추후 안내')} ${statusTag(c.status)}`,
    content: `<form novalidate>
      ${closed ? '<div class="callout">마감되었거나 지난 학기 반입니다. 대기 신청을 남기면 자리가 나거나 다음 반이 열릴 때 연락드립니다.</div>' : ''}
      <div class="row2">
        <label class="field"><span>학생 이름</span><input class="input" name="studentName" required value="${esc(u?.studentName || u?.name || '')}"></label>
        <label class="field"><span>연락처</span><input class="input" name="phone" required inputmode="tel" placeholder="010-0000-0000" value="${esc(u?.phone || '')}"></label>
      </div>
      <div class="row2">
        <label class="field"><span>학교</span><input class="input" name="school" value="${esc(c.school && c.school !== '연합반' ? c.school : u?.school || '')}"></label>
        <label class="field"><span>학년</span><input class="input" name="grade" value="${esc(c.grade || u?.grade || '')}"></label>
      </div>
      <label class="field"><span>남길 말 <small>(선택)</small></span><textarea class="textarea" name="memo" style="min-height:80px" placeholder="예: 현재 성적, 희망 시간"></textarea></label>
      ${CONSENT}
      <p class="form-error" aria-live="polite"></p>
      <button class="btn block">${closed ? '대기 신청하기' : '수강 신청하기'}</button>
    </form>`,
    onMount(box, close) {
      const f = box.querySelector('form');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const d = formData(f); const err = f.querySelector('.form-error');
        if (!d.studentName.trim()) return (err.textContent = '학생 이름을 입력해 주세요.');
        if (!phoneOk(d.phone)) return (err.textContent = '연락처를 010-0000-0000 형식으로 입력해 주세요.');
        if (!f.agree.checked) return (err.textContent = '개인정보 수집·이용에 동의해 주세요.');
        const btn = f.querySelector('button.btn'); btn.disabled = true;
        try {
          await backend.db.add('applications', {
            kind: closed ? 'waitlist' : 'enroll', classId: c.id, classLabel: classLabel(c), teacherName: c.teacherName || '',
            term: c.term, studentName: d.studentName.trim(), phone: d.phone.trim(), school: d.school, grade: d.grade,
            memo: d.memo, uid: getUser()?.uid || '', status: '접수',
          });
          close(); clearCache();
          toast(closed ? '대기 신청을 접수했습니다.' : '수강 신청을 접수했습니다. 학원에서 연락드릴게요.');
        } catch (ex) {
          err.textContent = `접수하지 못했습니다. ${ex.message}`; btn.disabled = false;
        }
      };
    },
  });
}

// 강의 내용 보기: 밴드에 올라온 해당 수업 이미지 카드를 팝업으로 보여 줍니다.
export function showClassCards(c, teacher) {
  const own = posterCodes(c.src);
  const more = (TEACHER_POSTERS[teacher?.id || c.teacherId] || []).filter((p) => !own.includes(p) && POSTERS[p]);
  const fig = (code) => `<figure class="pc-card"><a href="${posterUrl(code)}" target="_blank" rel="noopener" title="크게 보기">
      <img src="${posterUrl(code)}" alt="${esc(POSTERS[code])}" loading="lazy"></a>
      <figcaption>${esc(POSTERS[code])}</figcaption></figure>`;
  const when = [c.start && `${c.start} 개강`, c.time].filter(Boolean).join(' · ');
  modal({
    title: classLabel(c) || '강의 내용',
    sub: `${esc(c.teacherName || '')}${c.teacherName ? ' 선생님' : ''}${when ? ` · ${esc(when)}` : ''} ${c.status ? statusTag(c.status) : ''}`,
    content: `<div class="pc-wrap">
      ${own.length ? `<h3 class="pc-h">이 수업 안내</h3><div class="pc-list">${own.map(fig).join('')}</div>` : ''}
      ${more.length ? `<h3 class="pc-h">${esc(c.teacherName || '')} 선생님 수업 소개</h3><div class="pc-list">${more.map(fig).join('')}</div>` : ''}
      ${!own.length && !more.length ? '<p class="empty">아직 올라온 수업 안내 이미지가 없습니다.</p>' : ''}
      <div class="toolbar pc-foot"><button class="btn block" data-apply-now>${c.status === '마감' ? '대기 신청하기' : '수강 신청하기'}</button></div>
    </div>`,
    onMount(box, close) {
      box.closest('.modal').classList.add('modal-cards');
      box.querySelectorAll('.pc-card img').forEach((img) => (img.onerror = () => img.closest('.pc-card').remove()));
      box.querySelector('[data-apply-now]').onclick = () => { close(); applyClass(c); };
    },
  });
}
