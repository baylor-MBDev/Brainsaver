const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text));

export const c = {
  dim: paint('2'),
  bold: paint('1'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  blue: paint('34'),
  magenta: paint('35'),
  cyan: paint('36'),
};

export const log = {
  info: (...args) => console.log(...args),
  step: (msg) => console.log(`${c.cyan('›')} ${msg}`),
  ok: (msg) => console.log(`${c.green('✓')} ${msg}`),
  warn: (msg) => console.warn(`${c.yellow('!')} ${msg}`),
  error: (msg) => console.error(`${c.red('✗')} ${msg}`),
  debug: (...args) => {
    if (process.env.MB_DEBUG) console.log(c.dim('[debug]'), ...args);
  },
};

/** Fixed-width table for terminal output. */
export function table(rows, columns) {
  if (!rows.length) return '';
  const widths = columns.map((col) =>
    Math.min(col.max ?? 40, Math.max(col.label.length, ...rows.map((r) => String(col.get(r) ?? '').length))),
  );
  const fit = (s, w) => {
    const str = String(s ?? '');
    return str.length > w ? `${str.slice(0, w - 1)}…` : str.padEnd(w);
  };
  const header = columns.map((col, i) => c.bold(fit(col.label, widths[i]))).join('  ');
  const body = rows.map((r) => columns.map((col, i) => fit(col.get(r), widths[i])).join('  '));
  return [header, ...body].join('\n');
}
