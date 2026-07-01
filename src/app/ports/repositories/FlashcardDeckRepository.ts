import { FlashcardDeck } from '../../../core/entities/FlashcardDeck';

export interface FlashcardDeckRepository {
  findById(id: string): Promise<FlashcardDeck | null>;
  findByOwner(ownerId: string): Promise<FlashcardDeck[]>;
  findByNameAndOwner(name: string, ownerId: string): Promise<FlashcardDeck | null>;
  findPublicDecks(): Promise<FlashcardDeck[]>;
  create(deck: Partial<FlashcardDeck>): Promise<FlashcardDeck>;
  update(id: string, deck: Partial<FlashcardDeck>): Promise<FlashcardDeck | null>;
  softDelete(id: string): Promise<void>;
}
