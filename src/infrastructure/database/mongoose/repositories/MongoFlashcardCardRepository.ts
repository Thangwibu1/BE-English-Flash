import { FlashcardCardRepository } from '../../../../app/ports/repositories/FlashcardCardRepository';
import { FlashcardCard } from '../../../../core/entities/FlashcardCard';
import { FlashcardCardModel, FlashcardCardDocument } from '../models/FlashcardCardModel';
import { mapCardDocToEntity } from '../mappers/flashcardMapper';

export class MongoFlashcardCardRepository implements FlashcardCardRepository {
  async findById(id: string): Promise<FlashcardCard | null> {
    const doc = await FlashcardCardModel.findOne({ _id: id, deletedAt: null });
    return doc ? mapCardDocToEntity(doc) : null;
  }

  async findByDeck(deckId: string): Promise<FlashcardCard[]> {
    const docs = await FlashcardCardModel.find({ deckId, deletedAt: null }).sort({ orderIndex: 1 });
    return docs.map(mapCardDocToEntity);
  }

  async create(card: Partial<FlashcardCard>): Promise<FlashcardCard> {
    const doc = await FlashcardCardModel.create({
      deckId: card.deckId,
      vocabularyId: card.vocabularyId,
      front: card.front,
      back: card.back,
      example: card.example,
      orderIndex: card.orderIndex || 0,
      deletedAt: null,
    });
    return mapCardDocToEntity(doc);
  }

  async delete(id: string): Promise<void> {
    await FlashcardCardModel.deleteOne({ _id: id });
  }

  async deleteByDeck(deckId: string): Promise<void> {
    await FlashcardCardModel.deleteMany({ deckId });
  }

  async findByDeckAndVocabulary(deckId: string, vocabularyId: string): Promise<FlashcardCard | null> {
    const doc = await FlashcardCardModel.findOne({ deckId, vocabularyId, deletedAt: null });
    return doc ? mapCardDocToEntity(doc) : null;
  }
}
