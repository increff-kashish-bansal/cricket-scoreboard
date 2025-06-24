import React from 'react';

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl p-0 w-full max-w-3xl max-h-screen overflow-y-auto relative animate-fadein flex flex-col">
        {/* Sticky header with title and close button */}
        <div className="sticky top-0 z-10 bg-white px-6 pt-6 pb-2 flex items-center justify-between border-b border-neutral-200 rounded-t-lg">
          {title && <div className="font-bold text-xl text-neutral-800">{title}</div>}
          <button
            className="text-neutral-500 hover:text-neutral-700 text-2xl ml-4"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="px-6 py-4 flex-1">{children}</div>
        {/* Bottom Close button */}
        <div className="px-6 pb-4 pt-2 flex justify-end border-t border-neutral-200 bg-white rounded-b-lg sticky bottom-0 z-10">
          <button
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors font-semibold"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal; 