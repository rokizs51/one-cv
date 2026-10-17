// Item types in a profile
export type ItemType =
  | 'career_snapshot'
  | 'education'
  | 'experience'
  | 'project'
  | 'award'
  | 'skill'
  | 'language';

// Generation modes
export type GenMode = 'as_is' | 'enhance';

// Provenance tracking
export interface ProvenanceEntry {
  text: string;
  originalText: string;
  fromResumeId: string;
  at: string;
}

// Profile item
export interface ProfileItem {
  id: string;
  profileId: string;
  type: ItemType;
  payload: Record<string, unknown>;
  canonicalText: string;
  source: 'manual' | 'import';
  provenance: ProvenanceEntry[];
  pinned: boolean;
  position: number;
}

// Job description extraction
export interface JdExtraction {
  requiredSkills: string[];
  preferredSkills: string[];
  keywords: string[];
  seniority: string;
  domain: string;
  tools: string[];
  responsibilities: string[];
}

// Section IDs
export type SectionId =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'awards'
  | 'languages';

// Suggestions
export interface Suggestion {
  id: string;
  targetItemId: string;
  kind: 'bullet' | 'summary';
  newText: string;
  basis: string;
}

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'edited';

export interface SuggestionState {
  suggestion: Suggestion;
  status: SuggestionStatus;
  finalText: string | null;
}

// Resume document
export interface ResumeHeader {
  fullName: string;
  email: string;
  phone: string | null;
  location: string | null;
  links: string[];
}

export interface ResumeDocItem {
  sourceItemId: string;
  text: string;
  basis: string;
}

export interface ResumeSection {
  id: SectionId;
  items: ResumeDocItem[];
}

export interface ResumeDoc {
  header: ResumeHeader;
  summary: string | null;
  sections: ResumeSection[];
}
