import { FlashcardDeckRepository } from '../../ports/repositories/FlashcardDeckRepository';
import { FlashcardCardRepository } from '../../ports/repositories/FlashcardCardRepository';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { FlashcardCard } from '../../../core/entities/FlashcardCard';
import { AppError } from '../../../core/errors/AppError';
import { TrackLearningActivityUseCase } from '../streak/TrackLearningActivityUseCase';

interface AddCardToDeckInput {
  deckId?: string;
  vocabularyId: string;
  userId: string;
}

export class AddCardToDeckUseCase {
  constructor(
    private deckRepository: FlashcardDeckRepository,
    private cardRepository: FlashcardCardRepository,
    private vocabularyRepository: VocabularyRepository,
    private userProgressRepository: UserProgressRepository,
    private trackLearningActivityUseCase: TrackLearningActivityUseCase
  ) {}

  async execute(input: AddCardToDeckInput): Promise<FlashcardCard> {
    let deckIdToUse = input.deckId;

    if (!deckIdToUse) {
      // Find or create default deck "My Flashcards"
      let defaultDeck = await this.deckRepository.findByNameAndOwner('My Flashcards', input.userId);
      if (!defaultDeck) {
        defaultDeck = await this.deckRepository.create({
          ownerId: input.userId as any,
          name: 'My Flashcards',
          description: 'Default flashcard deck',
          visibility: 'private',
          status: 'active',
        });
      }
      deckIdToUse = defaultDeck.id;
    } else {
      const deck = await this.deckRepository.findById(deckIdToUse);
      if (!deck) {
        throw new AppError('NOT_FOUND', 'Flashcard deck not found', 404);
      }

      if (deck.ownerId !== input.userId) {
        throw new AppError('FORBIDDEN', 'You do not own this deck', 403);
      }
    }

    const vocab = await this.vocabularyRepository.findById(input.vocabularyId);
    if (!vocab) {
      throw new AppError('NOT_FOUND', 'Vocabulary item not found', 404);
    }

    // Check if card already exists in the deck
    const existing = await this.cardRepository.findByDeckAndVocabulary(
      deckIdToUse,
      input.vocabularyId
    );
    if (existing) {
      return existing; // Return existing card (idempotent behavior)
    }

    // Count existing cards to set orderIndex
    const currentCards = await this.cardRepository.findByDeck(deckIdToUse);
    const orderIndex = currentCards.length;

    // Create card with empty overrides (rely on Vocabulary for content rendering)
    const card = await this.cardRepository.create({
      deckId: deckIdToUse,
      vocabularyId: input.vocabularyId,
      orderIndex,
    });

    // Update deck card count
    const deckToUpdate = await this.deckRepository.findById(deckIdToUse);
    if (deckToUpdate) {
      await this.deckRepository.update(deckIdToUse, {
        cardCount: deckToUpdate.cardCount + 1,
      });
    }

    // Upsert UserWordProgress to 'saved'
    const now = new Date();
    const progressUpdate = {
      $set: {
        status: 'saved',
        dueAt: now,
        deletedAt: null,
      },
      $setOnInsert: {
        ease: 2.5,
        intervalDays: 0,
        reviewCount: 0,
        correctCount: 0,
        wrongCount: 0,
        firstSavedAt: now,
      },
    };
    await this.userProgressRepository.saveWordProgress(
      input.userId,
      input.vocabularyId,
      progressUpdate
    );

    // Track learning activity
    await this.trackLearningActivityUseCase.execute({
      userId: input.userId,
      activityType: 'CARD_CREATED'
    });

    return card;
  }
}
