import { esc } from '../ui.js';
import { load, visible, pageHead } from './common.js';

const side = (cur) => `<nav class="side-nav" aria-label="학원안내 메뉴">
  ${[['학원 소개', '#/about', 'about'], ['공지사항', '#/notice', 'notice'], ['설명회·특강', '#/events', 'events'], ['오시는 길', '#/location', 'location']].map(([t, h, k]) => `<a href="${h}" ${cur === k ? 'aria-current="page"' : ''}>${t}</a>`).join('')}
</nav>`;

export async function about({ el, site }) {
  const [schools, teachers, classes] = await Promise.all([load('schools'), load('teachers'), load('classes')]);
  const open = visible(classes).filter((c) => c.term === 'final');
  el.innerHTML = `${pageHead('학원 소개', '', [['학원안내'], ['학원 소개']])}
  <div class="wrap page"><div class="layout-side">${side('about')}<div class="mid">
    <h2 style="font-size:28px;font-weight:900;color:var(--ink);line-height:1.35">학교가 다르면<br>시험도 다릅니다</h2>
    <p style="margin-top:18px;white-space:pre-line">${esc(site.greeting)}</p>
    ${site.directorName ? `<p style="margin-top:14px;font-weight:800">태산학원 원장 ${esc(site.directorName)}</p>` : ''}

    <div class="info-band" style="margin-top:32px">
      <div><h3>이번 기말대비</h3><p class="v num">${open.length}개 반</p><p>${new Set(open.map((c) => c.school)).size}개 학교·연합반</p></div>
      <div><h3>선생님</h3><p class="v num">${visible(teachers).length}명</p><p>국어·영어·수학·물리·통합사회</p></div>
      <div><h3>캠퍼스</h3><p class="v">본관 · 2관</p><p>대전 서구 둔산</p></div>
    </div>

    <div class="block"><h3>수업하는 학교</h3>
      <div class="tt-wrap"><table class="tt"><thead><tr><th>학교</th><th>구분</th><th>학년</th><th><span class="sr">시간표</span></th></tr></thead><tbody>
      ${visible(schools).map((s) => `<tr><td class="t-school">${esc(s.full)}</td><td>${esc(s.type)}</td><td>${esc(s.grades.join(', '))}</td><td class="t-act"><a class="link" href="#/timetable?school=${encodeURIComponent(s.id)}">시간표</a></td></tr>`).join('')}
      </tbody></table></div>
    </div>

    <div class="block"><h3>수업이 돌아가는 방식</h3><ol class="steps">
      <li>학교별 반 편성 — 같은 학교 학생끼리, 그 학교 시험 범위로 수업합니다.</li>
      <li>자체 교재와 외부지문 분석 — 교과서·부교재·외부지문까지 학교 출제 경향에 맞춥니다.</li>
      <li>매주 과제와 테스트 — 어휘·복습 테스트와 피드백으로 진도를 확인합니다.</li>
      <li>시험 1~2주 전 실전 모의고사 — 학교 시험과 같은 형식으로 풀어 봅니다.</li>
      <li>시험 전날 직전 보강 — 학교별로 마지막 정리를 합니다.</li>
    </ol><p class="notice-line">반·선생님마다 운영이 조금씩 다릅니다. 자세한 내용은 <a class="link" href="#/curriculum">커리큘럼</a>과 각 선생님 페이지를 확인하세요.</p></div>

    <div class="block"><h3>캠퍼스</h3>
      ${site.branches.map((b) => `<div class="card"><h4 style="font-size:18px;font-weight:900">${esc(b.name)}</h4><dl class="kv" style="margin-top:10px">
        <dt>주소</dt><dd>${esc(b.address || '상담 시 안내')}</dd><dt>주요 용도</dt><dd>${esc(b.uses || '')}</dd><dt>등록 계정</dt><dd>${esc(b.regNo)}</dd></dl></div>`).join('')}
    </div>
  </div></div></div>`;
}

export async function location({ el, site }) {
  const main = site.branches[0];
  const q = encodeURIComponent(main.address.replace(/\s*2층.*/, ''));
  el.innerHTML = `${pageHead('오시는 길', '', [['학원안내'], ['오시는 길']])}
  <div class="wrap page"><div class="layout-side">${side('location')}<div>
    <div class="map-box"><iframe title="태산학원 본관 지도" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${q}&z=17&output=embed"></iframe></div>
    <div class="info-band" style="margin-top:20px">
      <div><h3>본관 주소</h3><p class="v" style="font-size:18px">${esc(main.address)}</p>
        <p><a class="link" href="https://map.kakao.com/?q=${q}" target="_blank" rel="noopener">카카오맵</a> · <a class="link" href="https://map.naver.com/p/search/${q}" target="_blank" rel="noopener">네이버 지도</a></p></div>
      <div><h3>2관</h3><p class="v" style="font-size:18px">${esc(site.branches[1]?.address || '상담 시 안내')}</p></div>
      <div><h3>전화</h3><a class="v num" href="tel:${esc(site.phone.replace(/-/g, ''))}">${esc(site.phone)}</a><p>${esc(site.hours || '상담 가능 시간은 전화로 확인해 주세요.')}</p></div>
    </div>
  </div></div></div>`;
}

export async function privacy({ el, site }) {
  el.innerHTML = `${pageHead('개인정보처리방침', '', [['개인정보처리방침']])}
  <div class="wrap page"><article class="article"><div class="body" style="white-space:normal">
    <p>태산학원(이하 "학원")은 상담·신청 확인에 필요한 최소한의 개인정보만 수집하고, 목적 외로 사용하지 않습니다.</p>
    <div class="block"><h3>수집 항목과 목적</h3><ul>
      <li>수강 신청: 학생 이름, 연락처, 학교·학년, 남긴 말 — 등록 안내 연락</li>
      <li>설명회·진단고사 예약: 이름, 연락처, 학교, 인원·과목·희망 일시 — 예약 확인 연락</li>
      <li>온라인·방문 상담: 이름, 연락처, 학교·학년, 상담 내용 — 상담 답변</li>
      <li>회원가입: 이메일, 이름, 연락처, 학생 학교·학년·이름, 문자 수신 동의 여부 — 회원 관리, 신청 내역 제공</li></ul></div>
    <div class="block"><h3>보관 기간</h3><ul><li>신청·상담 정보: 목적 달성 후 1년 또는 삭제 요청 시까지</li><li>회원 정보: 회원 탈퇴 시까지</li></ul></div>
    <div class="block"><h3>처리 위탁</h3><ul><li>Google Firebase(데이터 저장·로그인 처리)</li></ul></div>
    <div class="block"><h3>정보 주체의 권리</h3><p>언제든지 열람·정정·삭제를 요청할 수 있습니다. 문의: <a class="link" href="tel:${esc(site.phone.replace(/-/g, ''))}">${esc(site.phone)}</a></p></div>
    <p class="notice-line" style="margin-top:28px">※ 개인정보 보호책임자 성명과 시행일은 학원에서 확인 후 입력해 주세요.</p>
  </div></article></div>`;
}
