export const COLUMN_WIDTH = 528;
export const COLUMN_GAP = 100;
export const BLOCK_GAP = 48;
export const COLUMN_STRIDE = COLUMN_WIDTH + COLUMN_GAP; // 628

export interface BlockInput {
  id: string;
  measuredHeight?: number;
  height?: number;
  diagram?: { svg: string; alt: string };
  [key: string]: any;
}

export interface PlacedBlock extends BlockInput {
  x: number;
  y: number;
  w: number;
  h: number;
  columnIndex: number;
}

/**
 * Lays out a vertical sequence of blocks in a designated column.
 * - Column width is 528px.
 * - Columns are 100px apart (stride: 628px).
 * - Blocks are stacked 48px apart.
 * - Column n sits at x = n * 628.
 * - Earlier blocks never move when new ones are appended.
 */
export function layoutBlocks<T extends BlockInput>(
  blocks: T[],
  columnIndex: number = 0,
  knownHeights: Record<string, number> = {}
): Array<T & { x: number; y: number; w: number; h: number; columnIndex: number }> {
  let currentY = 0;
  const x = columnIndex * COLUMN_STRIDE;
  const w = COLUMN_WIDTH;

  return blocks.map((block) => {
    const h = knownHeights[block.id] ?? block.measuredHeight ?? block.height ?? 120;
    const y = currentY;
    currentY += h + BLOCK_GAP;

    return {
      ...block,
      x,
      y,
      w,
      h,
      columnIndex,
    };
  });
}

