"use client";

import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

const SUGGESTIONS = [
  "Como melhorar meu agachamento?",
  "O que comer antes do treino?",
  "Estou com dor no ombro, o que fazer?",
  "Como montar uma dieta para ganho de massa?"
];

export default function Coach() {
  const { profile } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('fitforge_coach_history');
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          content: `Olá${profile?.name ? ' ' + profile.name : ''}! Eu sou o seu VegaFit Coach. Como posso ajudar com seus treinos ou dieta hoje?`
        }
      ]);
    }
  }, [profile?.name]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 1) {
      localStorage.setItem('fitforge_coach_history', JSON.stringify(messages));
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: profile?.geminiApiKey,
          profile,
          message: text,
          history: messages.filter(m => m.id !== 'welcome')
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', content: data.text };
      setMessages(prev => [...prev, modelMsg]);

    } catch (err: any) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', content: `**Erro:** ${err.message}. Verifique sua chave da API.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseMarkdown = (text: string) => {
    // Simple bold parser
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-[#00ff88]">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-screen md:h-full w-full max-w-4xl mx-auto md:p-6 pb-20 md:pb-6 relative animate-fade-in">
      <header className="p-4 border-b border-white/[0.08] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-10 md:rounded-t-[24px] md:border md:border-white/[0.08] md:border-b-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#00ff88] p-[2px]">
            <div className="w-full h-full bg-[#0a0a0f] rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-[#00ff88]" />
            </div>
          </div>
          <div>
            <h1 className="font-outfit font-bold text-xl">VegaFit Coach</h1>
            <p className="text-xs text-[#00ff88] flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></span> Online (Groq AI)</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 md:border-x md:border-white/[0.08] bg-gradient-to-b from-[#ffffff02] to-transparent">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-[70%] p-4 ${
              msg.role === 'user' 
                ? 'bg-[#7c3aed] text-white rounded-[20px] rounded-br-sm' 
                : 'bg-white/[0.04] backdrop-blur-md border border-white/10 text-gray-200 rounded-[20px] rounded-bl-sm'
            }`}>
              <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">
                {parseMarkdown(msg.content)}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 p-4 rounded-[20px] rounded-bl-sm flex gap-2 items-center">
              <span className="w-2 h-2 bg-[#00ff88] rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-[#00ff88] rounded-full animate-bounce delay-75"></span>
              <span className="w-2 h-2 bg-[#00ff88] rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 bg-[#0a0a0f]/90 backdrop-blur-xl border-t border-white/[0.08] md:rounded-b-[24px] md:border md:border-white/[0.08] relative z-20">
        {messages.length <= 2 && (
          <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar">
            {SUGGESTIONS.map((sug, i) => (
              <button 
                key={i} 
                onClick={() => handleSend(sug)}
                className="whitespace-nowrap px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 transition-colors"
              >
                {sug}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend(input)}
            placeholder="Pergunte ao seu Coach..." 
            className="w-full bg-white/[0.02] border border-white/10 rounded-[16px] py-4 pl-4 pr-12 text-white focus:border-[#7c3aed] outline-none transition-all"
            disabled={isLoading}
          />
          <button 
            onClick={() => handleSend(input)}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#00ff88] text-[#0a0a0f] rounded-lg disabled:opacity-50 hover:scale-105 transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
