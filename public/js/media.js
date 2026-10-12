// 관리자가 올린 이미지(media 컬렉션)는 'media:<id>'로 저장합니다. 화면에 그린 뒤 hydrateMedia로 실제 이미지를 채웁니다.
import { backend } from './backend.js';
import { esc } from './ui.js';

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const cache = {};

export const isMedia = (f) => typeof f === 'string' && f.startsWith('media:');
export function imgAttrs(f) {
  return isMedia(f) ? `src="${BLANK}" data-media="${esc(f.slice(6))}"` : `src="${esc(f)}"`;
}
export function linkAttrs(f) {
  return isMedia(f) ? `href="#" data-media-link="${esc(f.slice(6))}"` : `href="${esc(f)}" target="_blank" rel="noopener"`;
}
export async function mediaData(id) {
  if (!cache[id]) cache[id] = backend.db.get('media', id).then((d) => (d && d.data) || '');
  return cache[id];
}
export function hydrateMedia(root = document) {
  root.querySelectorAll('img[data-media]').forEach(async (img) => { const d = await mediaData(img.dataset.media); if (d) img.src = d; });
  root.querySelectorAll('a[data-media-link]').forEach((a) => (a.onclick = async (e) => {
    e.preventDefault(); const d = await mediaData(a.dataset.mediaLink); if (!d) return;
    const w = window.open(); if (w) w.document.write(`<img src="${d}" style="max-width:100%">`);
  }));
}
