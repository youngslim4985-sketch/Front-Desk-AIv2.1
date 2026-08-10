import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Bot,
  User,
  BookOpen,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { Company, PhoneConfig, CallMessage } from '../types';
import { api } from '../services/api';

interface CallSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
  phoneConfig: PhoneConfig;
  onCallEnded?: () => void;
}

type CallState = 'idle' | 'connecting' | 'connected' | 'ended';

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence?: number;
      };
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  }
}

export const CallSimulatorModal: React.FC<CallSimulatorModalProps> = ({
  isOpen,
  onClose,
  company,
  phoneConfig,
  onCallEnded,
}) => {
  const messagesRef = useRef<CallMessage[]>([]);
  const [callerName, setCallerName] = useState('Alex Morgan');
  const [callerPhone, setCallerPhone] = useState('+1 (555) 392-1049');
  const [callState, setCallState] = useState<CallState>('idle');
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [latestToolCall, setLatestToolCall] = useState<any>(null);
  const [ragCitations, setRagCitations] = useState<
    { docTitle: string; snippet: string }[]
  >([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  /*
   * These refs represent the live state of the voice machine.
   *
   * React state is intentionally NOT used as the source of truth inside
   * async speech/audio callbacks because those callbacks can execute after
   * the render that created them.
   */
  const callActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const recognitionRunningRef = useRef(false);
  const recognitionStartingRef = useRef(false);
  const recognitionStopRequestedRef = useRef(false);
  const speechEnabledRef = useRef(speechEnabled);
  const callStateRef = useRef<CallState>(callState);

  /*
   * Keep refs synchronized with React state.
   */
  useEffect(() => {
    speechEnabledRef.current = speechEnabled;
  }, [speechEnabled]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  /*
   * Keep the conversation scrolled to the latest message.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  /*
   * Initialize the SpeechRecognition instance exactly once.
   *
   * The original implementation created a brand-new recognition object every
   * time the microphone button was pressed. That makes onend/onerror races
   * much easier to trigger. This component owns one recognition instance for
   * its entire lifetime.
   */
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      recognitionRunningRef.current = true;
      recognitionStartingRef.current = false;
      recognitionStopRequestedRef.current = false;

      if (
        callActiveRef.current &&
        !isSpeakingRef.current &&
        !isProcessingRef.current
      ) {
        setIsListening(true);
      }
    };

    recognition.onresult = (event) => {
      if (!callActiveRef.current) {
        return;
      }

      const transcript =
        event.results?.[0]?.[0]?.transcript?.trim() || '';

      if (!transcript) {
        return;
      }

      /*
       * The recognition engine is turn-based. Once we have a result,
       * immediately stop the current recognition cycle before sending the
       * transcript to the backend.
       */
      recognitionStopRequestedRef.current = true;

      try {
        recognition.stop();
      } catch (_err) {
        // Recognition may already be stopping.
      }

      setIsListening(false);
      setInputMessage(transcript);

      /*
       * Do not await this here. handleSendMessage owns the processing state
       * and ElevenLabs owns the next speech/listening transition.
       */
      void handleSendMessage(transcript);
    };

    recognition.onerror = (event) => {
      recognitionRunningRef.current = false;
      recognitionStartingRef.current = false;
      setIsListening(false);

      /*
       * "aborted" and "no-speech" are normal turn-based recognition outcomes.
       * The onend handler decides whether another listening turn should begin.
       */
      if (
        event.error !== 'aborted' &&
        event.error !== 'no-speech' &&
        event.error !== 'not-allowed'
      ) {
        console.warn('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      recognitionRunningRef.current = false;
      recognitionStartingRef.current = false;
      setIsListening(false);

      /*
       * If the user explicitly stopped the recognition cycle, do not restart
       * it from onend. The next appropriate event will start it.
       */
      if (recognitionStopRequestedRef.current) {
        recognitionStopRequestedRef.current = false;
        return;
      }

      /*
       * This is the critical lifecycle rule:
       *
       * recognition may only re-arm when:
       *   - the call is still active
       *   - ElevenLabs/browser speech is not playing
       *   - the backend is not processing a caller turn
       *
       * This prevents the microphone from hearing the AI receptionist.
       */
      if (
        callActiveRef.current &&
        !isSpeakingRef.current &&
        !isProcessingRef.current &&
        callStateRef.current === 'connected'
      ) {
        window.setTimeout(() => {
          startRecognition();
        }, 50);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognitionStopRequestedRef.current = true;

      try {
        recognition.abort();
      } catch (_err) {
        // Recognition may already be inactive.
      }

      recognitionRef.current = null;
      recognitionRunningRef.current = false;
      recognitionStartingRef.current = false;
    };
  }, []);

  /*
   * Stop all active voice resources.
   */
  const stopRecognition = () => {
    recognitionStopRequestedRef.current = true;
    recognitionStartingRef.current = false;

    const recognition = recognitionRef.current;

    if (!recognition) {
      recognitionRunningRef.current = false;
      setIsListening(false);
      return;
    }

    try {
      if (recognitionRunningRef.current) {
        recognition.stop();
      } else {
        recognition.abort();
      }
    } catch (_err) {
      // Browser may throw if recognition is already stopped.
    }

    recognitionRunningRef.current = false;
    setIsListening(false);
  };

  /*
   * Start one controlled speech-recognition turn.
   *
   * continuous=false is intentional. The receptionist should listen for one
   * caller turn, submit it, wait for the AI response, play the response, and
   * only then open the microphone again.
   */
  const startRecognition = () => {
    if (!callActiveRef.current) {
      return;
    }

    if (callStateRef.current !== 'connected') {
      return;
    }

    if (isSpeakingRef.current) {
      return;
    }

    if (isProcessingRef.current) {
      return;
    }

    if (recognitionRunningRef.current) {
      return;
    }

    if (recognitionStartingRef.current) {
      return;
    }

    const recognition = recognitionRef.current;

    if (!recognition) {
      return;
    }

    recognitionStopRequestedRef.current = false;
    recognitionStartingRef.current = true;

    try {
      recognition.start();
    } catch (err) {
      recognitionStartingRef.current = false;

      /*
       * Browsers can throw InvalidStateError when start() happens too close to
       * a previous stop(). Give the browser a small recovery window and retry
       * only if the call is still in a valid state.
       */
      console.warn('Speech recognition start failed:', err);

      window.setTimeout(() => {
        if (
          callActiveRef.current &&
          callStateRef.current === 'connected' &&
          !isSpeakingRef.current &&
          !isProcessingRef.current &&
          !recognitionRunningRef.current
        ) {
          startRecognition();
        }
      }, 150);
    }
  };

  /*
   * Called after receptionist audio finishes.
   *
   * This is the central handoff from:
   *
   *     AI SPEAKING -> CALLER LISTENING
   */
  const finishSpeechTurn = () => {
    isSpeakingRef.current = false;

    if (!callActiveRef.current) {
      return;
    }

    if (callStateRef.current !== 'connected') {
      return;
    }

    if (isProcessingRef.current) {
      return;
    }

    /*
     * Give the browser a small scheduling boundary after audio cleanup before
     * opening SpeechRecognition again.
     */
    window.setTimeout(() => {
      if (
        callActiveRef.current &&
        callStateRef.current === 'connected' &&
        !isSpeakingRef.current &&
        !isProcessingRef.current &&
        !recognitionRunningRef.current
      ) {
        startRecognition();
      }
    }, 50);
  };

  /*
   * Speak receptionist message using ElevenLabs when configured, otherwise
   * use browser SpeechSynthesis.
   *
   * The important difference from the original implementation is that audio
   * completion owns the next listening transition.
   */
  const speakText = async (text: string) => {
    if (!speechEnabledRef.current) {
      isSpeakingRef.current = false;

      if (
        callActiveRef.current &&
        callStateRef.current === 'connected' &&
        !isProcessingRef.current
      ) {
        finishSpeechTurn();
      }

      return;
    }

    /*
     * Prevent the microphone from being active while the receptionist speaks.
     */
    stopRecognition();

    isSpeakingRef.current = true;

    /*
     * Stop previous ElevenLabs audio.
     */
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    /*
     * Stop any browser SpeechSynthesis audio.
     */
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    /*
     * ElevenLabs path.
     */
    if (company.voiceConfig?.voiceId) {
      try {
        const blob = await api.synthesizeVoice({
          voiceId: company.voiceConfig.voiceId,
          text,
          modelId:
            company.voiceConfig.modelId || 'eleven_multilingual_v2',
          languageCode:
            company.voiceConfig.languageCode || 'en',
          settings: {
            stability:
              company.voiceConfig.settings?.stability ?? 0.5,
            similarity_boost:
              company.voiceConfig.settings?.similarityBoost ?? 0.75,
            style:
              company.voiceConfig.settings?.style ?? 0,
            use_speaker_boost:
              company.voiceConfig.settings?.useSpeakerBoost ?? true,
          },
        });

        /*
         * The call may have ended while the ElevenLabs request was in flight.
         * Do not start playback after hang-up.
         */
        if (
          !callActiveRef.current ||
          callStateRef.current === 'ended'
        ) {
          isSpeakingRef.current = false;
          return;
        }

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        currentAudioRef.current = audio;

        /*
         * onended is the authoritative ElevenLabs -> microphone handoff.
         */
        audio.onended = () => {
          URL.revokeObjectURL(url);

          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
          }

          finishSpeechTurn();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);

          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
          }

          /*
           * If ElevenLabs playback itself fails, do not leave the call
           * permanently locked in "speaking".
           */
          finishSpeechTurn();
        };

        try {
          await audio.play();
          return;
        } catch (playError) {
          console.warn(
            'ElevenLabs audio playback failed:',
            playError
          );

          audio.onended = null;
          audio.onerror = null;
          audio.pause();

          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
          }

          URL.revokeObjectURL(url);
        }
      } catch (err) {
        /*
         * ElevenLabs synthesis failed. Fall through to browser speech.
         */
        console.warn(
          'ElevenLabs synthesis failed; falling back to browser speech:',
          err
        );
      }
    }

    /*
     * Browser SpeechSynthesis fallback.
     */
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        finishSpeechTurn();
      };

      utterance.onerror = () => {
        finishSpeechTurn();
      };

      /*
       * SpeechSynthesis can occasionally report completion after cancellation.
       * isSpeakingRef and callActiveRef keep that callback from reopening a
       * closed call.
       */
      window.speechSynthesis.speak(utterance);
      return;
    }

    /*
     * No speech system available.
     */
    finishSpeechTurn();
  };

  /*
   * Start the simulated call directly from the user's click gesture.
   *
   * There is intentionally no setTimeout around the call initialization.
   * This preserves the browser's user-gesture/audio-unlock relationship.
   */
  const handleStartCall = async () => {
    /*
     * Reset live voice state first.
     */
    callActiveRef.current = true;
    isSpeakingRef.current = false;
    isProcessingRef.current = false;
    recognitionRunningRef.current = false;
    recognitionStartingRef.current = false;
    recognitionStopRequestedRef.current = false;

    setCallState('connecting');
    callStateRef.current = 'connecting';

    messagesRef.current = [];
    setMessages([]);
    setRagCitations([]);
    setLatestToolCall(null);
    setInputMessage('');
    setIsListening(false);
    setIsProcessing(false);

    /*
     * The previous implementation waited 1.2 seconds here. That delay is
     * removed because it can cause the browser to lose the original user
     * gesture needed for audio playback.
     */
    setCallState('connected');
    callStateRef.current = 'connected';

    const initialGreeting =
      company.customGreeting ||
      `Thank you for calling ${company.name}! How may I help you today?`;

    const firstMsg: CallMessage = {
      id: `m-${Date.now()}`,
      sender: 'receptionist',
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    messagesRef.current = [firstMsg];
    setMessages([firstMsg]);

    /*
     * Start the greeting immediately from the click-triggered call path.
     * speakText owns the transition to caller listening after the greeting.
     */
    void speakText(initialGreeting);
  };

  /*
   * Process a caller turn.
   */
  const handleSendMessage = async (customText?: string) => {
    const textToSend =
      customText !== undefined ? customText : inputMessage;

    if (!textToSend.trim()) {
      return;
    }

    if (!callActiveRef.current) {
      return;
    }

    if (isProcessingRef.current) {
      return;
    }

    /*
     * Do not process a caller message while the receptionist is speaking.
     */
    if (isSpeakingRef.current) {
      return;
    }

    /*
     * Stop recognition before sending the request.
     */
    stopRecognition();

    const userMsg: CallMessage = {
      id: `m-caller-${Date.now()}`,
      sender: 'caller',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const updatedHistory = [...messagesRef.current, userMsg];

    messagesRef.current = updatedHistory;
    setMessages(updatedHistory);
    setInputMessage('');

    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      const result = await api.simulateCallTurn({
        companyId: company.id,
        userMessage: textToSend.trim(),
        history: updatedHistory.map((m) => ({
          sender: m.sender,
          text: m.text,
        })),
        callerName,
        callerPhone,
      });

      /*
       * The call could have been hung up while the API request was running.
       * Do not continue the voice loop after the call has ended.
       */
      if (
        !callActiveRef.current ||
        callStateRef.current === 'ended'
      ) {
        return;
      }

      const receptionistMsg: CallMessage = {
        id: `m-rec-${Date.now()}`,
        sender: 'receptionist',
        text: result.responseText,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        ragSourcesUsed: result.ragSources,
        toolCallExecuted: result.toolCallExecuted,
      };

      const nextHistory = [...messagesRef.current, receptionistMsg];
      messagesRef.current = nextHistory;
      setMessages(nextHistory);

      if (
        result.ragSources &&
        result.ragSources.length > 0
      ) {
        setRagCitations(result.ragSources);
      }

      if (result.toolCallExecuted) {
        setLatestToolCall(result.toolCallExecuted);
      }

      /*
       * Mark processing complete before starting receptionist speech.
       *
       * This is important because audio.onended checks isProcessingRef.
       */
      isProcessingRef.current = false;
      setIsProcessing(false);

      /*
       * ElevenLabs/browser speech now owns the next transition back to
       * listening.
       */
      void speakText(result.responseText);
    } catch (err) {
      console.error('Call simulation error:', err);

      /*
       * Do not insert an error response if the call has already ended.
       */
      if (
        !callActiveRef.current ||
        callStateRef.current === 'ended'
      ) {
        return;
      }

      const errorMsg: CallMessage = {
        id: `m-err-${Date.now()}`,
        sender: 'receptionist',
        text:
          'I am having trouble accessing our scheduling system right now, but I can certainly answer questions about our services.',
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      const nextHistory = [...messagesRef.current, errorMsg];
      messagesRef.current = nextHistory;
      setMessages(nextHistory);

      /*
       * Allow the caller to try again after the error response.
       */
      isProcessingRef.current = false;
      setIsProcessing(false);

      void speakText(errorMsg.text);
    } finally {
      /*
       * The success path clears these before speech starts so that the
       * audio.onended transition can safely re-arm recognition.
       *
       * The finally block is intentionally defensive.
       */
      if (isProcessingRef.current) {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    }
  };

  /*
   * Hang up the call and destroy all voice activity.
   */
  const handleEndCall = async () => {
    /*
     * Mark the call inactive FIRST.
     *
     * Async recognition/audio callbacks that arrive afterward will see
     * callActiveRef.current === false and will not restart anything.
     */
    callActiveRef.current = false;
    isSpeakingRef.current = false;
    isProcessingRef.current = false;

    /*
     * Stop microphone recognition.
     */
    stopRecognition();

    /*
     * Stop ElevenLabs audio.
     */
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    /*
     * Stop browser speech.
     */
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsListening(false);
    setIsProcessing(false);

    setCallState('ended');
    callStateRef.current = 'ended';

    /*
     * Save call transcript to server.
     */
    if (messagesRef.current.length > 1) {
      try {
        await api.saveCallLog({
          companyId: company.id,
          customerId: `cust-${Date.now()}`,
          customerName: callerName,
          customerPhone: callerPhone,
          durationSeconds: Math.floor(messagesRef.current.length * 12 + 15),
          status:
            latestToolCall?.toolName === 'transfer_to_human'
              ? 'transferred'
              : 'completed',
          sentiment: latestToolCall ? 'positive' : 'neutral',
          intentDetected:
            latestToolCall?.toolName ===
            'schedule_appointment'
              ? 'Schedule Appointment'
              : 'General Inquiry',
          keyTopics: [
            company.industry,
            'AI Grounding Test',
          ],
          appointmentBooked:
            latestToolCall?.toolName ===
            'schedule_appointment',
          transcript: messagesRef.current,
        });

        if (onCallEnded) {
          onCallEnded();
        }
      } catch (e) {
        console.error('Failed to log call:', e);
      }
    }
  };

  /*
   * Microphone button.
   *
   * This only manually starts/stops a listening turn. After a successful
   * caller turn, audio.onended controls the next automatic start.
   */
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert(
        'Speech recognition is not supported in this browser. Please type your query in the input field.'
      );
      return;
    }

    if (!callActiveRef.current) {
      return;
    }

    if (callStateRef.current !== 'connected') {
      return;
    }

    if (isProcessingRef.current) {
      return;
    }

    if (isSpeakingRef.current) {
      return;
    }

    if (
      recognitionRunningRef.current ||
      recognitionStartingRef.current
    ) {
      stopRecognition();
      return;
    }

    startRecognition();
  };

  /*
   * If the modal closes while the call is active, shut down all voice
   * resources immediately.
   */
  useEffect(() => {
    if (!isOpen) {
      callActiveRef.current = false;
      isSpeakingRef.current = false;
      isProcessingRef.current = false;

      stopRecognition();

      if (currentAudioRef.current) {
        currentAudioRef.current.onended = null;
        currentAudioRef.current.onerror = null;
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      setIsListening(false);
      setIsProcessing(false);
    }
  }, [isOpen]);

  /*
   * Full component cleanup.
   */
  useEffect(() => {
    return () => {
      callActiveRef.current = false;
      isSpeakingRef.current = false;
      isProcessingRef.current = false;

      recognitionStopRequestedRef.current = true;

      try {
        recognitionRef.current?.abort();
      } catch (_err) {
        // Ignore browser cleanup errors.
      }

      if (currentAudioRef.current) {
        currentAudioRef.current.onended = null;
        currentAudioRef.current.onerror = null;
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /*
   * Do not render the modal when closed.
   */
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="bg-slate-800/90 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Phone className="w-5 h-5 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">
                  {company.name} AI Receptionist
                </h3>

                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  {phoneConfig.phoneNumber}
                </span>
              </div>

              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span>Industry: {company.industry}</span>
                <span>•</span>
                <span className="capitalize font-mono text-indigo-300">
                  {company.aiPersonality.replace('_', ' ')}
                </span>
              </p>
            </div>
          </div>

          {/* Speech Audio Toggle & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextEnabled = !speechEnabled;

                setSpeechEnabled(nextEnabled);
                speechEnabledRef.current = nextEnabled;

                /*
                 * If the user mutes speech while ElevenLabs is playing,
                 * immediately stop that audio and return control to the
                 * caller/listening state.
                 */
                if (!nextEnabled) {
                  if (currentAudioRef.current) {
                    currentAudioRef.current.onended = null;
                    currentAudioRef.current.onerror = null;
                    currentAudioRef.current.pause();
                    currentAudioRef.current.currentTime = 0;
                    currentAudioRef.current = null;
                  }

                  if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }

                  isSpeakingRef.current = false;

                  if (
                    callActiveRef.current &&
                    callStateRef.current === 'connected' &&
                    !isProcessingRef.current
                  ) {
                    finishSpeechTurn();
                  }
                }
              }}
              title={
                speechEnabled
                  ? 'Mute AI Speech Output'
                  : 'Enable AI Speech Output'
              }
              className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                speechEnabled
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {speechEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors text-sm font-semibold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {callState === 'idle' && (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 p-0.5 shadow-xl">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Bot className="w-10 h-10" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">
                Simulate Phone Call to AI Receptionist
              </h2>

              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                Test how your custom company settings, policies,
                services, and uploaded PDF knowledge base respond
                live to customer calls.
              </p>
            </div>

            {/* Caller Profile Settings */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 w-full max-w-md text-left space-y-3">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Simulated Caller Profile
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Caller Name
                  </label>

                  <input
                    type="text"
                    value={callerName}
                    onChange={(e) =>
                      setCallerName(e.target.value)
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Caller Phone #
                  </label>

                  <input
                    type="text"
                    value={callerPhone}
                    onChange={(e) =>
                      setCallerPhone(e.target.value)
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Suggested Sample Questions */}
            <div className="w-full max-w-md">
              <div className="text-xs text-slate-400 mb-2 font-medium">
                Try asking during the call:
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full">
                  "How much are your services?"
                </span>

                <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full">
                  "Do you take insurance?"
                </span>

                <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full">
                  "I want to book an appointment"
                </span>
              </div>
            </div>

            <button
              onClick={handleStartCall}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-3 transition-all transform active:scale-95"
            >
              <Phone className="w-5 h-5" />
              Dial Dedicated AI Number (
              {phoneConfig.phoneNumber})
            </button>
          </div>
        )}

        {callState === 'connecting' && (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin flex items-center justify-center">
              <Phone className="w-6 h-6 text-emerald-400" />
            </div>

            <h3 className="text-lg font-medium text-white">
              Connecting HD Voice Line...
            </h3>

            <p className="text-xs text-slate-400 font-mono">
              Routing to {phoneConfig.phoneNumber}
            </p>
          </div>
        )}

        {(callState === 'connected' ||
          callState === 'ended') && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/50">
            {/* Live Call Banner */}
            <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                {callState === 'connected' && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                )}

                {callState === 'ended' && (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}

                <span className="font-semibold uppercase tracking-wider">
                  {callState === 'connected'
                    ? 'Live Call In Progress'
                    : 'Call Completed & Logged'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-slate-400 font-mono">
                <span>
                  Caller: {callerName} ({callerPhone})
                </span>
              </div>
            </div>

            {/* Conversation Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((msg) => {
                const isReceptionist =
                  msg.sender === 'receptionist';

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      isReceptionist
                        ? 'justify-start'
                        : 'justify-end'
                    }`}
                  >
                    {isReceptionist && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className="max-w-[80%] space-y-2">
                      <div
                        className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          isReceptionist
                            ? 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-none'
                            : 'bg-indigo-600 text-white rounded-tr-none'
                        }`}
                      >
                        <p>{msg.text}</p>

                        <div className="text-[10px] text-slate-400 mt-1 text-right font-mono">
                          {msg.timestamp}
                        </div>
                      </div>

                      {/* RAG Sources Cited Callout */}
                      {msg.ragSourcesUsed &&
                        msg.ragSourcesUsed.length > 0 && (
                          <div className="bg-slate-900/90 border border-indigo-500/30 p-2.5 rounded-xl text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>
                                RAG Grounding Memory Cited:
                              </span>
                            </div>

                            {msg.ragSourcesUsed.map(
                              (src, idx) => (
                                <div
                                  key={idx}
                                  className="text-slate-300 bg-slate-800/80 p-2 rounded border border-slate-700 text-[11px]"
                                >
                                  <span className="font-semibold text-indigo-300">
                                    [{src.docTitle}]
                                  </span>
                                  : "{src.snippet}"
                                </div>
                              )
                            )}
                          </div>
                        )}

                      {/* Tool Call Execution Banner */}
                      {msg.toolCallExecuted && (
                        <div className="bg-emerald-950/60 border border-emerald-500/40 p-2.5 rounded-xl text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              Action Executed:{' '}
                              {
                                msg.toolCallExecuted
                                  .toolName
                              }
                            </span>
                          </div>

                          <div className="text-emerald-200/90 font-mono text-[11px]">
                            {msg.toolCallExecuted.result}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isReceptionist && (
                      <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex items-center gap-3 text-slate-400 text-xs py-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-400 animate-spin">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>

                  <span>
                    AI Receptionist searching knowledge base &
                    generating response...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Controls Bar */}
            {callState === 'connected' && (
              <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3">
                {/* Preset Prompt Helper Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
                  <span className="text-slate-500 font-medium shrink-0">
                    Quick Prompt:
                  </span>

                  <button
                    onClick={() =>
                      void handleSendMessage(
                        'What are your business hours?'
                      )
                    }
                    disabled={
                      isProcessing ||
                      isSpeakingRef.current
                    }
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Hours
                  </button>

                  <button
                    onClick={() =>
                      void handleSendMessage(
                        'What services do you offer and how much are they?'
                      )
                    }
                    disabled={
                      isProcessing ||
                      isSpeakingRef.current
                    }
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Services & Prices
                  </button>

                  <button
                    onClick={() =>
                      void handleSendMessage(
                        'What is your cancellation policy?'
                      )
                    }
                    disabled={
                      isProcessing ||
                      isSpeakingRef.current
                    }
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Policy Check
                  </button>

                  <button
                    onClick={() =>
                      void handleSendMessage(
                        'I want to schedule an appointment for next week.'
                      )
                    }
                    disabled={
                      isProcessing ||
                      isSpeakingRef.current
                    }
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Book Appointment
                  </button>

                  <button
                    onClick={() =>
                      void handleSendMessage(
                        'I need to speak to a manager right away!'
                      )
                    }
                    disabled={
                      isProcessing ||
                      isSpeakingRef.current
                    }
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Human Transfer
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleListening}
                    disabled={
                      isProcessing ||
                      isSpeakingRef.current
                    }
                    title={
                      isListening
                        ? 'Stop Listening'
                        : 'Speak into Microphone'
                    }
                    className={`p-3 rounded-xl border transition-all disabled:opacity-50 ${
                      isListening
                        ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) =>
                      setInputMessage(e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey
                      ) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder="Speak or type what you would say on the phone..."
                    disabled={isProcessing}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />

                  <button
                    onClick={() =>
                      void handleSendMessage()
                    }
                    disabled={
                      !inputMessage.trim() ||
                      isProcessing ||
                      isSpeakingRef.current
                    }
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() =>
                      void handleEndCall()
                    }
                    className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors ml-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>Hang Up</span>
                  </button>
                </div>
              </div>
            )}

            {callState === 'ended' && (
              <div className="p-6 text-center bg-slate-900 border-t border-slate-800 space-y-4">
                <div className="text-emerald-400 flex items-center justify-center gap-2 font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    Call ended & transcript saved to Call
                    History
                  </span>
                </div>

                <button
                  onClick={onClose}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-xl text-sm font-medium border border-slate-700"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
