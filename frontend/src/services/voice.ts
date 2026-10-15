import type { VoiceState, SourceCitation } from '../types';
import { isMockMode } from './api';

export interface VoiceCallbacks {
  onStateChange: (state: VoiceState) => void;
  onAudioLevel: (level: number) => void; // 0.0 to 1.0
  onInputTranscription: (text: string) => void;
  onOutputTranscription: (text: string) => void;
  onSources?: (sources: SourceCitation[]) => void;
  onError: (error: string) => void;
}

export class RealtimeVoiceService {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private isMuted: boolean = false;
  private callbacks: VoiceCallbacks;
  private documentId: string;
  private sessionId: string;
  private isRunning: boolean = false;

  constructor(documentId: string, sessionId: string, callbacks: VoiceCallbacks) {
    this.documentId = documentId;
    this.sessionId = sessionId;
    this.callbacks = callbacks;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.callbacks.onStateChange('requesting_permission');

    try {
      // 1. Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // 2. Set up Web Audio API Analyser for authentic waveform visualization
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);

      // Start level monitoring loop
      this.monitorAudioLevel();

      // 3. Connect WebSocket to Realtime Backend
      this.callbacks.onStateChange('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const mockParam = isMockMode() ? '&mock=true' : '';
      const wsUrl = `${protocol}//${host}/api/voice/live?document_id=${encodeURIComponent(
        this.documentId
      )}&session_id=${encodeURIComponent(this.sessionId)}${mockParam}`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.callbacks.onStateChange('connected');
        this.callbacks.onStateChange('listening');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleSocketMessage(data);
        } catch (e) {
          console.error('[Voice Socket] Parse error:', e);
        }
      };

      this.socket.onerror = (e) => {
        console.warn('[Voice Socket] Connection error or offline:', e);
        if (isMockMode()) {
          this.startMockSimulation();
        } else {
          this.callbacks.onError('Could not reach realtime voice endpoint. Try enabling Dev Mock Mode in the sidebar.');
          this.callbacks.onStateChange('error');
        }
      };

      this.socket.onclose = () => {
        if (this.isRunning && !isMockMode()) {
          this.callbacks.onStateChange('idle');
        }
      };
    } catch (err: unknown) {
      this.isRunning = false;
      const msg = err instanceof Error ? err.message : 'Microphone access denied or unavailable.';
      this.callbacks.onError(msg);
      this.callbacks.onStateChange('error');
    }
  }

  private handleSocketMessage(data: {
    type: string;
    state?: VoiceState;
    text?: string;
    sources?: SourceCitation[];
    message?: string;
  }): void {
    switch (data.type) {
      case 'state':
        if (data.state) {
          this.callbacks.onStateChange(data.state);
        }
        break;

      case 'input_transcription':
        if (data.text) {
          this.callbacks.onInputTranscription(data.text);
        }
        break;

      case 'output_transcription':
        if (data.text) {
          this.callbacks.onOutputTranscription(data.text);
        }
        break;

      case 'sources':
        if (data.sources) {
          this.callbacks.onSources?.(data.sources);
        }
        break;

      case 'error':
        if (data.message) {
          this.callbacks.onError(data.message);
          this.callbacks.onStateChange('error');
        }
        break;
    }
  }

  private monitorAudioLevel(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const update = () => {
      if (!this.isRunning || !this.analyser) return;

      if (this.isMuted) {
        this.callbacks.onAudioLevel(0);
      } else {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(1.0, Math.pow(average / 128, 1.2));
        this.callbacks.onAudioLevel(normalized);
      }

      this.animationFrameId = requestAnimationFrame(update);
    };

    update();
  }

  private startMockSimulation(): void {
    this.callbacks.onStateChange('listening');
    this.callbacks.onOutputTranscription('Aethelgard Voice is listening. Speak into your microphone...');

    setTimeout(() => {
      if (!this.isRunning) return;
      this.callbacks.onStateChange('processing');
      this.callbacks.onInputTranscription('Can you explain the main conclusions from Section 4?');

      setTimeout(() => {
        if (!this.isRunning) return;
        this.callbacks.onStateChange('speaking');
        this.callbacks.onOutputTranscription(
          'Section 4 establishes that the proposed model achieved an 18% reduction in latency while maintaining grounding accuracy across all benchmark trials.'
        );
        this.callbacks.onSources?.([
          {
            id: 'mock_src_1',
            page: 4,
            section: 'Section 4.2 — Experimental Outcomes',
            snippet: 'Latency dropped from 420ms to 344ms under sustained parallel queries...',
            relevance_score: 0.96,
          },
        ]);

        setTimeout(() => {
          if (!this.isRunning) return;
          this.callbacks.onStateChange('listening');
        }, 4000);
      }, 1500);
    }, 4000);
  }

  public finishTurn(spokenText?: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'end_turn',
          transcription: spokenText,
        })
      );
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  public stop(): void {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.callbacks.onAudioLevel(0);
    this.callbacks.onStateChange('idle');
  }
}
