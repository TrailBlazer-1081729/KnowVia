import type { VoiceState, SourceCitation, ToolInvocation } from '../types';
import { isMockMode } from './api';

export interface VoiceCallbacks {
  onStateChange: (state: VoiceState) => void;
  onAudioLevel: (level: number) => void; // 0.0 to 1.0
  onInputTranscription: (text: string) => void;
  onOutputTranscription: (text: string) => void;
  onSources?: (sources: SourceCitation[], documentName?: string) => void;
  onToolCall?: (invocation: ToolInvocation) => void;
  onToolResult?: (invocation: ToolInvocation) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onError: (error: string) => void;
}

/**
 * Universal linear resampler converting input audio buffer to 16,000 Hz 16-bit PCM.
 */
function resampleTo16k(input: Float32Array, inputRate: number): Int16Array {
  if (inputRate === 16000) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  const ratio = inputRate / 16000;
  const outLength = Math.round(input.length / ratio);
  const out = new Int16Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const index = Math.floor(srcIndex);
    const frac = srcIndex - index;
    const s1 = input[index] || 0;
    const s2 = input[index + 1] || s1;
    const sample = s1 + frac * (s2 - s1);
    const clamped = Math.max(-1, Math.min(1, sample));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return out;
}

export class RealtimeVoiceService {
  private socket: WebSocket | null = null;
  private inputContext: AudioContext | null = null;
  private playbackContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private isMuted: boolean = false;
  private callbacks: VoiceCallbacks;
  private documentId: string;
  private sessionId: string;
  private isRunning: boolean = false;
  private currentVoiceState: VoiceState = 'idle';

  // Output streaming audio scheduler
  private nextPlayTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private playbackEpoch: number = 0;
  private isDiscardingAudio: boolean = false;

  constructor(documentId: string, sessionId: string, callbacks: VoiceCallbacks) {
    this.documentId = documentId;
    this.sessionId = sessionId;
    this.callbacks = callbacks;
  }

  private setState(state: VoiceState): void {
    this.currentVoiceState = state;
    this.callbacks.onStateChange(state);
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.setState('requesting_permission');

    try {
      // 1. Request microphone access with acoustic echo cancellation
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Initialize input AudioContext
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.inputContext = new AudioCtx({ sampleRate: 16000 });

      // 3. Initialize playback AudioContext for Gemini Live 24kHz PCM output
      this.playbackContext = new AudioCtx();
      this.nextPlayTime = this.playbackContext.currentTime;

      // 4. Connect microphone processing pipeline
      this.inputSource = this.inputContext.createMediaStreamSource(this.mediaStream);
      // 2048 sample buffer gives ~128ms chunks at 16kHz
      this.scriptProcessor = this.inputContext.createScriptProcessor(2048, 1, 1);

      this.scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isRunning) return;

        const channelData = event.inputBuffer.getChannelData(0);

        // Calculate RMS for visual audio level
        let sumSquares = 0;
        for (let i = 0; i < channelData.length; i++) {
          sumSquares += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sumSquares / channelData.length);

        if (!this.isMuted) {
          // If assistant is not actively outputting audio or user speech is active, show mic level
          if (this.activeSources.length === 0 || rms > 0.04) {
            this.callbacks.onAudioLevel(Math.min(1.0, rms * 5));
          }
          if (rms > 0.04) {
            // User speech activity detected: reset discard audio state
            this.isDiscardingAudio = false;
          }
        }

        // Stream raw PCM chunk over WebSocket if active and not muted
        if (
          !this.isMuted &&
          this.socket &&
          this.socket.readyState === WebSocket.OPEN
        ) {
          const sampleRate = this.inputContext?.sampleRate || 16000;
          const pcm16 = resampleTo16k(channelData, sampleRate);
          this.socket.send(pcm16.buffer as ArrayBuffer);
        }
      };

      this.inputSource.connect(this.scriptProcessor);
      // Connect to a silent dummy node to ensure onaudioprocess fires across all browsers
      const dummyGain = this.inputContext.createGain();
      dummyGain.gain.value = 0;
      this.scriptProcessor.connect(dummyGain);
      dummyGain.connect(this.inputContext.destination);

      // 5. Connect WebSocket to Realtime Backend
      this.setState('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const mockParam = isMockMode() ? '&mock=true' : '';
      const wsUrl = `${protocol}//${host}/api/voice/live?document_id=${encodeURIComponent(
        this.documentId
      )}&session_id=${encodeURIComponent(this.sessionId)}${mockParam}`;

      this.socket = new WebSocket(wsUrl);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        this.setState('connected');
        this.setState('listening');
      };

      this.socket.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);
            this.handleSocketMessage(data);
          } catch (err) {
            console.error('[Voice Socket] JSON parse error:', err);
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Streamed 24kHz PCM audio from Gemini Live
          this.playPcmChunk(event.data);
        }
      };

      this.socket.onerror = (e) => {
        console.warn('[Voice Socket] Error or disconnect:', e);
        if (isMockMode()) {
          this.startMockSimulation();
        } else {
          this.callbacks.onError(
            'Could not reach realtime voice endpoint. Ensure the backend is running.'
          );
          this.setState('error');
        }
      };

      this.socket.onclose = () => {
        if (this.isRunning && !isMockMode()) {
          this.setState('idle');
        }
      };
    } catch (err: unknown) {
      this.isRunning = false;
      const msg =
        err instanceof Error
          ? err.message
          : 'Microphone access denied or unavailable.';
      this.callbacks.onError(msg);
      this.setState('error');
    }
  }

  private handleSocketMessage(data: {
    type: string;
    state?: VoiceState;
    text?: string;
    delta?: string;
    id?: string;
    name?: string;
    server?: string;
    arguments?: Record<string, unknown>;
    status?: 'running' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
    items?: SourceCitation[];
    sources?: SourceCitation[];
    document_name?: string;
    message?: string;
    epoch?: number;
    source?: string;
  }): void {
    if (!this.isRunning) return;

    switch (data.type) {
      case 'connected':
        this.setState('connected');
        this.setState('listening');
        break;

      case 'state':
        if (data.state) {
          if (data.state === 'speaking' && this.isDiscardingAudio) {
            // Suppress late speaking state from interrupted turn
            break;
          }
          this.setState(data.state);
        }
        break;

      case 'tool_call': {
        const invocation: ToolInvocation = {
          id: data.id || `call_${Date.now()}`,
          name: data.name || 'tool',
          server: data.server || 'mcp',
          arguments: data.arguments || {},
          status: 'running',
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          startTime: Date.now(),
        };
        this.callbacks.onToolCall?.(invocation);
        this.setState('executing_tool');
        break;
      }

      case 'tool_result': {
        const invocation: ToolInvocation = {
          id: data.id || '',
          name: data.name || 'tool',
          server: data.server || 'mcp',
          status: data.status || 'completed',
          result: data.result,
          error: data.error,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };
        this.callbacks.onToolResult?.(invocation);
        break;
      }

      case 'input_transcription':
        this.isDiscardingAudio = false;
        if (data.text) {
          this.callbacks.onInputTranscription(data.text);
        }
        break;

      case 'output_transcription':
        if (this.isDiscardingAudio) {
          break;
        }
        if (data.text) {
          this.callbacks.onOutputTranscription(data.text);
        }
        break;

      case 'text': {
        if (this.isDiscardingAudio) {
          break;
        }
        const streamText = data.delta || data.text;
        if (streamText) {
          this.callbacks.onOutputTranscription(streamText);
        }
        break;
      }

      case 'sources': {
        const citationList = data.items || data.sources;
        if (citationList && citationList.length > 0) {
          this.callbacks.onSources?.(citationList, data.document_name);
        }
        break;
      }

      case 'interrupted':
        this.isDiscardingAudio = true;
        if (data.epoch !== undefined && data.epoch > this.playbackEpoch) {
          this.playbackEpoch = data.epoch;
        }
        this.clearPlayback();
        this.callbacks.onInterrupted?.();
        this.setState('listening');
        break;

      case 'turn_complete':
        this.isDiscardingAudio = false;
        this.callbacks.onTurnComplete?.();
        this.setState('listening');
        break;

      case 'error':
        if (data.message) {
          this.callbacks.onError(data.message);
          this.setState('error');
        }
        break;
    }
  }

  private playPcmChunk(pcmData: ArrayBuffer): void {
    if (!this.isRunning || !this.playbackContext) return;
    if (this.isDiscardingAudio) {
      // Interrupted: drop late or queued packet
      return;
    }

    if (this.playbackContext.state === 'suspended') {
      this.playbackContext.resume();
    }

    const int16 = new Int16Array(pcmData);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    let sumSquares = 0;
    for (let i = 0; i < int16.length; i++) {
      const val = int16[i] / 32768.0;
      float32[i] = val;
      sumSquares += val * val;
    }

    // Visualize output audio on the waveform
    const rms = Math.sqrt(sumSquares / int16.length);
    this.callbacks.onAudioLevel(Math.min(1.0, rms * 4));

    // Gemini Live outputs 24,000 Hz 1-channel PCM
    const audioBuffer = this.playbackContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.playbackContext.destination);

    const now = this.playbackContext.currentTime;
    if (this.nextPlayTime < now) {
      this.nextPlayTime = now + 0.04; // 40ms safety buffer
    }

    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
    };
  }

  public clearPlayback(): void {
    for (const src of this.activeSources) {
      try {
        src.stop(0);
        src.disconnect();
      } catch {
        // Source might already have ended
      }
    }
    this.activeSources = [];
    if (this.playbackContext) {
      this.nextPlayTime = this.playbackContext.currentTime;
    } else {
      this.nextPlayTime = 0;
    }
    this.callbacks.onAudioLevel(0);
  }

  public getCurrentState(): VoiceState {
    return this.currentVoiceState;
  }

  public hasActivePlayback(): boolean {
    return this.activeSources.length > 0;
  }

  public getPlaybackEpoch(): number {
    return this.playbackEpoch;
  }

  private startMockSimulation(): void {
    this.setState('listening');
    this.callbacks.onOutputTranscription(
      'Mock Voice is listening. Speak into your microphone...'
    );

    setTimeout(() => {
      if (!this.isRunning) return;
      this.setState('processing');
      this.callbacks.onInputTranscription(
        'Can you explain the main conclusions from Section 4?'
      );

      setTimeout(() => {
        if (!this.isRunning) return;
        this.setState('speaking');
        this.callbacks.onOutputTranscription(
          'Section 4 establishes that the proposed model achieved an 18% reduction in latency while maintaining grounding accuracy.'
        );
        this.callbacks.onSources?.([
          {
            id: 'mock_src_1',
            page: 4,
            section: 'Section 4.2 — Experimental Outcomes',
            snippet:
              'Latency dropped from 420ms to 344ms under sustained parallel queries...',
            relevance_score: 0.96,
          },
        ]);

        setTimeout(() => {
          if (!this.isRunning) return;
          this.setState('listening');
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

  public interrupt(): void {
    this.playbackEpoch += 1;
    this.isDiscardingAudio = true;
    this.clearPlayback();
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'interrupt',
          epoch: this.playbackEpoch,
        })
      );
    }
    this.callbacks.onInterrupted?.();
    this.setState('listening');
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    if (this.isMuted) {
      this.callbacks.onAudioLevel(0);
    }
    return this.isMuted;
  }

  public stop(): void {
    this.isRunning = false;
    this.clearPlayback();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }

    if (this.inputContext && this.inputContext.state !== 'closed') {
      this.inputContext.close();
      this.inputContext = null;
    }

    if (this.playbackContext && this.playbackContext.state !== 'closed') {
      this.playbackContext.close();
      this.playbackContext = null;
    }

    if (this.socket) {
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      if (this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: 'stop' }));
        } catch {}
      }
      this.socket.close();
      this.socket = null;
    }

    this.callbacks.onAudioLevel(0);
    this.setState('idle');
  }
}
