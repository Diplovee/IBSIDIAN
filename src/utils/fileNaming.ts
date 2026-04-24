export const normalizeNewItemName = (input: string, ext?: string) => {
  let name = input
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/[\u0000-\u001f]/g, '');

  if (ext) {
    const suffix = `.${ext}`;
    if (name.toLowerCase().endsWith(suffix.toLowerCase())) {
      name = name.slice(0, -suffix.length).trim();
    }
  }

  return name || 'Untitled';
};
