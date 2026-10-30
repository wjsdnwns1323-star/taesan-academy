// 태산학원 홍보 광고. 자리마다 다른 광고가 나오고 몇 초마다 차례로 바뀜. 누르면 그 내용을 올린 태산학원 밴드 글(새 창)
// 문구는 태산학원 밴드 게시물(정리본: Drive '태산학원_웹콘텐츠') 그대로. 가채점 실적은 '가채점'을 붙임
// 자리: pic(홈 가운데 사진 광고 2개) · line(홈 가운데 글자 띠) · rail(오른쪽 사진 광고) · note(오른쪽 짧은 글자 광고)
import { ACADEMY_BAND, ADS_ON } from './config.js';
import { esc, getBanners } from './ui.js';
import { listBanners } from './backend.js';

const photo = (id) => `images/ads/${id}.webp`;

// post 는 그 내용을 올린 밴드 글 번호(없으면 밴드 글 목록으로). short 는 오른쪽 사진 광고용 짧은 제목, hook 은 오른쪽 한 줄 광고
export const PROMOS = [
  { id: 'pre-eng', tone: 'navy', tag: '예비고1', title: 'PRE 대성·대신·대전외고\n영어 고등 내신 실전반', short: '예비고1 영어\n고등 내신 실전반', hook: '예비고1 영어, 고등 내신 실전반', when: '11.20(금)부터 순차 개강', who: ['lee-geonjun'], by: '영어 이건준', post: 3566 },
  { id: 'final', tone: 'ink', tag: '고1·고2', title: '학교마다 범위가 다르니까\n반도 학교별로', short: '기말대비\n학교별 내신반', hook: '기말대비 내신반, 학교별로', when: '2학기 기말고사 대비', who: ['kim-dohyun', 'lee-geonjun', 'kim-taehyun'], by: '태산학원', post: 3560 },
  { id: 'kor-1p', tone: 'teal', tag: '예비고1', title: '국어 1% 완성반\n모의고사 + 핵심개념 16주', short: '국어 1% 완성반\n16주 완성', hook: '16주 완성 국어 1% 완성반', when: '11.21(토) 개강', who: ['kim-taehyun'], by: '국어 김태현', post: 3566 },
  { id: 'mo-eng', tone: 'ink', tag: '영어', title: '9월 모의고사\n영어 1등급 95명', short: '9월 모의고사\n영어 1등급 95명', hook: '9월 모의고사 영어 1등급 95명', when: '2026 9월 모의고사 · 가채점', who: ['lee-geonjun'], by: '영어 이건준', post: 3555 },
  { id: 'soc', tone: 'teal', tag: '고1 연합반', title: '통합사회\n경제단원 집중특강', short: '통합사회\n경제단원 특강', hook: '통합사회 경제단원 집중특강', when: '11.15(일) · 11.22(일) · 학교 무관', who: ['jeong-jikhan'], by: '통합사회 정직한' },
  { id: 'dfl-math', tone: 'navy', tag: '대전외고', title: '대전외고 수학\n24문항 중 24문항 적중', short: '대전외고 수학\n24문항 적중', hook: '대전외고 수학 24문항 적중', when: '2026 2학기 중간 · 가채점', who: [], by: '수학 김민아', post: 3561 },
  { id: 'diag', tone: 'navy', tag: '예비고1', title: '대성·대신 진단고사\n국어 · 수학 · 영어', short: '대성·대신\n진단고사', hook: '대성·대신 진단고사 신청', when: '주중 응시 · 개별 성적표 발송', who: ['kim-taehyun', 'lee-geonjun'], by: '태산학원 본관', post: 3563 },
  { id: 'kongju', tone: 'navy', tag: '공주사대부고', title: '공주사대부고 수학\n최고점 98.5 · 1등급 과반수', short: '공주사대부고 수학\n최고점 98.5', hook: '공주사대부고 수학 최고점 98.5', when: '2026 2학기 중간', who: [], by: '수학 박한빛', post: 3565 },
  { id: 'phy', tone: 'ink', tag: '예비고1', title: '물리학 비기너 · 마스터\n12월 개강', short: '물리 비기너·마스터\n12월 개강', hook: '물리학 비기너 · 마스터 12월 개강', when: '물리학 문제풀이 · 10주 과정도 운영', who: ['choi-sunghoon'], by: '물리 최성훈', post: 3566 },
  { id: 'gwanjeo', tone: 'teal', tag: '관저고2', title: '관저고2 국어\n전원 90점 이상', short: '관저고2 국어\n전원 90점 이상', hook: '관저고2 국어 전원 90점 이상', when: '수강생 50% 이상 1등급', who: ['kim-dohyun'], by: '국어 김도현', post: 3576 },
];

// 관리자가 '광고' 칸에서 고친 목록이 있으면 그것을, 없으면 위 기본 목록을 씀
export const TEACHERS = { 'lee-geonjun': '영어 이건준', 'kim-taehyun': '국어 김태현', 'kim-dohyun': '국어 김도현', 'choi-sunghoon': '물리 최성훈', 'jeong-jikhan': '통합사회 정직한' };
let promos = PROMOS;
export async function loadPromos() {
  const saved = (await getBanners(listBanners)).find((b) => b.id === 'ads');
  promos = saved?.items?.length ? saved.items : PROMOS;
  return promos;
}

const lines = (s) => s.split('\n').map((l) => `<span>${esc(l)}</span>`).join('');
const oneLine = (s) => esc(s.replace(/\n/g, ' '));
const link = (x) => x.link || (x.post ? `${ACADEMY_BAND}/${x.post}` : ACADEMY_BAND);
const go = (x, inner, cls) =>
  `<a class="${cls}" href="${link(x)}" target="_blank" rel="noopener" aria-label="${oneLine(x.title)} · 태산학원 밴드(새 창)">${inner}<span class="ad-mark">AD</span></a>`;
// 사진은 둘까지만(셋이면 글자를 가림)
const faces = (p) => `<span class="ad-ph${p.who.length > 1 ? ' many' : ''}">${p.who.slice(0, 2).map((id) => `<img src="${photo(id)}" alt="" loading="lazy">`).join('')}</span>`;
// 날짜·장소 줄은 ' · ' 사이에서만 줄이 바뀌게
const when = (s) => s.split(' · ').map((x) => `<span>${esc(x)}</span>`).join(' · ');

const LAYOUT = {
  // 사진 광고(가운데 두 개, 오른쪽 하나): 짙은 바탕, 큰 글자, 오른쪽 아래 선생님 사진
  // 선생님이 여럿이면 사진이 넓어서 짧은 제목을 씀
  pic: (p) => go(p, `<span class="ap-top">태산학원 · ${esc(p.tag)}</span><strong class="ap-title">${lines(p.who.length > 1 ? p.short || p.title : p.title)}</strong><span class="ap-when">${when(p.when)}</span>${faces(p)}<span class="ap-by">${esc(p.by)}</span>`, `ad-pic t-${p.tone}`),
  // 글자 띠(가운데): 옅은 바탕에 한 줄 제목, 오른쪽에 작은 사진
  // 휴대폰처럼 좁으면 짧은 제목(sm)으로 바뀜
  line: (p) => go(p, `<span class="al-txt"><strong class="al-title"><span class="lg">${oneLine(p.title)}</span><span class="sm">${oneLine(p.short || p.title)}</span></strong><span class="al-sub">${esc(p.by)} · ${esc(p.when)}</span></span>${p.who.length ? faces(p) : ''}<span class="al-cta">자세히 보기</span>`, 'ad-line'),
  // 짧은 글자 광고(오른쪽): 남색 바탕 한 줄
  note: (p) => go(p, `<strong>${esc(p.hook)}</strong>`, 'ad-note'),
};
LAYOUT.rail = (p) => LAYOUT.pic({ ...p, title: p.short || p.title }).replace('class="ad-pic', 'class="ad-pic rail');

// 처음 열 때마다 시작 광고가 다르게, 이후 7초마다 다음 광고로
let tick = Math.floor(Math.random() * 1000);
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// 사진이 있는 광고만 사진 자리에(사진이 없는 선생님 광고는 원본 사진을 받으면 who 에 넣어 켬)
const listFor = (kind) => (kind === 'pic' || kind === 'rail' ? promos.filter((p) => p.who?.length) : promos);

// 한 화면에 같은 광고가 두 번 나오지 않게: 이번 차례에 이미 쓴 광고는 건너뜀
let used = new Set();
function paint(el) {
  const kind = el.dataset.ad;
  if (!LAYOUT[kind]) return;
  const list = listFor(kind);
  if (!list.length) return;
  let i = tick + (+el.dataset.off || 0), item = list[i % list.length];
  for (let k = 0; k < list.length && used.has(item.id); k++) item = list[++i % list.length];
  used.add(item.id);
  if (el.dataset.cur === item.id) return;
  el.classList.toggle('swap', !!el.dataset.cur);
  el.dataset.cur = item.id;
  el.innerHTML = LAYOUT[kind](item);
}

export async function mountAds() {
  if (ADS_ON) await loadPromos();
  used = new Set();
  document.querySelectorAll('[data-ad]').forEach((el) => (ADS_ON ? paint(el) : el.remove()));
}

if (ADS_ON) {
  setInterval(() => {
    if (document.hidden || still()) return;
    tick += 1;
    used = new Set();
    const all = [...document.querySelectorAll('[data-ad]')];
    all.filter((el) => el.matches(':hover,:focus-within')).forEach((el) => used.add(el.dataset.cur));
    all.forEach((el) => { if (!el.matches(':hover,:focus-within')) paint(el); });
  }, 7000);
}
