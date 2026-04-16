// Three-app split: site (root), docs-site (/docs/), playground (/playground/)
// This index.tsx is only for the site app. Navigation to /docs/ or /playground/
// is handled by the browser and served by separate apps.

import { mountHomeSample } from './site-highlight';

void import('./main.lm').then(() => mountHomeSample());
