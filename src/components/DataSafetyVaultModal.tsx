import React, { useState, useEffect } from "react";
import { useSstrData } from "../context/SstrDataContext";
import { SafetySnapshotMeta } from "../utils/indexedDbCache";
import { HISTORICAL_RECORDS_JAN_JUL_2026 } from "../data/historicalRecordsJul2026";
import { ImportBatch } from "../types";
import { 
  ShieldCheck, 
  HardDrive, 
  Download, 
  Upload, 
  Clock, 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  FileJson, 
  Layers, 
  History, 
  Lock,
  ArrowRight,
  ShieldAlert,
  RotateCcw
} from "lucide-react";

interface DataSafetyVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataSafetyVaultModal: React.FC<DataSafetyVaultModalProps> = ({ isOpen, onClose }) => {
  const { 
    records, 
    pendingRequests, 
    vales, 
    batches, 
    products, 
    managers, 
    createSafetySnapshot, 
    restoreSafetySnapshot, 
    listSafetySnapshots,
    exportDatabaseBackup,
    importDatabaseBackup,
    saveRecordsAndBatches
  } = useSstrData();

  const [snapshots, setSnapshots] = useState<SafetySnapshotMeta[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotSuccessMsg, setSnapshotSuccessMsg] = useState<string | null>(null);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  // Import file ref
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const list = await listSafetySnapshots();
      setSnapshots(list);
    } catch (e) {
      console.error("Erro ao carregar snapshots do cofre:", e);
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateManualSnapshot = async () => {
    setIsCreatingSnapshot(true);
    try {
      const snap = await createSafetySnapshot("Ponto de Restauração Criado Manualmente");
      if (snap) {
        setSnapshotSuccessMsg(`Snapshot "${snap.id}" criado com sucesso!`);
        await loadSnapshots();
        setTimeout(() => setSnapshotSuccessMsg(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleExecuteRestore = async (id: string) => {
    setRestoringSnapshotId(id);
    try {
      const success = await restoreSafetySnapshot(id);
      if (success) {
        alert("✅ Restauração Concluída!\n\nTodos os dados da plataforma foram restaurados com sucesso a partir do ponto selecionado no Cofre de Segurança.");
        setConfirmRestoreId(null);
        await loadSnapshots();
      } else {
        alert("❌ Falha na restauração. Por favor tente outro ponto do cofre.");
      }
    } finally {
      setRestoringSnapshotId(null);
    }
  };

  const handleDownloadBackupFile = () => {
    try {
      const json = exportDatabaseBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `SSTR_BACKUP_TOTAL_SEGURO_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Erro ao exportar backup:", e);
      alert("Erro ao gerar arquivo de backup.");
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("⚠️ ATENÇÃO: Deseja importar este arquivo de backup?\n\nO sistema criará automaticamente um snapshot prévio do estado atual antes de carregar o arquivo.")) {
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = await importDatabaseBackup(content);
        if (ok) {
          alert("✅ Banco de Dados Restaurado com Sucesso a partir do arquivo importado!");
          await loadSnapshots();
        } else {
          alert("❌ O arquivo selecionado não contém um formato de backup SSTR válido.");
        }
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleResetToOfficialBaseline = async () => {
    if (!window.confirm("⚠️ Deseja redefinir a base para a Base Padrão Oficial do Studio (342 solicitações e 2 duplicatas)?\n\nUm ponto de restauração de segurança automático será salvo antes da operação para garantir zero perda de dados.")) {
      return;
    }
    await createSafetySnapshot("Backup pré-alinhamento com Base Oficial 342");
    const defaultBatch: ImportBatch = {
      id: "batch_default_hist",
      timestamp: Date.now(),
      fileName: "Base Promax 03.18.05 (Jan-Jul 2026 Congelada)",
      recordCount: HISTORICAL_RECORDS_JAN_JUL_2026.length,
      totalValue: HISTORICAL_RECORDS_JAN_JUL_2026.reduce((acc, r) => acc + (r.valorTotal || 0), 0)
    };
    await saveRecordsAndBatches(HISTORICAL_RECORDS_JAN_JUL_2026, [defaultBatch], "overwrite");
    setSnapshotSuccessMsg("✅ Base redefinida com sucesso para o padrão oficial do Studio (342 solicitações e 2 duplicatas)!");
    await loadSnapshots();
    setTimeout(() => setSnapshotSuccessMsg(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Cofre de Blindagem & Prevenção de Perdas</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PROTEÇÃO 100% ATIVA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Garantia permanente de preservação de dados: espelhamento em dois níveis, cofre de snapshots e fila offline.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Protection Pillars Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                <HardDrive className="w-4 h-4" />
                <span>Espelhamento Duplo (IDB + Local)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Todas as alterações são gravadas no localStorage e espelhadas em segundo plano no IndexedDB ilimitado.
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs mb-1">
                <Layers className="w-4 h-4" />
                <span>Mesclagem Sem Sobrescrita</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Novos registros criados em campo nunca são apagados ao receber atualizações da nuvem Firestore.
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
                <History className="w-4 h-4" />
                <span>Snapshots Automáticos</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Pontos de restauração são criados a cada 10 minutos e antes de qualquer importação de lotes.
              </p>
            </div>
          </div>

          {/* Current Live Database Stats */}
          <div className="bg-slate-850/50 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Base Consolidada</span>
                <span className="text-base font-bold font-mono text-white">{records.length.toLocaleString("pt-BR")} itens</span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Solicitações & Vales</span>
                <span className="text-base font-bold font-mono text-cyan-400">{(pendingRequests.length + vales.length).toLocaleString("pt-BR")} registros</span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Catálogo de SKUs</span>
                <span className="text-base font-bold font-mono text-emerald-400">{products.length.toLocaleString("pt-BR")} produtos</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateManualSnapshot}
                disabled={isCreatingSnapshot}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isCreatingSnapshot ? "Salvando Snapshot..." : "Criar Snapshot Manual"}</span>
              </button>

              <button
                onClick={handleDownloadBackupFile}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 border border-slate-700"
                title="Baixar arquivo JSON completo com todos os dados"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>Exportar Backup (.json)</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept=".json"
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 border border-slate-700"
                title="Restaurar de arquivo .json salvo anteriormente"
              >
                <Upload className="w-4 h-4 text-purple-400" />
                <span>Restaurar de Arquivo</span>
              </button>

              <button
                onClick={handleResetToOfficialBaseline}
                className="px-3.5 py-2 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                title="Redefine a base para a Base Oficial do Studio (342 solicitações / 2 duplicatas)"
              >
                <RotateCcw className="w-4 h-4 text-indigo-400" />
                <span>Restaurar Base Padrão Oficial (342)</span>
              </button>
            </div>
          </div>

          {snapshotSuccessMsg && (
            <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{snapshotSuccessMsg}</span>
            </div>
          )}

          {/* Snapshots Vault History List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Pontos de Restauração no Cofre Local ({snapshots.length})
                </h3>
              </div>
              <button
                onClick={loadSnapshots}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSnapshots ? "animate-spin" : ""}`} />
                <span>Atualizar</span>
              </button>
            </div>

            {snapshots.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-8 text-center text-slate-400 text-xs">
                Nenhum snapshot registrado ainda. O sistema cria automaticamente a cada 10 minutos ou você pode clicar em "Criar Snapshot Manual".
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {snapshots.map((snap) => {
                  const isConfirming = confirmRestoreId === snap.id;
                  const isRestoring = restoringSnapshotId === snap.id;

                  return (
                    <div
                      key={snap.id}
                      className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white font-mono">{snap.dateStr}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-850 text-slate-300 border border-slate-750">
                              {snap.reason}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                            <span>Base: <strong>{snap.summary.recordsCount}</strong> trocas</span>
                            <span>•</span>
                            <span>Solicitações: <strong>{snap.summary.pendingCount}</strong></span>
                            <span>•</span>
                            <span>Vales: <strong>{snap.summary.valesCount}</strong></span>
                            <span>•</span>
                            <span>SKUs: <strong>{snap.summary.productsCount}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {isConfirming ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleExecuteRestore(snap.id)}
                              disabled={isRestoring}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md"
                            >
                              {isRestoring ? "Restaurando..." : "Confirmar Restauração"}
                            </button>
                            <button
                              onClick={() => setConfirmRestoreId(null)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs rounded-xl cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRestoreId(snap.id)}
                            className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 text-xs font-medium rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Restaurar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Blindagem Ativa: Todas as trocas, solicitações, faturamento e tabelas estão permanentemente seguras.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Fechar Cofre
          </button>
        </div>

      </div>
    </div>
  );
};
