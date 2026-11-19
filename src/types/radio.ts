export type RadioBand = 'FM' | 'AM';

export type RadioPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type SleepTimerMinutes = 0 | 15 | 30 | 60;

export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  homepage?: string;
  favicon?: string;
  country: string;
  countryCode: string;
  state?: string;
  tags: string[];
  codec: string;
  bitrate: number;
  band: RadioBand;
  frequency: number; // FM: 87.5..108.0 MHz | AM: 530..1700 kHz
  isCustom?: boolean;
  votes?: number;
}

export interface RadioGenrePreset {
  id: string;
  label: string;
  band: RadioBand;
  tag: string;
  query?: string;
  globalSearch?: boolean; // e.g., Lo-Fi or Classical work best globally or mixed
}

export interface RadioCountryOption {
  code: string; // ISO2 or 'ALL'
  label: string;
}

export interface RadioPreferences {
  band: RadioBand;
  countryCode: string;
  volume: number; // 0..1
  staticEffectEnabled: boolean;
  lastStationId?: string;
}
