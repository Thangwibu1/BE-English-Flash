import { FlashcardDeck } from '../../../../core/entities/FlashcardDeck';
import { FlashcardCard } from '../../../../core/entities/FlashcardCard';
import { FlashcardDeckDocument } from '../models/FlashcardDeckModel';
import { FlashcardCardDocument } from '../models/FlashcardCardModel';

export function mapDeckDocToEntity(doc: FlashcardDeckDocument): FlashcardDeck {
  return {
    id: doc._id.toString(),
    ownerId: doc.ownerId.toString(),
    name: doc.name,
    description: doc.description,
    visibility: doc.visibility,
    status: doc.status,
    cardCount: doc.cardCount,
    sourceDeckId: doc.sourceDeckId ? doc.sourceDeckId.toString() : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
  };
}

export function mapCardDocToEntity(doc: FlashcardCardDocument): FlashcardCard {
  return {
    id: doc._id.toString(),
    deckId: doc.deckId.toString(),
    vocabularyId: doc.vocabularyId.toString(),
    front: doc.front,
    back: doc.back,
    example: doc.example,
    orderIndex: doc.orderIndex,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
  };
}
