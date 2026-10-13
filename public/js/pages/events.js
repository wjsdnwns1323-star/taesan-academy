import { backend, getUser, seed } from '../backend.js';
import { esc, $, statusTag, dayParts, isPast, formData, toast, CONSENT, phoneOk } from '../ui.js';
import { load, visible, pageHead, clearCache } from './common.js';
import { imgAttrs, linkAttrs, hydrateMedia, isMedia } from '../media.js';
import { schoolFields, bindSchoolPickers } from '../school.js';
import { POSTERS, posterCodes, posterUrl } from '../data/posters.js';

const baseOf = (e) => (seed.events || []).find((x) => x.id === e.id) || {};
let POSTS = [];
const postsOf = (e) => (e.bandPosts || baseOf(e).bandPosts || []).map((id) => POSTS.find((x) => String(x.id) === String(id) && !x.hidden)).filter(Boolean);
function thumbOf(e) {
  if ((e.imgs || []).length) return e.imgs[0];
  for (const p of postsOf(e)) if ((p.imgs || []).length) return p.imgs[0];
  const c = posterCodes(e.src || baseOf(e).src)[0];
  return c ? posterUrl(c) : '';
}
const isOpen = (e) => e.status !== '종료' && e.status !== '마감' && !isPast(e.date);

export async function list({ el }) {
  const [events0, posts] = await Promise.all([load('events'), load('bandPosts').catch(() => [])]);
  POSTS = posts; const events = visible(events0);
  const open = events.filter(isOpen).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const past = events.filter((e) => !isOpen(e)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const small = (f) => (!isMedia(f) && f.startsWith('images/band/') ? f.replace('images/band/', 'images/band/t/').replace(/\.\w+$/, '.jpg') : f);
  const card = (e) => { const d = dayParts(e.date); const th = thumbOf(e) && small(thumbOf(e)); return `<a class="ev-card" href="#/events/${esc(e.id)}">
    <div class="ev-thumb">${th ? `<img ${imgAttrs(th)} alt="" loading="lazy" ${isMedia(th) ? '' : `onerror="this.onerror=null;this.src='${esc(thumbOf(e))}'"`}>` : ''}
      <div class="ev-date">${d ? `<b class="num">${d.m}.${d.d}</b><span>${d.w}</span>` : '<b>상시</b><span>신청</span>'}</div></div>
    <div class="ev-body"><p class="ev-tags"><span class="tag">${esc(e.type)}</span> ${statusTag(isOpen(e) ? e.status : '종료')}</p>
    <h4>${esc(e.title)}</h4>
    <p class="ev-meta">${esc(e.time)} · ${esc(e.place)}</p><p class="ev-meta">대상 ${esc(e.target)}</p>
    ${e.benefit ? `<p class="ev-gift">🎁 ${esc(e.benefit)}</p>` : ''}</div></a>`; };
  el.innerHTML = `${pageHead('설명회·특강', '고교 선택, 학교별 입시 전략, 진단고사 일정을 안내합니다.', [['학원안내', '#/about'], ['설명회·특강']])}
  <div class="wrap page">
    <h2 class="ev-h">예약 받는 중</h2>
    <div class="ev-grid">${open.map(card).join('') || '<p class="empty">지금 예약 받는 설명회가 없습니다.</p>'}</div>
    <h2 class="ev-h" style="margin-top:48px">지난 설명회·특강</h2>
    <div class="ev-grid">${past.map(card).join('')}</div>
  </div>`;
  hydrateMedia(el);
}

export async function detail({ el, params }) {
  const [e, posts0] = await Promise.all([backend.db.get('events', params.id), load('bandPosts').catch(() => [])]);
  POSTS = posts0;
  if (!e) { el.innerHTML = `<div class="wrap page"><div class="empty"><p>설명회를 찾을 수 없습니다.</p><p><a class="btn" href="#/events">목록으로</a></p></div></div>`; return; }
  const u = getUser();
  const open = isOpen(e);
  const diag = e.type === '진단고사';
  // 밴드에 올라온 설명회 안내(글·고화질 이미지)와 포스터. Firestore에 없으면 기본 데이터에서 가져옵니다.
  const base = (seed.events || []).find((x) => x.id === e.id) || {};
  const posts = postsOf(e).slice(0, 1);
  const shown = new Set();
  const hero = thumbOf(e);
  const fig = (src, cap) => `<figure class="pc-card"><a ${linkAttrs(src)} title="크게 보기"><img ${imgAttrs(src)} alt="${esc(cap)}" loading="lazy"></a></figure>`;
  const posterHtml = posterCodes(e.src || base.src).filter((c) => posterUrl(c) !== hero && !shown.has(c) && shown.add(c)).map((c) => fig(posterUrl(c), POSTERS[c])).join('');
  const own = (e.imgs || []).filter((f) => f !== hero);
  const ownHtml = own.length ? `<section class="plan-sec ev-band"><h4>사진</h4><div class="pc-list" style="margin-top:12px">${own.map((f) => fig(f, e.title)).join('')}</div></section>` : '';
  const bandHtml = posts.map((p) => `<section class="plan-sec ev-band">
      <h4>설명회 안내 <small>${esc(p.date)} · 밴드 게시글</small></h4>
      ${p.text ? `<div class="plan-text">${esc(p.text)}</div>` : ''}
      ${(p.imgs || []).filter((f) => f !== hero).length ? `<div class="pc-list">${(p.imgs || []).filter((f) => f !== hero).map((f) => fig(f, p.title)).join('')}</div>` : ''}
      ${p.bandUrl ? `<p class="plan-src"><a class="link" href="${esc(p.bandUrl)}" target="_blank" rel="noopener">밴드 원문 보기 ›</a></p>` : ''}
    </section>`).join('') + (posterHtml ? `<section class="plan-sec ev-band"><h4>포스터</h4><div class="pc-list" style="margin-top:12px">${posterHtml}</div></section>` : '');
  el.innerHTML = `${pageHead(e.title, '', [['설명회·특강', '#/events'], [e.type]])}
  <div class="wrap page"><div class="profile ev">
    <div>
      ${thumbOf(e) ? `<a class="ev-hero" ${linkAttrs(thumbOf(e))}><img ${imgAttrs(thumbOf(e))} alt="${esc(e.title)}"></a>` : ''}
      <dl class="kv">
        <dt>일시</dt><dd>${e.date ? esc(e.date.replace(/-/g, '.')) + ' ' : ''}${esc(e.time)}${e.dateNote ? ` <small style="color:var(--muted)">(${esc(e.dateNote)})</small>` : ''}</dd>
        <dt>장소</dt><dd>${esc(e.place)}</dd>
        <dt>대상</dt><dd>${esc(e.target)}</dd>
        ${e.speakers ? `<dt>연사</dt><dd>${esc(e.speakers)}</dd>` : ''}
        ${e.benefit ? `<dt>참석 혜택</dt><dd>${esc(e.benefit)}</dd>` : ''}
        <dt>상태</dt><dd>${statusTag(open ? e.status : '종료')}</dd>
      </dl>
      ${(e.program || []).length ? `<div class="block"><h3>${diag ? '진행 순서' : '프로그램'}</h3><ol class="steps">${e.program.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></div>` : ''}
      ${e.body ? `<div class="block"><h3>안내</h3><p style="white-space:pre-line">${esc(e.body)}</p></div>` : ''}
      ${ownHtml}${bandHtml}
    </div>
    <div class="card ev-form">
      ${open ? `<h2 style="font-size:20px;font-weight:900;color:var(--ink);margin-bottom:14px">${diag ? '진단고사 신청' : '예약하기'}</h2>
      <form id="rsv" novalidate>
        <label class="field"><span>${diag ? '학생 이름' : '신청자 이름'}</span><input class="input" name="name" required value="${esc(u?.name || '')}"></label>
        <label class="field"><span>연락처</span><input class="input" name="phone" inputmode="tel" required placeholder="010-0000-0000" value="${esc(u?.phone || '')}"></label>
        ${diag ? '' : schoolFields({ school: u?.school || '', grade: u?.grade || '', label: '학생 학교 (현재)' })}
        <div class="row2">
          ${diag ? '<label class="field"><span>응시 학교</span><select class="select" name="school"><option>대성고</option><option>대신고</option></select></label>' : ''}
          <label class="field"><span>${diag ? '과목' : '인원'}</span>${diag ? '<select class="select" name="subjects"><option>국어</option><option>수학</option><option>영어</option><option>국어·수학·영어</option></select>' : '<select class="select" name="people"><option>1</option><option>2</option><option>3</option></select>'}</label>
        </div>
        ${diag ? '<label class="field"><span>희망 날짜·시간</span><input class="input" name="wish" placeholder="예: 10/18(토) 오후"></label>' : ''}
        ${CONSENT}
        <p class="form-error" aria-live="polite"></p>
        <button class="btn block">${diag ? '신청하기' : '예약하기'}</button>
      </form>` : `<p>${e.status === '마감' ? '예약이 마감되었습니다.' : '종료된 설명회입니다.'}</p><p style="margin-top:12px"><a class="btn ghost block" href="#/events">다른 설명회 보기</a></p>`}
    </div>
  </div></div>`;
  hydrateMedia(el);
  const f = $('#rsv', el);
  if (!f) return;
  bindSchoolPickers(f);
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const d = formData(f); const err = f.querySelector('.form-error');
    if (!d.name.trim()) return (err.textContent = '이름을 입력해 주세요.');
    if (!phoneOk(d.phone)) return (err.textContent = '연락처를 010-0000-0000 형식으로 입력해 주세요.');
    if (!f.agree.checked) return (err.textContent = '개인정보 수집·이용에 동의해 주세요.');
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      await backend.db.add('reservations', {
        eventId: e.id, eventTitle: e.title, eventDate: e.date || '', name: d.name.trim(), phone: d.phone.trim(),
        school: d.school || '', grade: d.grade || '', people: Number(d.people || 1), subjects: d.subjects || '', wish: d.wish || '',
        uid: getUser()?.uid || '', status: '접수',
      });
      clearCache();
      f.outerHTML = `<div class="callout" role="status"><b>${diag ? '신청' : '예약'}을 접수했습니다.</b><br>${diag ? '응시 일정은 개별 연락드립니다.' : '학원에서 확인 후 연락드립니다.'}${getUser() ? '<br><a class="link" href="#/mypage">내 신청 내역 보기</a>' : ''}</div>`;
      toast(diag ? '진단고사 신청 완료' : '설명회 예약 완료');
    } catch (ex) { err.textContent = `접수하지 못했습니다. ${ex.message}`; btn.disabled = false; }
  };
}
