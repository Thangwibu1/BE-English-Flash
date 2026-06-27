import { FlashcardDeckRepository } from '../../ports/repositories/FlashcardDeckRepository';
import { FlashcardDeck } from '../../../core/entities/FlashcardDeck';

interface ListDecksInput {
  userId: string;
}

export class ListDecksUseCase {
  constructor(private deckRepository: FlashcardDeckRepository) {}

  async execute(input: ListDecksInput): Promise<{ myDecks: FlashcardDeck[]; publicDecks: FlashcardDeck[] }> {
    const myDecks = await this.deckRepository.findByOwner(input.userId);
    const publicDecks = await this.deckRepository.findPublicDecks();
    
    // Exclude own decks from public list
    const filteredPublicDecks = publicDecks.filter((deck) => deck.ownerId !== input.userId);

    return {
      myDecks,
      publicDecks: filteredPublicDecks,
    };
  }
}
