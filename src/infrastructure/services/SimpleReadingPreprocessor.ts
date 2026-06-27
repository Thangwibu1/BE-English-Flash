import { ReadingPreprocessor, VocabularyFormForMatching, ReadingPreprocessResult, ReadingSpanOutput } from '../../app/ports/services/ReadingPreprocessor';
import { normalizeText } from '../../shared/utils/normalizeText';
import { tokenizeText, Token } from '../../shared/utils/tokenizeText';

export class SimpleReadingPreprocessor implements ReadingPreprocessor {
  preprocess(content: string, forms: VocabularyFormForMatching[]): ReadingPreprocessResult {
    const tokens = tokenizeText(content);

    const formMap = new Map<string, VocabularyFormForMatching>();
    let maxWordLength = 1;

    for (const form of forms) {
      formMap.set(form.normalizedText, form);
      const wordLength = form.normalizedText.split(' ').length;
      maxWordLength = Math.max(maxWordLength, wordLength);
    }

    const spans: ReadingSpanOutput[] = [];
    const vocabularyIdSet = new Set<string>();

    let i = 0;
    let orderIndex = 0;

    while (i < tokens.length) {
      const token = tokens[i];

      if (token.type !== 'word') {
        spans.push({
          text: token.text,
          spanType: token.type,
          startIndex: token.startIndex,
          endIndex: token.endIndex,
          orderIndex: orderIndex++,
          isClickable: false,
        });

        i++;
        continue;
      }

      const match = this.findLongestMatch(tokens, i, maxWordLength, formMap);

      if (match) {
        spans.push({
          text: match.text,
          normalizedText: match.normalizedText,
          spanType: match.form.type,
          lemma: match.form.text,
          vocabularyId: match.form.vocabularyId,
          startIndex: match.startIndex,
          endIndex: match.endIndex,
          orderIndex: orderIndex++,
          isClickable: true,
        });

        vocabularyIdSet.add(match.form.vocabularyId);
        i = match.nextIndex;
        continue;
      }

      spans.push({
        text: token.text,
        normalizedText: normalizeText(token.text),
        spanType: 'word',
        startIndex: token.startIndex,
        endIndex: token.endIndex,
        orderIndex: orderIndex++,
        isClickable: false,
      });

      i++;
    }

    return {
      spans,
      vocabularyIds: Array.from(vocabularyIdSet),
    };
  }

  private findLongestMatch(
    tokens: Token[],
    start: number,
    maxWordLength: number,
    formMap: Map<string, VocabularyFormForMatching>
  ) {
    for (let length = maxWordLength; length >= 1; length--) {
      const candidate = this.buildCandidate(tokens, start, length);
      if (!candidate) continue;

      const normalized = normalizeText(candidate.text);
      const form = formMap.get(normalized);

      if (form) {
        return {
          ...candidate,
          normalizedText: normalized,
          form,
        };
      }
    }

    return null;
  }

  private buildCandidate(tokens: Token[], start: number, wordCount: number) {
    let currentWordCount = 0;
    let end = start;
    let text = '';

    while (end < tokens.length && currentWordCount < wordCount) {
      const token = tokens[end];

      if (token.type === 'word') {
        currentWordCount++;
      }

      if (
        token.type === 'punctuation' &&
        token.text !== "'" &&
        token.text !== '-'
      ) {
        break;
      }

      text += token.text;
      end++;
    }

    if (currentWordCount !== wordCount) return null;

    const startIndex = tokens[start].startIndex;
    const endIndex = tokens[end - 1].endIndex;

    return {
      text,
      startIndex,
      endIndex,
      nextIndex: end,
    };
  }
}
