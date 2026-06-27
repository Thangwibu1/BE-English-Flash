export interface Token {
  text: string;
  type: 'word' | 'space' | 'punctuation';
  startIndex: number;
  endIndex: number;
}

export function tokenizeText(content: string): Token[] {
  const tokens: Token[] = [];
  // Matches letters, apostrophes in letters, whitespaces, or other characters
  const regex = /([A-Za-z]+(?:'[A-Za-z]+)?)|(\s+)|([^A-Za-z\s]+)/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const text = match[0];
    const startIndex = match.index;
    const endIndex = match.index + text.length;

    let type: Token['type'] = 'punctuation';
    if (/^[A-Za-z]/.test(text)) type = 'word';
    else if (/^\s+$/.test(text)) type = 'space';

    tokens.push({ text, type, startIndex, endIndex });
  }

  return tokens;
}
