//=======================================
// Modal component for deleting of itmes
//=======================================
import { useState } from "react";

interface ConfirmDeleteModalProps {
  title?: string;
  message?: string;
  onConfirm: () => void;
  buttonLabel?: string;
  buttonClass?: string;
}

// Set Button apperance first
export default function ConfirmDeleteModal({
  title = "Confirm Delete",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  onConfirm,
  buttonLabel = "Delete",
  buttonClass = "btn btn-xs btn-warning btn-outline",
}: ConfirmDeleteModalProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setOpen(false);
  };

  // Set Button Modal dialog
  return (
    <>
      {/* Trigger button */}
      <button className={buttonClass} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>

      {/* Modal */}
      {open && (
        <dialog className="modal modal-open text-center">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{title}</h3>

            <p className="py-3 whitespace-pre-line">
              {message}
            </p>

            <div className="modal-action place-content-center">
              <button
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>

              <button
                className="btn btn-warning"
                onClick={handleConfirm}
              >
                Confirm Delete
              </button>
            </div>
          </div>

          <div
            className="modal-backdrop"
            onClick={() => setOpen(false)}
          ></div>
        </dialog>
      )}
    </>
  );
}
