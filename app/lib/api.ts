
export type Health = {
  wifi: { connected: boolean; ssid?: string; ip?: string };
  uptime?: number;
};

export type Device = {
  name: string;
  protocol?: 'IR' | 'SAA3004' | 'KENWOOD_XS8' | string;
  ir?: any;
  saa3004?: any;
  kenwood_xs8?: any;
  [key: string]: any;
};

export type DevicesResponse = Record<string, Omit<Device, 'name'>>;

export type ApiConfig = {
  baseUrl?: string; // e.g. http://192.168.1.50:80
  apiKey?: string;
};

// Timers
export type TimerAction = {
  device: string;
  action: string;
  repetitions?: number;
  delay_ms?: number;
};

export type TimerItem = {
  id: string;
  type: string; // 'sleep' | 'wakeup' | 'generic'
  label: string;
  trigger_time: string; // ISO-like string from backend
  actions: TimerAction[];
};

export type CreateTimerRequest = {
  label: string;
  type: string; // 'sleep' | 'wakeup' | 'generic'
  delay_minutes: number; // delay before firing (0 for test)
  actions: TimerAction[];
};

function buildUrl(baseUrl: string, path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function headers(apiKey?: string): HeadersInit {
  const h: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  } as HeadersInit;
  if (apiKey) {
    (h as any)['X-API-Key'] = apiKey;
    (h as any)['X-Api-Key'] = apiKey;
  }
  return h;
}

export class HifiApi {
  baseUrl: string;
  apiKey?: string;

  constructor(cfg: ApiConfig) {
    this.baseUrl = cfg.baseUrl || '';
    this.apiKey = cfg.apiKey;
  }

  with(cfg: Partial<ApiConfig>) {
    return new HifiApi({ baseUrl: cfg.baseUrl ?? this.baseUrl, apiKey: cfg.apiKey ?? this.apiKey });
  }

  private ensureBase() {
    if (!this.baseUrl) throw new Error('Base URL not set. Go to Settings and configure the device IP.');
  }

  async health(): Promise<Health> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/health');
    const res = await fetch(url, { headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Health request failed: ${res.status}`);
    return res.json();
  }

  async info(): Promise<any> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/info');
    const res = await fetch(url, { headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Info request failed: ${res.status}`);
    return res.json();
  }

  async getConfig(): Promise<any> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/config');
    const res = await fetch(url, { headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Get config failed: ${res.status}`);
    return res.json();
  }

  async putConfig(body: any): Promise<any> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/config');
    const res = await fetch(url, { method: 'PUT', headers: headers(this.apiKey), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Put config failed: ${res.status}`);
    return res.json();
  }

  // UI config: arbitrary JSON blob for persisting app UI settings/layout
  async getUiConfig(): Promise<any> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/ui/config');
    const res = await fetch(url, { headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Get UI config failed: ${res.status}`);
    return res.json();
  }

  async putUiConfig(body: any): Promise<any> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/ui/config');
    const res = await fetch(url, { method: 'PUT', headers: headers(this.apiKey), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Put UI config failed: ${res.status}`);
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  async deviceSend(opts: { name: string; command: string | string[]; repetitions?: number; fast?: boolean; async?: boolean }): Promise<any> {
    this.ensureBase();
    const command = Array.isArray(opts.command) ? opts.command.join(',') : opts.command;
    const url = buildUrl(this.baseUrl, '/device/send', {
      name: opts.name,
      command,
      repetitions: opts.repetitions,
      fast: opts.fast ? 1 : undefined,
      async: opts.async ? 1 : undefined,
    });
    const res = await fetch(url, { headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Send failed: ${res.status}`);
    return res.json();
  }

  async deviceSetup(opts: { name: string; command: string }): Promise<any> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/device/setup', { name: opts.name, command: opts.command });
    const res = await fetch(url, { method: 'POST', headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Setup failed: ${res.status}`);
    return res.json();
  }

  async devices(): Promise<DevicesResponse> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/devices');
    const res = await fetch(url, { headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Devices failed: ${res.status}`);
    return res.json();
  }

  async getDevice(name: string): Promise<Device> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/device', { name });
    const res = await fetch(url, { headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Get device failed: ${res.status}`);
    const data = await res.json();
    return { name, ...data };
  }

  async putDevice(device: Device): Promise<any> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/device');
    const res = await fetch(url, { method: 'PUT', headers: headers(this.apiKey), body: JSON.stringify(device) });
    if (!res.ok) throw new Error(`Put device failed: ${res.status}`);
    return res.json();
  }

  async deleteDevice(name: string): Promise<any> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/device', { name });
    const res = await fetch(url, { method: 'DELETE', headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Delete device failed: ${res.status}`);
    return res.json();
  }

  // --- Timers API ---
  async timers(): Promise<TimerItem[]> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/timers');
    const res = await fetch(url, { headers: headers(this.apiKey) });
    if (!res.ok) throw new Error(`Timers request failed: ${res.status}`);
    return res.json();
  }

  async createTimer(body: CreateTimerRequest): Promise<boolean> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/timers');
    const res = await fetch(url, { method: 'POST', headers: headers(this.apiKey), body: JSON.stringify(body) });
    if (!res.ok && res.status !== 202) throw new Error(`Create timer failed: ${res.status}`);
    return res.ok || res.status === 202;
  }

  async testTimer(body: CreateTimerRequest): Promise<boolean> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/timers/test');
    const res = await fetch(url, { method: 'POST', headers: headers(this.apiKey), body: JSON.stringify(body) });
    if (!res.ok && res.status !== 202) throw new Error(`Test timer failed: ${res.status}`);
    return res.ok || res.status === 202;
  }

  async deleteTimer(id: string): Promise<boolean> {
    this.ensureBase();
    const url = buildUrl(this.baseUrl, '/timer', { id });
    const res = await fetch(url, { method: 'DELETE', headers: headers(this.apiKey) });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`Delete timer failed: ${res.status}`);
    return true;
  }
}

export function makeApi(cfg: ApiConfig) {
  return new HifiApi(cfg);
}
