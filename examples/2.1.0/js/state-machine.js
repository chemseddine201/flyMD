/**
 * js/state-machine.js
 * المخزن المركزي النقي (Pure Reducer) + حواجز الحماية (SafeStorageAdapter, SafeAudioSynthesizer, Visibility Sleep Barrier)
 */

import { sanitizeSeismicParams, clampFinite } from './seismic-laws.js';

export const INITIAL_STATE = Object.freeze({
  viewMode: 'interactive', // 'interactive' | 'workbook'
  activeSection: 'sec-simulator',
  audioEnabled: false,
  simulation: {
    status: 'idle',        // 'idle' | 'running' | 'paused'
    magnitude: 6.5,        // [2.0, 9.0]
    depthKm: 15,           // [2, 300]
    stationDistKm: 80,     // [10, 500]
    faultType: 'reverse',  // 'normal' | 'reverse' | 'strike-slip'
    vpKmS: 6.0,            // [4.0, 8.5]
    vsKmS: 3.5,            // [2.0, 5.0]
    elapsedSec: 0
  },
  calculator: {
    vp: 6.0,
    vs: 3.5,
    deltaT: 12.0,
    depthH: 15.0,
    amplitudeUm: 1000,
    distKm: 100,
    mag1: 5.0,
    mag2: 7.0,
    triDeltaT: [10.0, 14.5, 11.5]
  },
  quiz: {
    answers: {},
    submitted: false,
    score: 0
  },
  errorState: null
});

/**
 * حارس التخزين المحلي (Critic Invariant #2)
 * يحمي التطبيق من استثناءات SecurityError أو QuotaExceededError
 */
export class SafeStorageAdapter {
  constructor(storageKey = 'fly10_seismic_lesson_state_v1') {
    this.storageKey = storageKey;
    this.memoryFallback = new Map();
    this.usingFallback = false;
  }

  load() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.storageKey);
        if (!raw) return null;
        return JSON.parse(raw);
      }
    } catch (_err) {
      this.usingFallback = true;
    }
    return this.memoryFallback.get(this.storageKey) || null;
  }

  save(partialState) {
    try {
      const serialized = JSON.stringify(partialState);
      if (!this.usingFallback && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, serialized);
        return true;
      }
    } catch (_err) {
      this.usingFallback = true;
    }
    this.memoryFallback.set(this.storageKey, partialState);
    return false;
  }

  clear() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(this.storageKey);
      }
    } catch (_err) {
      this.usingFallback = true;
    }
    this.memoryFallback.delete(this.storageKey);
  }
}

/**
 * حارس الصوت التفاعلي (Critic Invariant #3)
 * يولد صوت هدير الموجات الزلزالية عبر Web Audio API مع حماية كاملة من حظر التشغيل التلقائي
 */
export class SafeAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.gainNode = null;
    this.oscLow = null;
    this.oscSub = null;
    this.isPlaying = false;
  }

  initFromUserGesture() {
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (_err) {
      this.ctx = null;
    }
  }

  updateRumble(enabled, isRunning, intensityLevel = 5.0) {
    if (!enabled || !isRunning) {
      this.stopRumble();
      return;
    }
    try {
      this.initFromUserGesture();
      if (!this.ctx) return;

      if (!this.isPlaying) {
        this.oscLow = this.ctx.createOscillator();
        this.oscSub = this.ctx.createOscillator();
        this.gainNode = this.ctx.createGain();

        this.oscLow.type = 'sawtooth';
        this.oscSub.type = 'sine';
        this.oscLow.frequency.setValueAtTime(52, this.ctx.currentTime);
        this.oscSub.frequency.setValueAtTime(36, this.ctx.currentTime);

        this.gainNode.gain.setValueAtTime(0.01, this.ctx.currentTime);

        this.oscLow.connect(this.gainNode);
        this.oscSub.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);

        this.oscLow.start();
        this.oscSub.start();
        this.isPlaying = true;
      }

      const normGain = Math.min(0.18, Math.max(0.01, (intensityLevel / 12) * 0.16));
      const jitterFreq = 45 + (intensityLevel * 2.5) + Math.sin(this.ctx.currentTime * 14) * 6;
      this.oscLow.frequency.setTargetAtTime(jitterFreq, this.ctx.currentTime, 0.08);
      this.gainNode.gain.setTargetAtTime(normGain, this.ctx.currentTime, 0.08);
    } catch (_err) {
      this.stopRumble();
    }
  }

  stopRumble() {
    if (!this.isPlaying) return;
    try {
      if (this.oscLow) {
        this.oscLow.stop();
        this.oscLow.disconnect();
      }
      if (this.oscSub) {
        this.oscSub.stop();
        this.oscSub.disconnect();
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
      }
    } catch (_err) {
      // تجاهل أي أخطاء إيقاف في المتصفح
    } finally {
      this.oscLow = null;
      this.oscSub = null;
      this.gainNode = null;
      this.isPlaying = false;
    }
  }
}

/**
 * الدالة النقية لإدارة حالة التطبيق (Pure State Reducer)
 */
export function reduceAppState(state = INITIAL_STATE, action = {}) {
  switch (action.type) {
    case 'SET_VIEW_MODE': {
      const mode = action.payload === 'workbook' ? 'workbook' : 'interactive';
      return {
        ...state,
        viewMode: mode
      };
    }

    case 'SET_ACTIVE_SECTION': {
      return {
        ...state,
        activeSection: String(action.payload || 'sec-simulator')
      };
    }

    case 'TOGGLE_AUDIO': {
      const nextAudio = typeof action.payload === 'boolean' ? action.payload : !state.audioEnabled;
      return {
        ...state,
        audioEnabled: nextAudio
      };
    }

    case 'SET_SIM_PARAMS': {
      const merged = sanitizeSeismicParams({
        ...state.simulation,
        ...(action.payload || {})
      });
      return {
        ...state,
        simulation: {
          ...state.simulation,
          magnitude: merged.magnitude,
          depthKm: merged.depthKm,
          stationDistKm: merged.stationDistKm,
          faultType: merged.faultType,
          vpKmS: merged.vp,
          vsKmS: merged.vs
        }
      };
    }

    case 'START_SIMULATION': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          status: 'running',
          elapsedSec: state.simulation.status === 'paused' ? state.simulation.elapsedSec : 0
        }
      };
    }

    case 'PAUSE_SIMULATION': {
      if (state.simulation.status !== 'running') return state;
      return {
        ...state,
        simulation: {
          ...state.simulation,
          status: 'paused'
        }
      };
    }

    case 'RESET_SIMULATION': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          status: 'idle',
          elapsedSec: 0
        }
      };
    }

    case 'TICK_SIMULATION': {
      if (state.simulation.status !== 'running') return state;
      const dt = clampFinite(action.payload, 0, 0.05, 0.016);
      const nextElapsed = state.simulation.elapsedSec + dt;
      // انتهاء الدورة الآلية بعد 48 ثانية زلزالية مع بقاء الرسم النهائي
      if (nextElapsed >= 48) {
        return {
          ...state,
          simulation: {
            ...state.simulation,
            status: 'paused',
            elapsedSec: 48
          }
        };
      }
      return {
        ...state,
        simulation: {
          ...state.simulation,
          elapsedSec: nextElapsed
        }
      };
    }

    case 'SET_CALC_PARAMS': {
      const raw = {
        ...state.calculator,
        ...(action.payload || {})
      };
      const clean = sanitizeSeismicParams(raw);
      return {
        ...state,
        calculator: {
          ...state.calculator,
          vp: clean.vp,
          vs: clean.vs,
          deltaT: clean.deltaT,
          depthH: clean.depthKm,
          amplitudeUm: clean.amplitudeUm,
          distKm: clean.stationDistKm,
          mag1: clean.mag1,
          mag2: clean.mag2
        }
      };
    }

    case 'SET_TRIANGULATION_DT': {
      const arr = Array.isArray(action.payload) ? action.payload : state.calculator.triDeltaT;
      const triDeltaT = [
        clampFinite(arr[0], 2.0, 45.0, 10.0),
        clampFinite(arr[1], 2.0, 45.0, 14.5),
        clampFinite(arr[2], 2.0, 45.0, 11.5)
      ];
      return {
        ...state,
        calculator: {
          ...state.calculator,
          triDeltaT
        }
      };
    }

    case 'SET_QUIZ_ANSWER': {
      const { questionId, optionIndex } = action.payload || {};
      if (questionId === undefined) return state;
      return {
        ...state,
        quiz: {
          ...state.quiz,
          answers: {
            ...state.quiz.answers,
            [questionId]: Number(optionIndex)
          }
        }
      };
    }

    case 'SUBMIT_QUIZ': {
      const score = clampFinite(action.payload?.score, 0, 20, 0);
      return {
        ...state,
        quiz: {
          ...state.quiz,
          submitted: true,
          score
        }
      };
    }

    case 'RESET_QUIZ': {
      return {
        ...state,
        quiz: {
          answers: {},
          submitted: false,
          score: 0
        }
      };
    }

    case 'SET_ERROR_STATE': {
      return {
        ...state,
        errorState: String(action.payload || 'حدث خطأ غير متوقع')
      };
    }

    case 'RECOVER_FROM_ERROR': {
      return {
        ...INITIAL_STATE,
        errorState: null
      };
    }

    default:
      return state;
  }
}

/**
 * إنشاء مخزن الحالة مع حارس إيقاف المحاكاة عند إخفاء التبويب (Visibility Sleep Barrier)
 */
export function createStore(reducer = reduceAppState, preloadedState = null) {
  const storage = new SafeStorageAdapter();
  let currentState = {
    ...INITIAL_STATE,
    ...(preloadedState || {})
  };

  // استرجاع الإعدادات المحفوظة بأمان
  const saved = storage.load();
  if (saved && typeof saved === 'object') {
    currentState = reduceAppState(currentState, {
      type: 'SET_SIM_PARAMS',
      payload: saved.simulation || {}
    });
    currentState = reduceAppState(currentState, {
      type: 'SET_CALC_PARAMS',
      payload: saved.calculator || {}
    });
  }

  const listeners = new Set();

  function getState() {
    return currentState;
  }

  function dispatch(action) {
    try {
      const nextState = reducer(currentState, action);
      if (nextState !== currentState) {
        currentState = nextState;
        if (action.type !== 'TICK_SIMULATION') {
          storage.save({
            simulation: {
              magnitude: currentState.simulation.magnitude,
              depthKm: currentState.simulation.depthKm,
              stationDistKm: currentState.simulation.stationDistKm,
              faultType: currentState.simulation.faultType
            },
            calculator: currentState.calculator
          });
        }
        listeners.forEach((listener) => {
          try {
            listener(currentState, action);
          } catch (_listenerErr) {
            // منع تعطل المستمعين الآخرين
          }
        });
      }
      return currentState;
    } catch (err) {
      currentState = {
        ...currentState,
        errorState: err?.message || 'خطأ في تحديث الحالة'
      };
      listeners.forEach((l) => l(currentState, { type: 'SET_ERROR_STATE' }));
      return currentState;
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // حارس إخفاء التبويب (Visibility Sleep Barrier)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && currentState.simulation.status === 'running') {
        dispatch({ type: 'PAUSE_SIMULATION' });
      }
    });
  }

  return {
    getState,
    dispatch,
    subscribe,
    storage
  };
}
