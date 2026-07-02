import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('escapes commas, quotes and newlines', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'he said "hi"'], ['line\nbreak', null]]);
    expect(csv).toBe('a,b\r\n"x,y","he said ""hi"""\r\n"line\nbreak",');
  });
  it('renders numbers and empty cells', () => {
    expect(toCsv(['n'], [[42], [undefined]])).toBe('n\r\n42\r\n');
  });
});
