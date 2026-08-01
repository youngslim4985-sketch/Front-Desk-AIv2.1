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
  AlertCircle,
  Clock,
  ShieldCheck,
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

export const CallSimulatorModal: React.FC<CallSimulatorModalProps> = ({
  isOpen,
  onClose,
  company,
  phoneConfig,
  onCallEnded,
}) => {
  const [callerName, setCallerName] = useState('Alex Morgan');
  const [callerPhone, setCallerPhone] = useState('+1 (555) 392-1049');
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'connected' | 'ended'>('idle');
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [latestToolCall, setLatestToolCall] = useState<any>(null);
  const [ragCitations, setRagCitations] = useState<{ docTitle: string; snippet: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  if (!isOpen) return null;

  // Speak receptionist message using browser SpeechSynthesis
  const speakText = (text: string) => {
    if (!speechEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Stop prior audio
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleStartCall = async () => {
    setCallState('connecting');
    setMessages([]);
    setRagCitations([]);
    setLatestToolCall(null);

    // Artificial connection delay for phone realism
    setTimeout(async () => {
      setCallState('connected');
      const initialGreeting = company.customGreeting || `Thank you for calling ${company.name}! How may I help you today?`;
      
      const firstMsg: CallMessage = {
        id: `m-${Date.now()}`,
        sender: 'receptionist',
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([firstMsg]);
      speakText(initialGreeting);
    }, 1200);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isProcessing) return;

    const userMsg: CallMessage = {
      id: `m-caller-${Date.now()}`,
      sender: 'caller',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputMessage('');
    setIsProcessing(true);

    try {
      const result = await api.simulateCallTurn({
        companyId: company.id,
        userMessage: textToSend,
        history: updatedHistory.map((m) => ({ sender: m.sender, text: m.text })),
        callerName,
        callerPhone,
      });

      const receptionistMsg: CallMessage = {
        id: `m-rec-${Date.now()}`,
        sender: 'receptionist',
        text: result.responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ragSourcesUsed: result.ragSources,
        toolCallExecuted: result.toolCallExecuted,
      };

      setMessages((prev) => [...prev, receptionistMsg]);
      if (result.ragSources && result.ragSources.length > 0) {
        setRagCitations(result.ragSources);
      }
      if (result.toolCallExecuted) {
        setLatestToolCall(result.toolCallExecuted);
      }

      speakText(result.responseText);
    } catch (err) {
      console.error('Call simulation error:', err);
      const errorMsg: CallMessage = {
        id: `m-err-${Date.now()}`,
        sender: 'receptionist',
        text: "I am having trouble accessing our scheduling system right now, but I can certainly answer questions about our services.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndCall = async () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCallState('ended');

    // Save call transcript to server
    if (messages.length > 1) {
      try {
        await api.saveCallLog({
          companyId: company.id,
          customerId: `cust-${Date.now()}`,
          customerName: callerName,
          customerPhone: callerPhone,
          durationSeconds: Math.floor(messages.length * 12 + 15),
          status: latestToolCall?.toolName === 'transfer_to_human' ? 'transferred' : 'completed',
          sentiment: latestToolCall ? 'positive' : 'neutral',
          intentDetected: latestToolCall?.toolName === 'schedule_appointment' ? 'Schedule Appointment' : 'General Inquiry',
          keyTopics: [company.industry, 'AI Grounding Test'],
          appointmentBooked: latestToolCall?.toolName === 'schedule_appointment',
          transcript: messages,
        });
        if (onCallEnded) onCallEnded();
      } catch (e) {
        console.error('Failed to log call:', e);
      }
    }
  };

  // Mic recording simulation / speech recognition
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser. Please type your query in the input field.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
      setIsListening(false);
      handleSendMessage(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

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
                <h3 className="font-semibold text-white">{company.name} AI Receptionist</h3>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  {phoneConfig.phoneNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span>Industry: {company.industry}</span>
                <span>•</span>
                <span className="capitalize font-mono text-indigo-300">{company.aiPersonality.replace('_', ' ')}</span>
              </p>
            </div>
          </div>

          {/* Speech Audio Toggle & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              title={speechEnabled ? "Mute AI Speech Output" : "Enable AI Speech Output"}
              className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                speechEnabled
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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
              <h2 className="text-xl font-bold text-white">Simulate Phone Call to AI Receptionist</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                Test how your custom company settings, policies, services, and uploaded PDF knowledge base respond live to customer calls.
              </p>
            </div>

            {/* Caller Profile Settings */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 w-full max-w-md text-left space-y-3">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Simulated Caller Profile
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Caller Name</label>
                  <input
                    type="text"
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Caller Phone #</label>
                  <input
                    type="text"
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Suggested Sample Questions */}
            <div className="w-full max-w-md">
              <div className="text-xs text-slate-400 mb-2 font-medium">Try asking during the call:</div>
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
              Dial Dedicated AI Number ({phoneConfig.phoneNumber})
            </button>
          </div>
        )}

        {callState === 'connecting' && (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin flex items-center justify-center">
              <Phone className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-medium text-white">Connecting HD Voice Line...</h3>
            <p className="text-xs text-slate-400 font-mono">Routing to {phoneConfig.phoneNumber}</p>
          </div>
        )}

        {(callState === 'connected' || callState === 'ended') && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/50">
            {/* Live Call Banner */}
            <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-semibold uppercase tracking-wider">
                  {callState === 'connected' ? 'Live Call In Progress' : 'Call Completed & Logged'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-slate-400 font-mono">
                <span>Caller: {callerName} ({callerPhone})</span>
              </div>
            </div>

            {/* Conversation Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((msg) => {
                const isReceptionist = msg.sender === 'receptionist';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isReceptionist ? 'justify-start' : 'justify-end'}`}
                  >
                    {isReceptionist && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className={`max-w-[80%] space-y-2`}>
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
                      {msg.ragSourcesUsed && msg.ragSourcesUsed.length > 0 && (
                        <div className="bg-slate-900/90 border border-indigo-500/30 p-2.5 rounded-xl text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>RAG Grounding Memory Cited:</span>
                          </div>
                          {msg.ragSourcesUsed.map((src, idx) => (
                            <div key={idx} className="text-slate-300 bg-slate-800/80 p-2 rounded border border-slate-700 text-[11px]">
                              <span className="font-semibold text-indigo-300">[{src.docTitle}]</span>: "{src.snippet}"
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tool Call Execution Banner */}
                      {msg.toolCallExecuted && (
                        <div className="bg-emerald-950/60 border border-emerald-500/40 p-2.5 rounded-xl text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Action Executed: {msg.toolCallExecuted.toolName}</span>
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
                  <span>AI Receptionist searching knowledge base & generating response...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Controls Bar */}
            {callState === 'connected' && (
              <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3">
                {/* Preset Prompt Helper Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
                  <span className="text-slate-500 font-medium shrink-0">Quick Prompt:</span>
                  <button
                    onClick={() => handleSendMessage("What are your business hours?")}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Hours
                  </button>
                  <button
                    onClick={() => handleSendMessage("What services do you offer and how much are they?")}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Services & Prices
                  </button>
                  <button
                    onClick={() => handleSendMessage("What is your cancellation policy?")}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Policy Check
                  </button>
                  <button
                    onClick={() => handleSendMessage("I want to schedule an appointment for next week.")}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Book Appointment
                  </button>
                  <button
                    onClick={() => handleSendMessage("I need to speak to a manager right away!")}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Human Transfer
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleListening}
                    title={isListening ? "Stop Listening" : "Speak into Microphone"}
                    className={`p-3 rounded-xl border transition-all ${
                      isListening
                        ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Speak or type what you would say on the phone..."
                    disabled={isProcessing}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || isProcessing}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>

                  <button
                    onClick={handleEndCall}
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
                  <span>Call ended & transcript saved to Call History</span>
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
