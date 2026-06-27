export interface FlashcardCard {
  id: string;
  deckId: string;
  vocabularyId: string;
  front?: string;
  back?: string;
  example?: string;
  orderIndex: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
