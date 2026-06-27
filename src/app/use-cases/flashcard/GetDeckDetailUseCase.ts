import { FlashcardDeckRepository } from '../../ports/repositories/FlashcardDeckRepository';
import { FlashcardCardRepository } from '../../ports/repositories/FlashcardCardRepository';
import { FlashcardDeck } from '../../../core/entities/FlashcardDeck';
import { FlashcardCard } from '../../../core/entities/FlashcardCard';
import { AppError } from '../../../core/errors/AppError';

interface GetDeckDetailInput {
  deckId: string;
  userId: string;
}

interface GetDeckDetailOutput {
  deck: FlashcardDeck;
  cards: FlashcardCard[];
}

export class GetDeckDetailUseCase {
  constructor(
    private deckRepository: FlashcardDeckRepository,
    private cardRepository: FlashcardCardRepository
  ) {}

  async execute(input: GetDeckDetailInput): Promise<GetDeckDetailOutput> {
    const deck = await this.deckRepository.findById(input.deckId);
    if (!deck) {
      throw new AppError('NOT_FOUND', 'Flashcard deck not found', 404);
    }

    // Verify visibility permission
    if (deck.visibility === 'private' && deck.ownerId !== input.userId) {
      throw new AppError('FORBIDDEN', 'You do not have permission to view this deck', 403);
    }

    const cards = await this.cardRepository.findByDeck(input.deckId);

    return {
      deck,
      cards,
    };
  }
}
