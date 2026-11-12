export interface AudioAnalysisResult {
  duration: number;
  waveform: number[];
  peaks: number[];
}

export async function analyzeAudio(url: string, points: number = 2000): Promise<AudioAnalysisResult> {
  const audioCtx = new window.AudioContext();
  
  // Fetch audio file
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  
  // Decode audio
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
  const channelData = audioBuffer.getChannelData(0); // Use first channel
  const duration = audioBuffer.duration;
  
  // 1. Generate Waveform Data
  const blockSize = Math.floor(channelData.length / points);
  const waveform: number[] = [];
  
  for (let i = 0; i < points; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      if (start + j < channelData.length) {
        sum += Math.abs(channelData[start + j]);
      }
    }
    waveform.push(sum / blockSize);
  }
  
  // Normalize waveform
  const maxWave = Math.max(...waveform);
  if (maxWave > 0) {
    for (let i = 0; i < waveform.length; i++) {
      waveform[i] = waveform[i] / maxWave;
    }
  }

  // 2. Generate Peaks (for snapping)
  // Find moments where amplitude exceeds a certain threshold suddenly
  const peaks: number[] = [];
  const sampleRate = audioBuffer.sampleRate;
  
  // A simple peak detection (RMS based or simple amplitude threshold)
  // We'll divide into smaller blocks, say 0.1s blocks, and find local maximums
  const peakBlockSize = Math.floor(sampleRate * 0.1); 
  let lastPeakTime = 0;

  for (let i = 0; i < channelData.length; i += peakBlockSize) {
    let blockMax = 0;
    for (let j = 0; j < peakBlockSize; j++) {
      if (i + j < channelData.length) {
        const val = Math.abs(channelData[i + j]);
        if (val > blockMax) {
          blockMax = val;
        }
      }
    }
    
    // If it's a significant peak (e.g. > 0.8 amplitude)
    if (blockMax > 0.8) {
      const time = i / sampleRate;
      // avoid peaks too close together
      if (time - lastPeakTime > 0.2) {
        peaks.push(time);
        lastPeakTime = time;
      }
    }
  }

  audioCtx.close();

  return {
    duration,
    waveform,
    peaks
  };
}
