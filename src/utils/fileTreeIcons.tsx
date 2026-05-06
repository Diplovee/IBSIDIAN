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
  ts: typescriptIcon,
  tsx: reactIcon,
  js: javascriptIcon,
  jsx: reactIcon,
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
