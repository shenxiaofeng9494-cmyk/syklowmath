/**
 * Doubao Binary Protocol Utilities
 *
 * Binary frame format for Doubao ASR and TTS:
 * [header 4 bytes] + [payload size 4 bytes] + [payload]
 *
 * Header (4 bytes):
 * - version: 4 bits (always 1)
 * - header_size: 4 bits (size in 4-byte units)
 * - message_type: 4 bits
 * - flags: 4 bits
 * - serial_method: 4 bits
 * - compress_type: 4 bits
 * - reserved: 8 bits
 */

import { PROTOCOL } from "./constants";
import type { DoubaoFrameHeader } from "./types";

// ============================================================================
// Header Encoding/Decoding
// ============================================================================

/**
 * Encode a frame header into 4 bytes
 */
export function encodeHeader(header: DoubaoFrameHeader): Uint8Array {
  const bytes = new Uint8Array(4);

  // Byte 0: version (4 bits) + header_size (4 bits)
  bytes[0] = ((header.version & 0x0f) << 4) | (header.headerSize & 0x0f);

  // Byte 1: message_type (4 bits) + flags (4 bits)
  bytes[1] = ((header.messageType & 0x0f) << 4) | (header.flags & 0x0f);

  // Byte 2: serial_method (4 bits) + compress_type (4 bits)
  bytes[2] = ((header.serial & 0x0f) << 4) | (header.compress & 0x0f);

  // Byte 3: reserved
  bytes[3] = header.reserved & 0xff;

  return bytes;
}

/**
 * Decode a frame header from 4 bytes
 */
export function decodeHeader(bytes: Uint8Array): DoubaoFrameHeader {
  if (bytes.length < 4) {
    throw new Error("Invalid header: too short");
  }

  return {
    version: (bytes[0] >> 4) & 0x0f,
    headerSize: bytes[0] & 0x0f,
    messageType: (bytes[1] >> 4) & 0x0f,
    flags: bytes[1] & 0x0f,
    serial: (bytes[2] >> 4) & 0x0f,
    compress: bytes[2] & 0x0f,
    reserved: bytes[3],
  };
}

// ============================================================================
// Frame Building (ASR)
// ============================================================================

/**
 * Build a Full Client Request frame for ASR
 * This is the first frame sent to establish the ASR session
 */
export function buildASRFullClientRequest(payload: object): ArrayBuffer {
  const jsonStr = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(jsonStr);

  // Header for full client request
  const header = encodeHeader({
    version: PROTOCOL.VERSION,
    headerSize: PROTOCOL.HEADER_SIZE,
    messageType: PROTOCOL.MSG_FULL_CLIENT_REQUEST,
    flags: PROTOCOL.FLAG_NONE,
    serial: PROTOCOL.SERIAL_JSON,
    compress: PROTOCOL.COMPRESS_NONE,
    reserved: 0,
  });

  // Build frame: header (4) + payload_size (4) + payload
  const frame = new ArrayBuffer(4 + 4 + payloadBytes.length);
  const view = new DataView(frame);
  const uint8 = new Uint8Array(frame);

  // Copy header
  uint8.set(header, 0);

  // Set payload size (big-endian)
  view.setUint32(4, payloadBytes.length, false);

  // Copy payload
  uint8.set(payloadBytes, 8);

  return frame;
}

/**
 * Build an Audio Only Request frame for ASR
 * Used to send audio data chunks
 */
export function buildASRAudioFrame(audioData: ArrayBuffer): ArrayBuffer {
  const header = encodeHeader({
    version: PROTOCOL.VERSION,
    headerSize: PROTOCOL.HEADER_SIZE,
    messageType: PROTOCOL.MSG_AUDIO_ONLY_REQUEST,
    flags: PROTOCOL.FLAG_NONE,
    serial: PROTOCOL.SERIAL_NONE,
    compress: PROTOCOL.COMPRESS_NONE,
    reserved: 0,
  });

  // Build frame: header (4) + payload_size (4) + audio_data
  const audioBytes = new Uint8Array(audioData);
  const frame = new ArrayBuffer(4 + 4 + audioBytes.length);
  const view = new DataView(frame);
  const uint8 = new Uint8Array(frame);

  // Copy header
  uint8.set(header, 0);

  // Set payload size (big-endian)
  view.setUint32(4, audioBytes.length, false);

  // Copy audio data
  uint8.set(audioBytes, 8);

  return frame;
}

/**
 * Build an end-of-stream frame for ASR
 * Signals no more audio data will be sent (最后一包/负包)
 */
export function buildASREndFrame(): ArrayBuffer {
  const header = encodeHeader({
    version: PROTOCOL.VERSION,
    headerSize: PROTOCOL.HEADER_SIZE,
    messageType: PROTOCOL.MSG_AUDIO_ONLY_REQUEST,
    flags: PROTOCOL.FLAG_LAST_PACKET,  // 0b0010 indicates last packet
    serial: PROTOCOL.SERIAL_NONE,
    compress: PROTOCOL.COMPRESS_NONE,
    reserved: 0,
  });

  // Build frame with empty payload
  const frame = new ArrayBuffer(4 + 4);
  const view = new DataView(frame);
  const uint8 = new Uint8Array(frame);

  // Copy header
  uint8.set(header, 0);

  // Set payload size to 0
  view.setUint32(4, 0, false);

  return frame;
}

// ============================================================================
// Frame Parsing (ASR Response)
// ============================================================================

export interface ParsedASRFrame {
  header: DoubaoFrameHeader;
  payload: object | null;
  payloadSize: number;
  sequence?: number;
}

/**
 * Parse an ASR response frame
 *
 * Frame format depends on flags:
 * - flags & 0x01 = 0: [header 4B][payload_size 4B][payload]
 * - flags & 0x01 = 1: [header 4B][sequence 4B][payload_size 4B][payload]
 */
export function parseASRFrame(data: ArrayBuffer): ParsedASRFrame {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);

  if (bytes.length < 8) {
    throw new Error("Invalid frame: too short");
  }

  const header = decodeHeader(bytes);

  // Check if sequence number is present (bit 0 of flags)
  const hasSequence = (header.flags & 0x01) !== 0;

  let sequence: number | undefined;
  let payloadSizeOffset: number;

  if (hasSequence) {
    // Sequence number is present after header
    if (bytes.length < 12) {
      throw new Error("Invalid frame: missing sequence number");
    }
    sequence = view.getInt32(4, false);  // big-endian, signed
    payloadSizeOffset = 8;
  } else {
    payloadSizeOffset = 4;
  }

  const payloadSize = view.getUint32(payloadSizeOffset, false);  // big-endian
  const payloadOffset = payloadSizeOffset + 4;

  let payload: object | null = null;

  if (payloadSize > 0 && bytes.length >= payloadOffset + payloadSize) {
    const payloadBytes = bytes.slice(payloadOffset, payloadOffset + payloadSize);

    // Check if this is JSON payload
    if (header.serial === PROTOCOL.SERIAL_JSON) {
      try {
        const jsonStr = new TextDecoder().decode(payloadBytes);
        payload = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse JSON payload:", e);
      }
    }
  }

  return {
    header,
    payload,
    payloadSize,
    sequence,
  };
}

// ============================================================================
// TTS Frame Building
// ============================================================================

/**
 * Build a TTS JSON frame (for StartConnection, StartSession, TaskRequest, etc.)
 */
export function buildTTSJSONFrame(payload: object): ArrayBuffer {
  const jsonStr = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(jsonStr);

  const header = encodeHeader({
    version: PROTOCOL.VERSION,
    headerSize: PROTOCOL.HEADER_SIZE,
    messageType: PROTOCOL.MSG_FULL_CLIENT_REQUEST,
    flags: PROTOCOL.FLAG_NONE,
    serial: PROTOCOL.SERIAL_JSON,
    compress: PROTOCOL.COMPRESS_NONE,
    reserved: 0,
  });

  // Build frame: header (4) + payload_size (4) + payload
  const frame = new ArrayBuffer(4 + 4 + payloadBytes.length);
  const view = new DataView(frame);
  const uint8 = new Uint8Array(frame);

  // Copy header
  uint8.set(header, 0);

  // Set payload size (big-endian)
  view.setUint32(4, payloadBytes.length, false);

  // Copy payload
  uint8.set(payloadBytes, 8);

  return frame;
}

// ============================================================================
// TTS Frame Parsing
// ============================================================================

export interface ParsedTTSFrame {
  header: DoubaoFrameHeader;
  payload: object | null;
  audioData: ArrayBuffer | null;
  payloadSize: number;
}

/**
 * Parse a TTS response frame
 * TTS frames can contain either JSON or raw audio data
 */
export function parseTTSFrame(data: ArrayBuffer): ParsedTTSFrame {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);

  if (bytes.length < 8) {
    throw new Error("Invalid TTS frame: too short");
  }

  const header = decodeHeader(bytes);
  const payloadSize = view.getUint32(4, false);  // big-endian

  let payload: object | null = null;
  let audioData: ArrayBuffer | null = null;

  if (payloadSize > 0 && bytes.length >= 8 + payloadSize) {
    const payloadBytes = bytes.slice(8, 8 + payloadSize);

    if (header.serial === PROTOCOL.SERIAL_JSON) {
      // JSON payload
      try {
        const jsonStr = new TextDecoder().decode(payloadBytes);
        payload = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse TTS JSON payload:", e);
      }
    } else if (header.serial === PROTOCOL.SERIAL_NONE) {
      // Raw audio data
      audioData = payloadBytes.buffer.slice(
        payloadBytes.byteOffset,
        payloadBytes.byteOffset + payloadBytes.byteLength
      );
    }
  }

  return {
    header,
    payload,
    audioData,
    payloadSize,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID for sessions
 */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Convert ArrayBuffer to hex string (for debugging)
 */
export function bufferToHex(buffer: ArrayBuffer, maxBytes: number = 32): string {
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes.slice(0, maxBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  return bytes.length > maxBytes ? hex + "..." : hex;
}

/**
 * Base64 encode ArrayBuffer
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 decode to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert Float32Array to PCM 16-bit ArrayBuffer
 */
export function float32ToPCM16(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/**
 * Convert PCM 16-bit ArrayBuffer to Float32Array
 */
export function pcm16ToFloat32(pcmBuffer: ArrayBuffer): Float32Array {
  const pcmData = new Int16Array(pcmBuffer);
  const floatData = new Float32Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    floatData[i] = pcmData[i] / 32768;
  }
  return floatData;
}

/**
 * Simple linear resampling from source rate to target rate
 */
export function resample(
  input: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return input;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    // Linear interpolation
    output[i] = input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction;
  }

  return output;
}
