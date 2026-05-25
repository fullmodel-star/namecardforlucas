# 智慧名片系統 UI/UX 與 PWA (漸進式網頁應用) 部署驗證報告

本報告新增了針對 **PWA (Progressive Web App)** 的部署與安裝驗證說明，以利您順利將系統當成手機 App 進行安裝與離線使用。

---

## 🛠 優化與 PWA 支援亮點

### 1. PWA (漸進式網頁應用) 支援 (App 化)
為了實現您的需求，並以最輕量的方式轉化為手機 App 運作，我們已建立完整的 PWA 規格：
- **`manifest.json`**：設定了 App 的名稱（智慧名片管理系統）、圖示、啟動背景色與全螢幕獨立運行模式。
- **`sw.js` (Service Worker) 離線核心**：
  - 新建了 [sw.js](file:///C:/Users/c0787/Desktop/名片管理/sw.js) 服務線程檔案。
  - 實作了 **Network-First (網路優先)** 快取防線策略：當有網路時優先下載最新版面並更新快取；當手機在斷網或收訊不佳的地方時，會自動調出本機快取的 `index.html` 與相關字型、圖示資源，**確保 App 隨時隨地可開啟用**。
- **Service Worker 註冊機制**：
  - 在 `index.html` 啟動進入點加入了註冊語句，確保瀏覽器成功偵測到 PWA 規範。

---

## 📱 手機 App 安裝與部署指南

要把本專案變成手機 App 執行，請照著以下步驟操作：

### 第一步：上傳網頁 (二選一，推薦免費部署)
PWA 規定網頁必須在具有 `https://` 的加密安全網域下才能觸發安裝。
1. **方式 A (Vercel，最推薦新手)**：
   - 到 [Vercel 官網](https://vercel.com/) 免費註冊一個帳號。
   - 安裝 Vercel CLI 或將桌面上的「名片管理」資料夾拖曳上傳至 Vercel，即可獲得一個免費的 `https://xxxx.vercel.app` 專屬網址。
2. **方式 B (GitHub Pages)**：
   - 建立一個 GitHub 儲存庫 (Repository)，將專案上傳，並在設定中開啟 GitHub Pages，即可取得 `https://username.github.io/repository-name` 免費 HTTPS 網址。

### 第二步：在手機上「安裝」為 App
* **iPhone (iOS) 系統**：
  1. 使用手機 **Safari 瀏覽器** 開啟您部署的網址。
  2. 點擊瀏覽器底部的 **「分享」** 按鈕（向上箭頭的方塊）。
  3. 滑動並選擇 **「加入主畫面」** (Add to Home Screen)。
  4. 點擊「新增」。您的手機桌面就會多出名片系統的 App 圖示！
* **Android (安卓) 系統**：
  1. 使用手機 **Chrome 瀏覽器** 開啟您的網址。
  2. 點擊右上角「三個點」選單，或直接在底部彈出的提示中點擊 **「安裝應用程式」** (Install App) 或 **「新增至主畫面」**。
  3. 確認安裝後，App 就會以原生樣式出現在您的手機應用程式列表與桌面上！

---

## 🔧 Bug 修正記錄

### 2026-05-23: 修正 Google Drive 同步出現 textContent of null 的錯誤
* **問題原因**：
  在點擊「智慧同步導入」時，系統會調用 `showToast()` 彈出提示訊息（例如：*「正在讀取雲端未辨識照片清單...」*）。但由於 HTML 中遺漏了 `<div id="toast">` 容器，導致 `document.getElementById('toast')` 回傳 `null`，進而引發 `Cannot set properties of null (setting 'textContent')` 錯誤，造成同步流程中斷。
* **修正方案**：
  已在 [index.html](file:///C:/Users/c0787/Desktop/名片管理/index.html) 中加入 `<div id="toast" class="toast"></div>` 提示容器。現在提示與同步功能皆可正常運作。

### 2026-05-23: 優化手機版分頁欄 (Tabs) 擠壓排版
* **問題原因**：
  原先的 `.tabs` 設計沒有設定溢出滾動與防換行，在寬度較窄的手機螢幕上，五個分頁標題會被強制擠壓，導致文字直向折行（如「名、片、庫」垂直排列），視覺效果不佳且不易點擊。
* **修正方案**：
  - 將 `.tabs` 加上 `overflow-x: auto;` 與 `-webkit-overflow-scrolling: touch;`，使其在小螢幕上可以像原生 App 一樣以橫向滑動方式呈現。
  - 加上 `scrollbar-width: none;` 與 `display: none;` 隱藏瀏覽器滾動條，保持介面極簡美觀。
  - 將 `.tab` 設定 `min-width: max-content;` 與 `white-space: nowrap;`，確保文字絕不折行，保持完美的水平排版。
  - 加寬按鈕內距至 `padding: 9px 16px;`，更符合人體工學、方便手機觸控點擊。

### 2026-05-23: 「我的個人名片」支援 AI 拍照辨識自動帶入與 vCard QR Code 生成
* **新增功能**：
  - **AI 拍照/上傳辨識**：在「我的個人名片」編輯畫面中，新增了「拍照/上傳個人名片由 AI 自動填寫」功能。使用者可以直接拍照自己實體名片或上傳檔案，系統會經由 Gemini AI 進行 OCR 辨識，自動把姓名、職稱、公司、部門、電話、手機、電子信箱、地址等欄位自動填入，免去手動輸入的麻煩。
  - **vCard QR Code 動態生成**：當您的個人資料設定完成後，主畫面會自動呈現動態生成的 QR Code。當別人用手機相機掃描您的 QR Code 時，可以一鍵直接將您的聯絡資訊匯入他們手機的通訊錄中（支援 iOS 聯絡人與 Android 聯絡人）。


