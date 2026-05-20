# PDF Booklet Imposition Tool

A single-page web app that converts any multi-page PDF into a print-ready **Double-Sided Cut-and-Stack** booklet layout — entirely in the browser. No uploads, no server, no data leaves your machine.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)
![pdf-lib](https://img.shields.io/badge/pdf--lib-1.17-red)

---

## What It Does

Upload a PDF → choose a grid layout → download a new PDF where pages are arranged so that after **duplex printing, cutting along the grid lines, and stacking the slips**, the resulting deck is in perfect sequential order (1, 2, 3 …).

---

## Features

- **Drag-and-drop** or click-to-browse PDF upload
- **4 grid layouts** — 2-up (1×2), 4-up (2×2), 9-up (3×3), 16-up (4×4)
- **Optional 1px border** around each page cell
- **100% client-side** — pdf-lib runs in the browser, nothing is sent to a server
- Output filename: `{original_name}_booklet_optimized.pdf`

---

## The Algorithm — Double-Sided Cut-and-Stack

Given a grid of **R rows × C columns**, each physical sheet holds **2K pages** (K = R×C per side).

### 1. Pad the document
Append blank pages until the total count is a multiple of `2K`.

### 2. Assign pages via stack index
For every cell at row `r`, column `c` (1-based):

```
Stack index   s  = (r-1)·C + c

Front(r, c)      = 2s - 1
Back(r, c)       = 2·((r-1)·C + (C - c + 1))
```

The **back formula mirrors the column** `c → (C - c + 1)` to compensate for the physical left-right flip that occurs when the sheet is turned over for duplex printing.

### 3. Example — 3×3 grid, 14-page document

Padded to 18 pages (next multiple of 2×9).

| | c=1 | c=2 | c=3 |
|---|---|---|---|
| **Front** | 1 | 3 | 5 |
| | 7 | 9 | 11 |
| | 13 | 15 | 17 → blank |
| **Back** | 6 | 4 | 2 |
| | 12 | 10 | 8 |
| | 18 → blank | 16 → blank | 14 |

After printing duplex, cutting into 9 slips, and stacking: slip 1 = pages 1 & 2, slip 2 = pages 3 & 4, … slip 9 = pages 17 & 18.

---

## Tech Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| PDF engine | pdf-lib 1.17 |
| Icons | lucide-react |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Install & run

```bash
git clone https://github.com/siddhesh3940/pdfbooklet.git
cd pdfbooklet
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for production

```bash
npm run build
npm start
```

---

## Project Structure

```
├── app/
│   ├── globals.css       # Tailwind directives
│   ├── layout.tsx        # Root layout + metadata
│   └── page.tsx          # UI — drag-drop, grid selector, border toggle
├── utils/
│   └── pdfGenerator.ts   # Core imposition algorithm
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## How to Print

1. Open the downloaded PDF in any PDF viewer.
2. Print **duplex (double-sided)**, flip on the **long edge**.
3. Cut along every grid line.
4. Stack the slips in sheet order — the deck will be in sequential page order.
