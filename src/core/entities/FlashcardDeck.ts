export interface FlashcardDeck {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  status: 'active' | 'archived';
  cardCount: number;
  sourceDeckId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
