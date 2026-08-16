let markdownLibPromise;

const loadMarkdownLibs = () => {
  if (!markdownLibPromise) {
    markdownLibPromise = Promise.all([import('snarkdown'), import('xss')]).then(
      ([snarkdownModule, xssModule]) => ({
        snarkdown: snarkdownModule.default || snarkdownModule,
        xss: xssModule.default || xssModule,
      })
    );
  }
  return markdownLibPromise;
};

export const sanitizeMarkdown = async (content) => {
  const { snarkdown, xss } = await loadMarkdownLibs();
  return xss(snarkdown(content || ''));
};
