export interface Topic {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentTopicId?: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
