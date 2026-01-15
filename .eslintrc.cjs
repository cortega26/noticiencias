module.exports = {
    ignorePatterns: ["dist", "_site", "node_modules", "coverage"],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "astro", "security", "no-secrets"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:astro/recommended",
    ],
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
    },
    env: {
        node: true,
        browser: true,
        es2020: true,
    },
    rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                argsIgnorePattern: "^_",
            },
        ],
        "security/detect-object-injection": "off",
        "no-secrets/no-secrets": "error",
    },
    overrides: [
        {
            files: ["*.astro"],
            parser: "astro-eslint-parser",
            parserOptions: {
                parser: "@typescript-eslint/parser",
                extraFileExtensions: [".astro"],
            },
        },
    ],
};
