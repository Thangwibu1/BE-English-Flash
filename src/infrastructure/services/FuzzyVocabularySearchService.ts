import Fuse from 'fuse.js';

export type FuzzyVocabularyDoc = {
  id: string;
  text: string;
  normalizedText: string;
  type: string;
  level: string;
  meaningVi?: string;
  meaningEn?: string;
  topics?: string[];
  forms?: string[];
};

export type FuzzySearchResult = FuzzyVocabularyDoc & {
  matchType: 'fuzzy';
  score: number;
};

export class FuzzyVocabularySearchService {
  private fuse: Fuse<FuzzyVocabularyDoc> | null = null;
  private docs: FuzzyVocabularyDoc[] = [];
  private lastBuiltAt: Date | null = null;

  constructor(
    private deps: {
      vocabularyRepository: {
        findApprovedForSearch(): Promise<any[]>;
      };
    }
  ) {}

  async rebuildIndex(): Promise<void> {
    const vocabularies = await this.deps.vocabularyRepository.findApprovedForSearch();

    this.docs = vocabularies.map((vocab: any) => ({
      id: vocab.id || vocab._id?.toString(),
      text: vocab.text,
      normalizedText: vocab.normalizedText,
      type: vocab.type,
      level: vocab.level || '',
      meaningVi:
        vocab.meanings?.[0]?.meaningVi ||
        vocab.meaningVi ||
        '',
      meaningEn:
        vocab.meanings?.[0]?.meaningEn ||
        vocab.meaningEn ||
        '',
      topics: vocab.topicIds || vocab.topics || [],
      forms: (vocab.forms || []).map((f: any) =>
        typeof f === 'string' ? f : f.formText || f.text || ''
      ),
    }));

    this.fuse = new Fuse(this.docs, {
      keys: [
        { name: 'text', weight: 0.5 },
        { name: 'normalizedText', weight: 0.3 },
        { name: 'forms', weight: 0.1 },
        { name: 'meaningVi', weight: 0.06 },
        { name: 'meaningEn', weight: 0.04 },
      ],
      threshold: 0.35,
      distance: 100,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });

    this.lastBuiltAt = new Date();
    console.log(
      `[FuzzySearch] Index rebuilt with ${this.docs.length} approved vocabulary items at ${this.lastBuiltAt.toISOString()}`
    );
  }

  async ensureIndexReady(): Promise<void> {
    if (!this.fuse) {
      await this.rebuildIndex();
    }
  }

  async search(input: {
    query: string;
    limit?: number;
  }): Promise<FuzzySearchResult[]> {
    await this.ensureIndexReady();

    const query = input.query.trim();
    if (!query || !this.fuse) return [];

    return this.fuse
      .search(query, { limit: input.limit || 20 })
      .map((result) => ({
        ...result.item,
        matchType: 'fuzzy' as const,
        score: result.score ?? 1,
      }));
  }

  getLastBuiltAt(): Date | null {
    return this.lastBuiltAt;
  }

  getDocCount(): number {
    return this.docs.length;
  }
}
