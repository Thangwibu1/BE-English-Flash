import { FlashcardCard } from '../../../core/entities/FlashcardCard';

export interface FlashcardCardRepository {
  findById(id: string): Promise<FlashcardCard | null>;
  findByDeck(deckId: string): Promise<FlashcardCard[]>;
  create(card: Partial<FlashcardCard>): Promise<FlashcardCard>;
  delete(id: string): Promise<void>;
  deleteByDeck(deckId: string): Promise<void>;
  findByDeckAndVocabulary(deckId: string, vocabularyId: string): Promise<FlashcardCard | null>;
}
