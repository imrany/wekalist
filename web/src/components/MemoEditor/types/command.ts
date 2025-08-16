export type Command = {
  name: string;
  description?: string;
  run: () => string;
  cursorOffset?: number;
  shortcut?: string;
  category: string;
};
