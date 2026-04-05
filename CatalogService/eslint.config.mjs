import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import * as importPlugin from "eslint-plugin-import";

export default tseslint.config(
  // 基本的な推奨設定を適用
  eslint.configs.recommended,
  // TypeScript推奨設定（パーサーとプラグインが自動で設定される）
  ...tseslint.configs.recommended,

  {
    // TypeScriptファイルの設定
    files: ["**/*.ts"],
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {},
      },
    },
  },
);
