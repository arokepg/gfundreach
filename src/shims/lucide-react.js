// Temporary shim for any lingering or third-party lucide-react imports.
// We re-export a minimal subset using Material UI icons to avoid build/runtime failures.
// Note: If a named symbol isn't listed here and someone tries to import it,
// Vite will error at build time. That’s intentional so we can add a proper mapping.

// Set default export to Close to act as a harmless fallback component
export { default } from '@mui/icons-material/Close';

// Commonly used replacements. Add more mappings here only if needed.
export { default as X } from '@mui/icons-material/Close';
export { default as Download } from '@mui/icons-material/Download';
export { default as Save } from '@mui/icons-material/Save';
export { default as MessageSquare } from '@mui/icons-material/ChatBubbleOutlineOutlined';
export { default as Info } from '@mui/icons-material/InfoOutlined';
