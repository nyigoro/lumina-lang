type SiteContent = {
  homeCodeSampleHtml: string;
};

const loadSiteContent = async (): Promise<SiteContent> => {
  const response = await fetch(new URL('./site-content.json', document.baseURI));
  if (!response.ok) {
    throw new Error(`Failed to load site content: ${response.status}`);
  }
  return response.json() as Promise<SiteContent>;
};

export const mountHomeSample = async (): Promise<void> => {
  const element = document.getElementById('home-code-sample');
  if (!element) return;

  try {
    const content = await loadSiteContent();
    element.innerHTML = content.homeCodeSampleHtml;
  } catch (error) {
    console.error(error);
    element.textContent = 'Failed to load syntax-highlighted sample.';
  }
};
