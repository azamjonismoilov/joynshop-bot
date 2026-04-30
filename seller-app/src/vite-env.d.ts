/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SELLER_BOT_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
