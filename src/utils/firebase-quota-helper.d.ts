export interface QuotaStatus {
  exceeded: boolean;
  lastCheck: number;
  retryAfter: string | null;
}

export interface QuotaActionMessage {
  title: string;
  message: string;
  type: 'warning' | 'error' | 'info';
  actions: Array<{
    label: string;
    action: string;
  }>;
}

export function setQuotaStatus(status: Partial<QuotaStatus>): void;
export function getQuotaStatus(): QuotaStatus;
export function isQuotaExceeded(): boolean;
export function getQuotaMessage(): string | null;
export function getQuotaActionMessage(): QuotaActionMessage | null;
export function shouldRetryFirebaseOperation(): boolean;
export function updateQuotaCheckTime(): void;
export function setQuotaRetryTime(retryAfter: string): void; 