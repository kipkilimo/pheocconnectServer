export interface IResource {
  [x: string]: Date;
  title?: string;
  description?: string;
  content?: string;
  targetRegion?: string;
  targetCountry?: string;
  language?: string;
  subject?: string;
  keywords?: string[];
  topic?: string;
  contentType?: string;
  createdBy?: string;
  id?: string;
  slug?: string;
  viewsNumber?: number;
  likesNumber?: number;
  sharesNumber?: number;
  rating?: number;
  sessionId?: string;
  accessKey?: string;
  coverImage?: string;
  isPublished?: boolean;
  averageRating?: number;
  reviews?: any[];
}

export interface ResourceSuggestion {
  title: any;
  coverImage: any;
  description: any;
  content: any;
  participants: any;
  targetRegion: any;
  language: any;
  sessionId: any;
  accessKey: any;
  subject: any;
  topic: any;
  keywords: any;
  createdBy: any;
  createdAt: any;
  contentType: any;
  id: any;
  resource: {
    id: string;
    title: string;
    coverImage?: string;
    description?: string;
    content?: string;
    participants?: string[];
    targetRegion?: string;
    language?: string;
    sessionId?: string;
    accessKey?: string;
    contentType?: string;
    subject?: string;
    topic?: string;
    keywords?: string[];
    createdBy: {
      id: string;
      personalInfo: { username: string };
      role: string;
    };
    createdAt: Date;
  };
  reason: string;
  score: number;
}

export interface IGetResourcesArgs {
  [x: string]: any;
  subject?: string;
  topic?: string;
  title?: string;
  contentType?: string;
  targetRegion?: string;
  language?: string;
  createdBy?: string;
  searchQuery?: string;
  userId: string;
  resourceTitle?: string;
}

export interface LiveResourceParams {
  userId?: string;
  resourceType?: string;
  accessKey?: string;
  sessionId?: string;
}
