import { ref, onBeforeUnmount, type Ref } from 'vue'
import { useNoydbUi, type VoiceSource } from './provider'
// Speech-to-text input. Uses the configured VoiceSource, else falls back to the browser Web Speech
// API. Emits a growing transcript + a final string; swap the source (AI-Edge/Whisper) without
// touching callers. Used by SearchBox/NlSearch (voice search) and editable fields.
function webSpeechSource(lang: string): VoiceSource {
  const SR = (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition
  let rec: any = null
  return {
    supported: !!SR,
    start(h) {
      if (!SR) return
      rec = new SR(); rec.lang = lang; rec.interimResults = true; rec.continuous = false
      rec.onresult = (e: any) => { let t = ''; for (const r of e.results) t += r[0].transcript; h.onResult(t, e.results[e.results.length - 1].isFinal) }
      rec.onend = () => h.onEnd(); rec.onerror = () => h.onEnd()
      rec.start()
    },
    stop() { rec?.stop() },
  }
}
export function useVoiceInput(opts: { lang?: string; onFinal?: (text: string) => void } = {}): {
  listening: Ref<boolean>; transcript: Ref<string>; supported: boolean; start(): void; stop(): void; toggle(): void
} {
  const src = useNoydbUi().voice ?? webSpeechSource(opts.lang ?? 'en-US')
  const listening = ref(false); const transcript = ref('')
  function start(): void {
    if (!src.supported || listening.value) return
    listening.value = true; transcript.value = ''
    src.start({ onResult: (t, final) => { transcript.value = t; if (final) opts.onFinal?.(t) }, onEnd: () => { listening.value = false } })
  }
  function stop(): void { src.stop(); listening.value = false }
  onBeforeUnmount(stop)
  return { listening, transcript, supported: src.supported, start, stop, toggle: () => (listening.value ? stop() : start()) }
}
