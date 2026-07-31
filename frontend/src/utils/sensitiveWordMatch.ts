/**
 * Client-side substring match against the sensitive-word lexicon.
 * Words should ideally be ordered longest-first; this function also sorts.
 */
export function matchSensitiveWord(
  text: string,
  words: readonly string[],
): string | null {
  const haystack = text.trim();
  if (!haystack || words.length === 0) {
    return null;
  }

  const ordered = [...words]
    .map((word) => word.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length || a.localeCompare(b, 'zh'));

  for (const word of ordered) {
    if (haystack.includes(word)) {
      return word;
    }
  }
  return null;
}

export const SENSITIVE_WORD_BLOCK_MESSAGE =
  '当前输入触发敏感词，请换个描述进行尝试';
