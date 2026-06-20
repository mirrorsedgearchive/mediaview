export const formatSize = (value) => {
  if (value === null || value === undefined) return '—';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
};

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const getBasename = (value) => {
  if (!value) return '';
  const parts = value.split('/');
  return parts[parts.length - 1] || '';
};

export const getDirname = (value) => {
  if (!value) return '';
  const parts = value.split('/');
  parts.pop();
  return parts.join('/');
};
