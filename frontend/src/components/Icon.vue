<!-- one icon set for the whole app: Lucide (ISC licence, lucide.dev), same stroke and size everywhere.
     <Icon name="folder" /> · <Icon name="trash" :size="14" /> · names are ours, so swapping the set means editing one map -->
<template>
  <component :is="cmp" class="ico" :size="size" :stroke-width="stroke" aria-hidden="true" />
</template>

<script setup>
import { computed } from 'vue';
import {
  TriangleAlert, ClipboardList, Copy, File, FileText, FileCode, FileImage, FileVideo, FileAudio, FileArchive, FileLock,
  Folder, FolderOpen, Zap, Trash2, Lock, LockKeyhole, Palette, Package, ChartColumn, X, Upload, Download, Scissors,
  Pencil, Link, Check, Settings, Monitor, Server, HardDrive, Menu, ArrowLeft, ArrowRight, ArrowUp, Search, RefreshCw,
  Cloud, Database, Globe, House, Star, Clock, ScrollText, Info, Eye, EyeOff, KeyRound, Activity, Plus, Terminal, Shield,
} from 'lucide-vue-next';

const props = defineProps({ name: { type: String, required: true }, size: { type: Number, default: 16 }, stroke: { type: Number, default: 1.75 } });
const MAP = {
  warn: TriangleAlert, list: ClipboardList, copy: Copy, file: File, text: FileText, code: FileCode, image: FileImage,
  video: FileVideo, audio: FileAudio, archive: FileArchive, secret: FileLock, folder: Folder, 'folder-open': FolderOpen,
  zap: Zap, trash: Trash2, lock: Lock, 'lock-key': LockKeyhole, palette: Palette, package: Package, chart: ChartColumn,
  x: X, upload: Upload, download: Download, cut: Scissors, edit: Pencil, link: Link, check: Check, settings: Settings,
  monitor: Monitor, server: Server, disk: HardDrive, menu: Menu, back: ArrowLeft, forward: ArrowRight, up: ArrowUp,
  search: Search, refresh: RefreshCw, cloud: Cloud, database: Database, globe: Globe, home: House, star: Star,
  clock: Clock, log: ScrollText, info: Info, eye: Eye, 'eye-off': EyeOff, key: KeyRound, activity: Activity, plus: Plus,
  terminal: Terminal, shield: Shield,
};
const cmp = computed(() => MAP[props.name] || File);
</script>

<style scoped>
.ico { display: inline-block; vertical-align: -0.18em; flex: none; }
</style>
