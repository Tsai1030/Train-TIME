# 鐵道脈 PULSE

台鐵即時時刻表查詢 PWA，串接 TDX 運輸資料流通服務即時 API，提供站到站班次查詢、票價、即時誤點狀態。

## 功能

- **站到站查詢** — 選擇起迄站，查詢所有車種班次
- **車種分類摘要** — 區間車、區間快、莒光、自強、自強3000、EMU3000、太魯閣、普悠瑪，各自獨立卡片
- **「下一班」即時標記** — 依據當前時間自動標示最近可搭乘班次，進入列表自動滾動至該班次
- **即時誤點狀態** — 串接 TDX TrainLiveBoard API，顯示準點或延誤分鐘數
- **票價顯示** — 串接 TDX ODFare API，依車種顯示成人票價
- **停靠站路線圖** — 點擊班次查看完整停靠站、到站/離站時間、延誤資訊
- **區域分類車站選擇器** — 全台 240+ 車站依 16 縣市分類，支援模糊搜尋
- **時間模式** — 現在出發 / 指定時間 / 最晚抵達（反推）
- **進階篩選** — 對號座 / 自由座、直達 / 含轉乘
- **三種查詢模式** — 站到站、車次查詢、車站查詢
- **深色 / 淺色主題** — Tweaks 面板即時切換，localStorage 持久化
- **查回程** — 結果頁一鍵交換起迄站

## 技術棧

- **Runtime / 套件管理** — Bun
- **框架** — React 19 + TypeScript
- **建置工具** — Vite 8
- **API** — TDX 運輸資料流通服務（tdx.transportdata.tw）
- **樣式** — CSS Modules + CSS Custom Properties
- **字型** — Noto Sans TC / Space Grotesk / JetBrains Mono

## 快速開始

### 前置需求

- [Bun](https://bun.sh/) v1.x+
- TDX 帳號（免費註冊：[tdx.transportdata.tw](https://tdx.transportdata.tw/)）

### 安裝

```bash
git clone https://github.com/Tsai1030/Train-TIME.git
cd Train-TIME
bun install
```

### 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`，填入你的 TDX 憑證：

```
VITE_TDX_CLIENT_ID=你的_client_id
VITE_TDX_CLIENT_SECRET=你的_client_secret
```

TDX 憑證取得方式：
1. 到 [TDX](https://tdx.transportdata.tw/) 註冊帳號
2. 登入後進入「會員中心」→「我的應用」→ 建立應用
3. 複製 Client Id 和 Client Secret

### 啟動開發伺服器

```bash
bun dev
```

開啟 `http://localhost:5173`

### 建置

```bash
bun run build
```

產出檔案在 `dist/` 目錄。

## API 來源

所有資料來自 [TDX 運輸資料流通服務](https://tdx.transportdata.tw/)：

| API | 用途 |
|-----|------|
| `v2/Rail/TRA/Station` | 全台車站列表 |
| `v3/Rail/TRA/DailyTrainTimetable/OD/{起站}/{迄站}/{日期}` | 站到站時刻表 |
| `v2/Rail/TRA/ODFare/{起站}/{迄站}` | 票價查詢 |
| `v2/Rail/TRA/GeneralTimetable/TrainNo/{車次}` | 車次停靠站 |
| `v3/Rail/TRA/TrainLiveBoard` | 即時誤點狀態 |

## 專案結構

```
src/
├── services/tdx.ts          TDX API 串接（認證、快取、重試）
├── hooks/
│   ├── useStations.ts       車站資料載入 + 區域分組
│   └── useTheme.ts          深淺色主題管理
├── components/
│   ├── StationPicker/       區域分類車站選擇器
│   ├── TypeCard/            車種摘要卡片
│   ├── TrainRow/            班次列表行
│   ├── RouteDetail/         停靠站路線圖
│   └── Layout/Chips.tsx     篩選 chip 元件
├── App.tsx                  主元件（狀態管理 + 頁面切換）
├── App.module.css           主元件樣式
└── styles/tokens.css        設計系統（色彩、字型、動畫）
```

## 車種色彩對照

| 車種 | 色碼 |
|------|------|
| 區間車 | `#4a90e2` 藍色 |
| 區間快 | `#2a5fb0` 深藍色 |
| 莒光號 | `#e6c84c` 黃色 |
| 自強號 | `#e8872e` 橘色 |
| 自強 3000 | `#9b6dff` 紫色 |
| EMU3000 | `#c8b89a` 米色 |
| 太魯閣號 | `#e84057` 亮紅色 |
| 普悠瑪號 | `#d63c3c` 紅色 |

## License

MIT
