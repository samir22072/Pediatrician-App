import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Mic, MicOff } from 'lucide-react';
import api from '@/lib/api';

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
    onTransfer: (summary: { diagnosis: string; notes: string; vaccines?: string[] }) => void;
}

export default function AIChat({ patientName, patientStats, patientId, onTransfer }: AIChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', sender: 'ai', text: `Hello! I'm your AI Triage Assistant. What symptoms is ${patientName} experiencing today?` }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // If embedded, start open
    useEffect(() => {
        if (typeof isOpen !== 'undefined') return; // If manually toggled, ignore
        setIsOpen(true); // Default open for embedded
    }, []);

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
            // Prepare history for context
            const history = messages.map(m => ({
                role: m.sender,
                text: m.text
            }));

            const response = await api.post('ai/chat/', {
                message: userMsg.text,
                history: history,
                patientStats: patientStats,
                patientId: patientId
            });

            const aiText = response.data.text;

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
                text: "I'm having trouble connecting to the server. Please check your connection."
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

            const response = await api.post('ai/summarize/', {
                history: history,
                patientId: patientId
            });

            const summaryRaw = response.data.summary;
            let summaryData = { diagnosis: '', notes: '' };

            // Backend returns a JSON string inside the 'summary' field if the prompt worked well, 
            // or sometimes just text. We try to parse it.
            if (typeof summaryRaw === 'string') {
                // Try to find JSON object pattern if there's extra text
                const jsonMatch = summaryRaw.match(/\{[\s\S]*\}/);
                const jsonString = jsonMatch ? jsonMatch[0] : summaryRaw;

                try {
                    summaryData = JSON.parse(jsonString);
                } catch (e) {
                    // Fallback if AI didn't return valid JSON
                    summaryData = {
                        diagnosis: "Consult Needed",
                        notes: summaryRaw
                    };
                }
            } else if (typeof summaryRaw === 'object') {
                summaryData = summaryRaw;
            }

            // Ensure keys exist
            const finalSummary = {
                diagnosis: summaryData.diagnosis || "Pending Evaluation",
                notes: summaryData.notes || JSON.stringify(summaryData),
                vaccines: (summaryData as any).given_vaccines || []
            };

            onTransfer(finalSummary);
            // setIsOpen(false); // Don't close if embedded in a tab
        } catch (error) {
            console.error("Summary Generation Failed", error);
            alert("Failed to generate summary via AI.");
        } finally {
            setIsTyping(false);
        }
    };

    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null); // Use any for SpeechRecognition to avoid strict type issues

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false; // Stop after one sentence/pause
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech Recognition Error", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Voice input is not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    // Render Clean Embedded View
    return (
        <div style={{
            height: '100%',
            display: 'flex', flexDirection: 'column',
            backgroundColor: 'rgba(5, 5, 20, 0.4)',
            borderRadius: '1rem',
            border: '1px solid var(--glass-border)',
            overflow: 'hidden'
        }}>
            {/* Header - Simplified for Tab View */}
            <div style={{
                padding: '1rem', borderBottom: '1px solid var(--glass-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'linear-gradient(90deg, rgba(14, 165, 233, 0.1), transparent)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '50%', backgroundColor: 'rgba(14, 165, 233, 0.2)' }}>
                        <Sparkles size={20} color="hsl(var(--primary))" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: 'hsl(var(--text-primary))' }}>AI Triage Session</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'hsl(var(--success))' }}></span>
                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Connected to Knowledge Base</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map(msg => (
                    <div key={msg.id} style={{
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '70%',
                        padding: '1rem 1.25rem',
                        borderRadius: msg.sender === 'user' ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0',
                        backgroundColor: msg.sender === 'user' ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.05)',
                        color: msg.sender === 'user' ? 'black' : 'hsl(var(--text-primary))',
                        fontSize: '0.95rem',
                        boxShadow: msg.sender === 'user' ? '0 2px 10px rgba(14, 165, 233, 0.2)' : 'none',
                        lineHeight: '1.5'
                    }}>
                        {msg.text}
                    </div>
                ))}
                {isTyping && (
                    <div style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={12} className="animate-spin-slow" />
                        AI is analyzing...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Action Bar */}
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                {messages.length > 2 && (
                    <button
                        onClick={handleGenerateSummary}
                        className="btn hover-scale"
                        disabled={isTyping}
                        style={{
                            width: '100%', marginBottom: '1rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'hsl(var(--success))',
                            border: '1px solid rgba(16, 185, 129, 0.3)', justifyContent: 'center',
                            padding: '0.75rem', fontSize: '0.9rem'
                        }}
                    >
                        <Sparkles size={16} />
                        {isTyping ? 'Generating Report...' : 'Summarize & Create Visit Record'}
                    </button>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={toggleListening}
                        disabled={isTyping}
                        style={{
                            width: '54px', height: '54px', borderRadius: '50%',
                            backgroundColor: isListening ? 'hsl(var(--destructive))' : 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: isListening ? '2px solid hsl(var(--destructive))' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            animation: isListening ? 'pulse-red 1.5s infinite' : 'none'
                        }}
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
                        style={{
                            flex: 1, padding: '1rem 1.5rem', borderRadius: '2rem',
                            backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
                            color: 'white', outline: 'none', fontSize: '1rem'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isTyping}
                        style={{
                            width: '54px', height: '54px', borderRadius: '50%',
                            backgroundColor: inputValue.trim() ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)',
                            color: inputValue.trim() ? 'black' : 'rgba(255,255,255,0.3)',
                            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: inputValue.trim() ? 'pointer' : 'default',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Send size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
}
