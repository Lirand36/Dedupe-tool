export { candidatesFromRecord, MAX_DISTINCT_VALUES, mergeCandidates } from "./candidates";
export { classifyChannel } from "./channels";
export { ConfigError, parseRunConfig, type RunConfig } from "./config";
export {
  checkExamples,
  type Example,
  type ExampleFailure,
  type PolicyChangePreview,
  previewPolicyChange,
} from "./examples";
export { goldenFromRecords } from "./golden";
export { type DuplicateGroup, type Evidence, findDuplicates, type MatchConfig } from "./match";
export { type Identity, type RunResult, type RunStats, runPipeline } from "./pipeline";
export { resolveGolden } from "./resolve";
export { suggestTag, type TagSuggestion } from "./suggest";
export type * from "./types";
