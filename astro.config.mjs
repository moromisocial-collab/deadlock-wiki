// @ts-check
import { defineConfig } from "astro/config";

// GitHub Pages 用。リポジトリ名のサブパスで配信するため base を指定する。
// 独自ドメインに移す場合は base を "/" に戻す。
export default defineConfig({
  site: "https://moromisocial-collab.github.io",
  base: "/deadlock-wiki",
  trailingSlash: "always",
  build: { format: "directory" },
});
