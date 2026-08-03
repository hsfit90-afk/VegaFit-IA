"use client";

import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Default true to prevent flash
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isAppInstalled);

    if (isAppInstalled) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // For iOS, we just show the prompt after a short delay since there's no install event
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // For Android/Chrome
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] bg-[#1a1a24] border border-[#00ff88]/30 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-5 md:hidden">
      <button 
        onClick={handleClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-white p-1"
      >
        <X size={18} />
      </button>
      
      <div className="flex items-start gap-4 pr-6">
        <div className="w-12 h-12 bg-gradient-to-br from-[#00ff88] to-[#7c3aed] rounded-xl flex-shrink-0 flex items-center justify-center p-0.5">
          <div className="w-full h-full bg-[#0a0a0f] rounded-[10px] flex items-center justify-center">
            <Download className="text-[#00ff88]" size={20} />
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-white font-bold text-sm mb-1">Instalar VegaFit IA</h3>
          <p className="text-gray-400 text-xs mb-3">
            {isIOS 
              ? "Para instalar: toque no ícone de Compartilhar abaixo e selecione 'Adicionar à Tela de Início'." 
              : "Instale o app para uma experiência mais rápida e em tela cheia!"}
          </p>
          
          {!isIOS && (
            <button 
              onClick={handleInstallClick}
              className="bg-[#00ff88] text-[#0a0a0f] text-xs font-bold px-4 py-2 rounded-lg w-full"
            >
              Instalar Aplicativo
            </button>
          )}
          
          {isIOS && (
            <div className="flex items-center justify-center gap-2 text-[#00ff88] bg-[#00ff88]/10 py-2 rounded-lg text-xs font-bold">
              <Share size={14} /> Ícone de Compartilhar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
