import js from '@eslint/js';

export default [
    {
        ignores: [
            'node_modules/**',
            'lib/**',
            '*.min.js',
            'content/sidebar-backup-*.js',
            'content/sidebar-before-slimming.js',
            'content/sidebar-pre-bindevents.js'
        ]
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                chrome: 'readonly',
                navigator: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                fetch: 'readonly',
                location: 'readonly',

                // DOM APIs
                Node: 'readonly',
                NodeFilter: 'readonly',
                Event: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                Blob: 'readonly',
                ClipboardItem: 'readonly',
                MutationObserver: 'readonly',

                // Extension specific globals
                globalThis: 'readonly',

                // Project-specific globals (defined by loaded scripts, allow redeclaration)
                BasePlatformAdapter: 'writable',
                PlatformAdapterFactory: 'writable',
                getSiteConfig: 'writable',
            }
        },
        rules: {
            // Possible Problems
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-redeclare': 'off', // Disable to allow defining globals that are also declared in config

            // Code Quality
            'complexity': ['warn', { max: 15 }],
            'max-depth': ['warn', { max: 4 }],
            'max-lines': ['warn', { max: 800, skipBlankLines: true, skipComments: true }],
            'max-params': ['warn', { max: 5 }],

            // Stylistic
            'no-console': 'off', // Allow console in extension
            'prefer-const': 'warn',
            'no-useless-assignment': 'warn',
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            sourceType: 'module',
        }
    },
    {
        files: ['eslint.config.js'],
        languageOptions: {
            sourceType: 'module',
        }
    }
];
