import { FlashcardDeckRepository } from '../../ports/repositories/FlashcardDeckRepository';
import { FlashcardDeck } from '../../../core/entities/FlashcardDeck';

interface CreateDeckInput {
  ownerId: string;
  name: string;
  description?: string;
  visibility?: 'public' | 'private';
}

export class CreateDeckUseCase {
  constructor(private deckRepository: FlashcardDeckRepository) {}

  async execute(input: CreateDeckInput): Promise<FlashcardDeck> {
    return this.deckRepository.create({
      ownerId: input.ownerId,
      name: input.name,
      description: input.description,
      visibility: input.visibility || 'private',
    });
  }
}
