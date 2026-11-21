// FormFit Real-Time Voice Coach Engine
// Uses the Web Speech API (window.speechSynthesis)
// Features: Category cooldowns, priority queue, deduplication, smooth calming cadence

class VoiceCoachEngine {
  constructor() {
    this.isEnabled = true;
    this.lastSpokenText = '';
    this.lastSpokenTime = 0;
    this.categoryCooldowns = {};
    this.minIntervalBetweenSpeechMs = 2800; // Do not talk faster than every 2.8s
    this.sameMessageCooldownMs = 6000;      // Don't repeat identical message within 6s

    // Preferred voice cache
    this.preferredVoice = null;
    this.initVoices();
  }

  initVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Look for smooth English voices
      this.preferredVoice = voices.find(v => 
        (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Karen') || v.name.includes('Daniel')))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
    };

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }
    pickVoice();
  }

  setEnabled(val) {
    this.isEnabled = Boolean(val);
    if (!this.isEnabled && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  speak(text, options = {}) {
    if (!this.isEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!text || typeof text !== 'string') return;

    const { category = 'general', priority = false, cooldownMs = 3500 } = options;
    const now = Date.now();

    // Check same message cooldown
    if (this.lastSpokenText === text && (now - this.lastSpokenTime < this.sameMessageCooldownMs)) {
      return;
    }

    // Check category cooldown unless it is high priority
    if (!priority) {
      const lastCatTime = this.categoryCooldowns[category] || 0;
      if (now - lastCatTime < cooldownMs) return;
      if (now - this.lastSpokenTime < this.minIntervalBetweenSpeechMs) return;
    }

    try {
      if (priority) {
        window.speechSynthesis.cancel();
      } else if (window.speechSynthesis.speaking) {
        return; // Don't interrupt non-priority speech
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
      }
      utterance.rate = 1.02;  // Natural, slightly upbeat pace
      utterance.pitch = 1.0;
      utterance.volume = 0.95;

      utterance.onend = () => {
        this.lastSpokenTime = Date.now();
      };

      utterance.onerror = () => {
        this.lastSpokenTime = Date.now();
      };

      this.lastSpokenText = text;
      this.lastSpokenTime = now;
      this.categoryCooldowns[category] = now;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // Speech synthesis unsupported or user disabled audio
    }
  }

  cancel() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const voiceCoach = new VoiceCoachEngine();

