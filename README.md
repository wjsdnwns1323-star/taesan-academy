# 태산학원 홈페이지

대전 둔산 태산학원의 공식 홈페이지입니다. 학교별 내신반 시간표, 선생님, 시험 결과, 설명회 예약, 상담, 회원, 관리자 기능을 담고 있습니다.

- 프레임워크·빌드 없이 동작하는 정적 사이트(HTML + ES 모듈)
- 서버: Firebase (Authentication · Firestore · Storage · Hosting)
- 내용 출처: 태산학원 네이버 밴드 캡처 정리본(Google Drive "태산학원 자료" 폴더). 데이터의 `src` 필드가 원본 캡처 번호(P01–P95)입니다.

## 화면 구성

| 메뉴 | 경로 | 기능 |
| --- | --- | --- |
| 홈 | `#/` | 학교·학년을 고르면 이번 기말대비 반이 바로 나오는 학교 찾기, 모집 과정, 2학기 중간 결과, 선생님, 공지·설명회 |
| 시간표 | `#/timetable` | 기말대비 / 예비고1 / 지난 중간대비, 학교·학년·과목·선생님 필터, 학교별·과목별 묶어보기, 수강·대기 신청 |
| 선생님 | `#/teachers`, `#/teachers/:id` | 과목별 목록, 선생님 홈(약력, 시험 결과, 지금 열린 반, 수업 방식, 교재) |
| 커리큘럼 | `#/curriculum` | 선생님별 수업 순서·교재 |
| 시험 결과 | `#/results` | 시험·과목 필터, 가채점 표시 |
| 설명회·특강 | `#/events`, `#/events/:id` | 예약, 진단고사 신청 |
| 공지사항 | `#/notice` | 분류·검색·페이지 |
| 상담 | `#/consult`, `#/visit`, `#/faq` | 온라인 상담(답변은 내 신청 내역에서 확인), 방문 상담 예약, FAQ |
| 학원 소개·오시는 길 | `#/about`, `#/location` | 인사말, 대상 학교, 캠퍼스, 지도 |
| 검색 | `#/search` | 강좌·선생님·설명회·공지 통합 검색 |
| 회원 | `#/login`, `#/join`, `#/mypage` | 가입(이메일 인증), 비밀번호 재설정, 내 신청·예약·상담·방문 내역, 예약 취소, 정보 수정 |
| 관리자 | `#/admin` | 접수 관리(상태 변경, 답변·메모, CSV), 강좌·선생님·설명회·결과·공지·FAQ·학교 편집, 사진 업로드, 회원 권한, 사이트 설정, 기본 데이터 업로드·백업 |

## 체험 모드

`public/js/config.js`의 `apiKey`가 비어 있으면 **체험 모드**로 동작합니다. 모든 기능이 그대로 동작하지만 데이터는 그 브라우저(localStorage)에만 저장됩니다. `admin@`으로 시작하는 이메일로 가입하면 관리자 화면을 써 볼 수 있습니다.

로컬에서 보기:

```bash
npx http-server public -p 5173
# 또는
python3 -m http.server 5173 --directory public
```

## Firebase 연결

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만듭니다.
2. **Authentication** → 로그인 방법 → 이메일/비밀번호 사용 설정
3. **Firestore Database** 만들기(프로덕션 모드, 지역 `asia-northeast3` 서울 권장)
4. **Storage** 시작하기
5. 프로젝트 설정 → 내 앱 → 웹 앱 추가 → 나온 `firebaseConfig` 값을 `public/js/config.js`에 붙여넣기
6. `.firebaserc`의 `YOUR_FIREBASE_PROJECT_ID`를 프로젝트 ID로 바꾸기
7. 배포

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only hosting,firestore,storage
```

8. 사이트에서 관리자 이메일(`config.js`의 `adminEmails`)로 가입 → 받은 인증 메일의 링크 클릭 → 다시 로그인
9. 관리자 → **데이터 관리** → "비어 있는 컬렉션 모두 올리기"를 누르면 밴드 자료 정리본이 Firestore에 저장되고, 이후부터 관리자 화면에서 수정할 수 있습니다.

관리자 이메일을 바꾸려면 `public/js/config.js`, `firestore.rules`, `storage.rules` 세 곳을 같이 바꿉니다. 그 밖의 관리자는 관리자 → 회원에서 지정합니다.

### GitHub에서 자동 배포

`.github/workflows/firebase-deploy.yml`이 `main`에 올릴 때마다 Hosting과 보안 규칙을 배포합니다.

- 저장소 Settings → Secrets and variables → Actions
  - Secret `FIREBASE_SERVICE_ACCOUNT`: Firebase 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성으로 받은 JSON 전체
  - Variable `FIREBASE_PROJECT_ID`: 프로젝트 ID
- 변수가 없으면 배포 단계는 건너뜁니다.

## 데이터 구조(Firestore)

| 컬렉션 | 내용 | 읽기 | 쓰기 |
| --- | --- | --- | --- |
| `classes` | 강좌·시간표 | 누구나 | 관리자 |
| `teachers`, `leaders` | 선생님, 설명회 연사 | 누구나 | 관리자 |
| `results` | 시험 결과 | 누구나 | 관리자 |
| `events` | 설명회·특강·진단고사 | 누구나 | 관리자 |
| `notices`, `faqs`, `schools` | 공지, FAQ, 학교 | 누구나 | 관리자 |
| `settings/site` | 전화, 운영시간, 인사말 등 | 누구나 | 관리자 |
| `users` | 회원 정보 | 본인·관리자 | 본인(권한 제외)·관리자 |
| `applications` | 수강·대기 신청 | 본인·관리자 | 누구나 접수, 관리자 처리 |
| `reservations` | 설명회·진단고사 예약 | 본인·관리자 | 누구나 접수, 본인 취소, 관리자 처리 |
| `consults` | 온라인 상담 | 본인·관리자 | 누구나 접수, 관리자 답변 |
| `visits` | 방문 상담 예약 | 본인·관리자 | 누구나 접수, 관리자 처리 |

Firestore가 비어 있는 공개 컬렉션은 `public/js/data/seed.js`의 기본 데이터를 보여줍니다.

## 공개 전에 확인할 것

자료에 없어서 비워 두었거나 확인이 필요한 항목입니다. 관리자 → 사이트 설정·선생님에서 채웁니다.

- 원장 성함, 인사말(현재 문구는 임시 작성), 운영·상담 시간, 카카오톡 채널 주소
- 2관 주소, 대표번호가 본관·2관 공용인지
- '제서2783호'·'제서5484호'가 학원 등록번호인지
- 선생님 사진: 원본 ZIP(`images/people/`)의 사진을 관리자 → 선생님 → 사진에서 올립니다. 사진이 없으면 이름 이니셜 카드가 나옵니다.
- 김현·정정래 소장의 소속 표기, 김학수 소장(외부 초청) 사진·실명 사용 허락
- 가채점 결과는 학교 발표 후 확정 수치로 바꾸고 "가채점(확정 전)" 체크를 해제
- 이원형 선생님의 현재 담당 여부
- 학생이 나온 포스터·사진은 쓰지 않았습니다. 쓰려면 블러 처리 후 사용
