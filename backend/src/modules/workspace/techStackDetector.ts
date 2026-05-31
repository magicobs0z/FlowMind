import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../../utils/logger';
import type { TechStackInfo } from './types';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const FRONTEND_LIBS: Record<string, string> = {
  react: 'React',
  'react-dom': 'React DOM',
  vue: 'Vue',
  'vue-router': 'Vue Router',
  vuex: 'Vuex',
  pinia: 'Pinia',
  svelte: 'Svelte',
  preact: 'Preact',
  lit: 'Lit',
  alpinejs: 'Alpine.js',
  '@angular/core': 'Angular',
  jquery: 'jQuery',
  next: 'Next.js',
  nuxt: 'Nuxt',
  'solid-js': 'Solid',
};

const BACKEND_LIBS: Record<string, string> = {
  express: 'Express',
  'fastify': 'Fastify',
  koa: 'Koa',
  hapi: 'Hapi',
  '@nestjs/core': 'NestJS',
  'restify': 'Restify',
  'socket.io': 'Socket.IO',
  grpc: 'gRPC',
  '@trpc/server': 'tRPC',
  hono: 'Hono',
  'nitropack': 'Nitro',
  'aws-cdk-lib': 'AWS CDK',
  serverless: 'Serverless',
  'firebase-admin': 'Firebase Admin',
};

const DATABASE_LIBS: Record<string, string> = {
  pg: 'PostgreSQL',
  postgres: 'PostgreSQL',
  'pg-promise': 'PostgreSQL',
  mongoose: 'MongoDB',
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  mysql2: 'MySQL',
  mariadb: 'MariaDB',
  'better-sqlite3': 'SQLite',
  sqlite3: 'SQLite',
  sequelize: 'Sequelize ORM',
  prisma: 'Prisma ORM',
  typeorm: 'TypeORM',
  drizzle: 'Drizzle ORM',
  knex: 'Knex',
  ioredis: 'Redis',
  redis: 'Redis',
  '@prisma/client': 'Prisma',
  '@mikro-orm/core': 'MikroORM',
  'firebase-admin': 'Firebase Firestore',
  'cassandra-driver': 'Cassandra',
  neo4j: 'Neo4j',
  'aws-sdk': 'AWS DynamoDB',
  '@aws-sdk/client-dynamodb': 'AWS DynamoDB',
  supabase: 'Supabase',
  '@supabase/supabase-js': 'Supabase',
  '@planetscale/database': 'PlanetScale',
  sqlite: 'SQLite',
  '@electric-sql/pglite': 'PGLite',
  'electron-builder': 'SQLite',
};

const TESTING_LIBS: Record<string, string> = {
  jest: 'Jest',
  vitest: 'Vitest',
  mocha: 'Mocha',
  jasmine: 'Jasmine',
  ava: 'AVA',
  cypress: 'Cypress',
  playwright: 'Playwright',
  puppeteer: 'Puppeteer',
  'testing-library__dom': 'Testing Library',
  'testing-library__react': 'React Testing Library',
  'testing-library__vue': 'Vue Testing Library',
  sinon: 'Sinon',
  chai: 'Chai',
  expect: 'Expect',
  supertest: 'SuperTest',
  enzyme: 'Enzyme',
  nyc: 'NYC',
  istanbul: 'Istanbul',
  karma: 'Karma',
  'ts-jest': 'ts-jest',
  '@playwright/test': 'Playwright',
  '@vue/test-utils': 'Vue Test Utils',
  '@testing-library/jest-dom': 'Jest DOM',
};

const DEVTOOLS: Record<string, string> = {
  typescript: 'TypeScript',
  webpack: 'Webpack',
  vite: 'Vite',
  rollup: 'Rollup',
  esbuild: 'esbuild',
  swc: 'SWC',
  babel: 'Babel',
  '@babel/core': 'Babel',
  eslint: 'ESLint',
  prettier: 'Prettier',
  husky: 'Husky',
  'lint-staged': 'Lint Staged',
  commitlint: 'Commitlint',
  '@commitlint/cli': 'Commitlint',
  biome: 'Biome',
  parcel: 'Parcel',
  turborepo: 'Turborepo',
  '@changesets/cli': 'Changesets',
  lerna: 'Lerna',
  nx: 'Nx',
};

const CONFIG_FILE_PATTERNS: Record<string, string[]> = {
  'vite.config.ts': ['Vite'],
  'vite.config.js': ['Vite'],
  'next.config.js': ['Next.js'],
  'next.config.mjs': ['Next.js'],
  'next.config.ts': ['Next.js'],
  'nuxt.config.ts': ['Nuxt'],
  'nuxt.config.js': ['Nuxt'],
  'angular.json': ['Angular'],
  'svelte.config.js': ['Svelte'],
  'remix.config.js': ['Remix'],
  'tsconfig.json': ['TypeScript'],
  'webpack.config.js': ['Webpack'],
  'babel.config.js': ['Babel'],
  'babel.config.json': ['Babel'],
  '.babelrc': ['Babel'],
  'jest.config.js': ['Jest'],
  'jest.config.ts': ['Jest'],
  'vitest.config.ts': ['Vitest'],
  'vitest.config.js': ['Vitest'],
  'tailwind.config.js': ['Tailwind CSS'],
  'tailwind.config.ts': ['Tailwind CSS'],
  'postcss.config.js': ['PostCSS'],
  'prettier.config.js': ['Prettier'],
  '.prettierrc': ['Prettier'],
  '.eslintrc': ['ESLint'],
  '.eslintrc.js': ['ESLint'],
  '.eslintrc.json': ['ESLint'],
  'eslint.config.js': ['ESLint'],
  'biome.json': ['Biome'],
  'rollup.config.js': ['Rollup'],
  'cypress.config.ts': ['Cypress'],
  'cypress.config.js': ['Cypress'],
  'playwright.config.ts': ['Playwright'],
  'playwright.config.js': ['Playwright'],
  '.swcrc': ['SWC'],
  'nx.json': ['Nx'],
  'turbo.json': ['Turborepo'],
};

const FRAMEWORK_PATTERNS: Record<string, string[]> = {
  react: ['React'],
  'react-dom': ['React'],
  'next': ['Next.js'],
  vue: ['Vue'],
  'vue-router': ['Vue'],
  nuxt: ['Nuxt'],
  '@angular/core': ['Angular'],
  svelte: ['Svelte'],
  'solid-js': ['Solid'],
  preact: ['Preact'],
  lit: ['Lit'],
  express: ['Express'],
  fastify: ['Fastify'],
  koa: ['Koa'],
  '@nestjs/core': ['NestJS'],
  hapi: ['Hapi'],
  hono: ['Hono'],
  remixed: ['Remix'],
  '@remix-run/node': ['Remix'],
};

const LANGUAGE_PATTERNS: Record<string, string[]> = {
  typescript: ['TypeScript'],
  '@babel/preset-typescript': ['TypeScript'],
  python: ['Python'],
  'requirements.txt': ['Python'],
  ruby: ['Ruby'],
  'Gemfile': ['Ruby'],
  golang: ['Go'],
  'go.mod': ['Go'],
  java: ['Java'],
  'pom.xml': ['Java'],
  rust: ['Rust'],
  'Cargo.toml': ['Rust'],
};

async function detectFromPackageJson(projectPath: string): Promise<TechStackInfo> {
  const result: TechStackInfo = {
    frontend: [],
    backend: [],
    database: [],
    testing: [],
    devtools: [],
    language: [],
    framework: [],
  };

  const packageJsonPath = join(projectPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return result;
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(content);

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [dep] of Object.entries(allDeps)) {
      if (dep in FRONTEND_LIBS) {
        const name = FRONTEND_LIBS[dep];
        if (name && !result.frontend.includes(name)) {
          result.frontend.push(name);
        }
      }

      if (dep in BACKEND_LIBS) {
        const name = BACKEND_LIBS[dep];
        if (name && !result.backend.includes(name)) {
          result.backend.push(name);
        }
      }

      if (dep in DATABASE_LIBS) {
        const name = DATABASE_LIBS[dep];
        if (name && !result.database.includes(name)) {
          result.database.push(name);
        }
      }

      if (dep in TESTING_LIBS) {
        const name = TESTING_LIBS[dep];
        if (name && !result.testing.includes(name)) {
          result.testing.push(name);
        }
      }

      if (dep in DEVTOOLS) {
        const name = DEVTOOLS[dep];
        if (name && !result.devtools.includes(name)) {
          result.devtools.push(name);
        }
      }

      if (dep in FRAMEWORK_PATTERNS) {
        const names = FRAMEWORK_PATTERNS[dep];
        if (names) {
          for (const name of names) {
            if (!result.framework.includes(name)) {
              result.framework.push(name);
            }
          }
        }
      }

      if (dep in LANGUAGE_PATTERNS) {
        const names = LANGUAGE_PATTERNS[dep];
        if (names) {
          for (const name of names) {
            if (!result.language.includes(name)) {
              result.language.push(name);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to parse package.json');
  }

  return result;
}

async function detectFromConfigFiles(projectPath: string, techStack: TechStackInfo): Promise<void> {
  for (const [configFile, detections] of Object.entries(CONFIG_FILE_PATTERNS)) {
    const configPath = join(projectPath, configFile);
    if (existsSync(configPath)) {
      for (const detection of detections) {
        if (
          !techStack.devtools.includes(detection) &&
          !techStack.framework.includes(detection)
        ) {
          techStack.devtools.push(detection);
        }
      }
    }
  }

  const tsConfigPath = join(projectPath, 'tsconfig.json');
  if (existsSync(tsConfigPath) && !techStack.language.includes('TypeScript')) {
    techStack.language.push('TypeScript');
  }

  const jsConfigPath = join(projectPath, 'jsconfig.json');
  if (existsSync(jsConfigPath) && !techStack.language.includes('JavaScript')) {
    techStack.language.push('JavaScript');
  }

  const requirementsPath = join(projectPath, 'requirements.txt');
  if (existsSync(requirementsPath) && !techStack.language.includes('Python')) {
    techStack.language.push('Python');
  }

  const goModPath = join(projectPath, 'go.mod');
  if (existsSync(goModPath) && !techStack.language.includes('Go')) {
    techStack.language.push('Go');
  }

  const cargoTomlPath = join(projectPath, 'Cargo.toml');
  if (existsSync(cargoTomlPath) && !techStack.language.includes('Rust')) {
    techStack.language.push('Rust');
  }

  if (techStack.language.length === 0) {
    techStack.language.push('Unknown');
  }

  if (techStack.frontend.length === 0 && techStack.backend.length === 0) {
    techStack.frontend.push('Unknown');
  }
}

export {
  detectFromPackageJson,
  detectFromConfigFiles,
};
