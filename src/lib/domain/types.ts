// Item types in a profile
export type ItemType =
  | 'career_snapshot'
  | 'education'
  | 'experience'
  | 'project'
  | 'certification'
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

// One traceable requirement pulled out of a job description. `id` is assigned
// deterministically after extraction (never trusted from the model) and is
// stable for a given extraction, so analyses and confirmations can point at it.
export type ReqCategory =
  | 'technical_skill'
  | 'responsibility'
  | 'experience'
  | 'seniority'
  | 'domain_knowledge'
  | 'education_cert'
  | 'communication';

export interface JdRequirement {
  id?: string;
  description: string;
  category: ReqCategory;
  importance: 'mandatory' | 'preferred';
  aliases: string[];
  // Verbatim substring of the JD the requirement came from; null when the
  // model couldn't cite one (an unverifiable citation is dropped, not kept).
  sourceExcerpt: string | null;
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
  // Optional: JDs stored before requirement extraction still parse.
  requirements?: JdRequirement[];
}

// Section IDs
export type SectionId =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'certifications'
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

// The parts of an entry the PDF lays out separately. Generated docs carry
// these from the profile payload; legacy stored docs only have `text` and the
// renderer derives them once (structureFromText).
export interface ResumeEntryHeader {
  title: string;
  company: string;
  // Display-ready range ("Mar 2022–present"); empty when there is none.
  dates: string;
  location?: string;
  employmentType?: string;
}

export interface ResumeDocItem {
  sourceItemId: string;
  text: string;
  basis: string;
  // Skills only: presentation label ("Backend", "Databases"…), grouped by the
  // renderer. Never stored on the profile item — it is per-CV tailoring.
  category?: string;
  header?: ResumeEntryHeader;
  // Projects: the one-line body between the name and the technologies.
  description?: string;
  // Experience: one entry per achievement line, marker-free.
  bullets?: string[];
  technologies?: string[];
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
