// Define the structure of each charge item
interface PublicationCreditCharge {
  type: string;
  key: string;
  credits: number;
}

// Export the array of publication credit charges
export const publicationCreditCharges: PublicationCreditCharge[] = [
  { type: "▶ SLIDES PLAYER", key: "PRESENTATION", credits: 10 },
  { type: "📚🎧 ASSIGNMENT TASKS", key: "TASK", credits: 5 },
  { type: "📙 DOCUMENTS", key: "DOCUMENT", credits: 20 },
  { type: "🕖📋✍🏼 EXAM TESTS", key: "TEST", credits: 5 },
  { type: "📑 BLOG ARTICLES", key: "ARTICLE", credits: 5 },
  { type: "📹 RECORDINGS", key: "VIDEO", credits: 10 },
  { type: "🖼️ GALLERIES", key: "IMAGES", credits: 5 },
  { type: "🎵 PODCASTS", key: "AUDIO", credits: 10 },
  { type: "🗓️ EVENTS", key: "EVENT", credits: 100 },
  { type: "⛁⛁ DATASETS", key: "DATASET", credits: 20 },
  { type: "🗣️📊 LIVE POLLS", key: "POLL", credits: 50 },
  { type: "🖥👩🏻‍💻⌨ PROGRAMMING", key: "COMPUTING", credits: 1000 },
  { type: "🎴 ABSTRACT POSTERS", key: "POSTER", credits: 1000 },
  { type: "📁 WORK STUDY", key: "MIXED", credits: 225 },
  { type: "⛓️ RESOURCE LINKS", key: "LINK", credits: 5 },
  { type: "🎲 CLINICAL MODELS", key: "MODEL", credits: 10 },
];
