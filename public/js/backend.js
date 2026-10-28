// 서버 연결 창구: 화면 코드는 이 파일만 씁니다.
// aws-config.js 에 주소가 있거나 체험 모드(?demo=1)면 AWS 서버(backend-aws.js), 아니면 예전 Firebase 서버(backend-firebase.js)를 씁니다.
import * as aws from './backend-aws.js';
import * as fb from './backend-firebase.js';
import { AWS_CONFIG } from './aws-config.js';

export const SERVER = AWS_CONFIG.api || new URLSearchParams(location.search).has('demo') ? 'aws' : 'firebase';
const impl = SERVER === 'aws' ? aws : fb;

export const {
  DEMO, init, currentUser, isAdmin, onUser, errorText, USERNAME_RE, toE164, signUp, signIn, signOut, changePassword, getPrivate, getUser, withdraw,
  uploadFile, fileUrl, listPosts, listMyPosts, listPending, getPost, createPost, updatePost, deletePost, approvePost, liked, toggleLike,
  listComments, addComment, deleteComment, commentLiked, toggleCommentLike, acceptComment, listNotifications, hasUnread, markRead,
  report, listReports, closeReport, listBanners, addBanner, saveCover, deleteBanner, setHidden, listHidden, getMember, listUsers, setUserFlags,
} = impl;

// 인증번호 보내기: AWS는 아이디·비밀번호·휴대폰을 함께, Firebase는 휴대폰과 보이지 않는 reCAPTCHA 자리만
export const sendPhoneCode = (o) => (SERVER === 'aws' ? aws.sendPhoneCode(o) : fb.sendPhoneCode(o.phone, o.boxId));
export { shrinkImage, blobToDataUrl, imageDataUrl } from './media.js';
