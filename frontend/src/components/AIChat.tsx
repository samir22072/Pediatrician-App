import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Mic, MicOff, PanelLeft } from 'lucide-react';
import { AIService } from '@/lib/api';

interface Message {
    id: string;
    sender: 'user' | 'ai';
    text: string;
}

interface AIChatProps {
    patientName: string;
    patientStats?: {
        age?: string | number;
        weight?: string | number;
        height?: string | number;
    };
    patientId: string;
    onTransfer: (summary: { diagnosis: string; notes: string; vaccines?: string[]; weight?: number; height?: number; visitType?: string[] }) => void;
}

export default function AIChat({ patientName, patientStats, patientId, onTransfer }: AIChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sessions, setSessions] = useState<any[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Initialize: Fetch Sessions
    useEffect(() => {
        setIsOpen(true);
        fetchSessions();
    }, [patientId]);

    const fetchSessions = async () => {
        try {
            const res = await AIService.listSessions({ patientId });
            setSessions(res.data);

            // Auto-select latest if exists, else create new or show empty
            if (res.data.length > 0) {
                selectSession(res.data[0].id);
            } else {
                handleCreateSession();
            }
        } catch (err) {
            console.error("Failed to fetch sessions", err);
        }
    };

    const handleCreateSession = async () => {
        try {
            const res = await AIService.createSession({ patientId, name: `Chat ${new Date().toLocaleDateString()}` });
            setSessions(prev => [res.data, ...prev]);
            setCurrentSessionId(res.data.id);
            setMessages([{ id: 'init', sender: 'ai', text: `Hello! I'm your medical assistant bot. What is ${patientName} here for today?` }]);
        } catch (err) {
            console.error("Failed to create session", err);
        }
    };

    const selectSession = async (sessionId: string) => {
        setCurrentSessionId(sessionId);
        setIsTyping(true);
        try {
            const res = await AIService.getSessionMessages({ sessionId });
            // Convert backend messages to UI format
            const uiMessages: Message[] = res.data.map((m: any) => ({
                id: m.id,
                sender: m.sender,
                text: m.text
            }));

            if (uiMessages.length === 0) {
                setMessages([{ id: 'init', sender: 'ai', text: `Hello! I'm your medical assistant bot. What is ${patientName} here for today?` }]);
            } else {
                setMessages(uiMessages);
            }
        } catch (err) {
            console.error("Failed to load session", err);
        } finally {
            setIsTyping(false);
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: inputValue };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            const history = messages.map(m => ({ role: m.sender, text: m.text }));

            const response = await AIService.chat({
                message: userMsg.text,
                history: history, // Send full history for context (simplified)
                patientStats: patientStats,
                patientId: patientId,
                sessionId: currentSessionId // Important: Pass session ID
            });

            const aiText = response.data.text;
            /* Update session list to show recent activity if needed (optional optimization) */

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: aiText
            }]);
        } catch (error) {
            console.error("AI Chat Error", error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: "I'm having trouble connecting to the server."
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleGenerateSummary = async () => {
        if (isTyping) return;
        setIsTyping(true);
        try {
            const history = messages.map(m => ({
                role: m.sender,
                text: m.text
            }));

            const response = await AIService.summarize({
                history: history,
                patientId: patientId
            });

            const summaryRaw = response.data.summary;
            let summaryData = { diagnosis: '', notes: '' };

            if (typeof summaryRaw === 'string') {
                const jsonMatch = summaryRaw.match(/\{[\s\S]*\}/);
                const jsonString = jsonMatch ? jsonMatch[0] : summaryRaw;
                try {
                    summaryData = JSON.parse(jsonString);
                } catch (e) {
                    summaryData = { diagnosis: "Consult Needed", notes: summaryRaw };
                }
            } else if (typeof summaryRaw === 'object') {
                summaryData = summaryRaw;
            }

            const finalSummary = {
                diagnosis: summaryData.diagnosis || "Pending Evaluation",
                notes: summaryData.notes || JSON.stringify(summaryData),
                vaccines: (summaryData as any).given_vaccines || [],
                weight: (summaryData as any).weight,
                height: (summaryData as any).height,
                visitType: (summaryData as any).visit_type || []
            };

            onTransfer(finalSummary);
        } catch (error) {
            console.error("Summary Generation Failed", error);
            alert("Failed to generate summary via AI.");
        } finally {
            setIsTyping(false);
        }
    };

    // Speech Recognition Setup (unchanged)
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';
            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
                setIsListening(false);
            };
            recognitionRef.current.onerror = () => setIsListening(false);
            recognitionRef.current.onend = () => setIsListening(false);
        }
    }, []);

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!confirm("Delete this chat session?")) return;

        try {
            await AIService.deleteSession({ sessionId });
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (currentSessionId === sessionId) {
                setMessages([]);
                setCurrentSessionId(null);
            }
        } catch (err) {
            console.error("Failed to delete session", err);
        }
    };

    const toggleListening = () => {
        if (!recognitionRef.current) return alert("Voice not supported");
        isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
        setIsListening(!isListening);
    };

    return (
        <div className="flex-row h-full gap-4 relative" style={{ minHeight: '500px', alignItems: 'flex-start' }}>
            {sessions.length === 0 ? (
                <div className="w-full h-full flex-center flex-col gap-4">
                    <div className="p-6 rounded-full" style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)' }}>
                        <Sparkles size={48} className="text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-primary">Start a New Consultation</h2>
                    <p className="text-secondary text-sm max-w-md text-center mb-4">
                        Create a new session to begin AI-assisted triage for {patientName}.
                    </p>
                    <button
                        onClick={handleCreateSession}
                        className="btn flex-center gap-2 px-6 py-3 text-lg hover-scale"
                        style={{
                            backgroundColor: 'hsl(var(--primary))',
                            color: 'white',
                            boxShadow: '0 4px 14px rgba(14, 165, 233, 0.4)'
                        }}
                    >
                        <Sparkles size={20} /> Start New Chat
                    </button>
                </div>
            ) : (
                <>
                    {/* Sidebar Toggle Button (Mobile/Collapsed) */}
                    {!isSidebarOpen && (
                        <div className="pt-2 tooltip-container tooltip-right" data-tooltip="Open Sidebar">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="btn-icon p-2 text-primary"
                                style={{
                                    backgroundColor: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}
                            >
                                <PanelLeft size={20} />
                            </button>
                        </div>
                    )}

                    {/* Sidebar - Sessions */}
                    {isSidebarOpen && (
                        <div className="flex-col gap-2 transition-all" style={{ width: '250px', borderRight: '1px solid var(--glass-border)', paddingRight: '1rem' }}>
                            {/* Header: Title + Collapse Right */}
                            <div className="flex-between mb-3 pt-1">
                                <h3 className="text-secondary text-sm font-semibold">History</h3>
                                <div className="tooltip-container tooltip-left" data-tooltip="Close Sidebar">
                                    <button
                                        onClick={() => setIsSidebarOpen(false)}
                                        className="btn-icon p-1 hover:text-primary"
                                    >
                                        <PanelLeft size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* New Chat Button */}
                            <button
                                onClick={handleCreateSession}
                                className="btn w-full flex-center gap-2 mb-2"
                                title="Start New Chat"
                                style={{
                                    padding: '0.6rem',
                                    fontSize: '0.9rem',
                                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                                    color: 'hsl(var(--primary))',
                                    border: '1px solid rgba(14, 165, 233, 0.2)'
                                }}
                            >
                                <Sparkles size={16} /> <span>New Chat</span>
                            </button>

                            {/* Previous Chats Heading */}
                            <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-1 opacity-60 pl-1">
                                Previous Chats
                            </div>

                            <div className="flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100% - 130px)' }}>
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => selectSession(session.id)}
                                        className={`p-3 rounded-lg cursor-pointer transition-all flex-between ${currentSessionId === session.id ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-secondary'}`}
                                        style={{ fontSize: '0.9rem' }}
                                    >
                                        <div className="font-medium truncate flex-1">{session.name}</div>
                                        <button
                                            onClick={(e) => handleDeleteSession(e, session.id)}
                                            className="btn-icon p-1 hover:text-red-400"
                                            style={{ color: 'inherit', opacity: 0.7 }}
                                            title="Delete Chat"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                {sessions.length === 0 && <div className="text-xs text-secondary text-center italic mt-4">No history yet</div>}
                            </div>
                        </div>
                    )}

                    {/* Main Chat Area */}
                    <div className="chat-container flex-1">
                        {/* Header */}
                        <div className="chat-header">
                            <div className="flex-center gap-3">
                                <div className="flex-center" style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(14, 165, 233, 0.2)' }}>
                                    <Sparkles size={20} color="hsl(var(--primary))" />
                                </div>
                                <div>
                                    <h3 className="text-primary font-semibold m-0" style={{ fontSize: '1rem' }}>AI Triage Session</h3>
                                    <div className="flex-center gap-1 justify-start">
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'hsl(var(--success))' }}></span>
                                        <span className="text-secondary text-xs">Connected • {sessions.find(s => s.id === currentSessionId)?.name || 'New Session'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="chat-messages">
                            {messages.map(msg => (
                                <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
                                    {msg.text}
                                </div>
                            ))}
                            {isTyping && (
                                <div style={{ alignSelf: 'flex-start' }} className="flex-center gap-2 text-secondary text-sm italic p-2">
                                    <Sparkles size={12} className="animate-spin-slow" />
                                    AI is analyzing...
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Action Bar */}
                        <div className="chat-actions">
                            {messages.length > 2 && (
                                <button
                                    onClick={handleGenerateSummary}
                                    className="btn hover-scale w-full flex-center gap-2 mb-4"
                                    disabled={isTyping}
                                    style={{
                                        backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'hsl(var(--success))',
                                        border: '1px solid rgba(16, 185, 129, 0.3)'
                                    }}
                                >
                                    <Sparkles size={16} />
                                    {isTyping ? 'Generating Report...' : 'Summarize & Create Visit Record'}
                                </button>
                            )}

                            <div className="flex-row gap-4">
                                <button
                                    onClick={toggleListening}
                                    disabled={isTyping}
                                    className={`mic-btn ${isListening ? 'active' : 'inactive'}`}
                                    title={isListening ? "Stop Listening" : "Start Voice Input"}
                                >
                                    {isListening ? <MicOff size={22} /> : <Mic size={22} />}
                                </button>

                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSend()}
                                    placeholder={isListening ? "Listening..." : (isTyping ? "Please wait..." : "Type or speak symptoms...")}
                                    disabled={isTyping}
                                    className="chat-input"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputValue.trim() || isTyping}
                                    className="flex-center"
                                    style={{
                                        width: '54px', height: '54px', borderRadius: '50%',
                                        backgroundColor: inputValue.trim() ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)',
                                        color: inputValue.trim() ? 'black' : 'rgba(255,255,255,0.3)',
                                        border: 'none', cursor: inputValue.trim() ? 'pointer' : 'default',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Send size={24} />
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
