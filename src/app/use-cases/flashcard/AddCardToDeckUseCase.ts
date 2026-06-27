import { FlashcardDeckRepository } from '../../ports/repositories/FlashcardDeckRepository';
import { FlashcardCardRepository } from '../../ports/repositories/FlashcardCardRepository';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { FlashcardCard } from '../../../core/entities/FlashcardCard';
import { AppError } from '../../../core/errors/AppError';
import { TrackLearningActivityUseCase } from '../streak/TrackLearningActivityUseCase';

interface AddCardToDeckInput {
  deckId: string;
  vocabularyId: string;
  userId: string;
}

export class AddCardToDeckUseCase {
  constructor(
    private deckRepository: FlashcardDeckRepository,
    private cardRepository: FlashcardCardRepository,
    private vocabularyRepository: VocabularyRepository,
    private trackLearningActivityUseCase: TrackLearningActivityUseCase
  ) {}

  async execute(input: AddCardToDeckInput): Promise<FlashcardCard> {
    const deck = await this.deckRepository.findById(input.deckId);
    if (!deck) {
      throw new AppError('NOT_FOUND', 'Flashcard deck not found', 404);
    }

    if (deck.ownerId !== input.userId) {
      throw new AppError('FORBIDDEN', 'You do not own this deck', 403);
    }

    const vocab = await this.vocabularyRepository.findById(input.vocabularyId);
    if (!vocab) {
      throw new AppError('NOT_FOUND', 'Vocabulary item not found', 404);
    }

    // Check if card already exists in the deck
    const existing = await this.cardRepository.findByDeckAndVocabulary(
      input.deckId,
      input.vocabularyId
    );
    if (existing) {
      throw new AppError('DUPLICATE_RESOURCE', 'This word is already in the deck', 409);
    }

    const front = vocab.text;
    const meaning = vocab.meanings[0];
    const back = meaning?.meaningVi || '';
    const example = meaning?.examples?.[0]?.exampleEn || '';

    // Count existing cards to set orderIndex
    const currentCards = await this.cardRepository.findByDeck(input.deckId);
    const orderIndex = currentCards.length;

    const card = await this.cardRepository.create({
      deckId: input.deckId,
      vocabularyId: input.vocabularyId,
      front,
      back,
      example,
      orderIndex,
    });

    // Update deck card count
    await this.deckRepository.update(input.deckId, {
      cardCount: deck.cardCount + 1,
    });

    // Track learning activity
    await this.trackLearningActivityUseCase.execute({
      userId: input.userId,
      activityType: 'CARD_CREATED'
    });

    return card;
  }
}
