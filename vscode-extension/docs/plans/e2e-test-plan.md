# תוכנית בדיקות E2E - Qlik Model Builder

> תאריך: 2026-01-16
> גרסה: 1.0
> סטטוס: טיוטה לאישור

---

## סקירה כללית

תוכנית בדיקות מקצה לקצה (E2E) לכל הפונקציונליות של Qlik Model Builder.
הבדיקות מאורגנות לפי Flow - מחיבור ראשוני ועד Deploy לסביבה אמיתית.

### סביבת בדיקות

| רכיב | פרטים |
|------|-------|
| Qlik Cloud Tenant | `iyil7lpmybpzhbm.de.qlikcloud.com` |
| PostgreSQL (Neon) | `ep-rapid-mouse-ag6qeusx-pooler.c-2.eu-central-1.aws.neon.tech` |
| Database | `neondb` |
| קובץ איפיון | `docs/Olist_Tables_Summary.csv` (9 טבלאות) |

### סוגי בדיקות

| סוג | כלי | כמות בדיקות |
|-----|-----|-------------|
| Unit Tests | ts-node (standalone) | ~15 |
| UI Tests | Playwright | ~40 |
| Integration Tests | VS Code Test Runner | ~20 |
| API Tests | Node.js + fetch | ~15 |
| **סה"כ** | | **~90 בדיקות** |

---

## Phase 0: Prerequisites & Setup

### 0.1 Extension Loading

| מזהה | בדיקה | סוג | צפי |
|------|-------|-----|-----|
| P0-01 | Extension compiles without errors | Unit | PASS |
| P0-02 | Extension activates in VS Code | Integration | Command registered |
| P0-03 | Command `qmb.openWizard` exists | Integration | Command found |
| P0-04 | Command `qmb.configure` exists | Integration | Command found |
| P0-05 | Command `qmb.newProject` exists | Integration | Command found |
| P0-06 | Sidebar view loads | Integration | View visible |
| P0-07 | Webview panel opens | Integration | Panel visible |

### 0.2 Dependencies

| מזהה | בדיקה | סוג | צפי |
|------|-------|-----|-----|
| P0-08 | `mammoth` loads (Word parsing) | Unit | Module loads |
| P0-09 | `xlsx` loads (Excel parsing) | Unit | Module loads |
| P0-10 | `@anthropic-ai/sdk` loads | Unit | Module loads |
| P0-11 | `@google/generative-ai` loads | Unit | Module loads |

---

## Phase 1: Connection Flow (Config Screen)

### 1.1 UI Elements

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P1-01 | Config screen renders | `.config-screen` | Visible |
| P1-02 | Title shows "התחבר ל-Qlik Cloud" | `h2` | Text matches |
| P1-03 | Tenant URL input exists | `#tenantUrl` | Visible, empty |
| P1-04 | API Key input exists | `#apiKey` | Visible, type=password |
| P1-05 | Connect button exists | `#btnConnect` | Visible, text="התחבר" |
| P1-06 | Skip button exists | `#btnSkip` | Visible, text="דלג" |

### 1.2 Input Validation

| מזהה | בדיקה | קלט | צפי |
|------|-------|-----|-----|
| P1-07 | Empty fields show error | Both empty | Error message |
| P1-08 | Empty tenant shows error | Only API key | Error message |
| P1-09 | Empty API key shows error | Only tenant | Error message |
| P1-10 | Invalid URL format | `not-a-url` | Error message |
| P1-11 | Valid URL accepted | `https://tenant.qlikcloud.com` | No error |

### 1.3 Connection Actions

| מזהה | בדיקה | פעולה | צפי |
|------|-------|-------|-----|
| P1-12 | Connect sends `saveConfig` message | Click Connect | Message sent with tenantUrl, apiKey |
| P1-13 | Skip sets configured=true | Click Skip | Dashboard renders |
| P1-14 | Invalid credentials show error | Bad API key | Error toast |
| P1-15 | Valid credentials proceed | Good API key | Dashboard renders |
| P1-16 | Credentials saved to storage | Connect success | Persist after reload |

### 1.4 Real API Tests

| מזהה | בדיקה | API | צפי |
|------|-------|-----|-----|
| P1-17 | Test connection to Qlik Cloud | `GET /api/v1/users/me` | 200 OK |
| P1-18 | Invalid API key rejected | Bad key | 401 Unauthorized |
| P1-19 | Tenant URL normalized | Missing https | Auto-added |

---

## Phase 2: Dashboard Layout

### 2.1 Structure

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P2-01 | Dashboard container exists | `.dashboard` | Visible |
| P2-02 | Header exists | `.header` | Visible |
| P2-03 | Sidebar exists | `.sidebar` | Visible |
| P2-04 | Canvas exists | `.canvas` | Visible |
| P2-05 | Action bar exists | `.action-bar` | Visible |

### 2.2 Header

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P2-06 | Title shows "Qlik Model Builder" | `.header h1` | Text matches |
| P2-07 | Connection status dot | `.status-dot` | Visible |
| P2-08 | Status dot green when connected | `.status-dot.connected` | Class present |
| P2-09 | Tenant URL displayed | `.connection-status span` | URL shown |

### 2.3 Canvas Toolbar

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P2-10 | Upload button exists | `#btnUpload` | Visible, text="העלה איפיון" |
| P2-11 | Refresh button exists | `#btnRefresh` | Visible |
| P2-12 | Preview button exists | `#btnPreview` | Visible |
| P2-13 | Generate button exists | `#btnGenerate` | Visible, text="צור סקריפט" |

---

## Phase 3: Sidebar - Spaces

### 3.1 Spaces Section

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P3-01 | Spaces section exists | `.sidebar-section:has(h3:contains("Spaces"))` | Visible |
| P3-02 | Spaces list loads | `#spacesList` | Has children |
| P3-03 | Loading indicator shows | `.tree-item:contains("טוען")` | Shows then hides |
| P3-04 | Space items render | `[data-space-id]` | Count > 0 |

### 3.2 Space Selection

| מזהה | בדיקה | פעולה | צפי |
|------|-------|-------|-----|
| P3-05 | First space auto-selected | Page load | `.selected` class on first |
| P3-06 | Click selects space | Click space item | `.selected` class moves |
| P3-07 | Selection updates state | Click different space | `state.selectedSpace` changes |

### 3.3 Space API Tests

| מזהה | בדיקה | API | צפי |
|------|-------|-----|-----|
| P3-08 | List spaces | `GET /api/v1/spaces` | Array of spaces |
| P3-09 | Create space | `POST /api/v1/spaces` | New space created |
| P3-10 | Get space details | `GET /api/v1/spaces/{id}` | Space object |

---

## Phase 4: Sidebar - Connections

### 4.1 Connections Section

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P4-01 | Connections section exists | `.sidebar-section:has(h3:contains("חיבורים"))` | Visible |
| P4-02 | Connections list loads | `#connectionsList` | Has children |
| P4-03 | Connection items render | `[data-connection-id]` | Count >= 0 |
| P4-04 | Connection name shown | `.tree-item` | qName visible |

### 4.2 Connection Selection

| מזהה | בדיקה | פעולה | צפי |
|------|-------|-------|-----|
| P4-05 | Click selects connection | Click conn item | `.selected` class |
| P4-06 | Selection updates state | Click different conn | `state.selectedConnection` changes |

### 4.3 Connection API Tests

| מזהה | בדיקה | API | צפי |
|------|-------|-----|-----|
| P4-07 | List connections | `GET /api/v1/data-connections` | Array |
| P4-08 | Create PostgreSQL connection | `POST /api/v1/data-connections` | Connection created |
| P4-09 | Test connection | Connection test endpoint | Success |

---

## Phase 5: Upload & Parse Spec Files

### 5.1 Upload UI

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P5-01 | Upload area visible (no tables) | `.upload-area` | Visible |
| P5-02 | Upload area has icon | `.upload-area .icon` | Contains 📄 |
| P5-03 | Upload area has text | `.upload-area h3` | "העלה קובץ איפיון" |
| P5-04 | Supported formats listed | `.upload-area p` | Lists formats |

### 5.2 Upload Actions

| מזהה | בדיקה | פעולה | צפי |
|------|-------|-------|-----|
| P5-05 | Click upload area sends message | Click `.upload-area` | `uploadSpec` message |
| P5-06 | Upload button sends message | Click `#btnUpload` | `uploadSpec` message |
| P5-07 | Drag over shows highlight | Drag file over | `.dragover` class |
| P5-08 | File dialog opens | Click upload | `showOpenDialog` called |

### 5.3 CSV Parsing

| מזהה | בדיקה | קובץ | צפי |
|------|-------|------|-----|
| P5-09 | Parse Olist CSV | `Olist_Tables_Summary.csv` | 9 tables extracted |
| P5-10 | Table names correct | Parse result | All 9 names match |
| P5-11 | Table types detected | Parse result | Fact/Dimension correct |
| P5-12 | Field counts correct | Parse result | Match CSV data |
| P5-13 | Key fields identified | Parse result | PKs identified |

### 5.4 Excel Parsing

| מזהה | בדיקה | קובץ | צפי |
|------|-------|------|-----|
| P5-14 | Parse Excel file | `.xlsx` file | Tables extracted |
| P5-15 | Multiple sheets handled | Multi-sheet xlsx | All sheets parsed |
| P5-16 | Headers detected | First row | Column names extracted |

### 5.5 Word Parsing (AI)

| מזהה | בדיקה | קובץ | צפי |
|------|-------|------|-----|
| P5-17 | Word file detected | `.docx` file | AI parsing triggered |
| P5-18 | Gemini API called | With API key | Request sent |
| P5-19 | Tables extracted from prose | Word doc | Structured data returned |

### 5.6 Error Handling

| מזהה | בדיקה | קלט | צפי |
|------|-------|-----|-----|
| P5-20 | Invalid file type | `.exe` file | Error message |
| P5-21 | Corrupted CSV | Bad format | Error message |
| P5-22 | Empty file | 0 bytes | Error message |
| P5-23 | No tables found | Empty CSV | Warning message |

---

## Phase 6: Tables Display & Selection

### 6.1 Tables List

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P6-01 | Tables section exists | `.sidebar-section:has(h3:contains("טבלאות"))` | Visible |
| P6-02 | Table count in header | `h3` | Shows "(9)" |
| P6-03 | Table items render | `.table-item` | Count = 9 |
| P6-04 | Table name shown | `.table-name` | Correct names |
| P6-05 | Table type badge | `.table-type` | Fact/Dimension |
| P6-06 | Field count shown | `.table-meta` | "X שדות" |

### 6.2 Table Selection

| מזהה | בדיקה | פעולה | צפי |
|------|-------|-------|-----|
| P6-07 | All tables auto-selected | After parse | All checkboxes checked |
| P6-08 | Checkbox toggles selection | Click checkbox | Checked state changes |
| P6-09 | Click row toggles checkbox | Click `.table-item` | Checkbox toggles |
| P6-10 | Selection count updates | Toggle tables | Summary card updates |
| P6-11 | Uncheck removes from array | Uncheck one | `selectedTables.length` decreases |

### 6.3 Summary Cards

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P6-12 | Summary cards visible | `.summary-cards` | Visible after parse |
| P6-13 | Total tables card | First card | Shows 9 |
| P6-14 | Selected tables card | Second card | Shows selected count |
| P6-15 | Fact count card | Third card | Shows 4 |
| P6-16 | Dimension count card | Fourth card | Shows 5 |

---

## Phase 7: Script Generation

### 7.1 Generate Action

| מזהה | בדיקה | פעולה | צפי |
|------|-------|-------|-----|
| P7-01 | Generate with no tables shows error | Click generate, 0 selected | Error toast |
| P7-02 | Generate sends message | Click generate, tables selected | `generateScript` message |
| P7-03 | Message includes tables | Generate message | `tables` array in message |
| P7-04 | Loading state shown | During generation | Indicator visible |

### 7.2 Script Content

| מזהה | בדיקה | בדיקת סקריפט | צפי |
|------|-------|--------------|-----|
| P7-05 | Script has header | Generated script | Contains "QlikModelBuilder" |
| P7-06 | Script has project name | Generated script | Contains app name |
| P7-07 | All tables included | Generated script | All 9 table names |
| P7-08 | LOAD statements exist | Generated script | `LOAD` keyword |
| P7-09 | STORE statements exist | Generated script | `STORE` and `.qvd` |
| P7-10 | LIB references correct | Generated script | `lib://` paths |

### 7.3 Incremental Load Scripts

| מזהה | בדיקה | Strategy | צפי |
|------|-------|----------|-----|
| P7-11 | Insert-only pattern | Fact table | `Concatenate`, `vMaxKey` |
| P7-12 | Insert-update pattern | Dimension table | `WHERE NOT EXISTS` |
| P7-13 | Time-window pattern | Large fact | `vCutoffDate`, `vWindowDays` |
| P7-14 | Full load pattern | No incremental | Simple LOAD |

### 7.4 Script Validation

| מזהה | בדיקה | Validation | צפי |
|------|-------|------------|-----|
| P7-15 | Balanced parentheses | `validateScript()` | No errors |
| P7-16 | Balanced brackets | `validateScript()` | No errors |
| P7-17 | Balanced IF/END IF | `validateScript()` | No errors |
| P7-18 | No syntax errors | Manual review | Valid Qlik syntax |

### 7.5 Script Preview

| מזהה | בדיקה | Element | צפי |
|------|-------|---------|-----|
| P7-19 | Preview area visible | `.script-preview` | Visible after generate |
| P7-20 | Script code shown | `#scriptCode` | Contains script |
| P7-21 | Copy button exists | `#btnCopyScript` | Visible |
| P7-22 | Copy works | Click copy | Clipboard updated |
| P7-23 | Toast shows after copy | Click copy | Success toast |

---

## Phase 8: Create App & Deploy

### 8.1 App Creation

| מזהה | בדיקה | API | צפי |
|------|-------|-----|-----|
| P8-01 | Create app in space | `POST /api/v1/apps` | App created |
| P8-02 | App name correct | Created app | Matches input |
| P8-03 | App in correct space | Created app | spaceId matches |

### 8.2 Script Upload

| מזהה | בדיקה | API | צפי |
|------|-------|-----|-----|
| P8-04 | Update app script | `PUT /api/v1/apps/{id}/script` | Script saved |
| P8-05 | Script content correct | Saved script | Matches generated |

### 8.3 Reload

| מזהה | בדיקה | API | צפי |
|------|-------|-----|-----|
| P8-06 | Trigger reload | `POST /api/v1/reloads` | Reload started |
| P8-07 | Get reload status | `GET /api/v1/reloads/{id}` | Status returned |
| P8-08 | Wait for completion | Poll status | Status = SUCCEEDED |
| P8-09 | Handle reload failure | Bad script | Error reported |

---

## Phase 9: Add to Existing (Second Flow)

### 9.1 Select Existing Space

| מזהה | בדיקה | פעולה | צפי |
|------|-------|-------|-----|
| P9-01 | Existing spaces shown | Load dashboard | Previous spaces visible |
| P9-02 | Select existing space | Click space | Space selected |
| P9-03 | Space apps loaded | After selection | Apps in space shown |

### 9.2 Select Existing App

| מזהה | בדיקה | פעולה | צפי |
|------|-------|-------|-----|
| P9-04 | Existing apps shown | Space selected | Apps list visible |
| P9-05 | Select existing app | Click app | App selected |
| P9-06 | Append to script option | App selected | Merge option shown |

---

## Phase 10: Error Scenarios

### 10.1 Network Errors

| מזהה | בדיקה | סימולציה | צפי |
|------|-------|----------|-----|
| P10-01 | No internet | Disconnect | Error message |
| P10-02 | API timeout | Slow response | Timeout message |
| P10-03 | Server error | 500 response | Error handled |

### 10.2 Permission Errors

| מזהה | בדיקה | סימולציה | צפי |
|------|-------|----------|-----|
| P10-04 | No space access | Forbidden space | Error message |
| P10-05 | No app access | Forbidden app | Error message |
| P10-06 | Expired token | Old API key | Re-auth prompt |

---

## סיכום כמויות

| Phase | תיאור | כמות בדיקות |
|-------|-------|-------------|
| 0 | Prerequisites | 11 |
| 1 | Connection | 19 |
| 2 | Dashboard Layout | 13 |
| 3 | Spaces | 10 |
| 4 | Connections | 9 |
| 5 | Upload & Parse | 23 |
| 6 | Tables | 16 |
| 7 | Script Generation | 23 |
| 8 | Deploy | 9 |
| 9 | Add to Existing | 6 |
| 10 | Error Scenarios | 6 |
| **סה"כ** | | **145 בדיקות** |

---

## קבצי טסט

| קובץ | תיאור | Phases |
|------|-------|--------|
| `test/e2e/00-prerequisites.test.ts` | Extension loading | 0 |
| `test/e2e/01-connection.test.ts` | Config & auth | 1 |
| `test/e2e/02-dashboard.test.ts` | Layout tests | 2 |
| `test/e2e/03-spaces.test.ts` | Space management | 3 |
| `test/e2e/04-connections.test.ts` | Data connections | 4 |
| `test/e2e/05-upload-parse.test.ts` | File parsing | 5 |
| `test/e2e/06-tables.test.ts` | Table selection | 6 |
| `test/e2e/07-script-gen.test.ts` | Script generation | 7 |
| `test/e2e/08-deploy.test.ts` | App & reload | 8 |
| `test/e2e/09-existing.test.ts` | Add to existing | 9 |
| `test/e2e/10-errors.test.ts` | Error handling | 10 |
| `test/e2e/api/qlik-api.test.ts` | Direct API tests | All API |

---

## הרצת הבדיקות

```bash
# All E2E tests
npm run test:e2e

# Specific phase
npm run test:e2e -- --grep "Phase 1"

# API tests only
npm run test:api

# With real Qlik Cloud
QLIK_API_KEY=xxx npm run test:e2e:live
```
