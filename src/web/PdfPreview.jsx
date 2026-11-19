import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfPreview({ file }) {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ status: 'loading', page: 1, pages: 0, error: '' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [file]);

  useEffect(() => {
    if (!file) {
      return undefined;
    }

    let cancelled = false;
    let pdf = null;
    let renderTask = null;

    setState((current) => ({ ...current, status: 'loading', error: '' }));

    async function renderPdf() {
      try {
        const data = await file.arrayBuffer();
        pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        const currentPage = Math.min(page, pdf.numPages);
        const pdfPage = await pdf.getPage(currentPage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = pdfPage.getViewport({ scale: 1.5 });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const context = canvas.getContext('2d');

        renderTask = pdfPage.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (cancelled) return;

        setState({ status: 'ready', page: currentPage, pages: pdf.numPages, error: '' });
      } catch (renderError) {
        if (!cancelled) {
          setState({
            status: 'error',
            page,
            pages: 0,
            error: renderError.message || 'This PDF could not be displayed.',
          });
        }
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
      pdf?.destroy?.();
    };
  }, [file, page]);

  if (state.status === 'error') {
    return <span className="paper-empty">{state.error}</span>;
  }

  return (
    <div className="pdf-preview">
      <canvas ref={canvasRef} className="pdf-canvas" aria-label="PDF preview" />
      {state.status === 'loading' && <span className="paper-empty">Rendering PDF...</span>}
      {state.status === 'ready' && state.pages > 0 && (
        <div className="pdf-preview-bar">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={state.page <= 1}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span>
            {state.page} / {state.pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(state.pages, value + 1))}
            disabled={state.page >= state.pages}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
