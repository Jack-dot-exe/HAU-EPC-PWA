interface PdfPreviewModalProps {
  open: boolean;
  title?: string;
  previewUrl?: string | null;
  loading?: boolean;
  downloading?: boolean;
  error?: string | null;
  onClose: () => void;
  onDownload: () => void | Promise<void>;
}

export default function PdfPreviewModal({
  open,
  title = "PDF Preview",
  previewUrl,
  loading = false,
  downloading = false,
  error,
  onClose,
  onDownload,
}: PdfPreviewModalProps) {
  return (
    <dialog className={`modal ${open ? "modal-open" : ""}`}>
      <div className="modal-box max-w-7xl p-0">
        <div className="px-4 py-4">
          {loading ? (
            <div className="flex min-h-75 items-center justify-center">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : error ? (
            <div className="alert alert-error min-h-40">
              <span>{error}</span>
            </div>
          ) : previewUrl ? (
            <iframe
              title={title}
              src={previewUrl}
              className="h-[85vh] w-full rounded-box border border-base-300 bg-base-100"
            />
          ) : (
            <div className="alert min-h-40">
              <span>No PDF preview available.</span>
            </div>
          )}
        </div>

        <div className="modal-action mt-0 border-t border-base-300 px-6 py-4">
          <button
            className="btn btn-neutral"
            disabled={loading || downloading || !!error || !previewUrl}
            onClick={() => void onDownload()}
          >
            {downloading ? "Downloading..." : "Download PDF"}
          </button>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
