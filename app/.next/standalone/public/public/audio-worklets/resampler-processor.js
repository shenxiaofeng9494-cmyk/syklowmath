/**
 * Audio Resampler Processor (AudioWorklet)
 *
 * Resamples audio from browser's native sample rate (usually 48kHz)
 * to target sample rate (16kHz for ASR) and outputs PCM 16-bit chunks.
 *
 * Message protocol:
 * - Input (from main thread): { type: 'config', targetSampleRate, chunkDurationMs }
 * - Output (to main thread): { type: 'audio', buffer: ArrayBuffer }
 */

class ResamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Configuration (will be set from main thread)
    this.targetSampleRate = 16000;
    this.chunkDurationMs = 200;

    // Calculate samples per chunk at target rate
    this.samplesPerChunk = Math.floor((this.targetSampleRate * this.chunkDurationMs) / 1000);

    // Buffer to accumulate resampled audio
    this.buffer = new Float32Array(this.samplesPerChunk * 2);  // Extra space for safety
    this.bufferWriteIndex = 0;

    // Resampling state
    this.resampleRatio = sampleRate / this.targetSampleRate;
    this.resampleIndex = 0;

    // Listen for configuration messages
    this.port.onmessage = (event) => {
      if (event.data.type === 'config') {
        this.targetSampleRate = event.data.targetSampleRate || 16000;
        this.chunkDurationMs = event.data.chunkDurationMs || 200;
        this.samplesPerChunk = Math.floor((this.targetSampleRate * this.chunkDurationMs) / 1000);
        this.resampleRatio = sampleRate / this.targetSampleRate;
        this.buffer = new Float32Array(this.samplesPerChunk * 2);
        this.bufferWriteIndex = 0;
        this.resampleIndex = 0;
      }
    };
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0];

    // Skip if no input
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const inputChannel = input[0];

    // Resample using linear interpolation
    while (this.resampleIndex < inputChannel.length) {
      const srcIndexFloor = Math.floor(this.resampleIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputChannel.length - 1);
      const fraction = this.resampleIndex - srcIndexFloor;

      // Linear interpolation
      const sample = inputChannel[srcIndexFloor] * (1 - fraction) +
                     inputChannel[srcIndexCeil] * fraction;

      this.buffer[this.bufferWriteIndex++] = sample;
      this.resampleIndex += this.resampleRatio;

      // Check if we have a full chunk
      if (this.bufferWriteIndex >= this.samplesPerChunk) {
        this.sendChunk();
      }
    }

    // Adjust resampleIndex for next block
    this.resampleIndex -= inputChannel.length;

    return true;
  }

  sendChunk() {
    // Extract samples for this chunk
    const samples = this.buffer.slice(0, this.samplesPerChunk);

    // Convert to PCM 16-bit
    const pcmBuffer = new ArrayBuffer(this.samplesPerChunk * 2);
    const pcmView = new DataView(pcmBuffer);

    for (let i = 0; i < this.samplesPerChunk; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      const value = s < 0 ? s * 0x8000 : s * 0x7fff;
      pcmView.setInt16(i * 2, value, true);  // little-endian
    }

    // Send to main thread
    this.port.postMessage({
      type: 'audio',
      buffer: pcmBuffer
    }, [pcmBuffer]);

    // Move remaining samples to start of buffer
    const remaining = this.bufferWriteIndex - this.samplesPerChunk;
    if (remaining > 0) {
      this.buffer.copyWithin(0, this.samplesPerChunk, this.bufferWriteIndex);
    }
    this.bufferWriteIndex = remaining;
  }
}

registerProcessor('resampler-processor', ResamplerProcessor);
