export const EMOTIONS = ["anger", "fear", "joy", "love", "sadness", "surprise"] as const;

export type Emotion = (typeof EMOTIONS)[number];
export type StudyState = "instructions" | "labeling" | "complete";

export type AssignmentView = {
  id: string;
  position: number;
  assignedAt: string;
  selectedLabel: Emotion | null;
  submittedAt: string | null;
  tweet: {
    id: string;
    text: string;
  };
};

export type ParticipantView = {
  publicId: string;
  username: string;
  completedCount: number;
  state: StudyState;
};

export type ResultView = {
  assignmentId: string;
  participantId: string;
  tweetId: string;
  text: string;
  selectedLabel: Emotion;
  submittedAt: string;
};
