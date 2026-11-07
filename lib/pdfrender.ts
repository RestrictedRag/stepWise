// Render width target: sharp enough to read, small enough to ship to the locate model.
export const renderScale = (pageWidthPt: number) => Math.min(2, 1400 / pageWidthPt);
