"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, Info, Play, Plus, Trash2, Loader2, Upload, Link as LinkIcon, Image as ImageIcon, Check } from 'lucide-react';
import { Exercise } from '@/lib/types';
import { getExercises, addExercise, deleteExercise } from '@/lib/db/exercises';
import { useAppContext } from '@/app/context/AppContext';

export default function Library() {
  const { profile } = useAppContext();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Add Exercise Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Bulk Import state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const bulkInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [newName, setNewName] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState('Peito');
  const [mediaType, setMediaType] = useState<'url' | 'upload'>('upload');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    setLoading(true);
    let dbExercises = await getExercises();
    setExercises(dbExercises);
    setLoading(false);
  };

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    
    setIsAdding(true);
    
    const newEx = await addExercise({
      name: newName,
      muscleGroup: newMuscleGroup,
      secondaryMuscles: [],
      equipment: 'Haltere',
      difficulty: 1,
      mediaUrl: mediaType === 'url' ? mediaUrl : undefined,
      instructions: [],
      commonMistakes: []
    }, mediaType === 'upload' ? mediaFile : null);

    if (newEx) {
      setExercises(prev => [...prev, newEx]);
      setIsAddModalOpen(false);
      // Reset form
      setNewName('');
      setMediaUrl('');
      setMediaFile(null);
    } else {
      alert("Erro ao adicionar exercício.");
    }
    
    setIsAdding(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Deseja realmente apagar este exercício?")) {
      const success = await deleteExercise(id);
      if (success) {
        setExercises(prev => prev.filter(ex => ex.id !== id));
      }
    }
  };

  const handleBulkSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Filter out system files or non media
      const files = Array.from(e.target.files).filter(f => 
        !f.name.startsWith('.') && 
        (f.type.startsWith('image/') || f.type.startsWith('video/'))
      );
      setBulkFiles(files);
      setIsBulkModalOpen(true);
      setBulkStatus('idle');
    }
    // reset input
    if (bulkInputRef.current) bulkInputRef.current.value = '';
  };

  const mapMuscleGroup = (folderName: string): string => {
    const normalized = folderName.toLowerCase();
    if (normalized.includes('peito')) return 'Peito';
    if (normalized.includes('costa')) return 'Costas';
    if (normalized.includes('ombro')) return 'Ombro';
    if (normalized.includes('bicep') || normalized.includes('bícep')) return 'Bíceps';
    if (normalized.includes('tricep') || normalized.includes('trícep')) return 'Tríceps';
    if (normalized.includes('perna') || normalized.includes('quad')) return 'Pernas (quadríceps)';
    if (normalized.includes('post') || normalized.includes('isquio')) return 'Posterior de coxa';
    if (normalized.includes('glut')) return 'Glúteos';
    if (normalized.includes('abdo') || normalized.includes('core')) return 'Core/Abdômen';
    if (normalized.includes('pantur')) return 'Panturrilhas';
    return 'Peito'; // default fallback
  };

  const executeBulkImport = async () => {
    setBulkStatus('uploading');
    setBulkProgress({ current: 0, total: bulkFiles.length });

    for (let i = 0; i < bulkFiles.length; i++) {
      const file = bulkFiles[i];
      const pathParts = file.webkitRelativePath.split('/');
      
      let folderName = 'Geral';
      if (pathParts.length >= 2) {
        folderName = pathParts[pathParts.length - 2];
      }
      
      const fileName = file.name;
      const exerciseName = fileName.replace(/\.[^/.]+$/, ""); // remove extension
      
      const muscleGroup = mapMuscleGroup(folderName);
      
      await addExercise({
        name: exerciseName,
        muscleGroup: muscleGroup,
        secondaryMuscles: [],
        equipment: 'Haltere',
        difficulty: 1,
        instructions: [],
        commonMistakes: []
      }, file);

      setBulkProgress({ current: i + 1, total: bulkFiles.length });
    }

    setBulkStatus('success');
    loadExercises(); // refresh all after done
  };

  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMuscle = selectedMuscle ? ex.muscleGroup === selectedMuscle : true;
    return matchesSearch && matchesMuscle;
  });

  const muscleGroups = Array.from(new Set(exercises.map(ex => ex.muscleGroup)));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-[#00ff88] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto animate-fade-in relative">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-outfit font-bold mb-4">Biblioteca de Exercícios</h1>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar exercício..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] outline-none transition-all"
              />
            </div>
            <select 
              value={selectedMuscle}
              onChange={e => setSelectedMuscle(e.target.value)}
              className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#00ff88] outline-none"
            >
              <option value="" className="bg-[#0a0a0f] text-white">Todos os Músculos</option>
              {muscleGroups.map(m => <option key={m} value={m} className="bg-[#0a0a0f] text-white">{m}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <input 
            type="file" 
            ref={bulkInputRef} 
            onChange={handleBulkSelect} 
            className="hidden" 
            // @ts-ignore
            webkitdirectory="true" 
            directory="true" 
          />
          <button 
            onClick={() => bulkInputRef.current?.click()}
            className="flex items-center gap-2 bg-white/5 border border-white/10 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-all whitespace-nowrap"
          >
            <Upload className="w-5 h-5" /> Importar Pasta
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-[#00ff88] text-black font-semibold px-6 py-3 rounded-xl hover:bg-[#00ff88]/90 transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)] whitespace-nowrap"
          >
            <Plus className="w-5 h-5" /> Novo Exercício
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExercises.map(ex => (
          <div key={ex.id} className="bg-white/[0.04] backdrop-blur-md p-5 rounded-[20px] border border-white/10 hover:bg-white/[0.06] transition-all cursor-pointer group relative" onClick={() => setSelectedExercise(ex)}>
            <div className="flex justify-between items-start mb-4">
              <span className="px-3 py-1 bg-[#00ff88]/20 text-[#00ff88] text-xs font-semibold rounded-full">{ex.muscleGroup}</span>
              
              {ex.userId && (
                <button 
                  onClick={(e) => handleDelete(e, ex.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <h3 className="font-outfit text-xl font-semibold mb-2 group-hover:text-[#00ff88] transition-colors pr-8">{ex.name}</h3>
            
            {ex.mediaUrl ? (
              <span className="text-xs text-blue-400 flex items-center gap-1 mt-3"><ImageIcon className="w-3 h-3"/> GIF Customizado</span>
            ) : ex.youtubeId ? (
              <span className="text-xs text-red-400 flex items-center gap-1 mt-3"><Play className="w-3 h-3"/> YouTube</span>
            ) : (
              <span className="text-xs text-gray-500 flex items-center gap-1 mt-3">Sem mídia</span>
            )}
          </div>
        ))}
      </div>

      {filteredExercises.length === 0 && (
        <div className="text-center py-20 text-gray-500">Nenhum exercício encontrado.</div>
      )}

      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0a0a0f] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-6 relative">
            {bulkStatus !== 'uploading' && (
              <button onClick={() => setIsBulkModalOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-all">✕</button>
            )}
            <h2 className="text-2xl font-outfit font-bold text-white mb-6">Importação em Massa</h2>
            
            {bulkStatus === 'idle' && (
              <>
                <p className="text-gray-300 mb-6">
                  Foram encontrados <strong className="text-[#00ff88]">{bulkFiles.length} arquivos</strong> de mídia.
                  Eles serão organizados automaticamente pelos nomes das subpastas e cadastrados no banco de dados.
                </p>
                
                <div className="bg-white/5 p-4 rounded-xl mb-6 max-h-40 overflow-y-auto">
                  <p className="text-xs text-gray-400 mb-2 font-bold uppercase">Exemplo de Leitura:</p>
                  {bulkFiles.slice(0, 3).map((f, i) => (
                    <div key={i} className="text-sm text-gray-300 truncate mb-1" title={f.webkitRelativePath}>
                      📄 {f.webkitRelativePath}
                    </div>
                  ))}
                  {bulkFiles.length > 3 && <div className="text-xs text-gray-500 mt-2 font-semibold">... e mais {bulkFiles.length - 3} arquivos</div>}
                </div>

                <button 
                  onClick={executeBulkImport}
                  className="w-full bg-[#00ff88] text-black font-bold py-3.5 rounded-xl hover:bg-[#00ff88]/90 transition-all flex justify-center items-center gap-2"
                >
                  <Play className="w-5 h-5" /> Iniciar Importação
                </button>
              </>
            )}

            {bulkStatus === 'uploading' && (
              <div className="text-center py-6">
                <Loader2 className="w-12 h-12 text-[#00ff88] animate-spin mx-auto mb-4" />
                <p className="text-white font-medium text-lg mb-2">Enviando arquivos...</p>
                <p className="text-gray-400 mb-4">{bulkProgress.current} de {bulkProgress.total} concluídos</p>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-[#00ff88] h-full transition-all duration-300" 
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {bulkStatus === 'success' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-[#00ff88]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-[#00ff88]" />
                </div>
                <p className="text-white font-medium text-xl mb-2">Importação Concluída!</p>
                <p className="text-gray-400 mb-6">Todos os exercícios foram adicionados à biblioteca.</p>
                <button 
                  onClick={() => setIsBulkModalOpen(false)}
                  className="w-full bg-white/10 text-white font-bold py-3.5 rounded-xl hover:bg-white/20 transition-all"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Exercise Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0a0a0f] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-6 relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-all">✕</button>
            <h2 className="text-2xl font-outfit font-bold text-white mb-6">Adicionar Exercício</h2>
            
            <form onSubmit={handleAddExercise} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome do Exercício</label>
                <input 
                  type="text" required
                  value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#00ff88] outline-none"
                  placeholder="Ex: Supino Reto Máquina"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Grupo Muscular Principal</label>
                <select 
                  value={newMuscleGroup} onChange={e => setNewMuscleGroup(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#00ff88] outline-none"
                >
                  <option value="Peito" className="bg-[#0a0a0f] text-white">Peito</option>
                  <option value="Costas" className="bg-[#0a0a0f] text-white">Costas</option>
                  <option value="Ombro" className="bg-[#0a0a0f] text-white">Ombro</option>
                  <option value="Bíceps" className="bg-[#0a0a0f] text-white">Bíceps</option>
                  <option value="Tríceps" className="bg-[#0a0a0f] text-white">Tríceps</option>
                  <option value="Pernas (quadríceps)" className="bg-[#0a0a0f] text-white">Pernas (quadríceps)</option>
                  <option value="Posterior de coxa" className="bg-[#0a0a0f] text-white">Posterior de coxa</option>
                  <option value="Glúteos" className="bg-[#0a0a0f] text-white">Glúteos</option>
                  <option value="Core/Abdômen" className="bg-[#0a0a0f] text-white">Core/Abdômen</option>
                  <option value="Panturrilhas" className="bg-[#0a0a0f] text-white">Panturrilhas</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="block text-sm text-gray-400 mb-2">Mídia do Exercício (GIF/Vídeo/Imagem)</label>
                <div className="flex bg-white/5 p-1 rounded-xl mb-4">
                  <button type="button" onClick={() => setMediaType('upload')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${mediaType === 'upload' ? 'bg-[#00ff88] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>
                    <Upload className="w-4 h-4" /> Upload
                  </button>
                  <button type="button" onClick={() => setMediaType('url')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${mediaType === 'url' ? 'bg-[#00ff88] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>
                    <LinkIcon className="w-4 h-4" /> Link URL
                  </button>
                </div>

                {mediaType === 'url' ? (
                  <input 
                    type="url" 
                    value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#00ff88] outline-none"
                    placeholder="https://exemplo.com/meu-gif.gif"
                  />
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed ${mediaFile ? 'border-[#00ff88] bg-[#00ff88]/5' : 'border-white/20 hover:border-white/40 hover:bg-white/5'} rounded-xl p-6 text-center cursor-pointer transition-all`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*,video/mp4" 
                      onChange={e => setMediaFile(e.target.files?.[0] || null)}
                    />
                    {mediaFile ? (
                      <div>
                        <ImageIcon className="w-8 h-8 text-[#00ff88] mx-auto mb-2" />
                        <p className="text-white font-medium text-sm">{mediaFile.name}</p>
                        <p className="text-gray-400 text-xs mt-1">{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-300 text-sm font-medium">Clique para selecionar</p>
                        <p className="text-gray-500 text-xs mt-1">GIF, MP4, JPG ou PNG (Máx. 10MB)</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                disabled={isAdding}
                className="w-full mt-6 bg-[#00ff88] text-black font-bold py-3.5 rounded-xl hover:bg-[#00ff88]/90 transition-all flex justify-center items-center gap-2"
              >
                {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Exercício'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* View Exercise Modal */}
      {selectedExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedExercise(null)}>
          <div className="bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-outfit font-bold text-white mb-2">{selectedExercise.name}</h2>
                  <span className="px-3 py-1 bg-[#00ff88]/20 text-[#00ff88] text-xs font-semibold rounded-full">{selectedExercise.muscleGroup}</span>
                </div>
                <button onClick={() => setSelectedExercise(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                  ✕
                </button>
              </div>

              <div className="aspect-video bg-black/50 rounded-xl mb-6 overflow-hidden relative group border border-white/5 flex items-center justify-center">
                {selectedExercise.mediaUrl ? (
                  selectedExercise.mediaUrl.endsWith('.mp4') ? (
                    <video src={selectedExercise.mediaUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={selectedExercise.mediaUrl} alt={selectedExercise.name} className="w-full h-full object-contain" />
                  )
                ) : selectedExercise.youtubeId ? (
                  <iframe 
                    width="100%" height="100%" 
                    src={`https://www.youtube.com/embed/${selectedExercise.youtubeId}?autoplay=1&mute=1`} 
                    title={selectedExercise.name} 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div className="text-gray-500 flex flex-col items-center">
                    <ImageIcon className="w-12 h-12 opacity-20 mb-2" />
                    <span className="text-sm">Nenhuma mídia cadastrada</span>
                  </div>
                )}
              </div>

              {selectedExercise.instructions && selectedExercise.instructions.length > 0 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[#00ff88] font-medium mb-2">Instruções</h4>
                    <ol className="list-decimal list-inside text-gray-300 space-y-2">
                      {selectedExercise.instructions.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
