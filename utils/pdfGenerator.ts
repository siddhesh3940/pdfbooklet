/**
 * pdfGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Double-Sided Cut-and-Stack imposition.
 *
 * After printing duplex, cutting along every grid line, and stacking the
 * resulting slips, the deck is in strict sequential order (1, 2, 3 …).
 *
 * Formula (1-based r, c):
 *   Stack index  s        = (r-1)·C + c
 *   Front(r, c)           = 2s - 1          = 2·((r-1)·C + c) - 1
 *   Back(r, c)            = 2s'             = 2·((r-1)·C + (C-c+1))
 *     where s' uses the mirrored column (C-c+1) to compensate for the
 *     physical left-right flip that happens when the sheet is turned over
 *     for duplex printing.
 *
 * All processing is 100% client-side via pdf-lib.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PDFDocument, rgb } from "pdf-lib";

export interface BookletOptions {
  nUp: 2 | 4 | 9 | 16;
  addBorder: boolean;
  file: File;
}

// A4 portrait in PDF points (1 pt = 1/72 inch).
const OUTPUT_WIDTH  = 595;
const OUTPUT_HEIGHT = 842;
const MARGIN = 8; // gap between cells and from sheet edge (points)

function gridDim(nUp: number): number {
  return Math.round(Math.sqrt(nUp));
}

/**
 * buildGrids
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns two R×C matrices (as flat arrays, row-major) of 1-based page numbers:
 *   frontGrid[r][c]  = 2·((r-1)·C + c) - 1
 *   backGrid[r][c]   = 2·((r-1)·C + (C-c+1))
 *
 * Both use 1-based r and c (converted from 0-based loop indices below).
 *
 * Example — 3×3 grid (C=3):
 *
 *   Front:          Back (columns mirrored):
 *   [ 1,  3,  5]    [ 6,  4,  2]
 *   [ 7,  9, 11]    [12, 10,  8]
 *   [13, 15, 17]    [18, 16, 14]
 *
 * Verification from spec:
 *   Front(1,1) = 2((0)·3+1)-1 = 1  ✓
 *   Front(1,3) = 2((0)·3+3)-1 = 5  ✓
 *   Back(1,1)  = 2((0)·3+(3-1+1)) = 2·3 = 6  ✓
 *   Back(1,3)  = 2((0)·3+(3-3+1)) = 2·1 = 2  ✓
 */
function buildGrids(R: number, C: number): { frontGrid: number[]; backGrid: number[] } {
  const frontGrid: number[] = [];
  const backGrid:  number[] = [];

  for (let r = 1; r <= R; r++) {
    for (let c = 1; c <= C; c++) {
      // Stack index for this cell (1-based).
      const s = (r - 1) * C + c;

      // Front: odd page of this stack  →  2s - 1
      frontGrid.push(2 * s - 1);

      // Back: even page of the MIRRORED stack.
      // Substituting c → (C - c + 1) flips the column so that after the
      // physical sheet is turned over (left↔right), this cell aligns with
      // the same stack as the front cell at (r, c).
      const sMirrored = (r - 1) * C + (C - c + 1);
      backGrid.push(2 * sMirrored);
    }
  }

  return { frontGrid, backGrid };
}

/**
 * renderCell
 * Draws one embedded page (or a blank) into a grid cell on an output PDF page.
 *
 * Coordinate note: pdf-lib origin is BOTTOM-LEFT.
 *   cellBottomY = OUTPUT_HEIGHT - cellTop - cellH
 */
function renderCell(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outPage: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  embPage: any | null,
  cellLeft: number,
  cellTop:  number,
  cellW:    number,
  cellH:    number,
  addBorder: boolean
) {
  const cellBottomY = OUTPUT_HEIGHT - cellTop - cellH;

  if (!embPage) {
    if (addBorder) {
      outPage.drawRectangle({
        x: cellLeft, y: cellBottomY, width: cellW, height: cellH,
        borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1,
        color: undefined, opacity: 0,
      });
    }
    return;
  }

  // Scale to fit cell while preserving aspect ratio (letterbox).
  //   scale = min(cellW/srcW, cellH/srcH)
  //   Center: drawX = cellLeft + (cellW - drawW)/2
  //           drawY = cellBottomY + (cellH - drawH)/2
  const scale = Math.min(cellW / embPage.width, cellH / embPage.height);
  const drawW = embPage.width  * scale;
  const drawH = embPage.height * scale;
  const drawX = cellLeft    + (cellW - drawW) / 2;
  const drawY = cellBottomY + (cellH - drawH) / 2;

  outPage.drawPage(embPage, { x: drawX, y: drawY, width: drawW, height: drawH });

  if (addBorder) {
    outPage.drawRectangle({
      x: drawX, y: drawY, width: drawW, height: drawH,
      borderColor: rgb(0, 0, 0), borderWidth: 1,
      color: undefined, opacity: 0,
    });
  }
}

export async function generateBooklet(options: BookletOptions): Promise<Blob> {
  const { nUp, addBorder, file } = options;

  // ── 1. Load source ─────────────────────────────────────────────────────────
  const srcBytes = await file.arrayBuffer();
  const srcDoc   = await PDFDocument.load(srcBytes);
  const N        = srcDoc.getPageCount();

  // ── 2. Grid dimensions ─────────────────────────────────────────────────────
  const R = gridDim(nUp); // rows
  const C = gridDim(nUp); // cols
  const K = R * C;        // cells per side  (= nUp)
  // One physical sheet holds 2K pages (front + back).
  const sheetCapacity = 2 * K;

  // ── 3. Pad to multiple of 2K ───────────────────────────────────────────────
  // The formulas produce page numbers up to 2K per sheet.
  // Any number > N is a blank padding page.
  const paddedCount =
    N % sheetCapacity === 0 ? N : N + (sheetCapacity - (N % sheetCapacity));

  const S = paddedCount / sheetCapacity; // number of physical sheets

  // ── 4. Build front/back grids ──────────────────────────────────────────────
  // frontGrid[cellPos] and backGrid[cellPos] hold 1-based page numbers for
  // ONE sheet.  For multiple sheets (S > 1) we offset by sheetCapacity·i.
  //
  // The formulas naturally produce numbers in [1 … 2K].
  // For sheet i, the actual 1-based page number is:
  //   pageNum = grid[cellPos] + i · sheetCapacity
  // Convert to 0-based index for embeddedPages:
  //   srcIdx  = pageNum - 1
  const { frontGrid, backGrid } = buildGrids(R, C);

  // ── 5. Embed source pages ──────────────────────────────────────────────────
  const outDoc        = await PDFDocument.create();
  const embeddedPages = await outDoc.embedPages(srcDoc.getPages());

  // ── 6. Grid geometry ───────────────────────────────────────────────────────
  //   availW = OUTPUT_WIDTH  - (C+1)·MARGIN
  //   availH = OUTPUT_HEIGHT - (R+1)·MARGIN
  //   cellW  = availW / C
  //   cellH  = availH / R
  //   cell(r,c) top-left: x = MARGIN + c·(cellW+MARGIN)
  //                        y = MARGIN + r·(cellH+MARGIN)   (top-left space)
  const availW = OUTPUT_WIDTH  - (C + 1) * MARGIN;
  const availH = OUTPUT_HEIGHT - (R + 1) * MARGIN;
  const cellW  = availW / C;
  const cellH  = availH / R;

  // ── 7. Render ──────────────────────────────────────────────────────────────
  // For each physical sheet i, emit two output PDF pages: front then back.
  for (let i = 0; i < S; i++) {
    const offset = i * sheetCapacity; // page-number offset for this sheet

    // Front page
    const frontPage = outDoc.addPage([OUTPUT_WIDTH, OUTPUT_HEIGHT]);
    // Back page
    const backPage  = outDoc.addPage([OUTPUT_WIDTH, OUTPUT_HEIGHT]);

    for (let cellPos = 0; cellPos < K; cellPos++) {
      // 0-based row/col from cellPos (row-major).
      const r0 = Math.floor(cellPos / C); // 0-based row
      const c0 = cellPos % C;             // 0-based col

      const cellLeft = MARGIN + c0 * (cellW + MARGIN);
      const cellTop  = MARGIN + r0 * (cellH + MARGIN);

      // ── Front cell ────────────────────────────────────────────────────────
      // frontGrid[cellPos] is 1-based within the sheet; add offset for sheet i.
      // Subtract 1 to get 0-based index into embeddedPages.
      const frontPageNum = frontGrid[cellPos] + offset; // 1-based absolute
      const frontSrcIdx  = frontPageNum - 1;            // 0-based
      renderCell(
        frontPage,
        frontSrcIdx < N ? embeddedPages[frontSrcIdx] : null,
        cellLeft, cellTop, cellW, cellH, addBorder
      );

      // ── Back cell ─────────────────────────────────────────────────────────
      // backGrid already has the mirrored column baked in via the formula.
      // The draw column is NOT additionally mirrored here — the formula
      // handles it entirely in the page-number assignment.
      const backPageNum = backGrid[cellPos] + offset;
      const backSrcIdx  = backPageNum - 1;
      renderCell(
        backPage,
        backSrcIdx < N ? embeddedPages[backSrcIdx] : null,
        cellLeft, cellTop, cellW, cellH, addBorder
      );
    }
  }

  // ── 8. Serialize ───────────────────────────────────────────────────────────
  const outBytes = await outDoc.save();
  return new Blob([outBytes], { type: "application/pdf" });
}
