import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  writeBatch 
} from "firebase/firestore";

// Configuração do Banco de Origem (Atual)
const originConfig = {
  projectId: "gen-lang-client-0624437496",
  appId: "1:701304893920:web:6c8b495653137d60357b85",
  apiKey: "AIzaSyAOVHg58KWp798onwm4Elx4gB_SCQDeJFo",
  authDomain: "gen-lang-client-0624437496.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-trocasereposieso-ac982826-306a-4b07-b343-d8dbff628ade",
  storageBucket: "gen-lang-client-0624437496.firebasestorage.app",
  messagingSenderId: "701304893920"
};

// Configuração do Banco de Destino (Novo)
const targetConfig = {
  apiKey: "AIzaSyC8Xkvh4Nj-VjzzDwqSNjefu3a79Y6ti2A",
  authDomain: "retorno-de-rota-pau-brasil.firebaseapp.com",
  projectId: "retorno-de-rota-pau-brasil",
  storageBucket: "retorno-de-rota-pau-brasil.firebasestorage.app",
  messagingSenderId: "792483558739",
  appId: "1:792483558739:web:1bcaba10d2038d7a6ddda6",
  measurementId: "G-FTGZF84NKM"
};

const COLLECTIONS_TO_MIGRATE = [
  "managers",
  "pendingRequests",
  "vales",
  "crewList",
  "repsSetor",
  "motoristasRotas",
  "products",
  "exchangeRecords",
  "exchangeRecords_chunks",
  "batches",
  "customPdvs",
  "sstr_logs",
  "sstr_state"
];

async function runDirectCloudMigration() {
  console.log("==========================================================");
  console.log("INICIANDO MIGRAÇÃO DIRETA NUVEM-PARA-NUVEM DO FIRESTORE");
  console.log(`Origem : ${originConfig.projectId} (${originConfig.firestoreDatabaseId})`);
  console.log(`Destino: ${targetConfig.projectId}`);
  console.log("==========================================================\n");

  const originApp = initializeApp(originConfig, "originApp_" + Date.now());
  const originDb = getFirestore(originApp, originConfig.firestoreDatabaseId);

  const targetApp = initializeApp(targetConfig, "targetApp_" + Date.now());
  const targetDb = getFirestore(targetApp);

  const migrationSummary: Record<string, { read: number; written: number; error?: string }> = {};

  for (const colName of COLLECTIONS_TO_MIGRATE) {
    console.log(`\n🔍 Verificando coleção: [${colName}] na nuvem de origem...`);
    try {
      const originColRef = collection(originDb, colName);
      const snapshot = await getDocs(originColRef);

      const docsCount = snapshot.size;
      console.log(`   Encontrados ${docsCount} documento(s) em [${colName}].`);

      if (docsCount === 0) {
        migrationSummary[colName] = { read: 0, written: 0 };
        continue;
      }

      console.log(`   🚀 Transferindo ${docsCount} documento(s) para o banco de destino...`);
      let writtenCount = 0;

      // Escrita em batches de até 200 documentos para alta performance e segurança
      let batch = writeBatch(targetDb);
      let batchCounter = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const docRef = doc(targetDb, colName, docSnap.id);
        batch.set(docRef, data, { merge: true });
        batchCounter++;
        writtenCount++;

        if (batchCounter >= 200) {
          await batch.commit();
          console.log(`   -> Gravados ${writtenCount}/${docsCount}...`);
          batch = writeBatch(targetDb);
          batchCounter = 0;
        }
      }

      if (batchCounter > 0) {
        await batch.commit();
      }

      console.log(`   ✅ Concluído [${colName}]: ${writtenCount}/${docsCount} gravados com sucesso.`);
      migrationSummary[colName] = { read: docsCount, written: writtenCount };
    } catch (err: any) {
      console.error(`   ❌ Erro ao migrar [${colName}]:`, err?.message || err);
      migrationSummary[colName] = { read: -1, written: 0, error: err?.message || String(err) };
    }
  }

  console.log("\n==========================================================");
  console.log("RELATÓRIO DE AUDITORIA DA MIGRAÇÃO");
  console.log("==========================================================");
  let totalDocs = 0;
  for (const [col, stats] of Object.entries(migrationSummary)) {
    if (stats.error) {
      console.log(`- ${col.padEnd(25)}: ERRO (${stats.error})`);
    } else {
      console.log(`- ${col.padEnd(25)}: ${stats.written} transferido(s) de ${stats.read}`);
      totalDocs += stats.written;
    }
  }
  console.log("----------------------------------------------------------");
  console.log(`TOTAL DE DOCUMENTOS MIGRADOS COM SUCESSO: ${totalDocs}`);
  console.log("==========================================================\n");

  return { success: true, totalDocs, summary: migrationSummary };
}

runDirectCloudMigration()
  .then((res) => {
    console.log("Processo finalizado:", res.success ? "SUCESSO" : "FALHA");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Falha fatal na migração:", err);
    process.exit(1);
  });
