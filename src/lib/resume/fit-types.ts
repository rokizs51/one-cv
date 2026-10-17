// Fit result snapshot for resume generation
export type FitResultSnapshot = {
  chosen: string[];
  cuts: { itemId: string; reason: 'relevance' | 'space' }[];
  overflow: boolean;
};
