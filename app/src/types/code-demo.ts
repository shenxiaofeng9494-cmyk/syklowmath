export interface CodeDemoData {
  code: string;
  language?: string;
  title?: string;
  explanation?: string;
}

export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  variables?: Record<string, string>;
}
