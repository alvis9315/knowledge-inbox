import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

// ESLint flat config:vue 推薦組 + ts 推薦組 + 專案自訂規則。
// 函式宣告規範(AGENTS.md 程式風格):一律 const + arrow function。
export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '*.d.ts'] },
  ...pluginVue.configs['flat/recommended'],
  ...tseslint.configs.recommended,
  {
    // tseslint recommended 會把 parser 蓋成 TS parser;.vue 要拿回 vue parser,
    // <script> 區塊再交給 TS parser 解析。
    files: ['**/*.vue'],
    languageOptions: { parser: vueParser, parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // 函式一律 const + arrow(理由見 AGENTS.md 程式風格)
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],
      'prefer-arrow-callback': 'error',
      // 單字元件名是既有慣例(HomeView 等 view 已多字;共用元件不強制)
      'vue/multi-word-component-names': 'off',
      // WebGL/第三方互動處已審核的 any 用行內 disable 標記,其餘警告
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true },
      ],
      // 控制面板模式:panel 直接編輯傳入的 reactive config(deep 寫入是設計);
      // 只禁「整顆 prop 重新賦值」。
      'vue/no-mutating-props': ['error', { shallowOnly: true }],
      // 排版類規則交給編輯器/formatter,不進 lint(避免 900+ 噪音)。
      'vue/max-attributes-per-line': 'off',
      'vue/html-indent': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/attributes-order': 'off',
      // TS optional props 已表達預設語意,不強制 withDefaults 全填。
      'vue/require-default-prop': 'off',
    },
  },
)
