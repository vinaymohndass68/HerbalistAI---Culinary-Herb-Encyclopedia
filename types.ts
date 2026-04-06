
export interface MultilingualName {
  language: string;
  native: string;
  english: string;
}

export interface RegionPrice {
  region: string;
  currency: string;
  priceRange: string;
}

export interface RelatedHerb {
  name: string;
  relationReason: string;
}

export interface Recipe {
  title: string;
  ingredients: string[];
  steps: string[];
}

export interface StakeholderInfo {
  name: string;
  address: string;
  contactNumber: string;
  website?: string;
  background?: string;
}

export interface ShopInfo {
  name: string;
  address: string;
  uri: string;
  description?: string;
}

export interface HerbInfo {
  isRelevantBotanical: boolean;
  classification?: string;
  name: string;
  scientificName?: string;
  leadingProducer?: string;
  placeOfOrigin?: string;
  majorStakeholders?: string[];
  multilingualNames?: MultilingualName[];
  benefits?: string[];
  recipe?: Recipe;
  availabilityRegions?: string[];
  pricing?: RegionPrice[];
  description: string;
  relatedHerbs?: RelatedHerb[];
  localShops?: ShopInfo[];
}

export interface RemedyItem {
  herbName: string;
  remedyTitle: string;
  description: string;
  ingredients: string[];
  preparationSteps: string[];
  whyItWorks: string;
  safetyWarning: string;
}

export interface RemedyResult {
  introduction: string;
  solutions: RemedyItem[];
  generalAdvice: string;
}

export interface FavoriteItem {
  herbName: string;
  scientificName?: string;
  recipe: Recipe;
  timestamp: number;
}

export interface AppState {
  loading: boolean;
  error: string | null;
  result: HerbInfo | null;
  generatedImageUrl: string | null;
  sourceImage: string | null;
}
