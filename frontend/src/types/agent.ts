export type AgentKey =
  | 'rd_qa'
  | 'tech_scout'
  | 'tech_partner'
  | 'precision_growth'
  | 'demand_forecast'
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

