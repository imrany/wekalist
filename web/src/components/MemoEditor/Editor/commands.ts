import { Command } from "@/components/MemoEditor/types/command";

export const editorCommands: Command[] = [
  // Basic Formatting
  {
    name: "bold",
    description: "Make text bold",
    run: () => "**text**",
    cursorOffset: 2,
    shortcut: "Ctrl+B",
    category: "formatting",
  },
  {
    name: "italic",
    description: "Make text italic",
    run: () => "*text*",
    cursorOffset: 1,
    shortcut: "Ctrl+I",
    category: "formatting",
  },
  {
    name: "strikethrough",
    description: "Strike through text",
    run: () => "~~text~~",
    cursorOffset: 2,
    shortcut: "Ctrl+Shift+X",
    category: "formatting",
  },
  {
    name: "underline",
    description: "Underline text",
    run: () => "<u>text</u>",
    cursorOffset: 3,
    category: "formatting",
  },
  {
    name: "highlight",
    description: "Highlight text",
    run: () => "==text==",
    cursorOffset: 2,
    category: "formatting",
  },
  {
    name: "inline-code",
    description: "Insert inline code",
    run: () => "`code`",
    cursorOffset: 1,
    shortcut: "Ctrl+`",
    category: "code",
  },

  // Headers
  {
    name: "h1",
    description: "Insert H1 heading",
    run: () => "# Heading 1",
    cursorOffset: 2,
    shortcut: "Ctrl+1",
    category: "headers",
  },
  {
    name: "h2",
    description: "Insert H2 heading",
    run: () => "## Heading 2",
    cursorOffset: 3,
    shortcut: "Ctrl+2",
    category: "headers",
  },
  {
    name: "h3",
    description: "Insert H3 heading",
    run: () => "### Heading 3",
    cursorOffset: 4,
    shortcut: "Ctrl+3",
    category: "headers",
  },
  {
    name: "h4",
    description: "Insert H4 heading",
    run: () => "#### Heading 4",
    cursorOffset: 5,
    category: "headers",
  },
  {
    name: "h5",
    description: "Insert H5 heading",
    run: () => "##### Heading 5",
    cursorOffset: 6,
    category: "headers",
  },
  {
    name: "h6",
    description: "Insert H6 heading",
    run: () => "###### Heading 6",
    cursorOffset: 7,
    category: "headers",
  },

  // Lists
  {
    name: "bullet-list",
    description: "Insert bullet list",
    run: () => "- List item\n- List item\n- List item",
    cursorOffset: 2,
    shortcut: "Ctrl+Shift+8",
    category: "lists",
  },
  {
    name: "numbered-list",
    description: "Insert numbered list",
    run: () => "1. First item\n2. Second item\n3. Third item",
    cursorOffset: 3,
    shortcut: "Ctrl+Shift+7",
    category: "lists",
  },
  {
    name: "todo",
    description: "Insert a task checkbox",
    run: () => "- [ ] Task to complete",
    cursorOffset: 6,
    shortcut: "Ctrl+Shift+T",
    category: "lists",
  },
  {
    name: "checkbox",
    description: "Insert a checklist item",
    run: () => "- [ ] task",
    cursorOffset: 6,
    shortcut: "Ctrl+Shift+C",
    category: "lists",
  },
  {
    name: "todo-done",
    description: "Insert completed task",
    run: () => "- [x] Completed task",
    cursorOffset: 6,
    category: "lists",
  },

  // Code Blocks
  {
    name: "code",
    description: "Insert code block",
    run: () => "```\ncode here\n```",
    cursorOffset: 4,
    shortcut: "Ctrl+Shift+C",
    category: "code",
  },
  {
    name: "javascript",
    description: "Insert JavaScript code block",
    run: () => "```javascript\nconsole.log('Hello World!');\n```",
    cursorOffset: 13,
    category: "code",
  },
  {
    name: "typescript",
    description: "Insert TypeScript code block",
    run: () => "```typescript\nconst message: string = 'Hello World!';\n```",
    cursorOffset: 13,
    category: "code",
  },
  {
    name: "python",
    description: "Insert Python code block",
    run: () => "```python\nprint('Hello World!')\n```",
    cursorOffset: 10,
    category: "code",
  },
  {
    name: "sql",
    description: "Insert SQL code block",
    run: () => "```sql\nSELECT * FROM table_name;\n```",
    cursorOffset: 7,
    category: "code",
  },
  {
    name: "bash",
    description: "Insert Bash code block",
    run: () => "```bash\necho 'Hello World!'\n```",
    cursorOffset: 8,
    category: "code",
  },

  // Links and Media
  {
    name: "link",
    description: "Insert a link",
    run: () => "[link text](https://example.com)",
    cursorOffset: 1,
    shortcut: "Ctrl+K",
    category: "media",
  },
  {
    name: "image",
    description: "Insert an image",
    run: () => "![alt text](image-url)",
    cursorOffset: 2,
    shortcut: "Ctrl+Shift+I",
    category: "media",
  },
  {
    name: "video",
    description: "Insert video embed",
    run: () => "[![Video Title](video-thumbnail.jpg)](video-url)",
    cursorOffset: 3,
    category: "media",
  },
  {
    name: "youtube",
    description: "Insert YouTube embed",
    run: () => "[![YouTube Video](https://img.youtube.com/vi/VIDEO_ID/0.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)",
    cursorOffset: 50,
    category: "media",
  },

  // Tables
  {
    name: "table",
    description: "Insert a basic table",
    run: () => "| Header 1 | Header 2 | Header 3 |\n| -------- | -------- | -------- |\n| Cell 1   | Cell 2   | Cell 3   |",
    cursorOffset: 2,
    shortcut: "Ctrl+Shift+Table",
    category: "tables",
  },
  {
    name: "table-2x2",
    description: "Insert 2x2 table",
    run: () => "| A | B |\n| - | - |\n| 1 | 2 |",
    cursorOffset: 2,
    category: "tables",
  },
  {
    name: "table-aligned",
    description: "Insert aligned table",
    run: () => "| Left | Center | Right |\n| :--- | :----: | ----: |\n| L1   |   C1   |    R1 |",
    cursorOffset: 2,
    category: "tables",
  },

  // Quotes and Callouts
  {
    name: "quote",
    description: "Insert blockquote",
    run: () => "> Quote text here",
    cursorOffset: 2,
    shortcut: "Ctrl+Shift+>",
    category: "quotes",
  },
  {
    name: "multi-quote",
    description: "Insert multi-line quote",
    run: () => "> First line of quote\n> Second line of quote\n> Third line of quote",
    cursorOffset: 2,
    category: "quotes",
  },
  {
    name: "info-callout",
    description: "Insert info callout",
    run: () => "> ℹ️ **Info**: This is an information callout",
    cursorOffset: 16,
    category: "callouts",
  },
  {
    name: "warning-callout",
    description: "Insert warning callout",
    run: () => "> ⚠️ **Warning**: This is a warning message",
    cursorOffset: 18,
    category: "callouts",
  },
  {
    name: "danger-callout",
    description: "Insert danger callout",
    run: () => "> 🚨 **Danger**: This is a danger alert",
    cursorOffset: 17,
    category: "callouts",
  },
  {
    name: "success-callout",
    description: "Insert success callout",
    run: () => "> ✅ **Success**: This is a success message",
    cursorOffset: 18,
    category: "callouts",
  },

  // Special Elements
  {
    name: "divider",
    description: "Insert horizontal divider",
    run: () => "\n---\n",
    cursorOffset: 5,
    category: "elements",
  },
  {
    name: "line-break",
    description: "Insert line break",
    run: () => "  \n",
    cursorOffset: 3,
    category: "elements",
  },
  {
    name: "details",
    description: "Insert collapsible details",
    run: () => "<details>\n<summary>Click to expand</summary>\n\nContent goes here\n\n</details>",
    cursorOffset: 32,
    category: "elements",
  },

  // Math and Equations
  {
    name: "math-inline",
    description: "Insert inline math",
    run: () => "$equation$",
    cursorOffset: 1,
    category: "math",
  },
  {
    name: "math-block",
    description: "Insert math block",
    run: () => "$$\nequation\n$$",
    cursorOffset: 3,
    category: "math",
  },

  // Dates and Time
  {
    name: "date-today",
    description: "Insert today's date",
    run: () => new Date().toISOString().split('T')[0],
    cursorOffset: 0,
    category: "dates",
  },
  {
    name: "datetime-now",
    description: "Insert current date and time",
    run: () => new Date().toISOString().replace('T', ' ').slice(0, 19),
    cursorOffset: 0,
    category: "dates",
  },
  {
    name: "timestamp",
    description: "Insert timestamp",
    run: () => `[${new Date().toLocaleString()}]`,
    cursorOffset: 0,
    category: "dates",
  },

  // Templates
  {
    name: "meeting-notes",
    description: "Insert meeting notes template",
    run: () => `# Meeting Notes - ${new Date().toISOString().split('T')[0]}

## Attendees
- 

## Agenda
1. 
2. 
3. 

## Discussion
- 

## Action Items
- [ ] 
- [ ] 

## Next Meeting
- **Date**: 
- **Time**: 
- **Location**: `,
    cursorOffset: 50,
    category: "templates",
  },
  {
    name: "daily-notes",
    description: "Insert daily notes template",
    run: () => `# Daily Notes - ${new Date().toISOString().split('T')[0]}

## Today's Goals
- [ ] 
- [ ] 
- [ ] 

## Completed
- [x] 

## Notes
- 

## Tomorrow's Priorities
- 
- 
- `,
    cursorOffset: 60,
    category: "templates",
  },
  {
    name: "project-template",
    description: "Insert project template",
    run: () => `# Project Name

## Overview
Brief description of the project.

## Objectives
- 
- 
- 

## Timeline
| Phase | Description | Due Date |
| ----- | ----------- | -------- |
|       |             |          |

## Resources
- 
- 

## Status
- [ ] Planning
- [ ] In Progress  
- [ ] Review
- [ ] Complete`,
    cursorOffset: 15,
    category: "templates",
  },

  // Emoji and Symbols
  {
    name: "emoji-happy",
    description: "Insert happy emoji",
    run: () => "😊",
    cursorOffset: 0,
    category: "emoji",
  },
  {
    name: "emoji-thinking",
    description: "Insert thinking emoji",
    run: () => "🤔",
    cursorOffset: 0,
    category: "emoji",
  },
  {
    name: "emoji-check",
    description: "Insert check mark",
    run: () => "✅",
    cursorOffset: 0,
    category: "emoji",
  },
  {
    name: "emoji-warning",
    description: "Insert warning emoji",
    run: () => "⚠️",
    cursorOffset: 0,
    category: "emoji",
  },
  {
    name: "emoji-fire",
    description: "Insert fire emoji",
    run: () => "🔥",
    cursorOffset: 0,
    category: "emoji",
  },
  {
    name: "emoji-rocket",
    description: "Insert rocket emoji",
    run: () => "🚀",
    cursorOffset: 0,
    category: "emoji",
  },

  // Advanced Formatting
  {
    name: "kbd",
    description: "Insert keyboard shortcut",
    run: () => "<kbd>Ctrl</kbd>+<kbd>C</kbd>",
    cursorOffset: 5,
    category: "advanced",
  },
  {
    name: "mark",
    description: "Insert marked text",
    run: () => "<mark>highlighted text</mark>",
    cursorOffset: 6,
    category: "advanced",
  },
  {
    name: "sub",
    description: "Insert subscript",
    run: () => "H<sub>2</sub>O",
    cursorOffset: 6,
    category: "advanced",
  },
  {
    name: "sup",
    description: "Insert superscript",
    run: () => "E=mc<sup>2</sup>",
    cursorOffset: 9,
    category: "advanced",
  },
  {
    name: "footnote",
    description: "Insert footnote",
    run: () => "Text with footnote[^1]\n\n[^1]: Footnote content",
    cursorOffset: 19,
    category: "advanced",
  },

  // Mermaid Diagrams
  {
    name: "mermaid-flowchart",
    description: "Insert Mermaid flowchart",
    run: () => "```mermaid\nflowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Action 1]\n    B -->|No| D[Action 2]\n```",
    cursorOffset: 32,
    category: "diagrams",
  },
  {
    name: "mermaid-sequence",
    description: "Insert sequence diagram",
    run: () => "```mermaid\nsequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Hello Bob!\n    B-->>A: Hello Alice!\n```",
    cursorOffset: 32,
    category: "diagrams",
  },
  {
    name: "mermaid-gantt",
    description: "Insert Gantt chart",
    run: () => "```mermaid\ngantt\n    title Project Timeline\n    dateFormat YYYY-MM-DD\n    section Phase 1\n    Task 1 :active, task1, 2024-01-01, 30d\n    Task 2 : task2, after task1, 20d\n```",
    cursorOffset: 32,
    category: "diagrams",
  },
];

// Helper function to get commands by category
export const getCommandsByCategory = (category: string): Command[] => {
  return editorCommands.filter(cmd => cmd.category === category);
};

// Available categories
export const commandCategories = [
  "formatting",
  "headers", 
  "lists",
  "code",
  "media",
  "tables", 
  "quotes",
  "callouts",
  "elements",
  "math",
  "dates",
  "templates",
  "emoji", 
  "advanced",
  "diagrams"
] as const;

export type CommandCategory = typeof commandCategories[number];