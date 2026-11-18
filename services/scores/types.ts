/** Where finished days' scores are kept: a key-value store on this device only. */
export type ScoreStorage = {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
};
