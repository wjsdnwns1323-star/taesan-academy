// 태산학원 홍보 광고(메뉴 아래 가로 띠 1개, 오른쪽 칸 1개). 몇 초마다 차례로 바뀜. 누르면 태산학원 밴드(새 창)
// 문구는 태산학원 밴드 게시물(정리본: Drive '태산학원_웹콘텐츠') 그대로. 가채점 실적은 '가채점'을 붙임
import { ACADEMY_BAND, ADS_ON } from './config.js';
import { esc } from './ui.js';

const photo = (id) => `images/ads/${id}.webp`;

// 선생님 카드(세로형)
export const TEACHERS = [
  { id: 'lee-geonjun', subject: '영어', name: '이건준', motto: '더 큰 격차를\n벌리겠습니다', post: 3567 },
  { id: 'kim-taehyun', subject: '국어', name: '김태현', motto: '16주 완성\n국어 1% 완성반', post: 3566 },
  { id: 'kim-dohyun', subject: '국어', name: '김도현', motto: '꼼꼼한 개념부터\n문제 적용까지', post: 3576 },
  { id: 'jeong-jikhan', subject: '통합사회', name: '정직한', motto: '학교 상관없이\n연합반으로', post: 3549 },
  { id: 'choi-sunghoon', subject: '물리', name: '최성훈', motto: '비기너에서\n마스터까지', post: 3566 },
];

// 강좌·실적 광고(메뉴 아래 가로 띠). post 는 그 내용을 올린 밴드 글 번호(없으면 밴드 글 목록으로)
export const PROMOS = [
  { id: 'pre-eng', tone: 'cool', tag: '예비고1', title: 'PRE 대성·대신·대전외고\n영어 고등 내신 실전반', when: '11.20(금)부터 순차 개강', who: ['lee-geonjun'], by: '영어 이건준', post: 3566 },
  { id: 'final', tone: 'warm', tag: '고1·고2', title: '학교마다 범위가 다르니까\n반도 학교별로', when: '2학기 기말대비 내신반', who: ['kim-taehyun', 'lee-geonjun', 'kim-dohyun'], by: '태산학원', post: 3560 },
  { id: 'kor-1p', tone: 'lav', tag: '예비고1', title: '국어 1% 완성반\n모의고사 + 핵심개념 16주', when: '11.21(토) 개강', who: ['kim-taehyun'], by: '국어 김태현', post: 3566 },
  { id: 'mo-eng', tone: 'cool', tag: '영어', title: '9월 모의고사\n영어 1등급 95명', when: '2026 9월 모의고사 · 가채점', who: ['lee-geonjun'], by: '영어 이건준', post: 3555 },
  { id: 'soc', tone: 'sage', tag: '고1 연합반', title: '통합사회\n경제단원 집중특강', when: '11.15(일) · 11.22(일) · 학교 무관', who: ['jeong-jikhan'], by: '통합사회 정직한' },
  { id: 'dfl-math', tone: 'warm', tag: '대전외고', title: '대전외고 수학\n24문항 중 24문항 적중', when: '2026 2학기 중간 · 가채점', who: [], by: '수학 김민아', post: 3561 },
  { id: 'diag', tone: 'cool', tag: '예비고1', title: '대성·대신 진단고사\n국어 · 수학 · 영어', when: '주중 응시 · 개별 성적표 발송', who: ['kim-taehyun', 'lee-geonjun'], by: '태산학원 본관', post: 3563 },
  { id: 'kongju', tone: 'cool', tag: '공주사대부고', title: '공주사대부고 수학\n최고점 98.5 · 1등급 과반수', when: '2026 2학기 중간', who: [], by: '수학 박한빛', post: 3565 },
  { id: 'phy', tone: 'sage', tag: '예비고1', title: '물리학 비기너 · 마스터', when: '12월 개강', who: ['choi-sunghoon'], by: '물리 최성훈', post: 3566 },
  { id: 'gwanjeo', tone: 'lav', tag: '관저고2', title: '관저고2 국어\n전원 90점 이상', when: '수강생 50% 이상 1등급', who: ['kim-dohyun'], by: '국어 김도현', post: 3576 },
];

// 사진이 있는 광고만 돌림(사진이 없는 선생님 광고는 원본 사진을 받으면 who 에 넣어 켬)
const ACTIVE = PROMOS.filter((p) => p.who.length);

const lines = (s) => esc(s).replace(/\n/g, '<br>');
const oneLine = (s) => esc(s.replace(/\n/g, ' '));
const link = (x) => (x.post ? `${ACADEMY_BAND}/${x.post}` : ACADEMY_BAND);
const go = (x, inner, cls, label) =>
  `<a class="${cls}" href="${link(x)}" target="_blank" rel="noopener" aria-label="${esc(label)} · 태산학원 밴드(새 창)">${inner}<span class="ad-mark">AD</span></a>`;
const faces = (p, cls) => `<span class="${cls}${p.who.length > 1 ? ' many' : ''}">${p.who.map((id) => `<img src="${photo(id)}" alt="" loading="lazy">`).join('')}</span>`;

const cardHtml = (t) => go(t, `<span class="ac-motto">${lines(t.motto)}</span>
  <span class="ac-ph"><img src="${photo(t.id)}" alt="" loading="lazy"></span>
  <span class="ac-name">${esc(t.subject)} <b>${esc(t.name)}</b></span>`, 'ad-card', `${t.subject} ${t.name}`);

const wideHtml = (p) => go(p, `<span class="aw-logo"><img src="images/logo.webp" alt="" width="84" height="45"></span><span class="aw-txt"><span class="aw-top"><b>태산학원</b>${esc(p.tag)}</span>
  <strong class="aw-title">${oneLine(p.title)}</strong><span class="aw-when">${esc(p.when)}</span></span>
  ${faces(p, 'aw-ph')}<span class="aw-by">${esc(p.by)}</span><span class="aw-cta">자세히 보기</span>`, `ad-wide t-${p.tone}`, oneLine(p.title));

// 처음 열 때마다 시작 광고가 다르게, 이후 6초마다 다음 광고로
let tick = Math.floor(Math.random() * 1000);
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function pick(list, off) { return list[(tick + off) % list.length]; }

function paint(el) {
  const kind = el.dataset.ad;
  const item = pick(kind === 'card' ? TEACHERS : ACTIVE, +el.dataset.off || 0);
  if (el.dataset.cur === item.id) return;
  el.classList.toggle('swap', !!el.dataset.cur);
  el.dataset.cur = item.id;
  el.innerHTML = kind === 'card' ? cardHtml(item) : wideHtml(item);
}

export function mountAds(root = document) {
  root.querySelectorAll('[data-ad]').forEach((el) => (ADS_ON ? paint(el) : el.remove()));
}

if (ADS_ON) {
  setInterval(() => {
    if (document.hidden || still()) return;
    tick += 1;
    document.querySelectorAll('[data-ad]').forEach((el) => {
      if (!el.matches(':hover,:focus-within')) paint(el);
    });
  }, 6000);
}
