import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypeScript,
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", "data/**", "docs/**"]
  }
];

export default config;
