import { backend, getUser, isAdmin, getSite, CONTENT, seed } from '../backend.js';
import { esc, $, $$, modal, toast, confirmBox, formData, statusTag, fmtDate } from '../ui.js';
import { clearCache } from './common.js';
import { refreshSite } from '../app.js';

const S = (o) => o.map((x) => (typeof x === 'string' ? [x, x] : x));
const schoolOpts = () => ['', ...seed.schools.map((s) => s.id)];

// 콘텐츠 편집 스키마
const SCHEMA = {
  classes: {
    title: '강좌·시간표', cols: ['term', 'grade', 'school', 'subject', 'teacherName', 'title', 'start', 'time', 'status'],
    fields: [
      ['term', '과정', 'select', S([['final', '기말대비'], ['mid', '중간대비(지난)'], ['pre', '예비고1']])],
      ['grade', '학년', 'select', S(['고1', '고2', '고3', '고2·3', '예비고1'])],
      ['school', '학교', 'select', S(schoolOpts())],
      ['subject', '과목', 'select', S([...seed.subjects, '통합과학', '화학'])],
      ['teacherName', '선생님 이름', 'text'],
      ['title', '강좌/반 이름', 'text'],
      ['start', '개강', 'text', '예: 10/18(일)'],
      ['time', '수업 시간', 'text', '예: 토 13:00-16:00 / 수 17:00-20:00'],
      ['status', '상태', 'select', S(['', '마감임박', '마감', '진행중'])],
      ['order', '정렬 순서', 'number'],
      ['hidden', '숨기기', 'bool'],
    ],
  },
  teachers: {
    title: '선생님', cols: ['name', 'subject', 'schools'],
    fields: [
      ['name', '이름', 'text'], ['subject', '과목', 'select', S([...seed.subjects, '통합과학', '화학'])],
      ['photo', '사진', 'image'], ['grades', '학년 태그(비우면 자동)', 'list'], ['brand', '브랜드명', 'text'],
      ['bio', '약력', 'list'], ['schools', '담당 학교·반', 'list'], ['highlights', '대표 결과', 'list'],
      ['method', '수업 방식', 'list'], ['materials', '교재', 'list'], ['prehigh', '예비고1 과정', 'list'], ['roles', '설명회·특강', 'list'],
      ['order', '정렬 순서', 'number'], ['hidden', '숨기기', 'bool'],
    ],
  },
  events: {
    title: '설명회·특강', cols: ['type', 'title', 'date', 'time', 'status'],
    fields: [
      ['type', '구분', 'select', S(['설명회', '특강', '진단고사'])], ['title', '제목', 'text'],
      ['date', '날짜', 'date'], ['time', '시간', 'text'], ['dateNote', '날짜 메모', 'text'], ['place', '장소', 'text'], ['target', '대상', 'text'],
      ['speakers', '연사', 'text'], ['benefit', '참석 혜택', 'text'], ['program', '프로그램', 'list'], ['body', '안내문', 'textarea'],
      ['status', '상태', 'select', S(['모집중', '마감임박', '마감', '종료'])], ['hidden', '숨기기', 'bool'],
    ],
  },
  results: {
    title: '시험 결과', cols: ['exam', 'school', 'grade', 'teacherName', 'headline', 'provisional', 'featured'],
    fields: [
      ['exam', '시험', 'text', '예: 2026 2학기 중간'], ['teacherName', '선생님', 'text'], ['subject', '과목', 'select', S(seed.subjects)],
      ['school', '학교', 'select', S(schoolOpts())], ['grade', '학년', 'text'], ['headline', '대표 문구', 'text'], ['detail', '세부 내용', 'textarea'],
      ['provisional', '가채점(확정 전)', 'bool'], ['featured', '메인에 노출', 'bool'],
      ['bandLabel', '보라 띠 문구(비우면 미노출)', 'text'], ['bandValue', '보라 띠 숫자', 'text'], ['bandUnit', '보라 띠 단위', 'text'], ['bandOrder', '보라 띠 순서', 'number'], ['hidden', '숨기기', 'bool'],
    ],
  },
  notices: {
    title: '공지사항', cols: ['pinned', 'category', 'title', 'date'],
    fields: [
      ['title', '제목', 'text'], ['category', '분류', 'select', S(['안내', '개강', '설명회', '실적', '예비고1', '진단고사', '휴원'])],
      ['date', '게시일', 'date'], ['pinned', '상단 고정', 'bool'], ['image', '이미지', 'image'], ['body', '내용', 'textarea'], ['hidden', '숨기기', 'bool'],
    ],
  },
  faqs: {
    title: '자주 묻는 질문', cols: ['category', 'q'],
    fields: [['category', '분류', 'select', S(['수강', '수업', '설명회', '기타'])], ['q', '질문', 'text'], ['a', '답변', 'textarea'], ['hidden', '숨기기', 'bool']],
  },
  schools: {
    title: '학교', cols: ['id', 'full', 'type', 'grades'],
    fields: [['id', '짧은 이름(시간표 표기)', 'text'], ['full', '정식 이름', 'text'], ['type', '구분', 'text'], ['grades', '학년', 'list'], ['hidden', '숨기기', 'bool']],
  },
};

// 접수 내역
const REQ = {
  applications: { title: '수강 신청', statuses: ['접수', '연락완료', '등록', '대기', '취소'], cols: (r) => [fmtDate(r.createdAt), r.kind === 'waitlist' ? '대기' : '수강', r.classLabel, r.teacherName, r.studentName, r.phone, `${r.school || ''} ${r.grade || ''}`, r.memo] , head: ['접수일', '구분', '강좌', '선생님', '학생', '연락처', '학교', '메모'] },
  reservations: { title: '설명회·진단고사', statuses: ['접수', '확정', '참석', '불참', '취소'], cols: (r) => [fmtDate(r.createdAt), r.eventTitle, r.name, r.phone, r.school, r.people || '', r.subjects || '', r.wish || ''], head: ['접수일', '설명회', '이름', '연락처', '학교', '인원', '과목', '희망 일시'] },
  consults: { title: '온라인 상담', statuses: ['접수', '답변완료', '전화완료'], cols: (r) => [fmtDate(r.createdAt), r.topic, r.title, r.name, r.phone, `${r.school || ''} ${r.grade || ''}`, r.answer ? '답변함' : ''], head: ['접수일', '분야', '제목', '이름', '연락처', '학교', '답변'] },
  visits: { title: '방문 상담', statuses: ['접수', '확정', '완료', '취소'], cols: (r) => [fmtDate(r.createdAt), `${r.date} ${r.time}`, r.branch, r.name, r.phone, `${r.school || ''} ${r.grade || ''}`, r.memo], head: ['접수일', '희망 일시', '장소', '이름', '연락처', '학교', '메모'] },
};

const NAV = [
  ['', '대시보드'], ['applications', '수강 신청'], ['reservations', '설명회 예약'], ['consults', '온라인 상담'], ['visits', '방문 상담'],
  ['classes', '강좌·시간표'], ['teachers', '선생님'], ['events', '설명회·특강'], ['results', '시험 결과'], ['notices', '공지사항'], ['faqs', 'FAQ'], ['schools', '학교'],
  ['users', '회원'], ['settings', '사이트 설정'], ['data', '데이터 관리'],
];

export async function render({ el, params, go }) {
  const u = getUser();
  if (!u) return go('#/login?next=/admin');
  if (!isAdmin()) {
    el.innerHTML = `<div class="wrap page"><div class="narrow card"><h2 style="font-size:20px;font-weight:900">관리자만 볼 수 있습니다.</h2>
      <p style="margin-top:8px;color:var(--muted)">관리자 권한이 필요하면 원장님께 요청하세요. 관리자 Google 계정으로 로그인했는지 확인해 주세요.</p>
      <p style="margin-top:14px"><a class="btn" href="#/">홈으로</a></p></div></div>`;
    return;
  }
  const tab = params.tab || '';
  const pending = {};
  await Promise.all(Object.keys(REQ).map(async (c) => { pending[c] = (await backend.db.list(c).catch(() => [])).filter((r) => r.status === '접수').length; }));

  el.innerHTML = `<div class="admin">
    <nav class="admin-nav" aria-label="관리 메뉴">${NAV.map(([k, t]) => `<a href="#/admin${k ? '/' + k : ''}" ${tab === k ? 'aria-current="page"' : ''}>${t}${pending[k] ? `<span class="cnt num">${pending[k]}</span>` : ''}</a>`).join('')}</nav>
    <section class="admin-main" id="am"></section></div>`;
  const main = $('#am', el);
  try {
    if (!tab) await dashboard(main, pending);
    else if (REQ[tab]) await requests(main, tab);
    else if (SCHEMA[tab]) await content(main, tab);
    else if (tab === 'users') await users(main);
    else if (tab === 'settings') await settings(main);
    else if (tab === 'data') await data(main);
  } catch (e) {
    main.innerHTML = `<div class="callout seal">불러오지 못했습니다: ${esc(e.message)}<br>Firestore 보안 규칙이 배포됐는지, 관리자 이메일 인증을 마쳤는지 확인하세요.</div>`;
  }
}

async function dashboard(main, pending) {
  const [classes, events] = await Promise.all([backend.db.list('classes'), backend.db.list('events')]);
  const open = classes.filter((c) => c.term === 'final' && !c.hidden);
  main.innerHTML = `<h1>대시보드</h1>
  ${backend.mode === 'local' ? '<div class="callout">체험 모드입니다. 여기서 바꾼 내용은 이 브라우저에만 저장됩니다. Firebase를 연결하면 모든 방문자에게 반영됩니다.</div>' : ''}
  <div class="stats">${Object.entries(REQ).map(([k, v]) => `<a class="stat" href="#/admin/${k}"><span>새 ${v.title}</span><b class="num">${pending[k] || 0}</b></a>`).join('')}</div>
  <div class="stats">
    <div class="stat"><span>기말대비 반</span><b class="num">${open.length}</b></div>
    <div class="stat"><span>마감 반</span><b class="num">${open.filter((c) => c.status === '마감').length}</b></div>
    <div class="stat"><span>예약 받는 설명회</span><b class="num">${events.filter((e) => ['모집중', '마감임박'].includes(e.status)).length}</b></div>
    <div class="stat"><span>운영 모드</span><b style="font-size:20px">${backend.mode === 'firebase' ? 'Firebase' : '체험 모드'}</b></div>
  </div>
  <div class="callout">공개 전에 확인할 것: 원장님 성함·인사말, 2관 주소, 운영시간, 카카오톡 채널 주소(사이트 설정), 선생님 사진(선생님), 김현·정정래 소장 소속 표기.</div>`;
}

function toCSV(head, rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function requests(main, col) {
  const cfg = REQ[col];
  let rows = (await backend.db.list(col)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const st = { status: '전체', q: '' };
  main.innerHTML = `<h1>${cfg.title}</h1>
    <div class="toolbar"><select class="select" id="fs"><option>전체</option>${cfg.statuses.map((s) => `<option>${s}</option>`).join('')}</select>
    <input class="input" id="fq" placeholder="이름·연락처·내용 검색"><button class="btn sm ghost" id="csv">CSV 내려받기</button></div>
    <div style="overflow-x:auto"><table class="grid-table"><thead><tr>${cfg.head.map((h) => `<th>${h}</th>`).join('')}<th>상태</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const filtered = () => rows.filter((r) => (st.status === '전체' || r.status === st.status) && (!st.q || JSON.stringify(r).includes(st.q)));
  const draw = () => {
    const list = filtered();
    $('#tb', main).innerHTML = list.length ? list.map((r) => `<tr>${cfg.cols(r).map((v) => `<td>${esc(v)}</td>`).join('')}
      <td><select class="select" style="min-height:32px;padding:2px 6px;width:auto" data-st="${esc(r.id)}">${cfg.statuses.map((s) => `<option ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td class="act"><button class="btn sm ghost" data-open="${esc(r.id)}">${col === 'consults' ? '답변' : '메모'}</button> <button class="btn sm danger" data-del="${esc(r.id)}">삭제</button></td></tr>`).join('')
      : `<tr><td colspan="${cfg.head.length + 2}" class="empty">접수된 내역이 없습니다.</td></tr>`;
    $$('[data-st]', main).forEach((s) => (s.onchange = async () => { await backend.db.update(col, s.dataset.st, { status: s.value }); rows.find((r) => r.id === s.dataset.st).status = s.value; toast(`상태를 ${s.value}(으)로 바꿨습니다.`); }));
    $$('[data-del]', main).forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox('이 접수 내역을 삭제할까요? 되돌릴 수 없습니다.'))) return;
      await backend.db.remove(col, b.dataset.del); rows = rows.filter((r) => r.id !== b.dataset.del); draw(); toast('삭제했습니다.');
    }));
    $$('[data-open]', main).forEach((b) => (b.onclick = () => {
      const r = rows.find((x) => x.id === b.dataset.open);
      const key = col === 'consults' ? 'answer' : 'adminNote';
      modal({
        title: col === 'consults' ? r.title : '관리 메모',
        sub: `${esc(r.name || r.studentName || '')} · ${esc(r.phone || '')}`,
        content: `${col === 'consults' ? `<div class="answer" style="margin-bottom:14px;background:#fff;border:1px solid var(--line)">${esc(r.body)}</div>` : ''}
          <form><label class="field"><span>${col === 'consults' ? '답변 (회원은 내 신청 내역에서 봅니다)' : '메모 (수강 신청은 회원에게 보입니다)'}</span><textarea class="textarea" name="v">${esc(r[key] || '')}</textarea></label><button class="btn block">저장</button></form>`,
        onMount(box, close) {
          box.querySelector('form').onsubmit = async (e) => {
            e.preventDefault(); const v = box.querySelector('textarea').value;
            const patch = { [key]: v, ...(col === 'consults' && v ? { status: '답변완료' } : {}) };
            await backend.db.update(col, r.id, patch); Object.assign(r, patch); close(); draw(); toast('저장했습니다.');
          };
        },
      });
    }));
  };
  $('#fs', main).onchange = (e) => { st.status = e.target.value; draw(); };
  $('#fq', main).oninput = (e) => { st.q = e.target.value.trim(); draw(); };
  $('#csv', main).onclick = () => download(`${cfg.title}_${new Date().toISOString().slice(0, 10)}.csv`, toCSV([...cfg.head, '상태'], filtered().map((r) => [...cfg.cols(r), r.status])));
  draw();
}

function fieldHTML([key, label, type, opt], v) {
  const id = `f-${key}`;
  if (type === 'bool') return `<label class="check" style="margin-bottom:12px"><input type="checkbox" name="${key}" ${v ? 'checked' : ''}> ${label}</label>`;
  if (type === 'select') return `<label class="field"><span>${label}</span><select class="select" name="${key}">${opt.map(([val, t]) => `<option value="${esc(val)}" ${String(v ?? '') === String(val) ? 'selected' : ''}>${esc(t || '(없음)')}</option>`).join('')}</select></label>`;
  if (type === 'textarea') return `<label class="field"><span>${label}</span><textarea class="textarea" name="${key}">${esc(v || '')}</textarea></label>`;
  if (type === 'list') return `<label class="field"><span>${label}</span><textarea class="textarea" style="min-height:90px" name="${key}" placeholder="한 줄에 하나씩">${esc((v || []).join('\n'))}</textarea><small>한 줄에 하나씩 적습니다.</small></label>`;
  if (type === 'image') return `<div class="field"><span>${label}</span>${v ? `<img src="${esc(v)}" alt="" style="max-height:140px;border-radius:6px">` : ''}
    <input class="input" name="${key}" value="${esc(v || '')}" placeholder="이미지 주소 또는 아래에서 파일 올리기"><input type="file" accept="image/*" data-upload="${key}" id="${id}"></div>`;
  return `<label class="field"><span>${label}</span><input class="input" type="${type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}" name="${key}" value="${esc(v ?? '')}" ${opt && typeof opt === 'string' ? `placeholder="${esc(opt)}"` : ''}></label>`;
}

function readForm(form, fields) {
  const d = formData(form); const out = {};
  for (const [key, , type] of fields) {
    if (type === 'bool') out[key] = form[key].checked;
    else if (type === 'list') out[key] = (d[key] || '').split('\n').map((s) => s.trim()).filter(Boolean);
    else if (type === 'number') out[key] = d[key] === '' ? null : Number(d[key]);
    else out[key] = (d[key] ?? '').trim();
  }
  return out;
}

async function content(main, col) {
  const cfg = SCHEMA[col];
  let rows = await backend.db.list(col);
  const seeded = await backend.db.isSeeded(col);
  const st = { q: '', term: col === 'classes' ? 'final' : '' };
  main.innerHTML = `<h1>${cfg.title}</h1>
    ${backend.mode === 'firebase' && !seeded ? `<div class="callout seal">아직 Firestore에 ${cfg.title} 데이터가 없어 기본 데이터를 보여주는 중입니다. 수정하려면 먼저 <a class="link" href="#/admin/data">데이터 관리</a>에서 기본 데이터를 올리세요.</div>` : ''}
    <div class="toolbar">${col === 'classes' ? `<select class="select" id="ft"><option value="">전체 과정</option>${seed.terms.map((t) => `<option value="${t.id}" ${st.term === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>` : ''}
      <input class="input" id="fq" placeholder="검색"><button class="btn sm" id="add">새로 추가</button></div>
    <div style="overflow-x:auto"><table class="grid-table"><thead><tr>${cfg.cols.map((c) => `<th>${esc(cfg.fields.find((f) => f[0] === c)?.[1] || (c === 'id' ? '짧은 이름' : c))}</th>`).join('')}<th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const cell = (r, c) => {
    const v = r[c];
    if (c === 'status') return statusTag(v);
    if (typeof v === 'boolean') return v ? '✓' : '';
    if (Array.isArray(v)) return esc(v.join(', '));
    if (c === 'term') return esc(seed.terms.find((t) => t.id === v)?.short || v);
    return esc(v ?? '');
  };
  const draw = () => {
    const list = rows.filter((r) => (!st.term || r.term === st.term) && (!st.q || JSON.stringify(r).includes(st.q)))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(b.date || '').localeCompare(String(a.date || '')));
    $('#tb', main).innerHTML = list.map((r) => `<tr style="${r.hidden ? 'opacity:.5' : ''}">${cfg.cols.map((c) => `<td>${cell(r, c)}</td>`).join('')}
      <td class="act"><button class="btn sm ghost" data-edit="${esc(r.id)}">수정</button> <button class="btn sm danger" data-del="${esc(r.id)}">삭제</button></td></tr>`).join('') || `<tr><td colspan="${cfg.cols.length + 1}" class="empty">항목이 없습니다.</td></tr>`;
    $$('[data-edit]', main).forEach((b) => (b.onclick = () => edit(rows.find((r) => r.id === b.dataset.edit))));
    $$('[data-del]', main).forEach((b) => (b.onclick = async () => {
      if (locked) { toast('먼저 데이터 관리에서 기본 데이터를 올려 주세요.'); return; }
      if (!(await confirmBox('삭제할까요? 잠시 숨기려면 "숨기기"를 쓰세요.'))) return;
      await backend.db.remove(col, b.dataset.del); rows = rows.filter((r) => r.id !== b.dataset.del); clearCache(); draw(); toast('삭제했습니다.');
    }));
  };
  const locked = backend.mode === 'firebase' && !seeded;
  const edit = (r) => {
    if (locked) { toast('먼저 데이터 관리에서 기본 데이터를 올려 주세요.'); return; }
    const isNew = !r;
    const base = r || (col === 'notices' ? { date: new Date().toISOString().slice(0, 10) } : col === 'classes' ? { term: st.term || 'final' } : {});
    modal({
      title: isNew ? `${cfg.title} 추가` : `${cfg.title} 수정`,
      content: `<form novalidate>${cfg.fields.map((f) => fieldHTML(f, base[f[0]])).join('')}<p class="form-error"></p><button class="btn block">${isNew ? '추가' : '저장'}</button></form>`,
      onMount(box, close) {
        const f = box.querySelector('form');
        $$('[data-upload]', box).forEach((inp) => (inp.onchange = async () => {
          const file = inp.files[0]; if (!file) return;
          if (file.size > 3 * 1024 * 1024) { toast('3MB 이하 이미지만 올릴 수 있습니다.'); return; }
          toast('올리는 중…');
          try {
            const url = await backend.storage.upload(`${col}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`, file);
            f[inp.dataset.upload].value = url; toast('이미지를 올렸습니다.');
          } catch (e) { toast(`올리지 못했습니다: ${e.message}`); }
        }));
        f.onsubmit = async (e) => {
          e.preventDefault();
          const d = readForm(f, cfg.fields);
          const err = f.querySelector('.form-error');
          const must = col === 'classes' ? 'subject' : col === 'teachers' ? 'name' : col === 'faqs' ? 'q' : col === 'results' ? 'headline' : col === 'schools' ? 'id' : 'title';
          if (!d[must]) return (err.textContent = '필수 항목을 입력해 주세요.');
          if (col === 'classes') d.teacherId = (await backend.db.list('teachers')).find((t) => t.name === d.teacherName)?.id || '';
          try {
            if (isNew) {
              const id = col === 'schools' ? d.id : col === 'classes' ? `C${Date.now().toString().slice(-6)}` : null;
              if (id) { await backend.db.set(col, id, { ...d, id }); rows.push({ ...d, id }); }
              else { const nid = await backend.db.add(col, d); rows.push({ ...d, id: nid }); }
            } else {
              const { id, ...rest } = { ...r, ...d, id: r.id };
              await backend.db.set(col, r.id, rest); Object.assign(r, d);
            }
            clearCache(); close(); draw(); toast(isNew ? '추가했습니다.' : '저장했습니다.');
          } catch (ex) { err.textContent = `저장하지 못했습니다. ${ex.message}`; }
        };
      },
    });
  };
  $('#add', main).onclick = () => edit(null);
  $('#fq', main).oninput = (e) => { st.q = e.target.value.trim(); draw(); };
  const ft = $('#ft', main); if (ft) ft.onchange = (e) => { st.term = e.target.value; draw(); };
  draw();
}

async function users(main) {
  const list = await backend.db.list('users');
  main.innerHTML = `<h1>회원</h1>
    <p class="notice-line">관리자로 지정하면 이 화면에 들어올 수 있습니다. config.js의 관리자 이메일은 여기서 바꿀 수 없습니다.</p>
    <div style="overflow-x:auto"><table class="grid-table"><thead><tr><th>가입일</th><th>이름</th><th>이메일</th><th>구분</th><th>연락처</th><th>학교</th><th>문자 수신</th><th>권한</th></tr></thead><tbody>
    ${list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((u) => `<tr><td>${esc(fmtDate(u.createdAt))}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.type || '')}</td><td>${esc(u.phone)}</td><td>${esc(u.school || '')} ${esc(u.grade || '')}</td><td>${u.marketing ? '동의' : ''}</td>
      <td><select class="select" style="min-height:32px;padding:2px 6px;width:auto" data-role="${esc(u.id)}" ${u.id === getUser().uid ? 'disabled' : ''}><option value="member" ${u.role !== 'admin' ? 'selected' : ''}>회원</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>관리자</option></select></td></tr>`).join('') || '<tr><td colspan="8" class="empty">가입한 회원이 없습니다.</td></tr>'}
    </tbody></table></div>`;
  $$('[data-role]', main).forEach((s) => (s.onchange = async () => { await backend.db.update('users', s.dataset.role, { role: s.value }); toast('권한을 바꿨습니다.'); }));
}

async function settings(main) {
  const site = await getSite();
  const fields = [
    ['phone', '대표 전화', 'text'], ['hours', '운영·상담 시간', 'text', '예: 평일 14:00~22:00'], ['kakaoUrl', '카카오톡 채널 주소', 'text', 'https://pf.kakao.com/...'],
    ['blogUrl', '밴드·블로그 주소', 'text'], ['directorName', '원장 이름', 'text'], ['greeting', '학원 소개 인사말', 'textarea'],
    ['annexAddress', '2관 주소', 'text'], ['timetableNotice', '시간표 안내 문구', 'textarea'],
  ];
  const v = { ...site, annexAddress: site.branches?.[1]?.address || '' };
  main.innerHTML = `<h1>사이트 설정</h1><div class="callout">빈 칸은 자료에 없던 정보입니다. 확인 후 채워 주세요.</div>
    <form class="card mid" id="sf">${fields.map((f) => fieldHTML(f, v[f[0]])).join('')}<button class="btn">저장</button></form>`;
  $('#sf', main).onsubmit = async (e) => {
    e.preventDefault();
    const d = readForm(e.target, fields);
    const branches = seed.site.branches.map((b) => ({ ...b }));
    branches[1].address = d.annexAddress; delete d.annexAddress;
    await backend.db.setDoc('settings/site', { ...d, branches });
    await refreshSite(); toast('설정을 저장했습니다.');
  };
}

async function data(main) {
  const cols = Object.keys(CONTENT);
  const state = {};
  for (const c of cols) state[c] = await backend.db.isSeeded(c);
  main.innerHTML = `<h1>데이터 관리</h1>
  ${backend.mode === 'firebase' ? `<p class="notice-line">Firestore가 비어 있는 컬렉션은 사이트에 기본 데이터(밴드 자료 정리본)를 보여줍니다. 수정하려면 먼저 올리세요. 이미 있는 항목은 같은 ID로 덮어씁니다.</p>
    <table class="grid-table mid"><thead><tr><th>컬렉션</th><th>기본 데이터</th><th>Firestore</th><th></th></tr></thead><tbody>
    ${cols.map((c) => `<tr><td>${esc(SCHEMA[c]?.title || (c === 'leaders' ? '소장(설명회 연사)' : c))}</td><td class="num">${CONTENT[c].length}건</td><td>${state[c] ? '<span class="tag ok">저장됨</span>' : '<span class="tag muted">비어 있음</span>'}</td>
      <td class="act"><button class="btn sm ${state[c] ? 'ghost' : ''}" data-seed="${c}">${state[c] ? '기본값으로 덮어쓰기' : '올리기'}</button></td></tr>`).join('')}
    </tbody></table>
    <p style="margin-top:16px"><button class="btn" id="all">비어 있는 컬렉션 모두 올리기</button></p>`
  : `<div class="callout">체험 모드입니다. 아래 버튼은 이 브라우저에 저장된 데이터만 지웁니다.</div><button class="btn danger" id="reset">체험 데이터 초기화</button>`}
  <div class="block mid"><h3>내보내기</h3><p class="notice-line">현재 콘텐츠를 JSON으로 내려받아 백업할 수 있습니다.</p><button class="btn ghost" id="export">JSON 내려받기</button></div>`;
  $$('[data-seed]', main).forEach((b) => (b.onclick = async () => {
    const c = b.dataset.seed;
    if (state[c] && !(await confirmBox('기본 데이터로 덮어쓰면 같은 ID 항목의 수정 내용이 사라집니다. 계속할까요?'))) return;
    b.disabled = true; await backend.db.seedCollection(c, CONTENT[c]); clearCache(); toast('올렸습니다.'); data(main);
  }));
  const all = $('#all', main);
  if (all) all.onclick = async () => {
    all.disabled = true;
    for (const c of cols) if (!state[c]) await backend.db.seedCollection(c, CONTENT[c]);
    clearCache(); toast('모두 올렸습니다.'); data(main);
  };
  const reset = $('#reset', main);
  if (reset) reset.onclick = async () => {
    if (!(await confirmBox('이 브라우저의 체험 데이터(신청·상담·회원·수정 내용)를 모두 지울까요?'))) return;
    Object.keys(localStorage).filter((k) => k.startsWith('taesan:')).forEach((k) => localStorage.removeItem(k));
    location.hash = '#/'; location.reload();
  };
  $('#export', main).onclick = async () => {
    const out = {};
    for (const c of cols) out[c] = await backend.db.list(c);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = `taesan-content-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
}
