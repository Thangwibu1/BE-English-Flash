import { FlashcardDeckRepository } from '../../../../app/ports/repositories/FlashcardDeckRepository';
import { FlashcardDeck } from '../../../../core/entities/FlashcardDeck';
import { FlashcardDeckModel, FlashcardDeckDocument } from '../models/FlashcardDeckModel';
import { mapDeckDocToEntity } from '../mappers/flashcardMapper';

export class MongoFlashcardDeckRepository implements FlashcardDeckRepository {
  async findById(id: string): Promise<FlashcardDeck | null> {
    const doc = await FlashcardDeckModel.findOne({ _id: id, deletedAt: null });
    return doc ? mapDeckDocToEntity(doc) : null;
  }

  async findByOwner(ownerId: string): Promise<FlashcardDeck[]> {
    const docs = await FlashcardDeckModel.find({ ownerId, deletedAt: null }).sort({ createdAt: -1 });
    return docs.map(mapDeckDocToEntity);
  }

  async findByNameAndOwner(name: string, ownerId: string): Promise<FlashcardDeck | null> {
    const doc = await FlashcardDeckModel.findOne({
      ownerId,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      deletedAt: null,
    });
    return doc ? mapDeckDocToEntity(doc) : null;
  }

  async findPublicDecks(): Promise<FlashcardDeck[]> {
    const docs = await FlashcardDeckModel.find({ visibility: 'public', status: 'active', deletedAt: null }).sort({ createdAt: -1 });
    return docs.map(mapDeckDocToEntity);
  }

  async create(deck: Partial<FlashcardDeck>): Promise<FlashcardDeck> {
    const doc = await FlashcardDeckModel.create({
      ownerId: deck.ownerId,
      name: deck.name,
      description: deck.description,
      visibility: deck.visibility || 'private',
      status: deck.status || 'active',
      cardCount: 0,
      sourceDeckId: deck.sourceDeckId || null,
      deletedAt: null,
    });
    return mapDeckDocToEntity(doc);
  }

  async update(id: string, deck: Partial<FlashcardDeck>): Promise<FlashcardDeck | null> {
    const updateData: any = { ...deck };
    delete updateData.id;
    delete updateData._id;

    const doc = await FlashcardDeckModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updateData },
      { new: true }
    );
    return doc ? mapDeckDocToEntity(doc) : null;
  }

  async softDelete(id: string): Promise<void> {
    await FlashcardDeckModel.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } }
    );
  }
}
