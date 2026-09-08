import { createHash } from 'crypto';

// Class Central character limits
const MIN_CONTENT_LENGTH = 20;
const MAX_CONTENT_LENGTH = 20000;
// The head carries subject matter and keywords more often than the tail
const HEAD_RATIO = 0.7;

// Avoid slicing through a tag
const trimToLastTag = (html) => {
  const cutoff = html.lastIndexOf('>');
  return cutoff === -1 ? html : html.slice(0, cutoff + 1);
};

const trimToFirstTag = (html) => {
  const cutoff = html.indexOf('<');
  return cutoff === -1 ? html : html.slice(cutoff);
};

export const prepareContentForClassCentral = (post) => {
  const html = (post?.content?.html || '').trim();

  if (html.length < MIN_CONTENT_LENGTH) return null;
  if (html.length <= MAX_CONTENT_LENGTH) return html;

  const headBudget = Math.round(MAX_CONTENT_LENGTH * HEAD_RATIO);
  const tailBudget = MAX_CONTENT_LENGTH - headBudget;

  const head = trimToLastTag(html.slice(0, headBudget));
  const tail = trimToFirstTag(html.slice(-tailBudget));

  return `${head}\n${tail}`;
};

export const hashContent = (content) =>
  createHash('sha256').update(content).digest('hex');
