import type { Emotion } from "@/lib/types";

export const WORKED_EXAMPLES: Array<{ id: string; text: string; label: Emotion; rationale: string }> = [
  { id: "train-000017", text: "i feel pretty pathetic most of the time", label: "sadness", rationale: "The speaker describes themselves in a self-depricating manner, indicating a sad emotional state." },
  { id: "train-000022", text: "i have the feeling she was amused and delighted", label: "joy", rationale: "The use of \"amused\" and \"delighted\" indicates a sense of joy." },
  { id: "train-000090", text: "i was ready to meet mom in the airport and feel her ever supportive arms around me", label: "love", rationale: "The speaker's desire for their mother and her \"supportive arms\" conveys a loving emotion." },
  { id: "train-000079", text: "i feel angered and firey", label: "anger", rationale: "The words \"angered\" and \"fiery\" correlate with an angry emotional state." },
  { id: "train-000089", text: "i will be able to lay on my bed in the dark and not feel terrified at least for a while", label: "fear", rationale: "While the speaker anticipates that they will \"not feel terrified,\" the underlying fear is still present since they believe the bliss will not last." },
  { id: "train-000168", text: "i want to hold this feeling of shocked awe and wonder forever", label: "surprise", rationale: "\"Shocked,\" \"awe,\" and \"wonder\" point to a message most correlated with surprise." }
];
