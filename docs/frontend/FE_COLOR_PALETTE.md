# DocVault FE Color Palette

Updated: 2026-03-15

## 1) Tinh thần màu sắc

Palette của DocVault phải tạo cảm giác:
- bảo mật
- chuyên nghiệp
- hiện đại
- dễ đọc dữ liệu

Hướng màu chính:
- **Navy / Slate** làm brand foundation
- **Off-white / Cool gray** làm background
- **Green / Amber / Red / Gray** cho trạng thái
- **Blue family** cho interactive controls

Không dùng neon, không dùng gradient nặng, không dùng saturation quá cao.

---

## 2) Brand palette

### Primary / Brand
- `brand-950: #0B1220`
- `brand-900: #111827`
- `brand-800: #1E293B`
- `brand-700: #334155`
- `brand-600: #475569`
- `brand-500: #2563EB`
- `brand-400: #60A5FA`
- `brand-300: #93C5FD`

### Use
- Logo text
- Sidebar active item
- Primary buttons
- Focus ring
- Links
- Selected states

---

## 3) Neutral palette

### Background / Surface / Border / Text
- `bg-app: #F8FAFC`
- `bg-subtle: #F1F5F9`
- `bg-card: #FFFFFF`
- `bg-muted: #EEF2F7`
- `border-soft: #E2E8F0`
- `border-strong: #CBD5E1`
- `text-strong: #0F172A`
- `text-main: #1E293B`
- `text-muted: #64748B`
- `text-faint: #94A3B8`

### Use
- App background
- Cards
- Tables
- Dividers
- Secondary text

---

## 4) Status palette

### Workflow status
#### Draft
- background: `#F1F5F9`
- text: `#334155`
- border: `#CBD5E1`

#### Pending
- background: `#FEF3C7`
- text: `#92400E`
- border: `#FCD34D`

#### Published
- background: `#DCFCE7`
- text: `#166534`
- border: `#86EFAC`

#### Archived
- background: `#E5E7EB`
- text: `#4B5563`
- border: `#D1D5DB`

---

## 5) Classification palette

### Public
- background: `#EFF6FF`
- text: `#1D4ED8`
- border: `#BFDBFE`

### Internal
- background: `#E0F2FE`
- text: `#0369A1`
- border: `#7DD3FC`

### Confidential
- background: `#FFF7ED`
- text: `#C2410C`
- border: `#FDBA74`

### Secret
- background: `#FEF2F2`
- text: `#B91C1C`
- border: `#FCA5A5`

---

## 6) Semantic palette

### Success
- `success-50: #ECFDF5`
- `success-500: #22C55E`
- `success-700: #15803D`

### Warning
- `warning-50: #FFFBEB`
- `warning-500: #F59E0B`
- `warning-700: #B45309`

### Danger
- `danger-50: #FEF2F2`
- `danger-500: #EF4444`
- `danger-700: #B91C1C`

### Info
- `info-50: #EFF6FF`
- `info-500: #3B82F6`
- `info-700: #1D4ED8`

---

## 7) Role badge palette

### Viewer
- background: `#F8FAFC`
- text: `#475569`

### Editor
- background: `#EFF6FF`
- text: `#1D4ED8`

### Approver
- background: `#F5F3FF`
- text: `#6D28D9`

### Compliance Officer
- background: `#FFF1F2`
- text: `#BE123C`

### Admin
- background: `#E2E8F0`
- text: `#0F172A`

---

## 8) Button mapping

### Primary button
- bg: `#2563EB`
- hover: `#1D4ED8`
- text: `#FFFFFF`

### Secondary button
- bg: `#FFFFFF`
- border: `#CBD5E1`
- text: `#1E293B`
- hover bg: `#F8FAFC`

### Ghost button
- bg: `transparent`
- text: `#334155`
- hover bg: `#F1F5F9`

### Destructive button
- bg: `#DC2626`
- hover: `#B91C1C`
- text: `#FFFFFF`

---

## 9) Sidebar mapping

- sidebar bg: `#0F172A`
- sidebar text: `#CBD5E1`
- sidebar muted: `#94A3B8`
- sidebar active bg: `#1E293B`
- sidebar active text: `#FFFFFF`
- sidebar accent line/dot: `#60A5FA`

---

## 10) Suggested CSS variables

```css
:root {
  --bg-app: #F8FAFC;
  --bg-subtle: #F1F5F9;
  --bg-card: #FFFFFF;
  --bg-muted: #EEF2F7;

  --text-strong: #0F172A;
  --text-main: #1E293B;
  --text-muted: #64748B;
  --text-faint: #94A3B8;

  --border-soft: #E2E8F0;
  --border-strong: #CBD5E1;

  --brand-900: #111827;
  --brand-800: #1E293B;
  --brand-700: #334155;
  --brand-500: #2563EB;
  --brand-400: #60A5FA;

  --success: #22C55E;
  --warning: #F59E0B;
  --danger: #EF4444;
  --info: #3B82F6;
}
```

---

## 11) Tailwind theme hint

```ts
colors: {
  brand: {
    950: '#0B1220',
    900: '#111827',
    800: '#1E293B',
    700: '#334155',
    600: '#475569',
    500: '#2563EB',
    400: '#60A5FA',
    300: '#93C5FD',
  },
}
```

---

## 12) Prompt cho AI Agent

Hãy dùng palette enterprise sáng, nền `#F8FAFC`, card trắng, text navy/slate, primary xanh `#2563EB`, sidebar tối `#0F172A`. Status badge: Draft = slate, Pending = amber, Published = green, Archived = gray. Classification badge: Public = blue, Internal = sky, Confidential = orange, Secret = red. Tổng thể phải sạch, hiện đại, bảo mật, nhiều khoảng trắng, không sặc sỡ.

