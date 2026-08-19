"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, Info, Play, Plus, Trash2, Loader2, Upload, Link as LinkIcon, Image as ImageIcon, Check } from 'lucide-react';
import { Exercise } from '@/lib/types';
import { getExercises, addExercise, deleteExercise, updateExerciseMuscleGroup } from '@/lib/db/exercises';
import { useAppContext } from '@/app/context/AppContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const MUSCLE_GROUP_OPTIONS = [
  'Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Antebraço', 'Pernas (quadríceps)',
  'Posterior de coxa', 'Glúteos', 'Lombar', 'Core/Abdômen', 'Panturrilhas', 'Cardio', 'Outros',
];

export default function Library() {
  const { profile } = useAppContext();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [editingMuscleGroup, setEditingMuscleGroup] = useState(false);
  const [editMuscleGroupValue, setEditMuscleGroupValue] = useState('');
  const [customEditMuscleGroup, setCustomEditMuscleGroup] = useState('');
  const [isSavingMuscleGroup, setIsSavingMuscleGroup] = useState(false);

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
  const [customNewMuscleGroup, setCustomNewMuscleGroup] = useState('');
  const [mediaType, setMediaType] = useState<'url' | 'upload'>('upload');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadExercises = async () => {
    setLoading(true);
    let dbExercises = await getExercises();
    setExercises(dbExercises);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedExercise) {
      setEditMuscleGroupValue(selectedExercise.muscleGroup);
      setCustomEditMuscleGroup('');
      setEditingMuscleGroup(false);
    }
  }, [selectedExercise]);

  const handleSaveMuscleGroup = async () => {
    if (!selectedExercise) return;
    const finalMuscleGroup = editMuscleGroupValue === '__custom__' ? customEditMuscleGroup.trim() : editMuscleGroupValue;
    if (!finalMuscleGroup) {
      alert("Digite o nome da nova categoria.");
      return;
    }
    setIsSavingMuscleGroup(true);
    const success = await updateExerciseMuscleGroup(selectedExercise.id, finalMuscleGroup);
    if (success) {
      setExercises(prev => prev.map(ex => ex.id === selectedExercise.id ? { ...ex, muscleGroup: finalMuscleGroup } : ex));
      setSelectedExercise(prev => prev ? { ...prev, muscleGroup: finalMuscleGroup } : prev);
      setEditingMuscleGroup(false);
    } else {
      alert("Não foi possível atualizar o grupo muscular. Verifique se a regra de permissão do Master (database/17_exercises_master_update.sql) já foi aplicada no Supabase.");
    }
    setIsSavingMuscleGroup(false);
  };

  useEffect(() => {
    loadExercises();
  }, []);

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const finalMuscleGroup = newMuscleGroup === '__custom__' ? customNewMuscleGroup.trim() : newMuscleGroup;
    if (!finalMuscleGroup) {
      alert("Digite o nome da nova categoria.");
      return;
    }

    setIsAdding(true);

    const newEx = await addExercise({
      name: newName,
      muscleGroup: finalMuscleGroup,
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
      setCustomNewMuscleGroup('');
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
      } else {
        alert("Não foi possível apagar o exercício. Verifique se a regra de permissão do Master (database/16_exercises_master_delete.sql) já foi aplicada no Supabase.");
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
    if (normalized.includes('antebra') || normalized.includes('punho') || normalized.includes('grip') || normalized.includes('pulso')) return 'Antebraço';
    if (normalized.includes('lombar') || normalized.includes('hiperextens')) return 'Lombar';
    if (normalized.includes('cardio') || normalized.includes('bike') || normalized.includes('bicicleta') ||
        normalized.includes('esteira') || normalized.includes('corrida') || normalized.includes('eliptic') ||
        normalized.includes('elíptic') || normalized.includes('remo') || normalized.includes('escada') ||
        normalized.includes('step') || normalized.includes('spinning') || normalized.includes('aerob')) return 'Cardio';
    // BUG FIX: o fallback era 'Peito', então qualquer pasta que não batesse com nenhuma palavra-chave
    // acima (ex: exercícios de cardio antes de existir a categoria) virava "Peito" silenciosamente.
    // 'Outros' deixa a classificação errada visível em vez de se misturar com um grupo muscular real.
    return 'Outros';
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
  // Inclui categorias customizadas que já foram criadas (por "+ Nova categoria...") além das fixas,
  // pra não obrigar redigitar o mesmo nome toda vez que for editar outro exercício.
  const allMuscleGroupOptions = Array.from(new Set([...MUSCLE_GROUP_OPTIONS, ...muscleGroups])).sort();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (profile && profile.role !== 'master' && profile.role !== 'trainer') {
    return (
      <div className="flex flex-col h-full items-center justify-center min-h-[50vh] text-center px-4">
        <h2 className="text-2xl font-outfit font-bold mb-2 text-white">Acesso Restrito</h2>
        <p className="text-foreground-muted">Apenas o Master e os Treinadores podem gerenciar a biblioteca de exercícios.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto animate-fade-in relative pb-32">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-outfit font-bold mb-4">Biblioteca de Exercícios</h1>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar exercício..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl py-3 pl-10 pr-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
            <select 
              value={selectedMuscle}
              onChange={e => setSelectedMuscle(e.target.value)}
              className="bg-surface border border-border rounded-xl py-3 px-4 text-white focus:border-primary outline-none"
            >
              <option value="" className="bg-background text-white">Todos os Músculos</option>
              {muscleGroups.map(m => <option key={m} value={m} className="bg-background text-white">{m}</option>)}
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
          <Button 
            onClick={() => bulkInputRef.current?.click()}
            variant="outline"
          >
            <Upload className="w-4 h-4 mr-2" /> Importar Pasta
          </Button>
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="shadow-[0_0_20px_rgba(0,255,136,0.2)]"
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Exercício
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExercises.map(ex => (
          <Card key={ex.id} variant="glass" className="cursor-pointer group hover:border-primary/50 transition-all" onClick={() => setSelectedExercise(ex)}>
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full">{ex.muscleGroup}</span>
                
                {profile?.role === 'master' && (
                  <button
                    onClick={(e) => handleDelete(e, ex.id)}
                    className="p-1.5 text-foreground-muted hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <h3 className="font-outfit text-xl font-semibold mb-2 group-hover:text-primary transition-colors pr-8">{ex.name}</h3>
              
              {ex.mediaUrl ? (
                <span className="text-xs text-blue-400 flex items-center gap-1 mt-3"><ImageIcon className="w-3 h-3"/> GIF Customizado</span>
              ) : ex.youtubeId ? (
                <span className="text-xs text-red-400 flex items-center gap-1 mt-3"><Play className="w-3 h-3"/> YouTube</span>
              ) : (
                <span className="text-xs text-foreground-muted flex items-center gap-1 mt-3">Sem mídia</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredExercises.length === 0 && (
        <Card className="text-center py-20 border-dashed border-2">
           <CardContent className="flex flex-col items-center">
             <Search className="w-16 h-16 text-foreground-muted mx-auto mb-4 opacity-50" />
             <h2 className="text-xl font-outfit text-foreground-muted">Nenhum exercício encontrado.</h2>
           </CardContent>
         </Card>
      )}

      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md shadow-2xl relative border-primary/30">
            {bulkStatus !== 'uploading' && (
              <button onClick={() => setIsBulkModalOpen(false)} className="absolute top-4 right-4 p-2 text-foreground-muted hover:text-white transition-all">✕</button>
            )}
            <CardContent className="p-6">
              <h2 className="text-2xl font-outfit font-bold text-white mb-6">Importação em Massa</h2>
              
              {bulkStatus === 'idle' && (
                <>
                  <p className="text-gray-300 mb-6">
                    Foram encontrados <strong className="text-primary">{bulkFiles.length} arquivos</strong> de mídia.
                    Eles serão organizados automaticamente pelos nomes das subpastas e cadastrados no banco de dados.
                  </p>
                  
                  <div className="bg-surface p-4 rounded-xl mb-6 max-h-40 overflow-y-auto border border-border">
                    <p className="text-xs text-foreground-muted mb-2 font-bold uppercase">Exemplo de Leitura:</p>
                    {bulkFiles.slice(0, 3).map((f, i) => (
                      <div key={i} className="text-sm text-gray-300 truncate mb-1" title={f.webkitRelativePath}>
                        📄 {f.webkitRelativePath}
                      </div>
                    ))}
                    {bulkFiles.length > 3 && <div className="text-xs text-foreground-muted mt-2 font-semibold">... e mais {bulkFiles.length - 3} arquivos</div>}
                  </div>
  
                  <Button 
                    onClick={executeBulkImport}
                    fullWidth
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" /> Iniciar Importação
                  </Button>
                </>
              )}
  
              {bulkStatus === 'uploading' && (
                <div className="text-center py-6">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                  <p className="text-white font-medium text-lg mb-2">Enviando arquivos...</p>
                  <p className="text-foreground-muted mb-4">{bulkProgress.current} de {bulkProgress.total} concluídos</p>
                  <div className="w-full bg-surface rounded-full h-3 overflow-hidden border border-border">
                    <div 
                      className="bg-primary h-full transition-all duration-300" 
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
  
              {bulkStatus === 'success' && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-white font-medium text-xl mb-2">Importação Concluída!</p>
                  <p className="text-foreground-muted mb-6">Todos os exercícios foram adicionados à biblioteca.</p>
                  <Button 
                    onClick={() => setIsBulkModalOpen(false)}
                    variant="outline"
                    fullWidth
                  >
                    Fechar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Exercise Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md shadow-2xl relative border-primary/30">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 p-2 text-foreground-muted hover:text-white transition-all">✕</button>
            <CardContent className="p-6">
              <h2 className="text-2xl font-outfit font-bold text-white mb-6">Adicionar Exercício</h2>
              
              <form onSubmit={handleAddExercise} className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Nome do Exercício</label>
                  <input 
                    type="text" required
                    value={newName} onChange={e => setNewName(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-white focus:border-primary outline-none"
                    placeholder="Ex: Supino Reto Máquina"
                  />
                </div>
  
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Grupo Muscular Principal</label>
                  <select 
                    value={newMuscleGroup} onChange={e => setNewMuscleGroup(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-white focus:border-primary outline-none"
                  >
                    <option value="Peito" className="bg-background text-white">Peito</option>
                    <option value="Costas" className="bg-background text-white">Costas</option>
                    <option value="Ombro" className="bg-background text-white">Ombro</option>
                    <option value="Bíceps" className="bg-background text-white">Bíceps</option>
                    <option value="Tríceps" className="bg-background text-white">Tríceps</option>
                    <option value="Antebraço" className="bg-background text-white">Antebraço</option>
                    <option value="Pernas (quadríceps)" className="bg-background text-white">Pernas (quadríceps)</option>
                    <option value="Posterior de coxa" className="bg-background text-white">Posterior de coxa</option>
                    <option value="Glúteos" className="bg-background text-white">Glúteos</option>
                    <option value="Lombar" className="bg-background text-white">Lombar</option>
                    <option value="Core/Abdômen" className="bg-background text-white">Core/Abdômen</option>
                    <option value="Panturrilhas" className="bg-background text-white">Panturrilhas</option>
                    <option value="Cardio" className="bg-background text-white">Cardio</option>
                    <option value="Outros" className="bg-background text-white">Outros</option>
                    <option value="__custom__" className="bg-background text-white">+ Nova categoria...</option>
                  </select>
                  {newMuscleGroup === '__custom__' && (
                    <input
                      type="text" required autoFocus
                      value={customNewMuscleGroup} onChange={e => setCustomNewMuscleGroup(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-white focus:border-primary outline-none mt-2"
                      placeholder="Nome da nova categoria (ex: Mobilidade)"
                    />
                  )}
                </div>
  
                <div className="pt-2">
                  <label className="block text-sm text-foreground-muted mb-2">Mídia do Exercício (GIF/Vídeo/Imagem)</label>
                  <div className="flex bg-surface p-1 rounded-xl mb-4 border border-border">
                    <button type="button" onClick={() => setMediaType('upload')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${mediaType === 'upload' ? 'bg-primary text-black shadow-md' : 'text-foreground-muted hover:text-white'}`}>
                      <Upload className="w-4 h-4" /> Upload
                    </button>
                    <button type="button" onClick={() => setMediaType('url')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${mediaType === 'url' ? 'bg-primary text-black shadow-md' : 'text-foreground-muted hover:text-white'}`}>
                      <LinkIcon className="w-4 h-4" /> Link URL
                    </button>
                  </div>
  
                  {mediaType === 'url' ? (
                    <input 
                      type="url" 
                      value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-white focus:border-primary outline-none"
                      placeholder="https://exemplo.com/meu-gif.gif"
                    />
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed ${mediaFile ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-white/5'} rounded-xl p-6 text-center cursor-pointer transition-all`}
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
                          <ImageIcon className="w-8 h-8 text-primary mx-auto mb-2" />
                          <p className="text-white font-medium text-sm">{mediaFile.name}</p>
                          <p className="text-foreground-muted text-xs mt-1">{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
                          <p className="text-gray-300 text-sm font-medium">Clique para selecionar</p>
                          <p className="text-foreground-muted text-xs mt-1">GIF, MP4, JPG ou PNG (Máx. 10MB)</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
  
                <Button 
                  type="submit" 
                  disabled={isAdding}
                  fullWidth
                  className="mt-6"
                >
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  {isAdding ? 'Salvando...' : 'Salvar Exercício'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Exercise Modal */}
      {selectedExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedExercise(null)}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative border-primary/30" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <CardContent className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-outfit font-bold text-white mb-2">{selectedExercise.name}</h2>
                  {profile?.role === 'master' && editingMuscleGroup ? (
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={editMuscleGroupValue}
                          onChange={e => setEditMuscleGroupValue(e.target.value)}
                          className="bg-surface border border-border rounded-lg py-1 px-2 text-xs text-white focus:border-primary outline-none"
                        >
                          {allMuscleGroupOptions.map(m => <option key={m} value={m} className="bg-background text-white">{m}</option>)}
                          <option value="__custom__" className="bg-background text-white">+ Nova categoria...</option>
                        </select>
                        <button
                          onClick={handleSaveMuscleGroup}
                          disabled={isSavingMuscleGroup}
                          className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                        >
                          {isSavingMuscleGroup ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button onClick={() => setEditingMuscleGroup(false)} className="text-xs text-foreground-muted hover:text-white">
                          Cancelar
                        </button>
                      </div>
                      {editMuscleGroupValue === '__custom__' && (
                        <input
                          type="text" autoFocus
                          value={customEditMuscleGroup} onChange={e => setCustomEditMuscleGroup(e.target.value)}
                          className="bg-surface border border-border rounded-lg py-1 px-2 text-xs text-white focus:border-primary outline-none"
                          placeholder="Nome da nova categoria"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full">{selectedExercise.muscleGroup}</span>
                      {profile?.role === 'master' && (
                        <button onClick={() => setEditingMuscleGroup(true)} className="text-xs text-foreground-muted hover:text-primary underline">
                          Editar
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => setSelectedExercise(null)} className="p-2 bg-surface rounded-full hover:bg-white/10 text-foreground-muted hover:text-white transition-all">
                  ✕
                </button>
              </div>
  
              <div className="aspect-video bg-black/50 rounded-xl mb-6 overflow-hidden relative group border border-border flex items-center justify-center">
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
                  <div className="text-foreground-muted flex flex-col items-center">
                    <ImageIcon className="w-12 h-12 opacity-20 mb-2" />
                    <span className="text-sm">Nenhuma mídia cadastrada</span>
                  </div>
                )}
              </div>
  
              {selectedExercise.instructions && selectedExercise.instructions.length > 0 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-primary font-medium mb-2">Instruções</h4>
                    <ol className="list-decimal list-inside text-gray-300 space-y-2">
                      {selectedExercise.instructions.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
