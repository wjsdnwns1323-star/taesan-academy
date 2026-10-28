// 사진 줄이기·데이터 주소 만들기(서버와 상관없이 브라우저에서 처리)
import { LIMITS } from './config.js';

// 사진을 줄여서 JPEG로 (긴 변 max px)
export function shrinkImage(file, max = LIMITS.imagePx, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 읽지 못했습니다.'))), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error(`${file.name || '사진'}: 사진 파일이 아닙니다.`));
    img.src = URL.createObjectURL(file);
  });
}

export const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

// 정해진 길이(글자 수) 안에 들어갈 때까지 점점 작게 줄여 JPEG 데이터 주소로
export async function imageDataUrl(file, maxChars, steps = [[1600, 0.82], [1280, 0.75], [1024, 0.7], [800, 0.65], [640, 0.6]]) {
  for (const [px, q] of steps) {
    const url = await blobToDataUrl(await shrinkImage(file, px, q));
    if (url.length <= maxChars) return url;
  }
  throw new Error('사진이 너무 큽니다. 더 작은 사진을 골라 주세요.');
}
