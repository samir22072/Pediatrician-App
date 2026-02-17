'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Paperclip, Loader2, Bot, User, PanelLeft, Plus, MessageSquare, Copy, FileText, Sparkles, Check, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AIService, VisitService, AttachmentService } from '@/lib/api';
import { Message, Session } from '@/lib/types';
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface AIChatProps {
    patientName?: string;
    patientId?: string;
    patientStats?: any;
    onTransfer?: (data: any) => void;
}

const MSG_INIT_PATIENT = "Hello! I am your pediatric assistant. I can help assess symptoms, check growth charts, and guide you on when to see a doctor. How can I help today?";
const MSG_INIT_DOCTOR = "Medical Scribe Mode Active. I will listen to your consultation, transcribe notes, and extract clinical data automatically. Ready to start.";

export default function AIChat({ patientName, patientId, patientStats, onTransfer }: AIChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [isDoctorMode, setIsDoctorMode] = useState(false); // Toggle State

    const [interimText, setInterimText] = useState(''); // New State for realtime feedback
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isAnalyzingScan, setIsAnalyzingScan] = useState(false);

    // Voice Recording State
    const [recordingTime, setRecordingTime] = useState(0);
    const [maxRecordingTime] = useState(120); // 2 minutes
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isManuallyStopped = useRef(false); // Track if user clicked stop



    // Auto-scroll ref
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial Responsive check
    useEffect(() => {
        if (window.innerWidth < 768) {
            setShowSidebar(false);
        }
    }, []);

    // Load sessions on mount
    useEffect(() => {
        // Check local storage for role
        const role = localStorage.getItem('role');
        setUserRole(role);
        const isDoc = role === 'doctor';

        if (isDoc) {
            setIsDoctorMode(true);
        } else {
            setIsDoctorMode(false);
        }

        loadSessions(isDoc);
    }, []);

    // Auto-scroll effect
    useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    }, [messages, isTyping]);


    const loadSessions = async (overrideMode?: boolean) => {
        if (!patientId) return;
        try {
            const res = await AIService.listSessions({ patientId });
            setSessions(res.data);

            const effectiveMode = (overrideMode !== undefined) ? overrideMode : isDoctorMode;

            // If sessions exist, select the most recent one automatically
            if (res.data.length > 0) {
                // Do not auto-create. Just select the first one or let user choose? 
                // User preference: "show previous chats and if nothing is present then just one window"
                // Let's select the latest one.
                if (!currentSessionId) selectSession(res.data[0].id, effectiveMode);
            } else {
                // No sessions. Prepare "New Chat" state but DO NOT create on backend yet.
                handleCreateSession(effectiveMode);
            }
        } catch (err) {
            console.error("Failed to load sessions", err);
        }
    };

    const handleCreateSession = async (doctorMode: boolean) => {
        // LAZY CREATION: Just reset UI state. Do not call API.
        setCurrentSessionId(null);
        const initialText = doctorMode ? MSG_INIT_DOCTOR : MSG_INIT_PATIENT;
        setMessages([{ id: 'init', sender: 'ai', text: initialText }]);
        if (window.innerWidth < 768) setShowSidebar(false);
    };

    const selectSession = async (id: string, overrideMode?: boolean) => {
        setCurrentSessionId(id);
        if (window.innerWidth < 768) setShowSidebar(false);
        try {
            const res = await AIService.getSessionMessages({ sessionId: id });
            const uiMessages: Message[] = res.data.map((m: any) => ({
                id: m.id,
                sender: m.sender,
                text: m.text,
                timestamp: m.timestamp,
                structuredData: m.structured_data
            }));

            if (uiMessages.length === 0) {
                const effectiveMode = (overrideMode !== undefined) ? overrideMode : isDoctorMode;
                const initialText = effectiveMode ? MSG_INIT_DOCTOR : MSG_INIT_PATIENT;
                setMessages([{ id: 'init', sender: 'ai', text: initialText }]);
            } else {
                setMessages(uiMessages);
            }
        } catch (err) {
            console.error("Load messages failed", err);
        }
    };

    const toggleMode = (checked: boolean) => {
        setIsDoctorMode(checked);
        handleCreateSession(checked);
    };

    // --- File Upload & Preview Logic ---
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        setPendingFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        e.target.value = '';
    };

    const clearPendingFile = () => {
        setPendingFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    };

    // --- Voice Logic (Enhanced) ---
    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

            // Re-initialize if needed
            if (!recognitionRef.current) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onstart = () => {
                    setIsListening(true);
                    isManuallyStopped.current = false;
                    setRecordingTime(0);
                    setInterimText('');
                    // Start Timer
                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = setInterval(() => {
                        setRecordingTime(prev => {
                            if (prev >= 119) {
                                stopListening();
                                return 120;
                            }
                            return prev + 1;
                        });
                    }, 1000);
                };

                recognitionRef.current.onresult = (event: any) => {
                    let finalTranscript = '';
                    let tempInterim = '';

                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            tempInterim += event.results[i][0].transcript;
                        }
                    }

                    if (finalTranscript) {
                        setInputValue(prev => prev + (prev ? ' ' : '') + finalTranscript);
                    }
                    setInterimText(tempInterim);
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    if (event.error === 'not-allowed') {
                        stopListening();
                        alert("Microphone access denied.");
                    }
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                    setInterimText('');
                    if (timerRef.current) clearInterval(timerRef.current);
                };
            }

            try {
                recognitionRef.current.start();
            } catch (e) {
                console.warn("Recognition already started");
            }

        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    };

    const stopListening = () => {
        isManuallyStopped.current = true;
        setIsListening(false);
        setInterimText('');
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsListening(false);
    };

    // --- Text to Speech Logic ---
    const [isTTSActive, setIsTTSActive] = useState(false);

    const speak = (text: string) => {
        if (!isTTSActive || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
        if (preferredVoice) utterance.voice = preferredVoice;
        window.speechSynthesis.speak(utterance);
    };

    // Stop speech when unmounting
    useEffect(() => {
        return () => {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        };
    }, []);

    // --- Main Send Logic ---
    const handleSend = async () => {
        if (!inputValue.trim() && !pendingFile) return;

        setIsTyping(true);

        // 1. If no session, create one now (Lazy Create)
        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            try {
                const sessionCount = sessions.length + 1;
                const baseName = isDoctorMode ? 'Medical Scribe Session' : 'Consultation';
                const name = `${baseName} ${sessionCount}`;

                const res = await AIService.createSession({ patientId, name });
                activeSessionId = res.data.id;
                setCurrentSessionId(activeSessionId);
                setSessions(prev => [res.data, ...prev]);
            } catch (err) {
                console.error("Failed to lazily create session", err);
                setIsTyping(false);
                return;
            }
        }

        // Display User Message Immediately
        const tempId = Date.now().toString();
        const userMsg: Message = {
            id: tempId,
            sender: 'user',
            text: inputValue,
            imageUrl: previewUrl || undefined
        };
        setMessages(prev => [...prev, userMsg]);

        // Clear Input State
        setInputValue('');
        const fileToUpload = pendingFile;
        clearPendingFile();

        try {
            let attachmentId = undefined;

            // 2. Upload File if present
            if (fileToUpload) {
                if (!patientId) throw new Error("Patient ID required");

                const attachRes = await AttachmentService.create({
                    sessionId: activeSessionId || undefined,
                    file: fileToUpload
                });
                attachmentId = attachRes.data.id;
            }

            // 3. Send to Chat
            const history = messages.map(m => ({ role: m.sender, text: m.text }));

            const response = await AIService.chat({
                message: userMsg.text || (fileToUpload ? `[Uploaded Image: ${fileToUpload.name}]` : ""),
                history: history,
                patientStats: patientStats,
                patientId: patientId,
                sessionId: activeSessionId,
                mode: isDoctorMode ? 'doctor' : 'patient',
                attachmentId: attachmentId
            });

            const reply = response.data.text;
            const structured = response.data.structured_data;

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: reply,
                structuredData: structured
            };
            setMessages(prev => [...prev, aiMsg]);
            speak(reply);

        } catch (err) {
            console.error("Chat/Upload failed", err);
            setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: "Sorry, I encountered an error processing your request." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this chat session?")) return;

        try {
            await AIService.deleteSession({ sessionId });
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (currentSessionId === sessionId) {
                setCurrentSessionId(null);
                setMessages([]);
            }
        } catch (err) {
            console.error("Failed to delete session", err);
        }
    };

    const handleGenerateReport = async () => {
        if (!currentSessionId || messages.length === 0) return;
        setIsTyping(true);
        try {
            const history = messages.map(m => ({ role: m.sender, text: m.text }));
            const res = await AIService.summarize({
                patientId,
                history,
                sessionId: currentSessionId
            });

            if (res.data.summary) {
                let parsedSummary = null;
                let displayText = res.data.summary;
                try {
                    const cleanJson = res.data.summary.replace(/```json/g, '').replace(/```/g, '').trim();
                    parsedSummary = JSON.parse(cleanJson);
                    displayText = "Visit Report Data Generated successfully.";
                } catch (e) {
                    parsedSummary = null;
                    displayText = `**Report Generated:**\n\n${res.data.summary}`;
                }

                const reportMsg: Message = {
                    id: Date.now().toString(),
                    sender: 'ai',
                    text: displayText,
                    structuredData: parsedSummary,
                    timestamp: new Date().toISOString()
                };

                if (!parsedSummary) {
                    setMessages(prev => [...prev, reportMsg]);
                }

                if (parsedSummary && onTransfer) {
                    onTransfer({ ...parsedSummary, sessionId: currentSessionId });
                }
            }
        } catch (err) {
            console.error("Generate report failed", err);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <Card className="flex flex-col h-full border-0 shadow-none sm:border sm:shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40 shrink-0 h-14">
                <div className="flex items-center gap-3 overflow-hidden">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowSidebar(!showSidebar)}>
                                    <PanelLeft size={18} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>Toggle Sidebar</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <Avatar className="h-8 w-8 border border-border">
                        <AvatarImage src="/ai-avatar.png" />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">AI</AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold text-sm truncate flex items-center gap-2">
                            {isDoctorMode ? 'Medical Scribe' : 'Pediatric Assistant'}
                            {isDoctorMode && <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">MD</Badge>}
                        </span>
                        {isTyping && <span className="text-[10px] text-muted-foreground animate-pulse">Thinking...</span>}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-8 w-8", isTTSActive ? "text-primary" : "text-muted-foreground")}
                                    onClick={() => {
                                        if (isTTSActive) window.speechSynthesis.cancel();
                                        setIsTTSActive(!isTTSActive);
                                    }}
                                >
                                    {isTTSActive ? <Volume2 size={18} /> : <VolumeX size={18} />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {isTTSActive ? "Mute Text-to-Speech" : "Enable Text-to-Speech"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>



                    {/* Generate Report Button - Visible if content exists */}
                    {messages.length > 0 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateReport}
                                        disabled={isTyping || isAnalyzingScan}
                                        className="h-8 gap-2 text-xs font-semibold sm:text-sm text-primary border-primary/20 hover:bg-primary/5 px-3"
                                    >
                                        <FileText size={14} />
                                        <span className="hidden xs:inline">Generate Visit</span>
                                        <span className="inline xs:hidden">Report</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Generate Report Summary</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}



                    {/* Only show switch if user is a doctor */}
                    {userRole === 'doctor' && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 px-2">
                                        <Label htmlFor="mode-switch" className="text-xs font-medium cursor-pointer hidden sm:inline-block">
                                            {isDoctorMode ? 'Doctor Mode' : 'Patient Mode'}
                                        </Label>
                                        <Switch
                                            id="mode-switch"
                                            checked={isDoctorMode}
                                            onCheckedChange={toggleMode}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Switch between Patient and Doctor personas</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden relative">
                {/* Sidebar */}
                <div
                    className={cn(
                        "absolute md:relative z-20 h-full bg-background border-r transition-all duration-300 ease-in-out flex flex-col shrink-0",
                        showSidebar ? "w-64 translate-x-0" : "w-0 -translate-x-full md:translate-x-0 md:w-0"
                    )}
                >
                    <div className={cn("p-3 border-b flex justify-between items-center bg-muted/20", !showSidebar && "hidden")}>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</span>
                        <Button variant="ghost" size="icon" onClick={() => handleCreateSession(isDoctorMode)} className="h-7 w-7">
                            <Plus size={14} />
                        </Button>
                    </div>
                    <ScrollArea className={cn("flex-1", !showSidebar && "hidden")}>
                        <div className="p-2 space-y-1">
                            {sessions
                                .filter(s => isDoctorMode || !s.name?.toLowerCase().includes("medical scribe"))
                                .map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => selectSession(s.id)}
                                        className={cn(
                                            "group w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 truncate",
                                            currentSessionId === s.id
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <MessageSquare size={14} className="shrink-0 opacity-70" />
                                        <span className="truncate flex-1">{s.name || "Untitled Chat"}</span>
                                        {/* Delete Button - visible on hover or if active */}
                                        <div
                                            role="button"
                                            onClick={(e) => handleDeleteSession(e, s.id)}
                                            className={cn(
                                                "shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all",
                                                currentSessionId === s.id && "opacity-100" // Always show on active
                                            )}
                                            title="Delete Session"
                                        >
                                            <Trash2 size={12} />
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col min-h-0 bg-background/50 relative">
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                        <div className="space-y-4 max-w-3xl mx-auto pb-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex gap-3",
                                        msg.sender === 'user' ? "justify-end" : "justify-start"
                                    )}
                                >
                                    {msg.sender === 'ai' && (
                                        <Avatar className="h-8 w-8 mt-1 border shadow-sm hidden sm:block">
                                            <AvatarImage src="/ai-avatar.png" />
                                            <AvatarFallback className="bg-primary/10 text-primary text-xs">AI</AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div
                                        className={cn(
                                            "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed",
                                            msg.sender === 'user'
                                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                                : "bg-muted/80 text-foreground rounded-tl-none border border-border"
                                        )}
                                    >
                                        {msg.imageUrl && (
                                            <img
                                                src={msg.imageUrl}
                                                alt="Uploaded Scan"
                                                className="max-w-full h-auto rounded-md mb-2 border border-white/20"
                                            />
                                        )}
                                        {msg.sender === 'ai' ? (
                                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words">
                                                {msg.imageUrl && (
                                                    <img src={msg.imageUrl} alt="Analyzed Scan" className="max-w-full h-auto rounded-md mb-2" />
                                                )}
                                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{msg.text}</div>
                                        )}

                                        {/* Action Buttons for AI messages */}
                                        {msg.sender === 'ai' && (
                                            <div className="flex gap-2 mt-3 pt-2 border-t border-border/50">
                                                {msg.structuredData && (
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="h-7 text-xs gap-1 bg-background/50 hover:bg-background border shadow-none"
                                                        onClick={() => onTransfer && onTransfer(msg.structuredData)}
                                                    >
                                                        <FileText size={12} /> Use Data
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(msg.text);
                                                    }}
                                                >
                                                    <Copy size={12} />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {msg.sender === 'user' && (
                                        <Avatar className="h-8 w-8 mt-1 border shadow-sm hidden sm:block">
                                            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">Me</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground opacity-50">
                                    <Sparkles size={48} className="mb-4" />
                                    <p>Start a conversation...</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 bg-background border-t">
                        {isListening && (
                            <div className="max-w-3xl mx-auto flex items-center gap-3 w-full bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3 animate-pulse mb-2">
                                <div className="h-3 w-3 rounded-full bg-destructive animate-ping" />
                                <span className="text-sm font-bold text-destructive flex-1">
                                    Recording... {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')} / 02:00
                                </span>
                                <Button
                                    onClick={stopListening}
                                    variant="destructive"
                                    size="sm"
                                    className="h-8"
                                >
                                    End Listening
                                </Button>
                            </div>
                        )}

                        {pendingFile && previewUrl && (
                            <div className="max-w-3xl mx-auto mb-2 flex items-start px-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="relative group">
                                    <div className="absolute -top-2 -right-2 z-10">
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="h-5 w-5 rounded-full shadow-sm"
                                            onClick={clearPendingFile}
                                        >
                                            <X size={12} />
                                        </Button>
                                    </div>
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="h-20 w-auto rounded-md border border-border shadow-sm bg-background/50 object-cover"
                                    />
                                    <div className="text-[10px] text-muted-foreground mt-1 max-w-[120px] truncate">
                                        {pendingFile.name}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="max-w-3xl mx-auto flex gap-2 items-end">
                            <Button
                                variant={isListening ? "destructive" : "outline"}
                                size="icon"
                                className={cn(
                                    "h-10 w-10 shrink-0 rounded-full transition-all",
                                    isListening && "animate-pulse ring-2 ring-destructive/50"
                                )}
                                onClick={toggleListening}
                                disabled={isTyping}
                            >
                                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                            </Button>

                            <div className="flex-1 relative flex gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0 rounded-full"
                                    onClick={() => document.getElementById('chat-file-upload')?.click()}
                                    disabled={isTyping}
                                >
                                    <Paperclip size={18} />
                                </Button>
                                <input
                                    id="chat-file-upload"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <Textarea
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={isListening ? "Listening..." : (isTyping ? "Please wait..." : (isDoctorMode ? "Dictate clinical notes..." : "Type or speak symptoms..."))}
                                    disabled={isTyping}
                                    className="min-h-[44px] max-h-[120px] resize-none py-3 pr-10 rounded-2xl border-input focus-visible:ring-1 bg-background shadow-sm"
                                    rows={1}
                                />
                            </div>

                            <Button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isTyping}
                                size="icon"
                                className={cn(
                                    "h-10 w-10 shrink-0 rounded-full transition-all",
                                    inputValue.trim() ? "opacity-100" : "opacity-50"
                                )}
                            >
                                <Send size={18} />
                            </Button>
                        </div>

                        <div className="max-w-3xl mx-auto text-center mt-2">
                            <span className="text-[10px] text-muted-foreground">
                                {isDoctorMode ? "AI Medical Scribe Active" : "Pediatric Guidance Active"}
                            </span>
                        </div>
                    </div>
                </div>
            </div >
        </Card >
    );
}
