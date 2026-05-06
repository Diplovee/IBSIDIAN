import React from 'react';

import defaultFileIcon from 'material-icon-theme/icons/file.svg';
import markdownIcon from 'material-icon-theme/icons/markdown.svg';
import typescriptIcon from 'material-icon-theme/icons/typescript.svg';
import javascriptIcon from 'material-icon-theme/icons/javascript.svg';
import reactIcon from 'material-icon-theme/icons/react.svg';
import jsonIcon from 'material-icon-theme/icons/json.svg';
import yamlIcon from 'material-icon-theme/icons/yaml.svg';
import tomlIcon from 'material-icon-theme/icons/toml.svg';
import htmlIcon from 'material-icon-theme/icons/html.svg';
import cssIcon from 'material-icon-theme/icons/css.svg';
import sassIcon from 'material-icon-theme/icons/sass.svg';
import pythonIcon from 'material-icon-theme/icons/python.svg';
import rustIcon from 'material-icon-theme/icons/rust.svg';
import goIcon from 'material-icon-theme/icons/go.svg';
import dockerIcon from 'material-icon-theme/icons/docker.svg';
import nodejsIcon from 'material-icon-theme/icons/nodejs.svg';
import bunIcon from 'material-icon-theme/icons/bun.svg';
import readmeIcon from 'material-icon-theme/icons/readme.svg';
import licenseIcon from 'material-icon-theme/icons/license.svg';
import viteIcon from 'material-icon-theme/icons/vite.svg';
import imageIcon from 'material-icon-theme/icons/image.svg';
import tuneIcon from 'material-icon-theme/icons/tune.svg';
import folderBaseIcon from 'material-icon-theme/icons/folder-base.svg';
import folderBaseOpenIcon from 'material-icon-theme/icons/folder-base-open.svg';
import folderSrcIcon from 'material-icon-theme/icons/folder-src.svg';
import folderSrcOpenIcon from 'material-icon-theme/icons/folder-src-open.svg';
import folderComponentsIcon from 'material-icon-theme/icons/folder-components.svg';
import folderComponentsOpenIcon from 'material-icon-theme/icons/folder-components-open.svg';
import folderPublicIcon from 'material-icon-theme/icons/folder-public.svg';
import folderPublicOpenIcon from 'material-icon-theme/icons/folder-public-open.svg';
import folderNodeIcon from 'material-icon-theme/icons/folder-node.svg';
import folderNodeOpenIcon from 'material-icon-theme/icons/folder-node-open.svg';
import folderGitIcon from 'material-icon-theme/icons/folder-git.svg';
import folderGitOpenIcon from 'material-icon-theme/icons/folder-git-open.svg';
import applescriptIcon from 'material-icon-theme/icons/applescript.svg';
import babelIcon from 'material-icon-theme/icons/babel.svg';
import coffeeIcon from 'material-icon-theme/icons/coffee.svg';
import cIcon from 'material-icon-theme/icons/c.svg';
import cppIcon from 'material-icon-theme/icons/cpp.svg';
import editorconfigIcon from 'material-icon-theme/icons/editorconfig.svg';
import ejsIcon from 'material-icon-theme/icons/ejs.svg';
import eslintIcon from 'material-icon-theme/icons/eslint.svg';
import flowIcon from 'material-icon-theme/icons/flow.svg';
import gradleIcon from 'material-icon-theme/icons/gradle.svg';
import graphcoolIcon from 'material-icon-theme/icons/graphcool.svg';
import handlebarsIcon from 'material-icon-theme/icons/handlebars.svg';
import hIcon from 'material-icon-theme/icons/h.svg';
import jarIcon from 'material-icon-theme/icons/jar.svg';
import javaIcon from 'material-icon-theme/icons/java.svg';
import kotlinIcon from 'material-icon-theme/icons/kotlin.svg';
import lockIcon from 'material-icon-theme/icons/lock.svg';
import nixIcon from 'material-icon-theme/icons/nix.svg';
import prettierIcon from 'material-icon-theme/icons/prettier.svg';
import processingIcon from 'material-icon-theme/icons/processing.svg';
import databaseIcon from 'material-icon-theme/icons/database.svg';
import swiftIcon from 'material-icon-theme/icons/swift.svg';
import xmlIcon from 'material-icon-theme/icons/xml.svg';
import webassemblyIcon from 'material-icon-theme/icons/webassembly.svg';
import zipIcon from 'material-icon-theme/icons/zip.svg';
import documentIcon from 'material-icon-theme/icons/document.svg';
import javascriptMapIcon from 'material-icon-theme/icons/javascript-map.svg';
import settingsIcon from 'material-icon-theme/icons/settings.svg';
import folderIcon from 'material-icon-theme/icons/folder.svg';

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);

const fileNameIcons: Record<string, string> = {
  'package.json': nodejsIcon,
  'package-lock.json': nodejsIcon,
  'bun.lock': bunIcon,
  'bun.lockb': bunIcon,
  'bunfig.toml': bunIcon,
  'tsconfig.json': typescriptIcon,
  'vite.config.ts': viteIcon,
  'vite.config.js': viteIcon,
  'dockerfile': dockerIcon,
  '.gitignore': nodejsIcon,
  'readme.md': readmeIcon,
  'license': licenseIcon,
  'licence': licenseIcon,
  'license.md': licenseIcon,
  'licence.md': licenseIcon,
};

const extensionIcons: Record<string, string> = {
  md: markdownIcon,
  markdown: markdownIcon,
  ts: typescriptIcon,
  tsx: reactIcon,
  mts: typescriptIcon,
  js: javascriptIcon,
  jsx: reactIcon,
  mjs: javascriptIcon,
  cjs: javascriptIcon,
  json: jsonIcon,
  yml: yamlIcon,
  yaml: yamlIcon,
  toml: tomlIcon,
  html: htmlIcon,
  css: cssIcon,
  scss: sassIcon,
  sass: sassIcon,
  py: pythonIcon,
  rs: rustIcon,
  go: goIcon,
  png: imageIcon,
  jpg: imageIcon,
  jpeg: imageIcon,
  gif: imageIcon,
  webp: imageIcon,
  svg: imageIcon,
  bmp: imageIcon,
  ico: imageIcon,
  avif: imageIcon,
  // Additional extensions
  c: cIcon,
  cc: cIcon,
  cpp: cppIcon,
  h: hIcon,
  java: javaIcon,
  jar: jarIcon,
  kt: kotlinIcon,
  swift: swiftIcon,
  coffee: coffeeIcon,
  csv: databaseIcon,
  sql: databaseIcon,
  xml: xmlIcon,
  lock: lockIcon,
  eslintrc: eslintIcon,
  eslintignore: eslintIcon,
  eslintcache: eslintIcon,
  prettierrc: prettierIcon,
  editorconfig: editorconfigIcon,
  nix: nixIcon,
  gradle: gradleIcon,
  flow: flowIcon,
  ejs: ejsIcon,
  hbs: handlebarsIcon,
  babelrc: babelIcon,
  applescript: applescriptIcon,
  wasm: webassemblyIcon,
  gyp: gradleIcon,
  gypi: gradleIcon,
  gz: zipIcon,
  tar: zipIcon,
  txt: documentIcon,
  list: documentIcon,
  map: javascriptMapIcon,
  properties: settingsIcon,
  podspec: swiftIcon,
  m: cIcon,
  info: documentIcon,
  sample: documentIcon,
  example: documentIcon,
  local: databaseIcon,
  opts: settingsIcon,
  pack: jarIcon,
  pegjs: javascriptIcon,
  rev: documentIcon,
  scandir: folderIcon,
  stat: documentIcon,
  walk: documentIcon,
  mailmap: documentIcon,
  iml: javaIcon,
  idx: javascriptIcon,
  npmignore: eslintIcon,
  nycrc: eslintIcon,
  pro: processingIcon,
  bnf: documentIcon,
  bare: documentIcon,
  bplist: xmlIcon,
  br: documentIcon,
  bsd: documentIcon,
  42: documentIcon,
  apache2: lockIcon,
};

const folderIcons: Record<string, { closed: string; open: string }> = {
  src: { closed: folderSrcIcon, open: folderSrcOpenIcon },
  components: { closed: folderComponentsIcon, open: folderComponentsOpenIcon },
  public: { closed: folderPublicIcon, open: folderPublicOpenIcon },
  'node_modules': { closed: folderNodeIcon, open: folderNodeOpenIcon },
  '.git': { closed: folderGitIcon, open: folderGitOpenIcon },
};

const imgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block',
};

const getEnvIconStyle = (fileName: string): React.CSSProperties | undefined => {
  const normalized = normalize(fileName);
  if (!normalized.startsWith('.env')) return undefined;
  if (normalized === '.env.production') return { filter: 'hue-rotate(320deg) saturate(1.4)' };
  if (normalized === '.env.development') return { filter: 'hue-rotate(120deg) saturate(1.1)' };
  if (normalized === '.env.test') return { filter: 'hue-rotate(220deg) saturate(1.1)' };
  if (normalized === '.env.example') return { opacity: 0.6, filter: 'saturate(0.8)' };
  if (normalized === '.env.local') return { filter: 'saturate(1.05)' };
  return undefined;
};

const normalize = (value: string) => value.toLowerCase();

export const renderMaterialFileIcon = (fileName: string, size: number) => {
  const normalizedName = normalize(fileName);
  const ext = fileName.includes('.') ? normalize(fileName.split('.').pop() || '') : '';
  const envIconStyle = getEnvIconStyle(fileName);
  const src = normalizedName.startsWith('.env')
    ? tuneIcon
    : fileNameIcons[normalizedName]
      ?? extensionIcons[ext]
      ?? (imageExtensions.has(ext) ? imageIcon : defaultFileIcon);

  return <img src={src} alt="" aria-hidden width={size} height={size} style={{ ...imgStyle, ...envIconStyle }} draggable={false} />;
};

export const renderMaterialFolderIcon = (folderName: string, isOpen: boolean, size: number) => {
  const normalizedName = normalize(folderName);
  const iconSet = folderIcons[normalizedName] ?? { closed: folderBaseIcon, open: folderBaseOpenIcon };
  const src = isOpen ? iconSet.open : iconSet.closed;
  return <img src={src} alt="" aria-hidden width={size} height={size} style={imgStyle} draggable={false} />;
};
