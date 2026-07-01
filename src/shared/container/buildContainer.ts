import { MongoUserRepository } from '../../infrastructure/database/mongoose/repositories/MongoUserRepository';
import { PasswordAuthProviderImpl } from '../../infrastructure/auth/PasswordAuthProviderImpl';
import { JwtAuthTokenService } from '../../infrastructure/auth/JwtAuthTokenService';
import { RegisterUseCase } from '../../app/use-cases/auth/RegisterUseCase';
import { LoginUseCase } from '../../app/use-cases/auth/LoginUseCase';
import { GetCurrentUserUseCase } from '../../app/use-cases/auth/GetCurrentUserUseCase';
import { ForgotPasswordUseCase } from '../../app/use-cases/auth/ForgotPasswordUseCase';
import { AuthController } from '../../interfaces/http/controllers/AuthController';

// Topic imports
import { MongoTopicRepository } from '../../infrastructure/database/mongoose/repositories/MongoTopicRepository';
import { ListTopicsUseCase } from '../../app/use-cases/topic/ListTopicsUseCase';
import { CreateTopicUseCase } from '../../app/use-cases/topic/CreateTopicUseCase';
import { UpdateTopicUseCase } from '../../app/use-cases/topic/UpdateTopicUseCase';
import { DeleteTopicUseCase } from '../../app/use-cases/topic/DeleteTopicUseCase';
import { TopicController } from '../../interfaces/http/controllers/TopicController';

// Vocabulary imports
import { MongoVocabularyRepository } from '../../infrastructure/database/mongoose/repositories/MongoVocabularyRepository';
import { MongoUserProgressRepository } from '../../infrastructure/database/mongoose/repositories/MongoUserProgressRepository';
import { ListVocabulariesUseCase } from '../../app/use-cases/vocabulary/ListVocabulariesUseCase';
import { GetVocabularyDetailUseCase } from '../../app/use-cases/vocabulary/GetVocabularyDetailUseCase';
import { CreateVocabularyUseCase } from '../../app/use-cases/vocabulary/CreateVocabularyUseCase';
import { UpdateVocabularyUseCase } from '../../app/use-cases/vocabulary/UpdateVocabularyUseCase';
import { DeleteVocabularyUseCase } from '../../app/use-cases/vocabulary/DeleteVocabularyUseCase';
import { SaveVocabularyUseCase } from '../../app/use-cases/vocabulary/SaveVocabularyUseCase';
import { MarkVocabularyKnownUseCase } from '../../app/use-cases/vocabulary/MarkVocabularyKnownUseCase';
import { MarkVocabularyDifficultUseCase } from '../../app/use-cases/vocabulary/MarkVocabularyDifficultUseCase';
import { SearchVocabularyUseCase } from '../../app/use-cases/vocabulary/SearchVocabularyUseCase';
import { LookupVocabularyByTextUseCase } from '../../app/use-cases/vocabulary/LookupVocabularyByTextUseCase';
import { FuzzyVocabularySearchService } from '../../infrastructure/services/FuzzyVocabularySearchService';
import { VocabularyController } from '../../interfaces/http/controllers/VocabularyController';

// Reading imports
import { MongoReadingRepository } from '../../infrastructure/database/mongoose/repositories/MongoReadingRepository';
import { SimpleReadingPreprocessor } from '../../infrastructure/services/SimpleReadingPreprocessor';
import { ListReadingsUseCase } from '../../app/use-cases/reading/ListReadingsUseCase';
import { GetReadingDetailUseCase } from '../../app/use-cases/reading/GetReadingDetailUseCase';
import { CreateReadingUseCase } from '../../app/use-cases/reading/CreateReadingUseCase';
import { UpdateReadingUseCase } from '../../app/use-cases/reading/UpdateReadingUseCase';
import { DeleteReadingUseCase } from '../../app/use-cases/reading/DeleteReadingUseCase';
import { ReprocessReadingUseCase } from '../../app/use-cases/reading/ReprocessReadingUseCase';
import { TrackReadingLookupUseCase } from '../../app/use-cases/reading/TrackReadingLookupUseCase';
import { UpdateReadingProgressUseCase } from '../../app/use-cases/reading/UpdateReadingProgressUseCase';
import { ReadingController } from '../../interfaces/http/controllers/ReadingController';

// Flashcard imports
import { MongoFlashcardDeckRepository } from '../../infrastructure/database/mongoose/repositories/MongoFlashcardDeckRepository';
import { MongoFlashcardCardRepository } from '../../infrastructure/database/mongoose/repositories/MongoFlashcardCardRepository';
import { BasicReviewScheduler } from '../../infrastructure/services/BasicReviewScheduler';
import { CreateDeckUseCase } from '../../app/use-cases/flashcard/CreateDeckUseCase';
import { ListDecksUseCase } from '../../app/use-cases/flashcard/ListDecksUseCase';
import { GetDeckDetailUseCase } from '../../app/use-cases/flashcard/GetDeckDetailUseCase';
import { AddCardToDeckUseCase } from '../../app/use-cases/flashcard/AddCardToDeckUseCase';
import { ReviewFlashcardUseCase } from '../../app/use-cases/flashcard/ReviewFlashcardUseCase';
import { FlashcardController } from '../../interfaces/http/controllers/FlashcardController';

// Streak imports
import { MongoUserActivityRepository } from '../../infrastructure/database/mongoose/repositories/MongoUserActivityRepository';
import { MongoUserStreakRepository } from '../../infrastructure/database/mongoose/repositories/MongoUserStreakRepository';
import { TrackLearningActivityUseCase } from '../../app/use-cases/streak/TrackLearningActivityUseCase';
import { GetMyStreakUseCase } from '../../app/use-cases/streak/GetMyStreakUseCase';
import { StreakController } from '../../interfaces/http/controllers/StreakController';

// AI Reading Import imports
import { MongoAiVocabularySuggestionRepository } from '../../infrastructure/database/mongoose/repositories/MongoAiVocabularySuggestionRepository';
import { NineRouterAIProvider } from '../../infrastructure/ai/NineRouterAIProvider';
import { AnalyzeReadingVocabularyUseCase } from '../../app/use-cases/admin/readings/AnalyzeReadingVocabularyUseCase';
import { GetReadingAiSuggestionsUseCase } from '../../app/use-cases/admin/readings/GetReadingAiSuggestionsUseCase';
import { UpdateAiVocabularySuggestionUseCase } from '../../app/use-cases/admin/readings/UpdateAiVocabularySuggestionUseCase';
import { ApproveAiVocabularySuggestionUseCase } from '../../app/use-cases/admin/readings/ApproveAiVocabularySuggestionUseCase';
import { RejectAiVocabularySuggestionUseCase } from '../../app/use-cases/admin/readings/RejectAiVocabularySuggestionUseCase';
import { AdminReadingAiController } from '../../interfaces/http/controllers/AdminReadingAiController';
import { AnalyzeContributionReadingWithAiUseCase } from '../../app/use-cases/contributions/AnalyzeContributionReadingWithAiUseCase';

let containerInstance: any = null;

export function buildContainer() {
  if (containerInstance) return containerInstance;

  // Repositories & Services
  const userRepository = new MongoUserRepository();
  const topicRepository = new MongoTopicRepository();
  const vocabularyRepository = new MongoVocabularyRepository();
  const userProgressRepository = new MongoUserProgressRepository();
  const readingRepository = new MongoReadingRepository();
  const deckRepository = new MongoFlashcardDeckRepository();
  const cardRepository = new MongoFlashcardCardRepository();
  const userActivityRepository = new MongoUserActivityRepository();
  const userStreakRepository = new MongoUserStreakRepository();
  const aiVocabularySuggestionRepository = new MongoAiVocabularySuggestionRepository();
  
  const aiProviderService = new NineRouterAIProvider({
    apiKey: process.env.NINEROUTER_9R_API_KEY || '',
    baseUrl: process.env.NINEROUTER_9R_BASE_URL || 'https://aishop24h.com/v1',
    model: process.env.NINEROUTER_9R_MODEL || 'z-ai/glm-5.2',
  });
  
  const readingPreprocessor = new SimpleReadingPreprocessor();
  const reviewScheduler = new BasicReviewScheduler();
  const passwordAuthProvider = new PasswordAuthProviderImpl();
  const authTokenService = new JwtAuthTokenService();

  // Streak Use Cases (Instantiated early for injection)
  const trackLearningActivityUseCase = new TrackLearningActivityUseCase(
    userActivityRepository,
    userStreakRepository
  );
  const getMyStreakUseCase = new GetMyStreakUseCase(
    userActivityRepository,
    userStreakRepository
  );

  // Auth Use Cases & Controller
  const registerUseCase = new RegisterUseCase(
    userRepository,
    passwordAuthProvider,
    authTokenService
  );

  const loginUseCase = new LoginUseCase(
    userRepository,
    passwordAuthProvider,
    authTokenService
  );

  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);

  const forgotPasswordUseCase = new ForgotPasswordUseCase(
    userRepository,
    passwordAuthProvider
  );

  const authController = new AuthController(
    registerUseCase,
    loginUseCase,
    getCurrentUserUseCase,
    forgotPasswordUseCase
  );

  // Topic Use Cases & Controller
  const listTopicsUseCase = new ListTopicsUseCase(topicRepository);
  const createTopicUseCase = new CreateTopicUseCase(topicRepository);
  const updateTopicUseCase = new UpdateTopicUseCase(topicRepository);
  const deleteTopicUseCase = new DeleteTopicUseCase(topicRepository);

  const topicController = new TopicController(
    listTopicsUseCase,
    createTopicUseCase,
    updateTopicUseCase,
    deleteTopicUseCase
  );

  // Vocabulary Use Cases & Controller
  const listVocabulariesUseCase = new ListVocabulariesUseCase(vocabularyRepository, userProgressRepository);
  const getVocabularyDetailUseCase = new GetVocabularyDetailUseCase(
    vocabularyRepository,
    userProgressRepository
  );
  const createVocabularyUseCase = new CreateVocabularyUseCase(vocabularyRepository);
  const updateVocabularyUseCase = new UpdateVocabularyUseCase(vocabularyRepository);
  const deleteVocabularyUseCase = new DeleteVocabularyUseCase(vocabularyRepository);
  const saveVocabularyUseCase = new SaveVocabularyUseCase(
    userProgressRepository,
    vocabularyRepository,
    trackLearningActivityUseCase
  );
  const markVocabularyKnownUseCase = new MarkVocabularyKnownUseCase(
    userProgressRepository,
    vocabularyRepository,
    trackLearningActivityUseCase
  );
  const markVocabularyDifficultUseCase = new MarkVocabularyDifficultUseCase(
    userProgressRepository,
    vocabularyRepository,
    trackLearningActivityUseCase
  );

  // Fuzzy Search Service & SearchVocabularyUseCase
  const fuzzyVocabularySearchService = new FuzzyVocabularySearchService({
    vocabularyRepository,
  });
  const searchVocabularyUseCase = new SearchVocabularyUseCase(
    vocabularyRepository,
    fuzzyVocabularySearchService
  );
  const lookupVocabularyByTextUseCase = new LookupVocabularyByTextUseCase(
    vocabularyRepository,
    fuzzyVocabularySearchService
  );

  const vocabularyController = new VocabularyController(
    listVocabulariesUseCase,
    getVocabularyDetailUseCase,
    createVocabularyUseCase,
    updateVocabularyUseCase,
    deleteVocabularyUseCase,
    saveVocabularyUseCase,
    markVocabularyKnownUseCase,
    markVocabularyDifficultUseCase
  );

  // Reading Use Cases & Controller
  const listReadingsUseCase = new ListReadingsUseCase(readingRepository);
  const getReadingDetailUseCase = new GetReadingDetailUseCase(
    readingRepository,
    vocabularyRepository,
    userProgressRepository
  );
  const createReadingUseCase = new CreateReadingUseCase(
    readingRepository,
    vocabularyRepository,
    readingPreprocessor
  );
  const updateReadingUseCase = new UpdateReadingUseCase(
    readingRepository,
    vocabularyRepository,
    readingPreprocessor
  );
  const deleteReadingUseCase = new DeleteReadingUseCase(readingRepository);
  const reprocessReadingUseCase = new ReprocessReadingUseCase(
    readingRepository,
    vocabularyRepository,
    readingPreprocessor
  );
  const trackReadingLookupUseCase = new TrackReadingLookupUseCase(
    userProgressRepository,
    readingRepository,
    vocabularyRepository,
    trackLearningActivityUseCase
  );
  const updateReadingProgressUseCase = new UpdateReadingProgressUseCase(
    userProgressRepository,
    readingRepository,
    trackLearningActivityUseCase
  );

  const readingController = new ReadingController(
    listReadingsUseCase,
    getReadingDetailUseCase,
    createReadingUseCase,
    updateReadingUseCase,
    deleteReadingUseCase,
    reprocessReadingUseCase,
    trackReadingLookupUseCase,
    updateReadingProgressUseCase
  );

  // Flashcard Use Cases & Controller
  const createDeckUseCase = new CreateDeckUseCase(deckRepository);
  const listDecksUseCase = new ListDecksUseCase(deckRepository);
  const getDeckDetailUseCase = new GetDeckDetailUseCase(deckRepository, cardRepository);
  const addCardToDeckUseCase = new AddCardToDeckUseCase(
    deckRepository,
    cardRepository,
    vocabularyRepository,
    userProgressRepository,
    trackLearningActivityUseCase
  );
  const reviewFlashcardUseCase = new ReviewFlashcardUseCase(
    userProgressRepository,
    reviewScheduler,
    trackLearningActivityUseCase
  );

  const flashcardController = new FlashcardController(
    createDeckUseCase,
    listDecksUseCase,
    getDeckDetailUseCase,
    addCardToDeckUseCase,
    reviewFlashcardUseCase
  );

  // Streak Controller (Use cases instantiated at the top)
  const streakController = new StreakController({
    getMyStreakUseCase,
    trackLearningActivityUseCase
  });

  // AI Reading Import Use Cases & Controller
  const analyzeReadingVocabularyUseCase = new AnalyzeReadingVocabularyUseCase({
    readingRepository,
    vocabularyRepository,
    aiVocabularySuggestionRepository,
    aiProviderService,
  });

  const getReadingAiSuggestionsUseCase = new GetReadingAiSuggestionsUseCase({
    aiVocabularySuggestionRepository,
  });

  const updateAiVocabularySuggestionUseCase = new UpdateAiVocabularySuggestionUseCase({
    aiVocabularySuggestionRepository,
  });

  const approveAiVocabularySuggestionUseCase = new ApproveAiVocabularySuggestionUseCase({
    aiVocabularySuggestionRepository,
    vocabularyRepository,
    reprocessReadingUseCase,
  });

  const rejectAiVocabularySuggestionUseCase = new RejectAiVocabularySuggestionUseCase({
    aiVocabularySuggestionRepository,
  });

  const analyzeContributionReadingWithAiUseCase = new AnalyzeContributionReadingWithAiUseCase({
    aiProviderService,
    vocabularyRepository,
  });

  const adminReadingAiController = new AdminReadingAiController({
    analyzeReadingVocabularyUseCase,
    getReadingAiSuggestionsUseCase,
    updateAiVocabularySuggestionUseCase,
    approveAiVocabularySuggestionUseCase,
    rejectAiVocabularySuggestionUseCase,
    reprocessReadingUseCase,
  });

  containerInstance = {
    authController,
    topicController,
    vocabularyController,
    readingController,
    flashcardController,
    streakController,
    adminReadingAiController,
    analyzeContributionReadingWithAiUseCase,
    trackLearningActivityUseCase,
    reprocessReadingUseCase,
    userRepository,
    topicRepository,
    vocabularyRepository,
    userProgressRepository,
    readingRepository,
    deckRepository,
    cardRepository,
    passwordAuthProvider,
    authTokenService,
    searchVocabularyUseCase,
    fuzzyVocabularySearchService,
    lookupVocabularyByTextUseCase,
  };

  return containerInstance;
}
