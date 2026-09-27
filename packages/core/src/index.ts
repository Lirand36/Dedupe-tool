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
export { type ImportPlan, type ImportRow, planImport } from "./importPlan";
export { type ColumnMap, objectFields, suggestColumnMap } from "./mapping";
export {
  type DuplicateGroup,
  type Evidence,
  findDuplicates,
  MAX_PAIRWISE_RECORDS,
  type MatchConfig,
  type PairExplanation,
  scoreAllPairs,
} from "./match";
export { SIGNAL_SCORES } from "./matchScore";
export { type Identity, type RunResult, type RunStats, runPipeline } from "./pipeline";
export {
  DEFAULT_THRESHOLDS,
  draftConfig,
  type FieldSuggestion,
  getPreset,
  normalizeFieldName,
  OBJECT_PRESETS,
  type ObjectPreset,
  type SystemId,
} from "./presets";
export { resolveGolden } from "./resolve";
export { suggestTag, type TagSuggestion } from "./suggest";
export { diffConfigs, type LogicSummary, type SummaryGroup, summarizeLogic } from "./summary";
export { applyTemplate, RULE_TEMPLATES, type RuleTemplate, type TemplateResult } from "./templates";
export type * from "./types";
