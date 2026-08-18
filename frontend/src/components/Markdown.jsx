import { Children } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CITATION_RE = /\[(\d+)\]/g;

function renderWithCitations(children, sources, onCitation) {
  const parts = [];
  Children.forEach(children, (child, i) => {
    if (typeof child !== 'string') {
      parts.push(<span key={i}>{child}</span>);
      return;
    }
    let lastIndex = 0;
    let match;
    const regex = new RegExp(CITATION_RE.source, 'g');
    while ((match = regex.exec(child)) !== null) {
      if (match.index > lastIndex) {
        parts.push(child.slice(lastIndex, match.index));
      }
      const idx = parseInt(match[1], 10) - 1;
      if (sources && sources[idx]) {
        parts.push(
          <button
            key={`c${i}-${match.index}`}
            className="citation"
            onClick={() => onCitation && onCitation(idx)}
            title={`Source ${idx + 1}: ${sources[idx].filename}`}
          >
            {match[0]}
          </button>
        );
      } else {
        parts.push(<sup key={`c${i}-${match.index}`}>{match[0]}</sup>);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < child.length) {
      parts.push(child.slice(lastIndex));
    }
  });
  return parts;
}

const textComponents = (sources, onCitation) => ({
  p: (props) => <p>{renderWithCitations(props.children, sources, onCitation)}</p>,
  li: (props) => <li>{renderWithCitations(props.children, sources, onCitation)}</li>,
  h1: (props) => <h1>{renderWithCitations(props.children, sources, onCitation)}</h1>,
  h2: (props) => <h2>{renderWithCitations(props.children, sources, onCitation)}</h2>,
  h3: (props) => <h3>{renderWithCitations(props.children, sources, onCitation)}</h3>,
  h4: (props) => <h4>{renderWithCitations(props.children, sources, onCitation)}</h4>,
  td: (props) => <td>{renderWithCitations(props.children, sources, onCitation)}</td>,
  th: (props) => <th>{renderWithCitations(props.children, sources, onCitation)}</th>,
  blockquote: (props) => (
    <blockquote>{renderWithCitations(props.children, sources, onCitation)}</blockquote>
  ),
});

export default function Markdown({ content, sources, onCitation }) {
  return (
    <div className="prose prose-slate max-w-none text-[0.925rem] leading-relaxed dark:prose-invert prose-p:my-2 prose-pre:overflow-x-auto prose-pre:bg-slate-900 prose-pre:text-slate-100 dark:prose-pre:bg-slate-950 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={textComponents(sources, onCitation)}>
        {content}
      </ReactMarkdown>
    </div>
  );
}