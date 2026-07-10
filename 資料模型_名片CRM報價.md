# 資料契約 — 名片管理 ↔ 客戶追蹤 CRM

> 這份文件是兩個**獨立程式**之間唯一的橋。
> 只要雙方都遵守這裡的約定,各自的程式碼怎麼改都不會斷。
>
> - **名片管理**（namecardforlucas）= 資料的「生產者」，負責寫入名片。
> - **客戶追蹤 CRM**（獨立 repo）= 資料的「消費者 + 加值者」，唯讀名片、另存追蹤。

---

## 一、核心原則（四條鐵則）

1. **CRM 唯讀名片，永不寫入 `BizCardDB`。** 名片程式對自己的資料庫有完全主權。
2. **CRM 的追蹤資料存在自己的 `CrmDB`，與名片庫完全分離。**
3. **兩邊靠 `card.id` 這一個欄位關聯。** 這是整座橋的橋墩，絕不可變。
4. **CRM 對名片欄位採「防禦式讀取」**：欄位可能不存在（舊資料、OCR 沒抓到），一律當可選，讀不到就給空字串或預設值，不可崩潰。

---

## 二、共用的來源（Origin）約定

IndexedDB 綁「主機來源」，不綁路徑。資料能否直讀，取決於部署位置：

| 情境 | CRM 部署位置 | 能否直讀 BizCardDB |
|------|-------------|-------------------|
| ✅ 直讀模式 | 同一個 `fullmodel-star.github.io`（可為獨立 repo） | 可以，自動即時 |
| ⚠️ 開發 / 跨站 | `localhost`、`file://`、其他網域 | 不行 → 走 JSON 匯入 |

> **結論**：CRM 上線請部署到 `fullmodel-star.github.io`（任意 repo 名皆可），即享直讀。
> 開發期或跨站時，用「JSON 匯入」載入名片資料（見第五節）。

---

## 三、名片端資料結構（CRM 唯讀，來源真相）

**資料庫**：`BizCardDB`（version 2）
**CRM 只讀這兩張表，且只用 `readonly` transaction：**

### 表 `cards`（keyPath: `id`）

| 欄位 | 型別 | 說明 | CRM 用途 |
|------|------|------|---------|
| `id` | string | 主鍵，唯一 | **關聯鍵**（最重要） |
| `name` | string | 姓名 | 客戶名稱 |
| `org` | string | 公司 / 組織 | 副標、分群 |
| `title` | string | 職稱 | 顯示 |
| `dept` | string | 部門 | 顯示 |
| `mobile` | string | 手機 | 撥打 / 傳訊 |
| `tel` | string | 電話 | 撥打 |
| `email` | string | Email | 寄信 |
| `website` | string | 官網 | 顯示 |
| `address` | string | 地址 | 顯示 |
| `group` | string | 名片程式的分群 | 可帶入 CRM 篩選 |
| `createdAt` | number/string | 建立時間 | 排序參考 |
| `processed` | boolean | 名片是否已處理 | 可過濾 |

> 已建索引：`name`、`org`、`createdAt`、`group`（CRM 查詢可善用）。
> ⚠️ 上表欄位 **除 `id`、`name` 外皆視為可選**，讀取時一律做空值保護。

### 表 `images`（keyPath: `id`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 對應 `cards.id` |
| `image` | string | 名片照片，base64 |

> CRM 若要顯示頭像／名片照，用 `card.id` 去 `images` 表撈 `image`。同樣唯讀。

*（第三張表 `scan_queue` 是 OCR 佇列，CRM 不使用，忽略。）*

---

## 四、CRM 端資料結構（CRM 自有，可自由演進）

**資料庫**：`CrmDB`（version 1，CRM 獨立擁有）

### 表 `crm`（keyPath: `cardId`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `cardId` | string | = `cards.id`，**關聯鍵** |
| `logs` | array | 互動紀錄，見下方 |
| `nextRemind` | string \| null | 下次提醒日期（ISO，如 `2026-07-10`） |
| `remindNote` | string | 提醒事由（如「追報價」） |
| `status` | string | 手動狀態覆寫，見第六節（可空，空則自動計算） |
| `tags` | array\<string\> | CRM 自訂標籤（與名片的 group 分開） |
| `updatedAt` | number | 最後更新時間戳 |

#### `logs` 陣列裡每一筆（互動紀錄）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `at` | number | 互動時間戳（毫秒） |
| `type` | string | `phone` / `visit` / `email` / `message` / `note` |
| `text` | string | 內容 |

> **設計要點**：一張名片**不一定**有對應的 `crm` 紀錄。
> 使用者第一次對某客戶「記一筆／設提醒」時，才建立 `crm` 那筆。
> 沒有 `crm` 紀錄的名片 → 在 CRM 顯示為「尚未追蹤」狀態。

---

## 五、JSON 匯入格式（開發 / 跨站備援）

名片程式可匯出 JSON 備份。CRM 匯入時，**只讀取 `cards` 陣列**，欄位對應同第三節。
CRM 應容忍以下差異，能讀多少算多少：

```json
{
  "cards": [
    {
      "id": "card_abc123",
      "name": "陳大明",
      "org": "台積電",
      "title": "採購經理",
      "dept": "採購部",
      "mobile": "0912-000-000",
      "email": "ming@example.com",
      "website": "",
      "address": "新竹市...",
      "group": "客戶",
      "createdAt": 1719800000000,
      "processed": true
    }
  ]
}
```

> 匯入的名片存進 CRM 端一份**本地快照**（可放 `CrmDB` 另開一張 `cards_snapshot` 表），
> 這樣直讀不可用時，CRM 仍有客戶清單可顯示。直讀可用時以直讀為準。

---

## 六、狀態燈計算規則（紅黃綠，CRM 自算）

名片沒有「最後聯絡時間」，所以由 CRM 依 `logs` 最近一筆的 `at` 計算：

```
distance = 今天 - 最近一筆 log 的日期（天）

若使用者手動設了 status → 以手動為準（覆寫）
否則自動：
  尚未追蹤（沒有 crm 紀錄或沒有 log）  → ⚪ 灰（尚未追蹤）
  distance ≥ 14 天                    → 🔴 紅（太久沒聯絡）
  7 ≤ distance < 14 天                → 🟡 黃（該追蹤了）
  distance < 7 天                     → 🟢 綠（最近有聯絡）

另外：
  有 nextRemind 且 nextRemind ≤ 今天  → 🔴 紅（提醒到期，優先）
```

> 這些門檻（7 / 14 天）之後可做成設定值，先用預設。

---

## 七、資料流（一頁看懂）

```
拍名片 → OCR → 寫入 BizCardDB.cards        （名片程式，CRM 不參與）
                    │
            CRM 唯讀讀出 cards（直讀或 JSON 匯入）
                    │
       使用者「記一筆 / 設提醒」→ 寫入 CrmDB.crm（key = cardId）
                    │
        依 logs 時間 + nextRemind → 算出紅黃綠燈
                    │
              清單依狀態排序，提醒「誰該聯絡了」
```

---

## 七之二、案子 / 報價（DealDB）—— 與「報價請款」程式共用

CRM 的客戶詳情可建立「案子」，資料放在**獨立的 `DealDB`**。
這張庫**未來由「報價請款」程式共同擁有**：CRM 負責建立案子與追蹤階段，報價請款程式接手加明細、產 PDF、更新收款狀態。兩者同來源、共用同一張 `deals` 表。

**資料庫**：`DealDB`（version 1）

### 表 `deals`（keyPath: `id`，索引 `cardId`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 案子主鍵（CRM 產生 `d<timestamp>`） |
| `cardId` | string | = `cards.id`，**關聯客戶** |
| `title` | string | 案名 |
| `amount` | number | 金額（未稅或含稅由報價請款程式細化） |
| `stage` | string | 階段，見下 |
| `note` | string | 備註 |
| `createdAt` / `updatedAt` | number | 時間戳 |

### 階段 `stage`（兩程式共用同一組 key）

| key | 名稱 | 是否進行中 |
|-----|------|-----------|
| `lead` | 洽談中 | 是 |
| `quote` | 已報價 | 是 |
| `won` | 已成交 | 是 |
| `billed` | 已請款 | 是（列入「待收款」） |
| `paid` | 已收款 | 否 |
| `lost` | 未成交 | 否 |

> **給報價請款程式的預留**：之後報價請款可在 `deals` 上**擴充**欄位（如 `items[]` 明細、`tax`、`pdfUrl`、`dueDate`、`invoiceNo`），CRM 採防禦式讀取、忽略不認得的欄位即可。`stage` 的六個 key 是兩邊共用的狀態機，不可各自亂改。
> **待收款計算**：CRM 首頁「待收款」= 所有 `stage==='billed'` 的 `amount` 加總。

---

## 八、版本與相容（避免以後斷橋）

- 本契約版本：**v2**（2026-07-07，新增 DealDB）
- **不可破壞的約定**：`BizCardDB` / `cards` / `id` 三者名稱與意義。動到就是斷橋。
- 名片端若**新增**欄位 → CRM 自動忽略無妨（防禦式讀取），不算破壞。
- 名片端若**改名／刪除**既有欄位 → 屬破壞性變更，需同步更新本文件並通知 CRM。
- CRM 端 `CrmDB` 可自由演進，與名片無關。

---

*任何一方要改動「共用的部分」（第二、三節），先改這份文件，再改程式。文件是唯一真相。*
