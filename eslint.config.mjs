import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
    extends: [...next],
    rules: {
        // Regras de "React Compiler readiness" (eslint-config-next 16, projeto está no Next 15
        // sem React Compiler habilitado). Pegam padrões legítimos e necessários no código atual
        // (relógio "now" reativo, sincronizar profile assíncrono do Supabase no form) que exigiriam
        // redesenho de estado em várias telas para satisfazer — não vale o risco agora.
        "react-hooks/purity": "off",
        "react-hooks/set-state-in-effect": "off",
    },
}]);
