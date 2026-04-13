export const VAULT_TOOLS = [
  {
    type: 'function' as const,
    name: 'read_file',
    description: 'Read the content of a file in the vault. Use relative paths like "daily.md" or "folder/note.md".',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path to the file inside the vault' } },
      required: ['path'],
    },
  },
  {
    type: 'function' as const,
    name: 'write_file',
    description: 'Create or overwrite a file in the vault with the given content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to write, e.g. "notes/todo.md"' },
        content: { type: 'string', description: 'Full file content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    type: 'function' as const,
    name: 'list_files',
    description: 'List all files and folders in the vault as a JSON tree.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function' as const,
    name: 'create_table',
    description: 'Create a structured table visualization from rows and columns.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        columns: { type: 'array', items: { type: 'string' } },
        rows: { type: 'array', items: { type: 'array', items: { type: ['string', 'number'] } } },
      },
      required: ['columns', 'rows'],
    },
  },
  {
    type: 'function' as const,
    name: 'create_pie_chart',
    description: 'Create an interactive pie chart visualization from labeled numeric values.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'number' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['data'],
    },
  },
  {
    type: 'function' as const,
    name: 'create_graph',
    description: 'Create an interactive graph (bar or line) from labeled numeric values.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        graphType: { type: 'string', enum: ['bar', 'line'] },
        xLabel: { type: 'string' },
        yLabel: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'number' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['graphType', 'data'],
    },
  },
];

export const VISUAL_TOOL_NAMES = new Set(['create_table', 'create_pie_chart', 'create_graph']);

export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    if (name === 'read_file') {
      return await window.api.files.read((args['path'] as string) ?? '');
    }
    if (name === 'write_file') {
      await window.api.files.write((args['path'] as string) ?? '', (args['content'] as string) ?? '');
      return `File "${(args['path'] as string) ?? ''}" written successfully.`;
    }
    if (name === 'list_files') {
      const tree = await window.api.files.tree();
      return JSON.stringify(tree, null, 2);
    }
    if (name === 'create_table') {
      const columns = Array.isArray(args.columns) ? args.columns.map(v => String(v)) : [];
      const rows = Array.isArray(args.rows)
        ? args.rows.map(row => Array.isArray(row) ? row.map(value => String(value)) : [])
        : [];
      return JSON.stringify({ kind: 'table', title: typeof args.title === 'string' ? args.title : 'Table', columns, rows });
    }
    if (name === 'create_pie_chart') {
      const data = Array.isArray(args.data)
        ? args.data
          .map(item => ({
            label: typeof item === 'object' && item && 'label' in item ? String((item as { label?: unknown }).label ?? '') : '',
            value: typeof item === 'object' && item && 'value' in item ? Number((item as { value?: unknown }).value ?? 0) : 0,
          }))
          .filter(item => item.label && Number.isFinite(item.value) && item.value >= 0)
        : [];
      return JSON.stringify({ kind: 'pie', title: typeof args.title === 'string' ? args.title : 'Pie chart', data });
    }
    if (name === 'create_graph') {
      const graphType = args.graphType === 'line' ? 'line' : 'bar';
      const data = Array.isArray(args.data)
        ? args.data
          .map(item => ({
            label: typeof item === 'object' && item && 'label' in item ? String((item as { label?: unknown }).label ?? '') : '',
            value: typeof item === 'object' && item && 'value' in item ? Number((item as { value?: unknown }).value ?? 0) : 0,
          }))
          .filter(item => item.label && Number.isFinite(item.value))
        : [];
      return JSON.stringify({
        kind: 'graph',
        title: typeof args.title === 'string' ? args.title : `${graphType === 'line' ? 'Line' : 'Bar'} graph`,
        graphType,
        xLabel: typeof args.xLabel === 'string' ? args.xLabel : 'Category',
        yLabel: typeof args.yLabel === 'string' ? args.yLabel : 'Value',
        data,
      });
    }
    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
