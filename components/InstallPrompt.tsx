"use client";

import { useState, useEffect } from 'react';
import { Download, X, Share, MoreVertical } from 'lucide-react';

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
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

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Force show prompt after a few seconds only for iOS
    const timer = setTimeout(() => {
      if (isIosDevice) {
        setShowPrompt(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If clicked but no native prompt (e.g. HTTP LAN), we just rely on the manual instructions shown.
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
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
              ? "Para instalar: toque em Compartilhar e selecione 'Adicionar à Tela de Início'." 
              : deferredPrompt 
                ? "Instale o app para uma experiência mais rápida e em tela cheia!"
                : "Para instalar: toque no menu (três pontinhos) do navegador e selecione 'Adicionar à tela inicial'."}
          </p>
          
          {!isIOS && deferredPrompt && (
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

          {!isIOS && !deferredPrompt && (
            <div className="flex items-center justify-center gap-2 text-[#00ff88] bg-[#00ff88]/10 py-2 rounded-lg text-xs font-bold">
              <MoreVertical size={14} /> Menu do Navegador
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
