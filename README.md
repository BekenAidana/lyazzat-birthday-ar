# Happy Birthday Ляззат — WebAR

Спереди карточки — AR-метка, сзади — QR на сайт. На метке появляется аватар с эмоутами (стрелки ← →).

## Быстрый старт

```bash
npm install
npm run preview
```

- Превью без камеры: http://localhost:5173/preview.html  
- AR (нужна камера + HTTPS на телефоне): http://localhost:5173/  

## Печать

| Файл | Сторона |
|------|---------|
| `print/card-front.png` | Лицевая — AR-метка |
| `print/card-back.png` | Оборот — QR |

1. Залей сайт на HTTPS (Netlify / Vercel / GitHub Pages).
2. Впиши URL в `print/site-url.txt`.
3. `npm run card-back` — пересоберёт QR.
4. Распечатай front + back (лучше матовая бумага, размер ~A6 / открытка).

## Файлы моделей

- `models/main.glb` — idle  
- `models/anim-00.glb` … `anim-12.glb` — эмоуты  
- `models/manifest.json` — подписи для стрелок  

## Технологии

MindAR + Three.js (без Unity). Маркер: `assets/marker.png` → `assets/targets.mind`.
