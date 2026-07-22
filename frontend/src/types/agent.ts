export type AgentKey =
  | 'achievement_match'
  | 'expert_recommend'
  | 'tech_partner'
  | 'precision_growth'
  | 'demand_forecast'
  | 'policy_service'
  | 'innovation_resources';

export interface AgentDefinition {
  key: AgentKey;
  shortName: string;
  name: string;
  description: string;
  detail: string;
  placeholder: string;
  greeting: string;
  prompts: readonly string[];
}
