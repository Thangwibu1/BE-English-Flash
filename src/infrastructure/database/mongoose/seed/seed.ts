import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/UserModel';
import { TopicModel } from '../models/TopicModel';
import { VocabularyModel, VocabularyType, CEFRLevel } from '../models/VocabularyModel';
import { ReadingModel } from '../models/ReadingModel';
import { FlashcardDeckModel } from '../models/FlashcardDeckModel';
import { FlashcardCardModel } from '../models/FlashcardCardModel';

// Load environment variables
dotenv.config();

const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
};

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB. Clearing existing database...');

  // Clean existing collection data
  await UserModel.deleteMany({});
  await TopicModel.deleteMany({});
  await VocabularyModel.deleteMany({});
  await ReadingModel.deleteMany({});
  await FlashcardDeckModel.deleteMany({});
  await FlashcardCardModel.deleteMany({});

  console.log('Database cleared. Creating default users...');

  // 1. Seed Users
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('admin123456', salt);
  const contributorPasswordHash = await bcrypt.hash('contributor123456', salt);
  const userPasswordHash = await bcrypt.hash('user123456', salt);

  const adminUser = await UserModel.create({
    username: 'admin',
    email: 'admin@example.com',
    passwordHash: adminPasswordHash,
    displayName: 'System Admin',
    role: 'admin',
    status: 'active',
  });

  const contributorUser = await UserModel.create({
    username: 'contributor',
    email: 'contributor@example.com',
    passwordHash: contributorPasswordHash,
    displayName: 'Main Contributor',
    role: 'contributor',
    status: 'active',
  });

  const normalUser = await UserModel.create({
    username: 'user',
    email: 'user@example.com',
    passwordHash: userPasswordHash,
    displayName: 'Regular Learner',
    role: 'user',
    status: 'active',
  });

  console.log('Users created. Seeding topics...');

  // 2. Seed Topics
  const topicsData = [
    { name: 'Daily Life', slug: 'daily-life', description: 'Common terms for daily routines' },
    { name: 'Travel', slug: 'travel', description: 'Useful vocabulary for trips and tourism' },
    { name: 'Work', slug: 'work', description: 'Professional and workplace terminology' },
    { name: 'School', slug: 'school', description: 'Academic and classroom vocab' },
    { name: 'Health', slug: 'health', description: 'Wellness, medical, and fitness terms' },
    { name: 'Technology', slug: 'technology', description: 'Tech gadgets, software, and internet terms' },
    { name: 'Business', slug: 'business', description: 'Trade, finance, and corporate speech' },
    { name: 'Environment', slug: 'environment', description: 'Climate, nature, and green living terms' },
  ];

  const topics: any[] = [];
  for (const t of topicsData) {
    const topic = await TopicModel.create({
      ...t,
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    });
    topics.push(topic);
  }

  console.log('Topics created. Seeding vocabulary items...');

  // 3. Seed Vocabulary Items (20 items)
  const vocabulariesToSeed = [
    // Single Words
    {
      text: 'abandon',
      type: 'single_word' as VocabularyType,
      level: 'B2' as CEFRLevel,
      partOfSpeech: 'verb',
      meaningVi: 'từ bỏ, ruồng bỏ',
      meaningEn: 'to leave a place, thing, or person forever',
      exampleEn: 'The baby was abandoned on the doorstep of a church.',
      exampleVi: 'Đứa bé bị bỏ rơi trước thềm nhà thờ.',
      forms: [{ formText: 'abandoned', formType: 'past' }, { formText: 'abandoning', formType: 'gerund' }],
      topicIds: [topics[7]._id], // Environment / nature
    },
    {
      text: 'decision',
      type: 'single_word' as VocabularyType,
      level: 'A2' as CEFRLevel,
      partOfSpeech: 'noun',
      meaningVi: 'quyết định',
      meaningEn: 'a choice that you make after thinking',
      exampleEn: 'She made a decision to study harder.',
      exampleVi: 'Cô ấy đã quyết định học hành chăm chỉ hơn.',
      forms: [{ formText: 'decisions', formType: 'plural' }],
      topicIds: [topics[0]._id], // Daily Life
    },
    {
      text: 'improve',
      type: 'single_word' as VocabularyType,
      level: 'B1' as CEFRLevel,
      partOfSpeech: 'verb',
      meaningVi: 'cải thiện, tiến bộ',
      meaningEn: 'to get better or to make something better',
      exampleEn: 'He tried to improve his health.',
      exampleVi: 'Anh ấy đã cố gắng cải thiện sức khỏe của mình.',
      forms: [{ formText: 'improved', formType: 'past' }, { formText: 'improving', formType: 'gerund' }, { formText: 'improves', formType: 'third-person' }],
      topicIds: [topics[4]._id], // Health
    },
    {
      text: 'environment',
      type: 'single_word' as VocabularyType,
      level: 'B1' as CEFRLevel,
      partOfSpeech: 'noun',
      meaningVi: 'môi trường',
      meaningEn: 'the air, water, and land in or on which people, animals, and plants live',
      exampleEn: 'We must protect the environment.',
      exampleVi: 'Chúng ta phải bảo vệ môi trường.',
      forms: [{ formText: 'environments', formType: 'plural' }],
      topicIds: [topics[7]._id], // Environment
    },
    // Collocations
    {
      text: 'make a decision',
      type: 'collocation' as VocabularyType,
      level: 'A2' as CEFRLevel,
      meaningVi: 'đưa ra quyết định',
      meaningEn: 'to decide on something',
      exampleEn: 'It is hard to make a decision right now.',
      exampleVi: 'Thật khó để đưa ra quyết định ngay lúc này.',
      forms: [{ formText: 'made a decision', formType: 'past' }, { formText: 'making a decision', formType: 'gerund' }],
      topicIds: [topics[0]._id],
    },
    {
      text: 'take responsibility',
      type: 'collocation' as VocabularyType,
      level: 'B2' as CEFRLevel,
      meaningVi: 'chịu trách nhiệm',
      meaningEn: 'to accept blame or take action for something',
      exampleEn: 'He needs to take responsibility for his actions.',
      exampleVi: 'Anh ấy cần chịu trách nhiệm về hành động của mình.',
      forms: [{ formText: 'took responsibility', formType: 'past' }, { formText: 'taking responsibility', formType: 'gerund' }],
      topicIds: [topics[2]._id], // Work
    },
    {
      text: 'heavy rain',
      type: 'collocation' as VocabularyType,
      level: 'A2' as CEFRLevel,
      meaningVi: 'mưa lớn, mưa nặng hạt',
      meaningEn: 'intense rainfall',
      exampleEn: 'They ran out of milk after the heavy rain.',
      exampleVi: 'Họ đã hết sữa sau trận mưa lớn.',
      forms: [],
      topicIds: [topics[7]._id],
    },
    {
      text: 'strong coffee',
      type: 'collocation' as VocabularyType,
      level: 'A2' as CEFRLevel,
      meaningVi: 'cà phê đặc',
      meaningEn: 'coffee that has a very rich, intense flavor',
      exampleEn: 'He prefers drinking strong coffee in the morning.',
      exampleVi: 'Anh ấy thích uống cà phê đặc vào buổi sáng.',
      forms: [],
      topicIds: [topics[0]._id],
    },
    // Phrasal Verbs
    {
      text: 'give up',
      type: 'phrasal_verb' as VocabularyType,
      level: 'B1' as CEFRLevel,
      meaningVi: 'từ bỏ, bỏ cuộc',
      meaningEn: 'to stop trying to do something',
      exampleEn: 'She finally gave up smoking.',
      exampleVi: 'Cô ấy cuối cùng đã từ bỏ hút thuốc.',
      forms: [{ formText: 'gave up', formType: 'past' }, { formText: 'giving up', formType: 'gerund' }],
      topicIds: [topics[4]._id],
    },
    {
      text: 'look up',
      type: 'phrasal_verb' as VocabularyType,
      level: 'A2' as CEFRLevel,
      meaningVi: 'tra cứu (từ điển)',
      meaningEn: 'to search for information in a book or online',
      exampleEn: 'You should look up new words in the dictionary.',
      exampleVi: 'Bạn nên tra cứu từ mới trong từ điển.',
      forms: [{ formText: 'looked up', formType: 'past' }, { formText: 'looking up', formType: 'gerund' }],
      topicIds: [topics[3]._id], // School
    },
    {
      text: 'run out of',
      type: 'phrasal_verb' as VocabularyType,
      level: 'B1' as CEFRLevel,
      meaningVi: 'cạn kiệt, hết sạch',
      meaningEn: 'to have no more of something left',
      exampleEn: 'We ran out of coffee yesterday.',
      exampleVi: 'Chúng tôi đã hết sạch cà phê ngày hôm qua.',
      forms: [{ formText: 'runs out of', formType: 'present-singular' }, { formText: 'ran out of', formType: 'past' }, { formText: 'running out of', formType: 'gerund' }],
      topicIds: [topics[0]._id],
    },
    {
      text: 'turn off',
      type: 'phrasal_verb' as VocabularyType,
      level: 'A1' as CEFRLevel,
      meaningVi: 'tắt đi',
      meaningEn: 'to stop a device from working',
      exampleEn: 'Please turn off the lights before leaving.',
      exampleVi: 'Vui lòng tắt đèn trước khi rời đi.',
      forms: [{ formText: 'turned off', formType: 'past' }, { formText: 'turning off', formType: 'gerund' }],
      topicIds: [topics[0]._id],
    },
    // Idioms
    {
      text: 'break the ice',
      type: 'idiom' as VocabularyType,
      level: 'B2' as CEFRLevel,
      meaningVi: 'phá vỡ bầu không khí ngượng ngùng',
      meaningEn: 'to make people feel more comfortable in a social situation',
      exampleEn: 'He told a joke to break the ice.',
      exampleVi: 'Anh ấy kể một câu chuyện cười để phá vỡ sự ngượng ngùng.',
      forms: [{ formText: 'broke the ice', formType: 'past' }, { formText: 'breaking the ice', formType: 'gerund' }],
      topicIds: [topics[0]._id],
    },
    {
      text: 'once in a blue moon',
      type: 'idiom' as VocabularyType,
      level: 'B2' as CEFRLevel,
      meaningVi: 'hiếm khi, năm thì mười họa',
      meaningEn: 'very rarely',
      exampleEn: 'He goes to the cinema once in a blue moon.',
      exampleVi: 'Anh ấy hiếm khi đi xem phim.',
      forms: [],
      topicIds: [topics[0]._id],
    },
    // Fixed Phrases
    {
      text: 'on the other hand',
      type: 'fixed_phrase' as VocabularyType,
      level: 'B1' as CEFRLevel,
      meaningVi: 'mặt khác, tuy nhiên',
      meaningEn: 'used to introduce a contrasting point of view',
      exampleEn: 'Laptops are convenient. On the other hand, they are expensive.',
      exampleVi: 'Laptop rất tiện lợi. Mặt khác, chúng lại khá đắt.',
      forms: [],
      topicIds: [topics[0]._id],
    },
    {
      text: 'as a result',
      type: 'fixed_phrase' as VocabularyType,
      level: 'B1' as CEFRLevel,
      meaningVi: 'kết quả là',
      meaningEn: 'because of something that happened before',
      exampleEn: 'He studied hard. As a result, he passed the exam.',
      exampleVi: 'Anh ấy học hành chăm chỉ. Kết quả là anh ấy đã đỗ kỳ thi.',
      forms: [],
      topicIds: [topics[3]._id],
    },
    {
      text: 'in addition',
      type: 'fixed_phrase' as VocabularyType,
      level: 'B1' as CEFRLevel,
      meaningVi: 'ngoài ra, thêm vào đó',
      meaningEn: 'as an extra thing',
      exampleEn: 'The hotel has a pool. In addition, it offers free breakfast.',
      exampleVi: 'Khách sạn có bể bơi. Ngoài ra, nó còn tặng kèm bữa sáng miễn phí.',
      forms: [],
      topicIds: [topics[1]._id], // Travel
    },
    {
      text: 'as soon as possible',
      type: 'fixed_phrase' as VocabularyType,
      level: 'A2' as CEFRLevel,
      meaningVi: 'càng sớm càng tốt',
      meaningEn: 'at the earliest possible time',
      exampleEn: 'Please call me as soon as possible.',
      exampleVi: 'Vui lòng gọi điện cho tôi càng sớm càng tốt.',
      forms: [],
      topicIds: [topics[2]._id],
    },
    // Extra test items
    {
      text: 'study hard',
      type: 'collocation' as VocabularyType,
      level: 'A1' as CEFRLevel,
      meaningVi: 'học hành chăm chỉ',
      meaningEn: 'to put effort into studying',
      exampleEn: 'If you study hard, you will succeed.',
      exampleVi: 'Nếu bạn học hành chăm chỉ, bạn sẽ thành công.',
      forms: [{ formText: 'studied hard', formType: 'past' }],
      topicIds: [topics[3]._id],
    },
    {
      text: 'free breakfast',
      type: 'collocation' as VocabularyType,
      level: 'A2' as CEFRLevel,
      meaningVi: 'bữa sáng miễn phí',
      meaningEn: 'breakfast provided at no cost',
      exampleEn: 'Our stay includes free breakfast.',
      exampleVi: 'Kỳ nghỉ của chúng tôi bao gồm bữa sáng miễn phí.',
      forms: [],
      topicIds: [topics[1]._id],
    },
  ];

  const vocabList: any[] = [];
  for (const v of vocabulariesToSeed) {
    // Standardize forms
    const normalizedTextVal = normalizeText(v.text);
    const forms = [
      { formText: v.text, normalizedFormText: normalizedTextVal, formType: 'base' },
      ...(v.forms || []).map((f) => ({
        formText: f.formText,
        normalizedFormText: normalizeText(f.formText),
        formType: f.formType,
      })),
    ];

    const vocab = await VocabularyModel.create({
      text: v.text,
      normalizedText: normalizedTextVal,
      type: v.type,
      level: v.level,
      partOfSpeech: v.partOfSpeech,
      meanings: [
        {
          meaningVi: v.meaningVi,
          meaningEn: v.meaningEn,
          examples: [
            {
              exampleEn: v.exampleEn,
              exampleVi: v.exampleVi,
            },
          ],
        },
      ],
      forms,
      topicIds: v.topicIds,
      status: 'approved',
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    });
    vocabList.push(vocab);
  }

  console.log('Vocabulary items created. Seeding readings...');

  // 4. Seed Readings (3 readings)
  // Get vocabulary map by text for lookup
  const vocabMap = new Map<string, string>();
  vocabList.forEach((v) => {
    vocabMap.set(v.text, v._id.toString());
    v.forms.forEach((f) => {
      vocabMap.set(f.formText, v._id.toString());
    });
  });

  // Reading 1: Contains the exact SRS testing phrase:
  // "She decided to give up smoking. On the other hand, her brother tried to improve his health by drinking less strong coffee. They ran out of milk after the heavy rain."
  const reading1Content =
    "She decided to give up smoking. On the other hand, her brother tried to improve his health by drinking less strong coffee. They ran out of milk after the heavy rain.";

  const reading1Spans = [
    { text: 'She ', spanType: 'word', startIndex: 0, endIndex: 4, orderIndex: 0, isClickable: false },
    { text: 'decided ', spanType: 'word', startIndex: 4, endIndex: 12, orderIndex: 1, isClickable: false },
    { text: 'to ', spanType: 'word', startIndex: 12, endIndex: 15, orderIndex: 2, isClickable: false },
    {
      text: 'give up',
      spanType: 'phrase',
      lemma: 'give up',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('give up')!),
      startIndex: 15,
      endIndex: 22,
      orderIndex: 3,
      isClickable: true,
    },
    { text: ' smoking. ', spanType: 'space', startIndex: 22, endIndex: 32, orderIndex: 4, isClickable: false },
    {
      text: 'On the other hand',
      spanType: 'phrase',
      lemma: 'on the other hand',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('on the other hand')!),
      startIndex: 32,
      endIndex: 49,
      orderIndex: 5,
      isClickable: true,
    },
    { text: ', her brother tried to ', spanType: 'word', startIndex: 49, endIndex: 72, orderIndex: 6, isClickable: false },
    {
      text: 'improve',
      spanType: 'word',
      lemma: 'improve',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('improve')!),
      startIndex: 72,
      endIndex: 79,
      orderIndex: 7,
      isClickable: true,
    },
    { text: ' his health by drinking less ', spanType: 'word', startIndex: 79, endIndex: 108, orderIndex: 8, isClickable: false },
    {
      text: 'strong coffee',
      spanType: 'phrase',
      lemma: 'strong coffee',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('strong coffee')!),
      startIndex: 108,
      endIndex: 121,
      orderIndex: 9,
      isClickable: true,
    },
    { text: '. They ', spanType: 'word', startIndex: 121, endIndex: 128, orderIndex: 10, isClickable: false },
    {
      text: 'ran out of',
      spanType: 'phrase',
      lemma: 'run out of',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('run out of')!),
      startIndex: 128,
      endIndex: 138,
      orderIndex: 11,
      isClickable: true,
    },
    { text: ' milk after the ', spanType: 'word', startIndex: 138, endIndex: 154, orderIndex: 12, isClickable: false },
    {
      text: 'heavy rain',
      spanType: 'phrase',
      lemma: 'heavy rain',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('heavy rain')!),
      startIndex: 154,
      endIndex: 164,
      orderIndex: 13,
      isClickable: true,
    },
    { text: '.', spanType: 'punctuation', startIndex: 164, endIndex: 165, orderIndex: 14, isClickable: false },
  ];

  const reading1 = await ReadingModel.create({
    title: 'Healthy Decisions and Weather',
    slug: 'healthy-decisions-and-weather',
    subtitle: 'A simple paragraph to test phrase matching and longest match first.',
    content: reading1Content,
    level: 'B1',
    topicIds: [topics[0]._id, topics[4]._id, topics[7]._id],
    source: 'Technical Test Suite',
    estimatedReadingTimeMinutes: 1,
    spans: reading1Spans,
    vocabularyIds: [
      vocabMap.get('give up'),
      vocabMap.get('on the other hand'),
      vocabMap.get('improve'),
      vocabMap.get('strong coffee'),
      vocabMap.get('run out of'),
      vocabMap.get('heavy rain'),
    ].map((id) => new mongoose.Types.ObjectId(id!)),
    status: 'published',
    createdBy: adminUser._id,
    updatedBy: adminUser._id,
  });

  // Reading 2: Travel & Accommodations
  const reading2Content = "We booked a nice hotel. In addition, it offers free breakfast. We hope to make a decision about our sightseeing soon.";
  const reading2Spans = [
    { text: 'We booked a nice hotel. ', spanType: 'word', startIndex: 0, endIndex: 24, orderIndex: 0, isClickable: false },
    {
      text: 'In addition',
      spanType: 'phrase',
      lemma: 'in addition',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('in addition')!),
      startIndex: 24,
      endIndex: 35,
      orderIndex: 1,
      isClickable: true,
    },
    { text: ', it offers ', spanType: 'word', startIndex: 35, endIndex: 47, orderIndex: 2, isClickable: false },
    {
      text: 'free breakfast',
      spanType: 'phrase',
      lemma: 'free breakfast',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('free breakfast')!),
      startIndex: 47,
      endIndex: 61,
      orderIndex: 3,
      isClickable: true,
    },
    { text: '. We hope to ', spanType: 'word', startIndex: 61, endIndex: 74, orderIndex: 4, isClickable: false },
    {
      text: 'make a decision',
      spanType: 'phrase',
      lemma: 'make a decision',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('make a decision')!),
      startIndex: 74,
      endIndex: 89,
      orderIndex: 5,
      isClickable: true,
    },
    { text: ' about our sightseeing soon.', spanType: 'word', startIndex: 89, endIndex: 117, orderIndex: 6, isClickable: false },
  ];

  const reading2 = await ReadingModel.create({
    title: 'Hotel Amenities',
    slug: 'hotel-amenities',
    subtitle: 'Deciding on vacation plans and breakfast.',
    content: reading2Content,
    level: 'A2',
    topicIds: [topics[1]._id],
    source: 'Vacation Daily',
    estimatedReadingTimeMinutes: 1,
    spans: reading2Spans,
    vocabularyIds: [
      vocabMap.get('in addition'),
      vocabMap.get('free breakfast'),
      vocabMap.get('make a decision'),
    ].map((id) => new mongoose.Types.ObjectId(id!)),
    status: 'published',
    createdBy: adminUser._id,
    updatedBy: adminUser._id,
  });

  // Reading 3: Environment topic
  const reading3Content = "We must not abandon the environment. As a result, we should study hard to find green solutions as soon as possible.";
  const reading3Spans = [
    { text: 'We must not ', spanType: 'word', startIndex: 0, endIndex: 12, orderIndex: 0, isClickable: false },
    {
      text: 'abandon',
      spanType: 'word',
      lemma: 'abandon',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('abandon')!),
      startIndex: 12,
      endIndex: 19,
      orderIndex: 1,
      isClickable: true,
    },
    { text: ' the ', spanType: 'word', startIndex: 19, endIndex: 24, orderIndex: 2, isClickable: false },
    {
      text: 'environment',
      spanType: 'word',
      lemma: 'environment',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('environment')!),
      startIndex: 24,
      endIndex: 35,
      orderIndex: 3,
      isClickable: true,
    },
    { text: '. ', spanType: 'space', startIndex: 35, endIndex: 37, orderIndex: 4, isClickable: false },
    {
      text: 'As a result',
      spanType: 'phrase',
      lemma: 'as a result',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('as a result')!),
      startIndex: 37,
      endIndex: 48,
      orderIndex: 5,
      isClickable: true,
    },
    { text: ', we should ', spanType: 'word', startIndex: 48, endIndex: 60, orderIndex: 6, isClickable: false },
    {
      text: 'study hard',
      spanType: 'phrase',
      lemma: 'study hard',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('study hard')!),
      startIndex: 60,
      endIndex: 70,
      orderIndex: 7,
      isClickable: true,
    },
    { text: ' to find green solutions ', spanType: 'word', startIndex: 70, endIndex: 95, orderIndex: 8, isClickable: false },
    {
      text: 'as soon as possible',
      spanType: 'phrase',
      lemma: 'as soon as possible',
      vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('as soon as possible')!),
      startIndex: 95,
      endIndex: 114,
      orderIndex: 9,
      isClickable: true,
    },
    { text: '.', spanType: 'punctuation', startIndex: 114, endIndex: 115, orderIndex: 10, isClickable: false },
  ];

  const reading3 = await ReadingModel.create({
    title: 'Caring for Our Planet',
    slug: 'caring-for-our-planet',
    subtitle: 'Steps to protect the world.',
    content: reading3Content,
    level: 'B1',
    topicIds: [topics[7]._id, topics[3]._id],
    source: 'Earth First',
    estimatedReadingTimeMinutes: 1,
    spans: reading3Spans,
    vocabularyIds: [
      vocabMap.get('abandon'),
      vocabMap.get('environment'),
      vocabMap.get('as a result'),
      vocabMap.get('study hard'),
      vocabMap.get('as soon as possible'),
    ].map((id) => new mongoose.Types.ObjectId(id!)),
    status: 'published',
    createdBy: adminUser._id,
    updatedBy: adminUser._id,
  });

  console.log('Readings created. Seeding Flashcard Decks...');

  // 5. Seed Decks (2 Decks owned by user)
  const deck1 = await FlashcardDeckModel.create({
    ownerId: normalUser._id,
    name: 'Daily Idioms & Phrases',
    description: 'Learn common phrasal verbs, idioms and expressions used in daily conversations.',
    visibility: 'private',
    status: 'active',
    cardCount: 3,
  });

  await FlashcardCardModel.create({
    deckId: deck1._id,
    vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('give up')!),
    front: 'give up',
    back: 'từ bỏ, bỏ cuộc',
    example: 'She finally gave up smoking.',
    orderIndex: 0,
  });

  await FlashcardCardModel.create({
    deckId: deck1._id,
    vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('break the ice')!),
    front: 'break the ice',
    back: 'phá vỡ bầu không khí ngượng ngùng',
    example: 'He told a joke to break the ice.',
    orderIndex: 1,
  });

  await FlashcardCardModel.create({
    deckId: deck1._id,
    vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('once in a blue moon')!),
    front: 'once in a blue moon',
    back: 'hiếm khi, năm thì mười họa',
    example: 'He goes to the cinema once in a blue moon.',
    orderIndex: 2,
  });

  const deck2 = await FlashcardDeckModel.create({
    ownerId: normalUser._id,
    name: 'Academic Vocabulary',
    description: 'Key academic words for IELTS/TOEFL preparation.',
    visibility: 'public',
    status: 'active',
    cardCount: 2,
  });

  await FlashcardCardModel.create({
    deckId: deck2._id,
    vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('abandon')!),
    front: 'abandon',
    back: 'từ bỏ, ruồng bỏ',
    example: 'The baby was abandoned on the doorstep of a church.',
    orderIndex: 0,
  });

  await FlashcardCardModel.create({
    deckId: deck2._id,
    vocabularyId: new mongoose.Types.ObjectId(vocabMap.get('improve')!),
    front: 'improve',
    back: 'cải thiện, tiến bộ',
    example: 'He tried to improve his health.',
    orderIndex: 1,
  });

  console.log('Flashcards seeded successfully!');
  console.log('Seeding completed. Disconnecting...');
  await mongoose.disconnect();
  console.log('Disconnected from database.');
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
