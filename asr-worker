
import {pipeline, env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;

let transcriber;

self.onmessage = async event => {
  if (event.data?.type !== 'transcribe') return;

  try {
    self.postMessage({
      type: 'progress',
      message: 'Caricamento modello Whisper multilingue. Attendere...'
    });

    if (!transcriber) {
      transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny',
        {
          device: 'wasm',
          dtype: 'q8',
          progress_callback: p => {
            if (p.status === 'progress' &&
                typeof p.progress === 'number') {
              self.postMessage({
                type: 'progress',
                message: 'Download modello AI: ' +
                  Math.round(p.progress) + '% (' +
                  (p.file || 'file') + ')',
                percent: p.progress
              });
            } else if (p.status === 'ready') {
              self.postMessage({
                type: 'progress',
                message: 'Modello pronto per la trascrizione.'
              });
            }
          }
        }
      );
    }

    self.postMessage({
      type: 'progress',
      message: 'Whisper sta elaborando le parole cantate. Su telefono può richiedere molto tempo...'
    });

    const result = await transcriber(event.data.samples, {
      chunk_length_s: 30,
      stride_length_s: 5,
      task: 'transcribe',
      return_timestamps: false
    });

    self.postMessage({
      type: 'done',
      text: typeof result?.text === 'string'
        ? result.text.trim()
        : ''
    });

  } catch (e) {
    self.postMessage({
      type: 'error',
      message: e?.message || String(e)
    });
  }
};
