// 학교 검색: 나이스 교육정보 개방 포털 '학교기본정보' API로 중·고등학교를 찾아 고릅니다.
// https://open.neis.go.kr/hub/schoolInfo  (대전·충남·세종을 먼저, 없으면 전국)
import { neisKey } from './config.js';
import { esc } from './ui.js';

const REGIONS = [['G10', '대전'], ['N10', '충남'], ['I10', '세종']];
const HIGH = ['고1', '고2', '고3'], MID = ['중1', '중2', '중3'];
const cache = new Map();

// 사이트에서 쓰는 짧은 이름: 대성고등학교 → 대성고, 공주대학교사범대학부설고등학교 → 공주사대부고
export function shortName(full = '') {
  if (/공주대학교사범대학부설고/.test(full)) return '공주사대부고';
  if (/대전외국어고/.test(full)) return '대전외고';
  if (/대전과학고/.test(full)) return '대전과고';
  if (/대전예술고/.test(full)) return '대전예고';
  return full.replace(/여자고등학교$/, '여고').replace(/고등학교$/, '고').replace(/여자중학교$/, '여중').replace(/중학교$/, '중');
}

async function neis(params) {
  const q = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: neisKey ? '30' : '5', ...params });
  if (neisKey) q.set('KEY', neisKey);
  const key = q.toString();
  if (!cache.has(key)) cache.set(key, fetch(`https://open.neis.go.kr/hub/schoolInfo?${key}`).then((r) => r.json()).then((j) => (j.schoolInfo ? j.schoolInfo[1].row : [])).catch(() => []));
  return cache.get(key);
}

export async function searchSchools(name) {
  name = name.trim(); if (!name) return [];
  const kinds = ['고등학교', '중학교'];
  const jobs = [];
  for (const [code] of REGIONS) for (const k of kinds) jobs.push(neis({ ATPT_OFCDC_SC_CODE: code, SCHUL_KND_SC_NM: k, SCHUL_NM: name }));
  let rows = (await Promise.all(jobs)).flat();
  if (rows.length < 3) for (const k of kinds) rows = rows.concat(await neis({ SCHUL_KND_SC_NM: k, SCHUL_NM: name }));
  const seen = new Set();
  return rows.filter((r) => kinds.includes(r.SCHUL_KND_SC_NM) && !seen.has(r.SD_SCHUL_CODE) && seen.add(r.SD_SCHUL_CODE))
    .map((r) => ({ code: r.SD_SCHUL_CODE, full: r.SCHUL_NM, short: shortName(r.SCHUL_NM), kind: r.SCHUL_KND_SC_NM, region: ({ 대전광역시: '대전', 충청남도: '충남', 세종특별자치시: '세종', 충청북도: '충북', 서울특별시: '서울', 경기도: '경기' })[r.LCTN_SC_NM] || r.LCTN_SC_NM, addr: r.ORG_RDNMA || '' }))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === '고등학교' ? -1 : 1) || (a.region === '대전' ? -1 : 0) - (b.region === '대전' ? -1 : 0))
    .slice(0, 12);
}

const gradesFor = (kind) => (kind === '중학교' ? MID : kind === '고등학교' ? HIGH : [...MID, ...HIGH]);
const kindOf = (school = '') => (/중$/.test(school) ? '중학교' : /고$/.test(school) ? '고등학교' : '');

// 폼 칸: 학교(검색) + 학년(선택)
export function schoolFields({ school = '', grade = '', label = '학교', gradeLabel = '학년', required = false } = {}) {
  const opts = gradesFor(kindOf(school));
  return `<div class="row2">
    <div class="field sp"><span>${esc(label)}${required ? ' *' : ''}</span>
      <input class="input" name="school" value="${esc(school)}" placeholder="학교 이름을 입력하세요 (예: 대성)" autocomplete="off" data-school-pick role="combobox" aria-autocomplete="list" aria-expanded="false">
      <input type="hidden" name="schoolCode"><input type="hidden" name="schoolFull">
      <ul class="sp-list" role="listbox" hidden></ul>
      <small class="sp-hint">나이스 학교 정보에서 찾아요. 목록에 없으면 그대로 입력해도 됩니다.</small></div>
    <label class="field"><span>${esc(gradeLabel)}</span><select class="select" name="grade" data-grade-sel><option value="">선택</option>${opts.map((g) => `<option ${grade === g ? 'selected' : ''}>${g}</option>`).join('')}${grade && !opts.includes(grade) ? `<option selected>${esc(grade)}</option>` : ''}</select></label>
  </div>`;
}

export function bindSchoolPickers(root) {
  root.querySelectorAll('[data-school-pick]').forEach((inp) => {
    const box = inp.closest('.sp'); const list = box.querySelector('.sp-list');
    const form = inp.form || root; const gsel = form.querySelector('[data-grade-sel]');
    let items = [], cur = -1, timer = 0, token = 0;
    const close = () => { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); cur = -1; };
    const pick = (it) => {
      inp.value = it.short; form.querySelector('[name=schoolCode]').value = it.code; form.querySelector('[name=schoolFull]').value = it.full;
      if (gsel) { const keep = gsel.value; const g = gradesFor(it.kind); gsel.innerHTML = `<option value="">선택</option>${g.map((x) => `<option ${keep === x ? 'selected' : ''}>${x}</option>`).join('')}`; }
      close();
    };
    const draw = () => {
      list.innerHTML = items.length ? items.map((it, i) => `<li role="option" data-i="${i}" class="${i === cur ? 'on' : ''}"><b>${esc(it.full)}</b><small>${esc(it.region)} · ${esc(it.kind)}${it.addr ? ` · ${esc(it.addr.replace(/^\S+\s/, ''))}` : ''}</small></li>`).join('')
        : '<li class="none">찾는 학교가 없어요. 이름을 그대로 입력해도 됩니다.</li>';
      list.hidden = false; inp.setAttribute('aria-expanded', 'true');
      list.querySelectorAll('[data-i]').forEach((li) => (li.onmousedown = (e) => { e.preventDefault(); pick(items[li.dataset.i]); }));
    };
    inp.addEventListener('input', () => {
      form.querySelector('[name=schoolCode]').value = ''; form.querySelector('[name=schoolFull]').value = '';
      clearTimeout(timer); const q = inp.value.trim();
      if (q.length < 1) return close();
      list.innerHTML = '<li class="none">찾는 중…</li>'; list.hidden = false;
      timer = setTimeout(async () => { const t = ++token; const r = await searchSchools(q); if (t !== token) return; items = r; cur = -1; draw(); }, 250);
    });
    inp.addEventListener('keydown', (e) => {
      if (list.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { cur = Math.min(items.length - 1, cur + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && cur >= 0) { pick(items[cur]); e.preventDefault(); }
      else if (e.key === 'Escape') close();
    });
    inp.addEventListener('blur', () => setTimeout(close, 150));
  });
}
